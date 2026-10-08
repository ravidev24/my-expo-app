import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { AppShell } from '../../components/app-shell';
import { customerApi } from '../../services/api';
import { balanceClass, formatMoney } from '../../lib/format';
import { RiskBadge } from '../../components/risk-badge';
import { evaluateCustomerRisk } from '../../lib/creditRisk';
import { body, card, heading, subtle } from '../../lib/ui';
import { useI18n } from '../../lib/i18n';

type CustomerRow = {
  _id: string;
  name: string;
  email: string;
  phone?: string;
  outstandingBalance: number;
  totalPurchases: number;
  totalPayments: number;
  creditLimit?: number;
  lastPaymentDate?: string;
  updatedAt?: string;
  createdAt?: string;
};

export default function CustomersScreen() {
  const router = useRouter();
  const { t } = useI18n();
  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [shop, setShop] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'over_2000' | 'overdue_1mo' | 'has_balance' | 'settled'>('all');

  const load = async () => {
    try {
      const [res, shopRes] = await Promise.all([
        customerApi.getAll({ limit: 200 }),
        import('../../services/api').then((m) => m.dashboardApi.getShopStats()).catch(() => ({ success: false })),
      ]);
      setCustomers(res.customers || []);
      if (shopRes.success) {
        setShop(shopRes.shop || null);
      }
    } catch (err: any) {
      setError(err.message || 'Could not load customers');
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      load();
    }, [])
  );

  const isOverdueOneMonth = (c: CustomerRow) => {
    if (c.outstandingBalance <= 0) return false;
    const now = Date.now();
    const lastTime = c.lastPaymentDate
      ? new Date(c.lastPaymentDate).getTime()
      : c.createdAt
      ? new Date(c.createdAt).getTime()
      : now;
    return now - lastTime > 30 * 24 * 60 * 60 * 1000;
  };

  const filteredCustomers = useMemo(() => {
    return customers.filter((c) => {
      // Search filter
      const matchesSearch =
        !search ||
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        c.email.toLowerCase().includes(search.toLowerCase()) ||
        (c.phone && c.phone.includes(search));

      if (!matchesSearch) return false;

      // Status filter
      if (filter === 'over_2000') return c.outstandingBalance > 2000;
      if (filter === 'overdue_1mo') return isOverdueOneMonth(c);
      if (filter === 'has_balance') return c.outstandingBalance > 0;
      if (filter === 'settled') return c.outstandingBalance <= 0;
      return true;
    });
  }, [customers, search, filter]);

  const totalOutstanding = useMemo(() => {
    return customers.reduce((sum, c) => sum + (c.outstandingBalance > 0 ? c.outstandingBalance : 0), 0);
  }, [customers]);

  return (
    <AppShell>
      {/* Missing UPI Alert Banner */}
      {shop && !shop.upiId && (
        <TouchableOpacity
          onPress={() => router.push('/profile')}
          className="bg-amber-500/15 border border-amber-500/40 rounded-2xl p-3.5 mb-4 flex-row items-center justify-between"
        >
          <View className="flex-row items-center gap-2.5 flex-1 pr-2">
            <Ionicons name="alert-circle" size={22} color="#f59e0b" />
            <View className="flex-1">
              <Text className="text-amber-800 dark:text-amber-200 font-extrabold text-xs">
                Action Required: Set Up Shop UPI ID
              </Text>
              <Text className="text-slate-600 dark:text-slate-400 text-[11px] mt-0.5">
                Add your UPI ID in Profile so your customers can pay bills directly.
              </Text>
            </View>
          </View>
          <Text className="text-amber-800 dark:text-amber-300 font-black text-xs">Setup ➔</Text>
        </TouchableOpacity>
      )}

      {/* Top Header */}
      <View className="mb-3">
        <Text className={`text-2xl font-black ${heading}`}>{t.customers}</Text>
        <Text className="text-slate-500 text-xs">
          {customers.length}
        </Text>
      </View>

      {/* Khatabook Summary Cards (You will get / You will give) */}
      <View className="flex-row gap-2.5 mb-4">
        <View className="flex-1 bg-red-50/80 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 p-3.5 rounded-2xl">
          <View className="flex-row items-center gap-1">
            <Ionicons name="arrow-up-circle" size={14} color="#dc2626" />
            <Text className="text-[10px] font-black uppercase text-red-700 dark:text-red-300">
              {t.youWillGet}
            </Text>
          </View>
          <Text className="text-xl font-black text-red-600 dark:text-red-400 mt-1">
            {formatMoney(totalOutstanding)}
          </Text>
        </View>

        <View className="flex-1 bg-emerald-50/80 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/50 p-3.5 rounded-2xl">
          <View className="flex-row items-center gap-1">
            <Ionicons name="arrow-down-circle" size={14} color="#16a34a" />
            <Text className="text-[10px] font-black uppercase text-emerald-700 dark:text-emerald-300">
              Settled Accounts
            </Text>
          </View>
          <Text className="text-xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
            {customers.filter((c) => c.outstandingBalance <= 0).length} of {customers.length}
          </Text>
        </View>
      </View>


      {/* Search Input */}
      <View className="flex-row items-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl px-3.5 h-11 mb-3">
        <Ionicons name="search-outline" size={18} color="#94a3b8" />
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder={t.search}
          placeholderTextColor="#94a3b8"
          className="flex-1 ml-2 text-slate-900 dark:text-white text-sm"
        />
        {search ? (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Ionicons name="close-circle" size={16} color="#94a3b8" />
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Filter Tabs */}
      <View className="flex-row flex-wrap gap-1.5 mb-4">
        {[
          { key: 'all', label: `All (${customers.length})` },
          { key: 'over_2000', label: '⚠️ > ₹2,000' },
          { key: 'overdue_1mo', label: '📅 > 1 Month' },
          { key: 'has_balance', label: 'Has Balance' },
          { key: 'settled', label: 'Settled' },
        ].map((tab) => (
          <TouchableOpacity
            key={tab.key}
            onPress={() => setFilter(tab.key as any)}
            className={`px-3 py-1.5 rounded-xl border ${
              filter === tab.key
                ? 'bg-emerald-600 border-emerald-600'
                : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-white/10'
            }`}
          >
            <Text
              className={`text-xs font-bold ${
                filter === tab.key ? 'text-white' : 'text-slate-700 dark:text-slate-300'
              }`}
            >
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {error && <Text className="text-red-500 text-xs mb-3">{error}</Text>}

      {loading ? (
        <ActivityIndicator color="#10b981" className="my-8" />
      ) : filteredCustomers.length === 0 ? (
        <View className={`rounded-3xl p-8 items-center justify-center ${card}`}>
          <Ionicons name="people-outline" size={40} color="#94a3b8" />
          <Text className="text-slate-800 dark:text-slate-200 font-bold text-sm mt-2">
            No matching customers found
          </Text>
        </View>
      ) : (
        filteredCustomers.map((customer) => {
          const overdue1Mo = isOverdueOneMonth(customer);
          const isHigh = customer.outstandingBalance > 2000;
          return (
            <TouchableOpacity
              key={customer._id}
              onPress={() => router.push(`/(shop-owner)/customer/${customer._id}`)}
              className={`rounded-2xl p-4 mb-3 border border-slate-200 dark:border-white/10 ${card}`}
            >
              <View className="flex-row items-center justify-between">
                <View className="flex-1 pr-3">
                  <View className="flex-row items-center flex-wrap gap-1.5 mb-1">
                    <Text className={`font-black text-base ${heading}`}>{customer.name}</Text>
                    {isHigh && (
                      <View className="bg-red-500/15 border border-red-500/30 px-1.5 py-0.5 rounded-md">
                        <Text className="text-[10px] font-bold text-red-600 dark:text-red-300">
                          &gt; ₹2k Due
                        </Text>
                      </View>
                    )}
                    {overdue1Mo && (
                      <View className="bg-amber-500/15 border border-amber-500/30 px-1.5 py-0.5 rounded-md">
                        <Text className="text-[10px] font-bold text-amber-600 dark:text-amber-300">
                          &gt; 1 Mo
                        </Text>
                      </View>
                    )}
                    <RiskBadge customer={customer} />
                  </View>
                  <Text className={`${body} text-xs`}>
                    {customer.phone ? `📱 ${customer.phone}` : `✉️ ${customer.email}`}
                  </Text>
                  <Text className={`${subtle} text-[11px] mt-1.5`}>
                    Added {formatMoney(customer.totalPurchases)} · Paid {formatMoney(customer.totalPayments)}
                  </Text>
                </View>
                <View className="items-end">
                  <Text className={`${subtle} text-[10px] font-bold uppercase`}>Balance</Text>
                  <Text className={`font-black text-lg mt-0.5 ${balanceClass(customer.outstandingBalance)}`}>
                    {formatMoney(customer.outstandingBalance)}
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          );
        })
      )}
    </AppShell>
  );
}
