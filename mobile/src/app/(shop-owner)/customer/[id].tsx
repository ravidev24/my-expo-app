import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { AppShell } from '../../../components/app-shell';
import { DateField } from '../../../components/date-field';
import { DateRangeFilter } from '../../../components/date-range-filter';
import { HistoryList } from '../../../components/history-list';
import { BillScannerModal } from '../../../components/bill-scanner-modal';
import { RiskBadge } from '../../../components/risk-badge';
import { customerApi, paymentApi, purchaseApi } from '../../../services/api';
import { soundbox } from '../../../services/soundbox';
import { evaluateCustomerRisk } from '../../../lib/creditRisk';
import {
  balanceClass,
  buildHistory,
  filterHistoryByDateRange,
  formatMoney,
  todayInput,
} from '../../../lib/format';
import { body, card, heading, subtle } from '../../../lib/ui';
import { printCustomerStatementPdf } from '../../../lib/pdfReport';

type Customer = {
  _id: string;
  name: string;
  email: string;
  phone?: string;
  address?: string;
  outstandingBalance: number;
  totalPurchases: number;
  totalPayments: number;
  creditLimit?: number;
  promiseToPayDate?: string | null;
  promiseAmount?: number;
  riskCategory?: string;
  lastPaymentDate?: string | null;
  updatedAt?: string;
  createdAt?: string;
};

export default function CustomerAccountScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [shop, setShop] = useState<any>(null);
  const [purchases, setPurchases] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingItem, setSavingItem] = useState(false);
  const [savingPayment, setSavingPayment] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Date Range Filter State
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Add Item Fields
  const [itemDate, setItemDate] = useState(todayInput());
  const [itemName, setItemName] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [price, setPrice] = useState('');
  const [scannerOpen, setScannerOpen] = useState(false);
  const [showHighRiskWarning, setShowHighRiskWarning] = useState(false);

  // Payment Fields
  const [payDate, setPayDate] = useState(todayInput());
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState<'cash' | 'upi'>('cash');

  // Promise-to-Pay (PTP) Fields
  const [ptpDate, setPtpDate] = useState('');
  const [showPtpModal, setShowPtpModal] = useState(false);
  const [savingPtp, setSavingPtp] = useState(false);

  const load = async () => {
    if (!id) return;
    try {
      const [customerRes, purchaseRes, paymentRes] = await Promise.all([
        customerApi.getById(id),
        purchaseApi.getAll({ customerId: id, limit: 500 }),
        paymentApi.getAll({ customerId: id, limit: 500 }),
      ]);
      setCustomer(customerRes.customer);
      setShop(customerRes.shop || null);
      setPurchases(purchaseRes.purchases || []);
      setPayments(paymentRes.payments || []);
      if (customerRes.customer?.promiseToPayDate) {
        setPtpDate(customerRes.customer.promiseToPayDate.slice(0, 10));
      }
    } catch (err: any) {
      setError(err.message || 'Could not load customer');
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      load();
    }, [id])
  );

  const history = useMemo(() => buildHistory(purchases, payments), [purchases, payments]);

  // Date-filtered calculation
  const summary = useMemo(
    () => filterHistoryByDateRange(history, startDate, endDate),
    [history, startDate, endDate]
  );

  const risk = useMemo(() => (customer ? evaluateCustomerRisk(customer) : null), [customer]);

  const lineAmount = useMemo(() => {
    const qty = Number(quantity);
    const rate = Number(price);
    if (!qty || qty <= 0 || Number.isNaN(rate) || rate < 0) return 0;
    return Math.round(qty * rate * 100) / 100;
  }, [quantity, price]);

  const previousBalance = customer?.outstandingBalance || 0;
  const nextBalance = Math.round((previousBalance + lineAmount) * 100) / 100;
  const paymentValue = Number(payAmount) || 0;
  const balanceAfterPayment = Math.round((previousBalance - paymentValue) * 100) / 100;

  const handleDownloadPdf = async () => {
    if (!customer) return;
    try {
    await printCustomerStatementPdf({
      shop: {
        name: shop?.name || 'Digimart',
        phone: shop?.phone || '+91 63795 17503',
        address: shop?.address || '',
        upiId: shop?.upiId || '',
        currency: '₹',
      },
      customer: {
        name: customer.name,
        phone: customer.phone,
        email: customer.email,
        address: customer.address,
      },
      startDate: startDate || undefined,
      endDate: endDate || undefined,
      openingBalance: summary.openingBalance,
      periodPurchases: summary.periodPurchases,
      periodPayments: summary.periodPayments,
      closingBalance: summary.closingBalance,
      transactions: summary.filteredRows.map((row) => ({
        date: row.date,
        billNo: row.billNo || row.receiptNo,
        description:
          row.kind === 'purchase'
            ? row.items?.length
              ? row.items.map((i) => `${i.name} (${i.quantity}x)`).join(', ')
              : 'Store Purchase'
            : `Payment Received (${(row.paymentMethod || 'cash').toUpperCase()})`,
        debit: row.kind === 'purchase' ? row.delta : undefined,
        credit: row.kind === 'payment' ? Math.abs(row.delta) : undefined,
        runningBalance: row.balance,
        paymentMethod: row.paymentMethod,
      })),
    });
    } catch (err: any) {
      Alert.alert('Download failed', err.message || 'Could not download the PDF');
    }
  };

  const addItem = async (bypassRiskWarning = false) => {
    if (!id || !itemName.trim() || !itemDate) {
      setError('Date and item name are required');
      return;
    }
    if (lineAmount <= 0) {
      setError('Enter a quantity and price greater than 0');
      return;
    }

    // Check risk warning if high risk and not bypassed
    if (!bypassRiskWarning && risk?.level === 'high') {
      setShowHighRiskWarning(true);
      return;
    }

    setSavingItem(true);
    setError(null);
    setShowHighRiskWarning(false);
    try {
      await purchaseApi.create({
        customerId: id,
        date: itemDate,
        items: [{ name: itemName.trim(), quantity: Number(quantity), unit: 'pcs', unitPrice: Number(price) }],
      });
      soundbox.speakAnnouncement(`Added ${quantity} ${itemName.trim()} for ${customer?.name}.`);
      setItemName('');
      setQuantity('1');
      setPrice('');
      setItemDate(todayInput());
      setSuccessMsg(`✓ Added ${itemName} to ${customer?.name}'s account!`);
      await load();
    } catch (err: any) {
      setError(err.message || 'Could not add item');
    } finally {
      setSavingItem(false);
    }
  };

  const handleScannerItems = async (extractedItems: any[]) => {
    if (!id || extractedItems.length === 0) return;
    setSavingItem(true);
    try {
      await purchaseApi.create({
        customerId: id,
        date: itemDate,
        items: extractedItems,
        notes: 'AI Slip Scanner import',
      });
      soundbox.speakAnnouncement(`Recorded ${extractedItems.length} items for ${customer?.name}.`);
      setSuccessMsg(`✓ Added ${extractedItems.length} items from scanned bill!`);
      await load();
    } catch (err: any) {
      setError(err.message || 'Could not save scanned items');
    } finally {
      setSavingItem(false);
    }
  };

  const addPayment = async () => {
    if (!id || !payDate || paymentValue <= 0) {
      setError('Enter the payment date and amount');
      return;
    }
    setSavingPayment(true);
    setError(null);
    try {
      await paymentApi.record({
        customerId: id,
        amount: paymentValue,
        paymentMethod: payMethod,
        date: payDate,
      });
      soundbox.paymentReceived(paymentValue, customer?.name || 'Customer', payMethod);
      setPayAmount('');
      setPayDate(todayInput());
      setSuccessMsg(`✓ Received ${formatMoney(paymentValue)} payment!`);
      await load();
    } catch (err: any) {
      setError(err.message || 'Could not save payment');
    } finally {
      setSavingPayment(false);
    }
  };

  const savePromiseToPay = async () => {
    if (!id) return;
    setSavingPtp(true);
    try {
      await customerApi.update(id, {
        promiseToPayDate: ptpDate ? new Date(ptpDate) : null,
      });
      setShowPtpModal(false);
      setSuccessMsg('✓ Promise to pay date saved!');
      await load();
    } catch (err: any) {
      setError(err.message || 'Could not update promise date');
    } finally {
      setSavingPtp(false);
    }
  };

  // Share Statement & UPI Link via WhatsApp or Email
  const shareStatement = async () => {
    if (!customer || !id) return;
    const shopName = shop?.name || 'Digimart';
    const upiId = shop?.upiId || '';
    const senderContact = shop?.phone || '+91 63795 17503';
    const upiLink = upiId
      ? `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(shopName)}&am=${customer.outstandingBalance}&cu=INR`
      : '';

    let reasonNote = '';
    if (previousBalance > 2000 && isOverdueOneMonth) {
      reasonNote = 'Balance exceeds ₹2,000 & payment pending for over 1 month.';
    } else if (previousBalance > 2000) {
      reasonNote = 'Balance has exceeded ₹2,000.';
    } else if (isOverdueOneMonth) {
      reasonNote = 'No payment has been received in over 1 month.';
    }

    const qrImageUrl = upiLink
      ? `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(upiLink)}`
      : '';

    const message =
      `🙏 *Payment Reminder from ${shopName}*\n\n` +
      `Hello *${customer.name}*,\n` +
      `Your current outstanding balance is *₹${customer.outstandingBalance.toFixed(2)}*.\n` +
      (reasonNote ? `📌 *Note:* ${reasonNote}\n\n` : '\n') +
      (upiLink ? `💳 *Pay via UPI (GPay / PhonePe / Paytm):*\n${upiLink}\n\n` : '') +
      (qrImageUrl ? `🖼️ *Download QR Code Image:*\n${qrImageUrl}\n\n` : '') +
      `📱 *Shop UPI ID:* ${upiId || 'Not set'}\n` +
      `🏪 *Shop Sender Contact:* ${senderContact}\n\n` +
      `Thank you for shopping with us!`;

    // 1. Always trigger the automated backend Email & Push notification
    try {
      await customerApi.sendPaymentReminder(id, { reason: reasonNote });
    } catch {}

    // 2. If customer has a phone number -> Format +91 and open WhatsApp
    if (customer.phone && customer.phone.replace(/\D/g, '').length >= 10) {
      const rawDigits = customer.phone.replace(/\D/g, '');
      const clean10Digits = rawDigits.slice(-10);
      const whatsappUrl = `https://wa.me/91${clean10Digits}?text=${encodeURIComponent(message)}`;
      Linking.openURL(whatsappUrl).catch(() => {
        setSuccessMsg(`✓ Payment reminder & UPI link emailed to ${customer.email}!`);
      });
    } else {
      // Customer has NO WhatsApp number -> Notify on screen that email was sent with 1-click fallback
      setSuccessMsg(`✓ Payment reminder with UPI QR Code emailed to ${customer.email}!`);
      const mailUrl = `mailto:${customer.email}?subject=${encodeURIComponent(
        `Payment Reminder from ${shopName}`
      )}&body=${encodeURIComponent(message)}`;
      Linking.openURL(mailUrl).catch(() => {});
    }
  };

  const isOverdueOneMonth = useMemo(() => {
    if (previousBalance <= 0) return false;
    const now = Date.now();
    const lastTime = customer?.lastPaymentDate
      ? new Date(customer.lastPaymentDate).getTime()
      : customer?.createdAt
      ? new Date(customer.createdAt).getTime()
      : now;
    return now - lastTime > 30 * 24 * 60 * 60 * 1000;
  }, [previousBalance, customer]);

  return (
    <AppShell>
      {/* Back button and PDF export header */}
      <View className="flex-row items-center justify-between mb-3">
        <TouchableOpacity onPress={() => router.replace('/(shop-owner)/customers')} className="flex-row items-center gap-1">
          <Ionicons name="chevron-back" size={16} color="#059669" />
          <Text className="text-emerald-700 dark:text-emerald-300 font-bold">Customer list</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={handleDownloadPdf}
          className="flex-row items-center gap-1 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-300 dark:border-emerald-700/60 px-3 py-1.5 rounded-xl shadow-sm"
        >
          <Ionicons name="document-text-outline" size={14} color="#059669" />
          <Text className="text-emerald-700 dark:text-emerald-300 text-xs font-black">Download PDF</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator color="#34d399" className="my-8" />
      ) : (
        <>
          {/* Customer Header & Risk Badge */}
          <View className="flex-row items-center justify-between mb-1">
            <Text className="text-slate-900 dark:text-white text-2xl font-black">{customer?.name}</Text>
            {customer && <RiskBadge customer={customer} showReason />}
          </View>
          <Text className="text-slate-600 dark:text-slate-400 text-xs mb-3">
            {customer?.phone ? `📱 +91 ${customer.phone.replace(/\D/g, '').slice(-10)} · ` : ''}✉️ {customer?.email}
          </Text>

          {/* Khatabook Net Outstanding Balance Card */}
          <View className={`rounded-3xl p-5 mb-4 border border-slate-200 dark:border-white/10 ${card} shadow-sm`}>
            <View className="flex-row items-center justify-between">
              <Text className="text-xs font-bold text-slate-500 uppercase tracking-wider">Remaining balance</Text>
              {customer?.promiseToPayDate && (
                <View className="bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 rounded-lg flex-row items-center gap-1">
                  <Ionicons name="calendar" size={12} color="#f59e0b" />
                  <Text className="text-[10px] font-bold text-amber-700 dark:text-amber-300">
                    Promise: {customer.promiseToPayDate.slice(0, 10)}
                  </Text>
                </View>
              )}
            </View>

            <Text className={`text-4xl font-black mt-1 ${previousBalance > 0 ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
              {formatMoney(previousBalance)}
            </Text>

            {/* Status Alert Badges */}
            {previousBalance > 2000 && (
              <View className="bg-red-500/15 border border-red-500/30 px-3 py-1.5 rounded-xl flex-row items-center gap-1.5 my-1.5">
                <Ionicons name="alert-circle" size={15} color="#ef4444" />
                <Text className="text-red-700 dark:text-red-300 font-extrabold text-xs">
                  Balance exceeds ₹2,000 • Automated payment reminder & UPI link active
                </Text>
              </View>
            )}

            {isOverdueOneMonth && (
              <View className="bg-amber-500/15 border border-amber-500/30 px-3 py-1.5 rounded-xl flex-row items-center gap-1.5 my-1.5">
                <Ionicons name="time" size={15} color="#f59e0b" />
                <Text className="text-amber-800 dark:text-amber-200 font-extrabold text-xs">
                  No payment received in &gt; 1 month • Overdue reminder active
                </Text>
              </View>
            )}

            {/* Quick Action Buttons */}
            <View className="flex-row gap-2 mt-4 pt-3 border-t border-slate-200 dark:border-white/10">
              <TouchableOpacity
                onPress={shareStatement}
                className="flex-1 bg-emerald-600 rounded-xl py-2.5 flex-row items-center justify-center gap-1.5 shadow"
              >
                <Ionicons name={customer?.phone ? 'logo-whatsapp' : 'mail-outline'} size={16} color="#fff" />
                <Text className="text-white font-bold text-xs">
                  {customer?.phone ? 'WhatsApp Bill & UPI' : 'Email Statement'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setShowPtpModal(true)}
                className="bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-xl px-3 py-2.5 flex-row items-center gap-1"
              >
                <Ionicons name="time-outline" size={16} color="#64748b" />
                <Text className="text-slate-700 dark:text-slate-300 font-bold text-xs">Set Promise Date</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Date Range Filter with Quick Chips */}
          <DateRangeFilter
            startDate={startDate}
            endDate={endDate}
            onRangeChange={(s, e) => {
              setStartDate(s);
              setEndDate(e);
            }}
            onDownloadPdf={handleDownloadPdf}
            pdfButtonLabel="Download PDF"
            title="Ledger Date Filter"
          />

          {/* Khatabook Period Summary Metric Cards */}
          <View className="flex-row gap-2 mb-4">
            {startDate ? (
              <View className="flex-1 bg-slate-50 dark:bg-slate-900/60 p-3 rounded-2xl border border-slate-200 dark:border-white/10">
                <Text className="text-[10px] font-bold text-slate-500 uppercase">Opening Bal</Text>
                <Text className="text-sm font-black text-slate-800 dark:text-slate-200 mt-0.5">
                  {formatMoney(summary.openingBalance)}
                </Text>
              </View>
            ) : null}

            <View className="flex-1 bg-red-50/70 dark:bg-red-950/30 p-3 rounded-2xl border border-red-200 dark:border-red-900/40">
              <View className="flex-row items-center gap-1">
                <Ionicons name="arrow-up-circle" size={12} color="#dc2626" />
                <Text className="text-[10px] font-black text-red-700 dark:text-red-300 uppercase">You Gave (Udhaar)</Text>
              </View>
              <Text className="text-base font-black text-red-600 dark:text-red-400 mt-0.5">
                +{formatMoney(summary.periodPurchases)}
              </Text>
            </View>

            <View className="flex-1 bg-emerald-50/70 dark:bg-emerald-950/30 p-3 rounded-2xl border border-emerald-200 dark:border-emerald-900/40">
              <View className="flex-row items-center gap-1">
                <Ionicons name="arrow-down-circle" size={12} color="#16a34a" />
                <Text className="text-[10px] font-black text-emerald-700 dark:text-emerald-300 uppercase">You Got (Jama)</Text>
              </View>
              <Text className="text-base font-black text-emerald-600 dark:text-emerald-400 mt-0.5">
                -{formatMoney(summary.periodPayments)}
              </Text>
            </View>
          </View>

          {error && <Text className="text-red-600 text-xs mb-3">{error}</Text>}
          {successMsg && <Text className="text-emerald-600 font-bold text-xs mb-3">{successMsg}</Text>}

          {/* Add Item Box */}
          <View className={`rounded-3xl p-5 mb-4 border border-slate-200 dark:border-white/10 ${card}`}>
            <View className="flex-row items-center justify-between mb-3">
              <Text className="text-slate-900 dark:text-white text-lg font-black">Add item</Text>
              <TouchableOpacity
                onPress={() => setScannerOpen(true)}
                className="flex-row items-center gap-1 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-lg"
              >
                <Ionicons name="camera-outline" size={14} color="#10b981" />
                <Text className="text-xs font-bold text-emerald-700 dark:text-emerald-300">
                  AI Slip Scanner
                </Text>
              </TouchableOpacity>
            </View>

            <Text className="text-slate-500 text-[11px] font-bold mb-1">DATE</Text>
            <DateField value={itemDate} onChange={setItemDate} />

            <Text className="text-slate-500 text-[11px] font-bold mt-3 mb-1">ITEM NAME</Text>
            <TextInput
              value={itemName}
              onChangeText={setItemName}
              placeholder="e.g. Sugar / Rice / Coconut"
              placeholderTextColor="#94a3b8"
              className="bg-white dark:bg-slate-950/70 border border-slate-200 dark:border-white/15 rounded-xl text-slate-900 dark:text-white px-4 h-12 text-sm font-semibold"
            />

            <View className="flex-row gap-3 mt-3">
              <View className="flex-1">
                <Text className="text-slate-500 text-[11px] font-bold mb-1">QTY</Text>
                <TextInput
                  value={quantity}
                  onChangeText={setQuantity}
                  keyboardType="decimal-pad"
                  className="bg-white dark:bg-slate-950/70 border border-slate-200 dark:border-white/15 rounded-xl text-slate-900 dark:text-white px-4 h-12 text-sm font-semibold"
                />
              </View>
              <View className="flex-1">
                <Text className="text-slate-500 text-[11px] font-bold mb-1">PRICE (₹)</Text>
                <TextInput
                  value={price}
                  onChangeText={setPrice}
                  keyboardType="decimal-pad"
                  placeholder="35"
                  placeholderTextColor="#94a3b8"
                  className="bg-white dark:bg-slate-950/70 border border-slate-200 dark:border-white/15 rounded-xl text-slate-900 dark:text-white px-4 h-12 text-sm font-semibold"
                />
              </View>
            </View>

            <View className="bg-slate-100 dark:bg-slate-950/80 rounded-xl p-3 mt-3">
              <Text className="text-slate-600 dark:text-slate-300 text-xs">This item: {formatMoney(lineAmount)}</Text>
              <Text className={`font-black text-sm mt-0.5 ${balanceClass(nextBalance)}`}>
                New balance: {formatMoney(nextBalance)}
              </Text>
            </View>

            <TouchableOpacity
              onPress={() => addItem(false)}
              disabled={savingItem}
              className="bg-emerald-600 rounded-xl h-12 items-center justify-center mt-4 shadow"
            >
              {savingItem ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text className="text-white font-black text-sm">+ Add to account</Text>
              )}
            </TouchableOpacity>
          </View>

          {/* Record Payment Box */}
          <View className={`rounded-3xl p-5 mb-4 border border-slate-200 dark:border-white/10 ${card}`}>
            <View className="flex-row items-center justify-between mb-3">
              <Text className="text-slate-900 dark:text-white text-lg font-black">Record payment</Text>
              <View className="flex-row gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
                <TouchableOpacity
                  onPress={() => setPayMethod('cash')}
                  className={`px-3 py-1 rounded-lg ${payMethod === 'cash' ? 'bg-emerald-600' : ''}`}
                >
                  <Text
                    className={`text-xs font-bold ${
                      payMethod === 'cash' ? 'text-white' : 'text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    💵 Cash
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setPayMethod('upi')}
                  className={`px-3 py-1 rounded-lg ${payMethod === 'upi' ? 'bg-emerald-600' : ''}`}
                >
                  <Text
                    className={`text-xs font-bold ${
                      payMethod === 'upi' ? 'text-white' : 'text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    📱 UPI
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            <Text className="text-slate-500 text-[11px] font-bold mb-1">DATE PAID</Text>
            <DateField value={payDate} onChange={setPayDate} />

            <Text className="text-slate-500 text-[11px] font-bold mt-3 mb-1">AMOUNT PAID (₹)</Text>
            <TextInput
              value={payAmount}
              onChangeText={setPayAmount}
              keyboardType="decimal-pad"
              placeholder="0"
              placeholderTextColor="#94a3b8"
              className="bg-white dark:bg-slate-950/70 border border-slate-200 dark:border-white/15 rounded-xl text-slate-900 dark:text-white px-4 h-12 text-base font-bold"
            />

            <View className="bg-slate-100 dark:bg-slate-950/80 rounded-xl p-3 mt-3">
              <Text className="text-slate-600 dark:text-slate-300 text-xs">Remaining now: {formatMoney(previousBalance)}</Text>
              <Text className={`font-black text-sm mt-0.5 ${balanceClass(balanceAfterPayment)}`}>
                After payment: {formatMoney(balanceAfterPayment)}
              </Text>
            </View>

            <TouchableOpacity
              onPress={addPayment}
              disabled={savingPayment}
              className="bg-emerald-600 rounded-xl h-12 items-center justify-center mt-4 shadow"
            >
              {savingPayment ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text className="text-white font-black text-sm">Save payment</Text>
              )}
            </TouchableOpacity>
          </View>

          {/* Full Transaction History */}
          <View className="flex-row items-center justify-between mb-3">
            <View className="flex-row items-center gap-1.5">
              <Ionicons name="receipt-outline" size={18} color="#059669" />
              <Text className="text-slate-900 dark:text-white text-lg font-black">
                Account Ledger ({summary.filteredRows.length})
              </Text>
            </View>
            {(startDate || endDate) && (
              <Text className="text-emerald-700 dark:text-emerald-300 text-xs font-bold">
                {startDate || 'Start'} → {endDate || 'Today'}
              </Text>
            )}
          </View>
          <HistoryList rows={summary.filteredRows} />
        </>
      )}


      {/* Bill Scanner Modal */}
      <BillScannerModal
        visible={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onItemsExtracted={handleScannerItems}
      />

      {/* High Risk Warning Modal */}
      {showHighRiskWarning && (
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.7)', alignItems: 'center', justifyContent: 'center', padding: 20, zIndex: 60 }}>
          <View className="w-full max-w-sm bg-white dark:bg-slate-900 border border-red-500/50 rounded-3xl p-6 shadow-2xl">
            <View className="w-12 h-12 rounded-2xl bg-red-500/20 items-center justify-center mb-3">
              <Ionicons name="warning" size={26} color="#ef4444" />
            </View>
            <Text className="text-lg font-black text-slate-900 dark:text-white">
              Overdue Credit Warning!
            </Text>
            <Text className="text-xs text-slate-600 dark:text-slate-300 mt-2">
              {customer?.name} already has{' '}
              <Text className="font-bold text-red-600">{formatMoney(previousBalance)}</Text> in unpaid dues ({risk?.reason}).
            </Text>
            <Text className="text-xs text-slate-500 mt-2">
              Do you still want to approve adding more credit?
            </Text>
            <View className="flex-row gap-3 mt-5">
              <TouchableOpacity
                onPress={() => setShowHighRiskWarning(false)}
                className="flex-1 h-11 rounded-xl border border-slate-300 dark:border-white/15 items-center justify-center"
              >
                <Text className="font-bold text-slate-700 dark:text-slate-300 text-xs">Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => addItem(true)}
                className="flex-1 h-11 rounded-xl bg-red-600 items-center justify-center"
              >
                <Text className="text-white font-bold text-xs">Confirm & Add</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {/* Promise to Pay Date Modal */}
      {showPtpModal && (
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.7)', alignItems: 'center', justifyContent: 'center', padding: 20, zIndex: 60 }}>
          <View className="w-full max-w-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-3xl p-6">
            <Text className="text-lg font-black text-slate-900 dark:text-white mb-2">
              Schedule Promise to Pay
            </Text>
            <Text className="text-xs text-slate-500 mb-3">
              Set customer's committed payment due date.
            </Text>

            <DateField value={ptpDate || todayInput()} onChange={setPtpDate} />

            <View className="flex-row gap-3 mt-4">
              <TouchableOpacity
                onPress={() => setShowPtpModal(false)}
                className="flex-1 h-11 rounded-xl border border-slate-300 dark:border-white/15 items-center justify-center"
              >
                <Text className="font-bold text-slate-700 dark:text-slate-300">Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={savePromiseToPay}
                disabled={savingPtp}
                className="flex-1 h-11 rounded-xl bg-emerald-600 items-center justify-center"
              >
                {savingPtp ? <ActivityIndicator color="#fff" /> : <Text className="text-white font-bold">Save Date</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </AppShell>
  );
}
