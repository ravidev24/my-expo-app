import React from 'react';
import { Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { HistoryRow, formatDate, formatMoney } from '../lib/format';
import { card } from '../lib/ui';

export function HistoryList({ rows }: { rows: HistoryRow[] }) {
  if (rows.length === 0) {
    return (
      <View className={`rounded-2xl p-6 items-center justify-center border border-dashed border-slate-300 dark:border-white/15 ${card}`}>
        <Ionicons name="document-text-outline" size={32} color="#94a3b8" />
        <Text className="text-slate-500 font-bold text-sm mt-2">No entries found for this date range</Text>
        <Text className="text-slate-400 text-xs mt-0.5">Transactions in this period will appear here.</Text>
      </View>
    );
  }

  return (
    <View className="gap-2.5">
      {rows.map((row, index) => {
        const isPurchase = row.kind === 'purchase';
        const isCash = row.paymentMethod === 'cash';

        return (
          <View
            key={row.id || index}
            className={`rounded-2xl p-3.5 border ${
              isPurchase
                ? 'border-red-200 dark:border-red-950/50 bg-white dark:bg-slate-900/90'
                : 'border-emerald-200 dark:border-emerald-950/50 bg-white dark:bg-slate-900/90'
            } shadow-sm`}
          >
            {/* Top Row: Date / Kind Badge on Left, Amount on Right */}
            <View className="flex-row justify-between items-start">
              <View className="flex-1 pr-2">
                <View className="flex-row items-center gap-1.5 flex-wrap">
                  {/* Khatabook Action Pill */}
                  <View
                    className={`px-2 py-0.5 rounded-md flex-row items-center gap-1 ${
                      isPurchase
                        ? 'bg-red-500/15 border border-red-500/30'
                        : 'bg-emerald-500/15 border border-emerald-500/30'
                    }`}
                  >
                    <Ionicons
                      name={isPurchase ? 'arrow-up-circle' : 'arrow-down-circle'}
                      size={12}
                      color={isPurchase ? '#dc2626' : '#16a34a'}
                    />
                    <Text
                      className={`text-[10px] font-black uppercase tracking-wide ${
                        isPurchase ? 'text-red-700 dark:text-red-300' : 'text-emerald-700 dark:text-emerald-300'
                      }`}
                    >
                      {isPurchase ? 'You Gave (Udhaar)' : 'You Got (Payment)'}
                    </Text>
                  </View>

                  {/* Payment Method Badge */}
                  {!isPurchase && (
                    <View className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-white/10">
                      <Text className="text-[10px] font-bold text-slate-700 dark:text-slate-300">
                        {isCash ? '💵 Cash' : '📱 UPI'}
                      </Text>
                    </View>
                  )}

                  {/* Bill / Receipt No */}
                  {(row.billNo || row.receiptNo) && (
                    <Text className="text-slate-400 text-[10px] font-bold">
                      #{row.billNo || row.receiptNo}
                    </Text>
                  )}
                </View>

                {/* Transaction Date */}
                <Text className="text-slate-700 dark:text-slate-200 font-bold text-xs mt-1.5">
                  📅 {formatDate(row.date)}
                </Text>
              </View>

              {/* Amount & Balance Column */}
              <View className="items-end">
                {/* Transaction Amount */}
                <Text
                  className={`text-lg font-black ${
                    isPurchase ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'
                  }`}
                >
                  {isPurchase ? `+${formatMoney(row.delta)}` : `-${formatMoney(Math.abs(row.delta))}`}
                </Text>

                {/* Running Balance */}
                <View className="flex-row items-center gap-1 mt-0.5">
                  <Text className="text-slate-400 text-[10px] font-medium">Bal:</Text>
                  <Text className="text-slate-900 dark:text-white text-xs font-black">
                    {formatMoney(row.balance)}
                  </Text>
                </View>
              </View>
            </View>

            {/* Item Breakdown if Purchase */}
            {isPurchase && row.items && row.items.length > 0 && (
              <View className="mt-2.5 pt-2 border-t border-slate-100 dark:border-white/5 gap-1">
                {row.items.map((item, itemIdx) => (
                  <View key={`${row.id}-item-${itemIdx}`} className="flex-row justify-between items-center">
                    <Text className="text-slate-600 dark:text-slate-300 text-xs font-medium">
                      • {item.name} <Text className="text-slate-400">({item.quantity} × {formatMoney(item.unitPrice)})</Text>
                    </Text>
                    <Text className="text-slate-700 dark:text-slate-300 text-xs font-bold">
                      {formatMoney(item.amount || item.quantity * item.unitPrice)}
                    </Text>
                  </View>
                ))}
              </View>
            )}

            {/* Notes if any */}
            {row.notes && (
              <Text className="text-slate-500 text-[11px] italic mt-1.5">
                Note: {row.notes}
              </Text>
            )}
          </View>
        );
      })}
    </View>
  );
}

