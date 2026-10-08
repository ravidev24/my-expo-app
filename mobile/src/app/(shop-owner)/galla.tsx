import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { AppShell } from '../../components/app-shell';
import { DateRangeFilter } from '../../components/date-range-filter';
import { gallaApi } from '../../services/api';
import { soundbox } from '../../services/soundbox';
import { VoiceMicModal } from '../../components/voice-mic-modal';
import { formatMoney, todayInput } from '../../lib/format';
import { body, card, heading, subtle } from '../../lib/ui';
import { printGallaReportPdf } from '../../lib/pdfReport';

export default function DailyGallaScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  // Date Range Filter State (Defaults to Today)
  const [startDate, setStartDate] = useState(todayInput());
  const [endDate, setEndDate] = useState(todayInput());

  const [summary, setSummary] = useState<any>(null);
  const [galla, setGalla] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  // Multi-day Range State
  const [rangeRecords, setRangeRecords] = useState<any[]>([]);
  const isSingleDay = !startDate || !endDate || startDate === endDate;
  const activeSingleDate = startDate || endDate || todayInput();

  // Modals & Inputs
  const [voiceOpen, setVoiceOpen] = useState(false);
  const [openingInput, setOpeningInput] = useState('');
  const [quickAmount, setQuickAmount] = useState('');
  const [quickNote, setQuickNote] = useState('');
  const [expAmount, setExpAmount] = useState('');
  const [expCategory, setExpCategory] = useState('Tea/Snacks');
  const [expNote, setExpNote] = useState('');
  const [closingCash, setClosingCash] = useState('');
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [savingAction, setSavingAction] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyList, setHistoryList] = useState<any[]>([]);

  const load = async () => {
    try {
      if (isSingleDay) {
        const res = await gallaApi.getToday(activeSingleDate);
        if (res.success) {
          setGalla(res.galla);
          setSummary(res.summary);
          setOpeningInput(String(res.summary.openingCash || ''));
        }
      } else {
        // Multi-day range query
        const res = await gallaApi.getHistory({
          startDate: startDate || undefined,
          endDate: endDate || undefined,
          limit: 200,
        });
        if (res.success) {
          const recs = res.history || [];
          setRangeRecords(recs);

          // Compute aggregate summary across range
          let aggOpening = 0;
          let aggQuickCash = 0;
          let aggExpenses = 0;
          let aggCounted: number | undefined = undefined;

          recs.forEach((r: any) => {
            aggOpening += Number(r.openingCash) || 0;
            const sales = (r.quickCashSales || []).reduce(
              (sum: number, s: any) => sum + (Number(s.amount) || 0),
              0
            );
            aggQuickCash += sales;
            const exp = (r.expenses || []).reduce(
              (sum: number, e: any) => sum + (Number(e.amount) || 0),
              0
            );
            aggExpenses += exp;
          });

          const aggExpected = aggOpening + aggQuickCash - aggExpenses;

          setSummary({
            date: `${startDate} to ${endDate}`,
            openingCash: aggOpening,
            quickCashTotal: aggQuickCash,
            customerCashCollected: 0,
            totalExpenses: aggExpenses,
            expectedCash: aggExpected,
            status: 'range',
          });
        }
      }
    } catch (err: any) {
      setError(err.message || 'Could not load Daily Galla');
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      load();
    }, [startDate, endDate])
  );

  const saveOpeningCash = async () => {
    const val = Number(openingInput);
    if (isNaN(val) || val < 0) return;
    setSavingAction(true);
    try {
      const res = await gallaApi.setOpeningCash(val, activeSingleDate);
      setSummary(res.summary);
      setGalla(res.galla);
    } catch (err: any) {
      setError(err.message || 'Could not update opening cash');
    } finally {
      setSavingAction(false);
    }
  };

  const handleQuickSale = async (amountVal?: number) => {
    const val = amountVal || Number(quickAmount);
    if (!val || val <= 0) return;
    setSavingAction(true);
    try {
      const res = await gallaApi.addQuickSale({
        amount: val,
        note: quickNote || 'Quick Cash Sale',
        source: 'manual',
        date: activeSingleDate,
      });
      setSummary(res.summary);
      setGalla(res.galla);
      setQuickAmount('');
      setQuickNote('');
      soundbox.quickSale(val, quickNote);
    } catch (err: any) {
      setError(err.message || 'Could not record sale');
    } finally {
      setSavingAction(false);
    }
  };

  const handleExpense = async () => {
    const val = Number(expAmount);
    if (!val || val <= 0) return;
    setSavingAction(true);
    try {
      const res = await gallaApi.addExpense({
        amount: val,
        category: expCategory,
        note: expNote,
        date: activeSingleDate,
      });
      setSummary(res.summary);
      setGalla(res.galla);
      setExpAmount('');
      setExpNote('');
      soundbox.expensePaid(val, expCategory);
    } catch (err: any) {
      setError(err.message || 'Could not record expense');
    } finally {
      setSavingAction(false);
    }
  };

  const handleCloseGalla = async () => {
    const val = Number(closingCash);
    if (isNaN(val) || val < 0) return;
    setSavingAction(true);
    try {
      const res = await gallaApi.closeGalla({
        closingCashCounted: val,
        notes: 'Day-end cash balancing',
        date: activeSingleDate,
      });
      setSummary(res.summary);
      setGalla(res.galla);
      setShowCloseModal(false);
      soundbox.speakAnnouncement(`Daily Galla closed with ${val} rupees.`);
    } catch (err: any) {
      setError(err.message || 'Could not close Galla');
    } finally {
      setSavingAction(false);
    }
  };

  const handleDownloadPdf = async () => {
    try {
    await printGallaReportPdf({
      shop: {
        name: 'Digimart',
        phone: '+91 63795 17503',
        currency: '₹',
      },
      startDate: startDate || todayInput(),
      endDate: endDate || todayInput(),
      openingCash: summary?.openingCash || 0,
      cashSales: summary?.quickCashTotal || 0,
      customerCollected: summary?.customerCashCollected || 0,
      expenses: summary?.totalExpenses || 0,
      expectedCash: summary?.expectedCash || 0,
      closingCashCounted: summary?.closingCashCounted,
      difference: summary?.difference,
      status: summary?.status,
    });
    } catch (err: any) {
      Alert.alert('Download failed', err.message || 'Could not download the PDF');
    }
  };

  const loadHistory = async () => {
    try {
      const res = await gallaApi.getHistory();
      if (res.success) {
        setHistoryList(res.history || []);
        setHistoryOpen(true);
      }
    } catch (err: any) {
      setError(err.message || 'Could not load history');
    }
  };

  const quickChips = [10, 20, 50, 100, 200, 500];

  return (
    <AppShell>
      {/* Header */}
      <View className="flex-row items-center justify-between mb-4">
        <View className="flex-row items-center gap-2">
          <View className="w-10 h-10 rounded-2xl bg-emerald-500/20 items-center justify-center">
            <Ionicons name="cash-outline" size={22} color="#10b981" />
          </View>
          <View>
            <Text className={`text-2xl font-black ${heading}`}>Daily Galla</Text>
            <Text className="text-slate-500 text-xs">Day-Book Register & Cash Drawer</Text>
          </View>
        </View>

        <View className="flex-row items-center gap-2">
          <TouchableOpacity
            onPress={handleDownloadPdf}
            className="flex-row items-center gap-1 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-300 dark:border-emerald-700 px-2.5 py-2 rounded-xl shadow-sm"
          >
            <Ionicons name="document-text-outline" size={16} color="#059669" />
            <Text className="text-emerald-700 dark:text-emerald-300 text-xs font-black">PDF</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setVoiceOpen(true)}
            className="w-10 h-10 rounded-xl bg-emerald-600 items-center justify-center shadow-md"
            accessibilityLabel="Voice Sale"
          >
            <Ionicons name="mic" size={20} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Date Range Filter with Quick Chips & 1-Click PDF */}
      <DateRangeFilter
        startDate={startDate}
        endDate={endDate}
        onRangeChange={(s, e) => {
          setStartDate(s);
          setEndDate(e);
        }}
        onDownloadPdf={handleDownloadPdf}
        pdfButtonLabel="Download Day-Book PDF"
        title="Galla Date Range"
      />

      {error && <Text className="text-red-600 text-xs mb-3">{error}</Text>}

      {loading ? (
        <ActivityIndicator color="#10b981" className="my-8" />
      ) : (
        <>
          {/* Main Khatabook Balance Banner */}
          <View className={`rounded-3xl p-5 mb-4 border border-emerald-500/30 ${card} shadow-sm`}>
            <View className="flex-row items-center justify-between mb-2">
              <Text className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                {isSingleDay ? 'EXPECTED CASH IN DRAWER' : 'TOTAL PERIOD EXPECTED CASH'}
              </Text>
              <View
                className={`px-2.5 py-0.5 rounded-full border ${
                  summary?.status === 'closed'
                    ? 'bg-blue-500/10 border-blue-500/30'
                    : 'bg-emerald-500/10 border-emerald-500/30'
                }`}
              >
                <Text
                  className={`text-[10px] font-black uppercase ${
                    summary?.status === 'closed' ? 'text-blue-600' : 'text-emerald-600'
                  }`}
                >
                  {summary?.status === 'closed' ? '✓ Day Closed' : isSingleDay ? '🟢 Active Drawer' : '📅 Range Summary'}
                </Text>
              </View>
            </View>

            <Text className="text-4xl font-black text-slate-900 dark:text-white">
              {formatMoney(summary?.expectedCash || 0)}
            </Text>

            {/* Reconciliation Difference Badge if closed */}
            {summary?.closingCashCounted !== null && summary?.closingCashCounted !== undefined && (
              <View
                className={`mt-3 p-2.5 rounded-xl flex-row items-center justify-between ${
                  summary.difference === 0
                    ? 'bg-emerald-500/15'
                    : summary.difference > 0
                    ? 'bg-amber-500/15'
                    : 'bg-red-500/15'
                }`}
              >
                <Text className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  Counted: {formatMoney(summary.closingCashCounted)}
                </Text>
                <Text
                  className={`text-xs font-black ${
                    summary.difference === 0
                      ? 'text-emerald-700 dark:text-emerald-300'
                      : summary.difference > 0
                      ? 'text-amber-700 dark:text-amber-300'
                      : 'text-red-700 dark:text-red-300'
                  }`}
                >
                  {summary.difference === 0
                    ? '🎉 Balanced Perfectly'
                    : summary.difference > 0
                    ? `+${formatMoney(summary.difference)} Excess`
                    : `${formatMoney(summary.difference)} Short`}
                </Text>
              </View>
            )}

            {/* Khatabook Grid Breakdown (Red for expenses, Green for sales) */}
            <View className="flex-row flex-wrap gap-2 mt-4 pt-3 border-t border-slate-200 dark:border-white/10">
              <View className="flex-1 min-w-[120px] bg-slate-100/70 dark:bg-slate-900/60 p-2.5 rounded-xl">
                <Text className="text-[11px] text-slate-500 font-bold">Opening Cash</Text>
                <Text className="text-base font-extrabold text-slate-800 dark:text-slate-200 mt-0.5">
                  {formatMoney(summary?.openingCash || 0)}
                </Text>
              </View>
              <View className="flex-1 min-w-[120px] bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/40 p-2.5 rounded-xl">
                <Text className="text-[11px] text-emerald-800 dark:text-emerald-300 font-bold">Direct Cash Sales</Text>
                <Text className="text-base font-extrabold text-emerald-600 dark:text-emerald-400 mt-0.5">
                  +{formatMoney(summary?.quickCashTotal || 0)}
                </Text>
              </View>
              <View className="flex-1 min-w-[120px] bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/40 p-2.5 rounded-xl">
                <Text className="text-[11px] text-emerald-800 dark:text-emerald-300 font-bold">Udhaar Collected</Text>
                <Text className="text-base font-extrabold text-emerald-600 dark:text-emerald-400 mt-0.5">
                  +{formatMoney(summary?.customerCashCollected || 0)}
                </Text>
              </View>
              <View className="flex-1 min-w-[120px] bg-red-50/70 dark:bg-red-950/30 border border-red-200 dark:border-red-900/40 p-2.5 rounded-xl">
                <Text className="text-[11px] text-red-800 dark:text-red-300 font-bold">Drawer Expenses</Text>
                <Text className="text-base font-extrabold text-red-600 dark:text-red-400 mt-0.5">
                  -{formatMoney(summary?.totalExpenses || 0)}
                </Text>
              </View>
            </View>
          </View>

          {/* Quick Sale Entry Box */}
          <View className={`rounded-3xl p-5 mb-4 ${card}`}>
            <View className="flex-row items-center justify-between mb-3">
              <Text className={`text-base font-black ${heading}`}>⚡ Quick Cash Sale</Text>
              <TouchableOpacity
                onPress={() => setVoiceOpen(true)}
                className="flex-row items-center gap-1 bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-500/20"
              >
                <Ionicons name="mic" size={14} color="#10b981" />
                <Text className="text-xs font-bold text-emerald-700 dark:text-emerald-300">
                  Speak "56 sale"
                </Text>
              </TouchableOpacity>
            </View>

            {/* Fast Chips */}
            <View className="flex-row flex-wrap gap-2 mb-3">
              {quickChips.map((chip) => (
                <TouchableOpacity
                  key={chip}
                  onPress={() => handleQuickSale(chip)}
                  disabled={savingAction}
                  className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-500/30 rounded-xl px-3.5 py-2"
                >
                  <Text className="text-emerald-800 dark:text-emerald-200 font-black text-sm">
                    +₹{chip}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Custom Amount */}
            <View className="flex-row gap-2">
              <TextInput
                value={quickAmount}
                onChangeText={setQuickAmount}
                keyboardType="decimal-pad"
                placeholder="Enter sale amount (e.g. 56)"
                placeholderTextColor="#94a3b8"
                className="flex-1 bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-white/10 rounded-xl px-4 h-12 text-slate-900 dark:text-white font-bold"
              />
              <TouchableOpacity
                onPress={() => handleQuickSale()}
                disabled={savingAction || !quickAmount}
                className="bg-emerald-600 rounded-xl px-5 h-12 items-center justify-center shadow"
              >
                <Text className="text-white font-black text-sm">Add Sale</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Drawer Expense Recorder */}
          <View className={`rounded-3xl p-5 mb-4 ${card}`}>
            <Text className={`text-base font-black ${heading} mb-3`}>💸 Pay Drawer Expense</Text>
            <View className="flex-row flex-wrap gap-2 mb-3">
              {['Tea/Snacks', 'Helper Wages', 'Electricity', 'Shop Supplies'].map((cat) => (
                <TouchableOpacity
                  key={cat}
                  onPress={() => setExpCategory(cat)}
                  className={`px-3 py-1.5 rounded-xl border ${
                    expCategory === cat
                      ? 'bg-red-500/20 border-red-500 text-red-700'
                      : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-white/10'
                  }`}
                >
                  <Text
                    className={`text-xs font-bold ${
                      expCategory === cat ? 'text-red-700 dark:text-red-300' : 'text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    {cat}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <View className="flex-row gap-2">
              <TextInput
                value={expAmount}
                onChangeText={setExpAmount}
                keyboardType="decimal-pad"
                placeholder="Amount (e.g. 20)"
                placeholderTextColor="#94a3b8"
                className="flex-1 bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-white/10 rounded-xl px-4 h-12 text-slate-900 dark:text-white font-bold"
              />
              <TouchableOpacity
                onPress={handleExpense}
                disabled={savingAction || !expAmount}
                className="bg-red-600 rounded-xl px-5 h-12 items-center justify-center shadow"
              >
                <Text className="text-white font-black text-sm">Record Expense</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Multi-Day Range Breakdown List */}
          {!isSingleDay && rangeRecords.length > 0 && (
            <View className="mb-4">
              <View className="flex-row items-center gap-1.5 mb-2">
                <Ionicons name="calendar-outline" size={18} color="#059669" />
                <Text className="text-slate-900 dark:text-white text-base font-black">
                  Day-by-Day Register ({rangeRecords.length} days)
                </Text>
              </View>

              <View className="gap-2">
                {rangeRecords.map((rec: any) => {
                  const sales = (rec.quickCashSales || []).reduce(
                    (s: number, i: any) => s + (Number(i.amount) || 0),
                    0
                  );
                  const exp = (rec.expenses || []).reduce(
                    (s: number, i: any) => s + (Number(i.amount) || 0),
                    0
                  );
                  const expected = (Number(rec.openingCash) || 0) + sales - exp;

                  return (
                    <TouchableOpacity
                      key={rec._id || rec.date}
                      onPress={() => {
                        setStartDate(rec.date);
                        setEndDate(rec.date);
                      }}
                      className="rounded-2xl p-3.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 shadow-sm flex-row items-center justify-between"
                    >
                      <View>
                        <Text className="text-slate-900 dark:text-white font-black text-sm">📅 {rec.date}</Text>
                        <Text className="text-slate-500 text-xs mt-0.5">
                          Open: {formatMoney(rec.openingCash || 0)} · Sales: +{formatMoney(sales)} · Exp: -{formatMoney(exp)}
                        </Text>
                      </View>
                      <View className="items-end">
                        <Text className="text-emerald-600 dark:text-emerald-400 font-black text-sm">
                          {formatMoney(expected)}
                        </Text>
                        <Text className="text-[10px] font-bold text-slate-400 mt-0.5">
                          {rec.status === 'closed' ? '✓ Closed' : '🟢 Open'}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}

          {/* Day End Balancing Action */}
          <TouchableOpacity
            onPress={() => setShowCloseModal(true)}
            className="bg-slate-900 dark:bg-emerald-600 rounded-2xl h-14 flex-row items-center justify-center gap-2 shadow-lg mb-6"
          >
            <Ionicons name="calculator-outline" size={20} color="#fff" />
            <Text className="text-white font-black text-base">
              {summary?.status === 'closed' ? 'Re-Count / Adjust Closing Cash' : '30-Sec Day-End Cash Count'}
            </Text>
          </TouchableOpacity>


          {/* Soundbox Test */}
          <View className={`rounded-2xl p-4 mb-4 flex-row items-center justify-between ${card}`}>
            <View className="flex-row items-center gap-3">
              <View className="w-8 h-8 rounded-full bg-emerald-500/20 items-center justify-center">
                <Ionicons name="volume-high" size={18} color="#10b981" />
              </View>
              <View>
                <Text className="text-slate-900 dark:text-white font-extrabold text-sm">
                  Mobile Voice Soundbox
                </Text>
                <Text className="text-slate-500 text-xs">Announces payments aloud</Text>
              </View>
            </View>
            <TouchableOpacity
              onPress={() => soundbox.testVoice()}
              className="bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-white/10"
            >
              <Text className="text-emerald-700 dark:text-emerald-300 text-xs font-bold">
                🔊 Test Speaker
              </Text>
            </TouchableOpacity>
          </View>
        </>
      )}

      {/* Voice Assistant Modal */}
      <VoiceMicModal
        visible={voiceOpen}
        onClose={() => setVoiceOpen(false)}
        onActionComplete={load}
      />

      {/* Day-End Close Modal */}
      {showCloseModal && (
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.7)', alignItems: 'center', justifyContent: 'center', padding: 20, zIndex: 50 }}>
          <View className="w-full max-w-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-3xl p-6">
            <Text className="text-xl font-black text-slate-900 dark:text-white mb-1">
              End-of-Day Cash Count
            </Text>
            <Text className="text-xs text-slate-500 mb-4">
              Count the physical currency notes & coins in your drawer.
            </Text>

            <View className="bg-slate-100 dark:bg-slate-800 p-3 rounded-2xl mb-4">
              <Text className="text-xs font-bold text-slate-500">SYSTEM EXPECTED CASH</Text>
              <Text className="text-2xl font-black text-emerald-600 mt-1">
                {formatMoney(summary?.expectedCash || 0)}
              </Text>
            </View>

            <Text className="text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">
              PHYSICAL CASH COUNTED (₹)
            </Text>
            <TextInput
              value={closingCash}
              onChangeText={setClosingCash}
              keyboardType="decimal-pad"
              placeholder="e.g. 1550"
              placeholderTextColor="#94a3b8"
              className="bg-white dark:bg-slate-950 border border-slate-300 dark:border-white/20 rounded-xl px-4 h-12 text-slate-900 dark:text-white font-extrabold text-lg mb-4"
            />

            <View className="flex-row gap-3">
              <TouchableOpacity
                onPress={() => setShowCloseModal(false)}
                className="flex-1 h-12 rounded-xl border border-slate-300 dark:border-white/20 items-center justify-center"
              >
                <Text className="font-bold text-slate-700 dark:text-slate-300">Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleCloseGalla}
                disabled={savingAction || !closingCash}
                className="flex-1 h-12 rounded-xl bg-emerald-600 items-center justify-center"
              >
                {savingAction ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text className="text-white font-black">Close & Balance</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </AppShell>
  );
}
