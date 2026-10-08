import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useColorScheme } from 'nativewind';
import { AppShell } from '../../components/app-shell';
import { HistoryList } from '../../components/history-list';
import { DateRangeFilter } from '../../components/date-range-filter';
import { customerExpenseApi } from '../../services/api';
import {
  balanceClass,
  buildHistory,
  filterHistoryByDateRange,
  formatMoney,
} from '../../lib/format';
import { body, card, heading, subtle } from '../../lib/ui';
import { useAuth } from '../../context/AuthContext';
import { printCustomerStatementPdf } from '../../lib/pdfReport';

export default function CustomerHomeScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [balance, setBalance] = useState(0);
  const [shop, setShop] = useState<any>(null);
  const [purchases, setPurchases] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showQrModal, setShowQrModal] = useState(false);

  // Date Range Filter state
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Dynamic Payment Amount state
  const [customPayAmount, setCustomPayAmount] = useState<string>('');

  const load = async () => {
    try {
      const [overview, purchaseRes, paymentRes] = await Promise.all([
        customerExpenseApi.getOverview(),
        customerExpenseApi.getPurchases({ limit: 500 }),
        customerExpenseApi.getPayments({ limit: 500 }),
      ]);
      const currentBal = overview.profile?.outstandingBalance || 0;
      setBalance(currentBal);
      setCustomPayAmount(String(currentBal > 0 ? currentBal : ''));
      setShop(overview.shop || null);
      setPurchases(purchaseRes.purchases || []);
      setPayments(paymentRes.payments || []);
    } catch (err: any) {
      setError(err.message || 'Could not load your account');
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      load();
    }, [])
  );

  const history = useMemo(() => buildHistory(purchases, payments), [purchases, payments]);

  // Date-filtered calculation
  const summary = useMemo(
    () => filterHistoryByDateRange(history, startDate, endDate),
    [history, startDate, endDate]
  );

  const { colorScheme } = useColorScheme();
  const icon = colorScheme === 'light' ? '#334155' : '#e2e8f0';

  const shopName = shop?.name || 'Digimart';
  const upiId = shop?.upiId || 'shop@upi';

  // Dynamic amount calculation
  const parsedPayAmount = Number(customPayAmount);
  const effectivePayAmount = !isNaN(parsedPayAmount) && parsedPayAmount > 0 ? parsedPayAmount : balance;
  const remainingAfterPayment = Math.max(0, balance - effectivePayAmount);

  const upiPayLink = `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(shopName)}&am=${effectivePayAmount}&cu=INR`;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(upiPayLink)}`;

  const handlePayNow = () => {
    setCustomPayAmount(String(balance > 0 ? balance : ''));
    setShowQrModal(true);
  };

  const [downloadingQr, setDownloadingQr] = useState(false);

  const handleDownloadQr = async () => {
    setDownloadingQr(true);
    try {
      if (typeof window !== 'undefined' && typeof document !== 'undefined') {
        const res = await fetch(qrUrl);
        const blob = await res.blob();
        const blobUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = `${shopName.replace(/[^a-zA-Z0-9]/g, '_')}_QR_Rs${effectivePayAmount}.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(blobUrl);
        alert(`✓ QR Code for ₹${effectivePayAmount} saved to Gallery! Open GPay/PhonePe and select this image to pay.`);
      } else {
        Linking.openURL(qrUrl);
      }
    } catch {
      Linking.openURL(qrUrl);
    } finally {
      setDownloadingQr(false);
    }
  };

  const handleDownloadStatementPdf = async () => {
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
        name: user?.name || 'Valued Customer',
        phone: user?.phone || '',
        email: user?.email || '',
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

  return (
    <AppShell>
      {/* Header */}
      <View className="flex-row items-center justify-between mb-4">
        <View className="flex-row items-center gap-2">
          <Ionicons name="wallet-outline" size={24} color={icon} />
          <View>
            <Text className={`text-2xl font-black ${heading}`}>My Account</Text>
            <Text className="text-emerald-600 dark:text-emerald-400 text-xs font-bold">
              🏪 {shopName}
            </Text>
          </View>
        </View>

        <TouchableOpacity
          onPress={() => router.push('/profile')}
          className="flex-row items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-300 dark:border-emerald-700/50"
        >
          <Ionicons name="person-outline" size={14} color="#059669" />
          <Text className="text-emerald-700 dark:text-emerald-300 text-xs font-bold">Profile</Text>
        </TouchableOpacity>
      </View>

      {/* Missing Phone Number Prompt Banner */}
      {!user?.phone && (
        <TouchableOpacity
          onPress={() => router.push('/profile')}
          className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-3.5 mb-4 flex-row items-center gap-3"
        >
          <Ionicons name="call-outline" size={20} color="#f59e0b" />
          <View className="flex-1">
            <Text className="text-amber-800 dark:text-amber-300 text-xs font-bold">
              Add your Phone / WhatsApp Number
            </Text>
            <Text className="text-slate-600 dark:text-slate-400 text-[11px] mt-0.5">
              Receive bill receipts, statements, and WhatsApp payment links.
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color="#f59e0b" />
        </TouchableOpacity>
      )}

      {/* Khatabook Net Outstanding Balance Card */}
      <View className={`rounded-3xl p-5 mb-4 border border-slate-200 dark:border-white/10 ${card} shadow-sm`}>
        <View className="flex-row items-center justify-between">
          <Text className="text-xs font-bold text-slate-500 uppercase tracking-wider">
            Total Outstanding Balance
          </Text>
          <View className={`px-2 py-0.5 rounded-full ${balance > 0 ? 'bg-red-500/10' : 'bg-emerald-500/10'}`}>
            <Text className={`text-[10px] font-black uppercase ${balance > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
              {balance > 0 ? 'Due to Pay' : 'All Clear'}
            </Text>
          </View>
        </View>

        <Text className={`text-4xl font-black mt-1 ${balance > 0 ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
          {formatMoney(balance)}
        </Text>

        {/* Action Buttons */}
        <View className="flex-row gap-2 mt-4 pt-3 border-t border-slate-200 dark:border-white/10">
          {balance > 0 ? (
            <TouchableOpacity
              onPress={handlePayNow}
              className="flex-1 bg-emerald-600 active:bg-emerald-700 rounded-xl py-3 flex-row items-center justify-center gap-2 shadow"
            >
              <Ionicons name="phone-portrait-outline" size={18} color="#fff" />
              <Text className="text-white font-black text-sm">Pay / Custom Amount</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              onPress={handlePayNow}
              className="flex-1 bg-emerald-600/20 border border-emerald-500/30 rounded-xl py-3 flex-row items-center justify-center gap-2"
            >
              <Ionicons name="qr-code-outline" size={18} color="#059669" />
              <Text className="text-emerald-700 dark:text-emerald-300 font-black text-sm">Scan / Advance Pay</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            onPress={() => {
              setCustomPayAmount(String(balance > 0 ? balance : ''));
              setShowQrModal(true);
            }}
            className="bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-xl px-3.5 py-3 flex-row items-center justify-center"
          >
            <Ionicons name="qr-code-outline" size={18} color={icon} />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleDownloadStatementPdf}
            className="bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-xl px-3 py-3 flex-row items-center justify-center"
            accessibilityLabel="Download Statement PDF"
          >
            <Ionicons name="document-text-outline" size={18} color="#059669" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Date Range Filter with Quick Chips & PDF Export */}
      <DateRangeFilter
        startDate={startDate}
        endDate={endDate}
        onRangeChange={(s, e) => {
          setStartDate(s);
          setEndDate(e);
        }}
        onDownloadPdf={handleDownloadStatementPdf}
        pdfButtonLabel="Download PDF"
        title="Ledger Date Filter"
      />

      {/* Khatabook Period Summary Metrics Grid */}
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
            <Text className="text-[10px] font-black text-red-700 dark:text-red-300 uppercase">You Took (Gave)</Text>
          </View>
          <Text className="text-base font-black text-red-600 dark:text-red-400 mt-0.5">
            +{formatMoney(summary.periodPurchases)}
          </Text>
        </View>

        <View className="flex-1 bg-emerald-50/70 dark:bg-emerald-950/30 p-3 rounded-2xl border border-emerald-200 dark:border-emerald-900/40">
          <View className="flex-row items-center gap-1">
            <Ionicons name="arrow-down-circle" size={12} color="#16a34a" />
            <Text className="text-[10px] font-black text-emerald-700 dark:text-emerald-300 uppercase">You Paid (Got)</Text>
          </View>
          <Text className="text-base font-black text-emerald-600 dark:text-emerald-400 mt-0.5">
            -{formatMoney(summary.periodPayments)}
          </Text>
        </View>
      </View>

      {error && <Text className="text-red-700 dark:text-red-200 mb-3">{error}</Text>}

      {loading ? (
        <ActivityIndicator color="#34d399" className="my-8" />
      ) : (
        <>
          <View className="flex-row items-center justify-between mb-3">
            <View className="flex-row items-center gap-2">
              <Ionicons name="receipt-outline" size={18} color={icon} />
              <Text className={`text-lg font-black ${heading}`}>
                Transactions ({summary.filteredRows.length})
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


      {/* Dynamic UPI In-App Payment Modal for Customer */}
      {showQrModal && (
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.75)', alignItems: 'center', justifyContent: 'center', padding: 16, zIndex: 60 }}>
          <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', alignItems: 'center' }} style={{ width: '100%' }}>
            <View className="w-full max-w-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-3xl p-5 items-center shadow-2xl my-auto">
              {/* Modal Header */}
              <View className="flex-row items-center justify-between w-full mb-2">
                <View className="flex-row items-center gap-2">
                  <View className="w-8 h-8 rounded-xl bg-emerald-500/20 items-center justify-center">
                    <Ionicons name="storefront-outline" size={18} color="#10b981" />
                  </View>
                  <Text className="text-base font-black text-slate-900 dark:text-white" numberOfLines={1}>
                    Pay {shopName}
                  </Text>
                </View>
                <TouchableOpacity onPress={() => setShowQrModal(false)} className="p-1">
                  <Ionicons name="close-circle" size={22} color="#94a3b8" />
                </TouchableOpacity>
              </View>

              {/* Total Balance Info Banner */}
              <View className="w-full bg-slate-100 dark:bg-slate-800/80 rounded-xl px-3 py-2 flex-row justify-between items-center mb-3">
                <Text className="text-slate-500 text-xs font-semibold">Total Outstanding Due:</Text>
                <Text className="text-slate-900 dark:text-white font-black text-xs">{formatMoney(balance)}</Text>
              </View>

              {/* Dynamic Amount Input Box */}
              <View className="w-full bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-3.5 mb-3">
                <Text className="text-emerald-800 dark:text-emerald-300 font-extrabold text-[10px] uppercase tracking-wider mb-1">
                  ENTER AMOUNT TO PAY NOW (₹)
                </Text>
                <View className="flex-row items-center gap-1.5 bg-white dark:bg-slate-950 rounded-xl px-3 border border-emerald-500/40 h-11">
                  <Text className="text-emerald-700 dark:text-emerald-400 font-black text-lg">₹</Text>
                  <TextInput
                    value={customPayAmount}
                    onChangeText={setCustomPayAmount}
                    placeholder="Enter amount"
                    placeholderTextColor="#94a3b8"
                    keyboardType="numeric"
                    className="flex-1 font-black text-lg text-emerald-800 dark:text-emerald-300 h-11"
                  />
                  {customPayAmount !== String(balance) && (
                    <TouchableOpacity
                      onPress={() => setCustomPayAmount(String(balance))}
                      className="bg-emerald-100 dark:bg-emerald-900/50 px-2 py-1 rounded-lg"
                    >
                      <Text className="text-emerald-700 dark:text-emerald-300 text-[10px] font-extrabold">Full</Text>
                    </TouchableOpacity>
                  )}
                </View>

                {/* Quick Amount Suggestion Chips */}
                <View className="flex-row flex-wrap gap-1.5 mt-2">
                  <TouchableOpacity
                    onPress={() => setCustomPayAmount(String(balance))}
                    className={`px-2.5 py-1 rounded-lg border ${
                      customPayAmount === String(balance)
                        ? 'bg-emerald-600 border-emerald-600'
                        : 'bg-white dark:bg-slate-800 border-slate-300 dark:border-white/15'
                    }`}
                  >
                    <Text className={`text-[10px] font-bold ${customPayAmount === String(balance) ? 'text-white' : 'text-slate-700 dark:text-slate-300'}`}>
                      Full (₹{balance})
                    </Text>
                  </TouchableOpacity>

                  {balance > 500 && (
                    <TouchableOpacity
                      onPress={() => setCustomPayAmount('500')}
                      className={`px-2.5 py-1 rounded-lg border ${
                        customPayAmount === '500'
                          ? 'bg-emerald-600 border-emerald-600'
                          : 'bg-white dark:bg-slate-800 border-slate-300 dark:border-white/15'
                      }`}
                    >
                      <Text className={`text-[10px] font-bold ${customPayAmount === '500' ? 'text-white' : 'text-slate-700 dark:text-slate-300'}`}>
                        ₹500
                      </Text>
                    </TouchableOpacity>
                  )}

                  {balance > 1000 && (
                    <TouchableOpacity
                      onPress={() => setCustomPayAmount('1000')}
                      className={`px-2.5 py-1 rounded-lg border ${
                        customPayAmount === '1000'
                          ? 'bg-emerald-600 border-emerald-600'
                          : 'bg-white dark:bg-slate-800 border-slate-300 dark:border-white/15'
                      }`}
                    >
                      <Text className={`text-[10px] font-bold ${customPayAmount === '1000' ? 'text-white' : 'text-slate-700 dark:text-slate-300'}`}>
                        ₹1,000
                      </Text>
                    </TouchableOpacity>
                  )}

                  {balance > 1500 && (
                    <TouchableOpacity
                      onPress={() => setCustomPayAmount('1500')}
                      className={`px-2.5 py-1 rounded-lg border ${
                        customPayAmount === '1500'
                          ? 'bg-emerald-600 border-emerald-600'
                          : 'bg-white dark:bg-slate-800 border-slate-300 dark:border-white/15'
                      }`}
                    >
                      <Text className={`text-[10px] font-bold ${customPayAmount === '1500' ? 'text-white' : 'text-slate-700 dark:text-slate-300'}`}>
                        ₹1,500
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>

                {/* Remaining Balance Indicator */}
                <View className="flex-row justify-between items-center mt-2 pt-2 border-t border-emerald-500/20">
                  <Text className="text-slate-500 text-[11px] font-medium">Balance After Payment:</Text>
                  <Text className="text-slate-800 dark:text-slate-200 font-extrabold text-[11px]">
                    ₹{remainingAfterPayment.toFixed(2)}
                  </Text>
                </View>
              </View>

              {/* Dynamic QR Code Container */}
              <View className="bg-white p-2.5 rounded-2xl border-2 border-emerald-600 mb-2.5 items-center shadow-sm">
                <Image source={{ uri: qrUrl }} style={{ width: 170, height: 170 }} resizeMode="contain" />
                <Text className="text-slate-500 text-[9px] font-bold mt-1 uppercase tracking-wider">
                  Live Dynamic QR for ₹{effectivePayAmount}
                </Text>
              </View>

              {/* UPI ID Copy Card */}
              <View className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-xl p-2.5 mb-2.5 flex-row items-center justify-between">
                <View className="flex-1 pr-2">
                  <Text className="text-slate-500 text-[9px] font-bold uppercase">Shop UPI ID</Text>
                  <Text className="text-slate-900 dark:text-white font-extrabold text-xs" numberOfLines={1}>
                    {upiId}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => {
                    if (typeof navigator !== 'undefined' && navigator.clipboard) {
                      navigator.clipboard.writeText(upiId);
                    }
                    alert('✓ Shop UPI ID copied to clipboard!');
                  }}
                  className="bg-emerald-600 px-2.5 py-1.5 rounded-lg flex-row items-center gap-1"
                >
                  <Ionicons name="copy-outline" size={12} color="#fff" />
                  <Text className="text-white text-[10px] font-black">Copy</Text>
                </TouchableOpacity>
              </View>

              {/* 1-Tap Open UPI App Button with Dynamic Amount */}
              <TouchableOpacity
                onPress={() => {
                  Linking.openURL(upiPayLink).catch(() => {
                    alert('Could not automatically launch UPI app. Please scan the QR code above or copy the UPI ID.');
                  });
                }}
                className="w-full bg-emerald-600 active:bg-emerald-700 rounded-xl h-11 flex-row items-center justify-center gap-2 shadow mb-2"
              >
                <Ionicons name="phone-portrait-outline" size={16} color="#fff" />
                <Text className="text-white font-black text-xs">
                  Pay ₹{effectivePayAmount} in UPI App (GPay / PhonePe)
                </Text>
              </TouchableOpacity>

              {/* Save QR Image to Gallery Button with Dynamic Amount */}
              <TouchableOpacity
                onPress={handleDownloadQr}
                disabled={downloadingQr}
                className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-white/15 rounded-xl h-10 flex-row items-center justify-center gap-2 mb-2"
              >
                <Ionicons name="download-outline" size={15} color="#059669" />
                <Text className="text-emerald-700 dark:text-emerald-400 font-bold text-xs">
                  {downloadingQr ? 'Saving QR...' : `Save ₹${effectivePayAmount} QR to Gallery`}
                </Text>
              </TouchableOpacity>

              {/* Close Button */}
              <TouchableOpacity
                onPress={() => setShowQrModal(false)}
                className="w-full h-9 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-white/10 items-center justify-center"
              >
                <Text className="text-slate-700 dark:text-slate-300 font-bold text-xs">Done / Close</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      )}
    </AppShell>
  );
}
