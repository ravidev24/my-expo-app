import React, { useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getLast30DaysInput, getMonthStartInput, todayInput } from '../lib/format';
import { card } from '../lib/ui';
import { DateField } from './date-field';

interface DateRangeFilterProps {
  startDate: string;
  endDate: string;
  onRangeChange: (start: string, end: string) => void;
  onDownloadPdf?: () => void;
  pdfButtonLabel?: string;
  title?: string;
}

export function DateRangeFilter({
  startDate,
  endDate,
  onRangeChange,
  onDownloadPdf,
  pdfButtonLabel = 'Download PDF',
  title = 'Filter by Date Range',
}: DateRangeFilterProps) {
  const [showCustomInputs, setShowCustomInputs] = useState(false);

  const isAll = !startDate && !endDate;
  const isMonth = startDate === getMonthStartInput() && endDate === todayInput();
  const is30Days = startDate === getLast30DaysInput() && endDate === todayInput();
  const isCustom = !isAll && !isMonth && !is30Days;

  const handleAll = () => {
    setShowCustomInputs(false);
    onRangeChange('', '');
  };

  const handleMonth = () => {
    setShowCustomInputs(false);
    onRangeChange(getMonthStartInput(), todayInput());
  };

  const handle30Days = () => {
    setShowCustomInputs(false);
    onRangeChange(getLast30DaysInput(), todayInput());
  };

  const handleCustomToggle = () => {
    setShowCustomInputs(!showCustomInputs);
    if (!startDate) onRangeChange(getMonthStartInput(), todayInput());
  };

  return (
    <View className={`rounded-2xl p-4 mb-4 border border-slate-200 dark:border-white/10 ${card} shadow-sm`}>
      {/* Header with Title & Download PDF Button */}
      <View className="flex-row items-center justify-between mb-3">
        <View className="flex-row items-center gap-1.5">
          <Ionicons name="filter-outline" size={16} color="#059669" />
          <Text className="text-slate-900 dark:text-white text-xs font-black uppercase tracking-wider">
            {title}
          </Text>
        </View>

        {onDownloadPdf && (
          <TouchableOpacity
            onPress={onDownloadPdf}
            className="flex-row items-center gap-1 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-300 dark:border-emerald-700 px-2.5 py-1 rounded-lg shadow-sm"
          >
            <Ionicons name="download-outline" size={14} color="#059669" />
            <Text className="text-emerald-700 dark:text-emerald-300 text-[11px] font-black">
              {pdfButtonLabel}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Quick Filter Chips */}
      <View className="flex-row flex-wrap gap-1.5 mb-2">
        <TouchableOpacity
          onPress={handleAll}
          className={`px-3 py-1.5 rounded-xl border ${
            isAll && !showCustomInputs
              ? 'bg-emerald-600 border-emerald-600'
              : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-white/10'
          }`}
        >
          <Text
            className={`text-xs font-bold ${
              isAll && !showCustomInputs ? 'text-white' : 'text-slate-700 dark:text-slate-300'
            }`}
          >
            All Time
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={handleMonth}
          className={`px-3 py-1.5 rounded-xl border ${
            isMonth && !showCustomInputs
              ? 'bg-emerald-600 border-emerald-600'
              : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-white/10'
          }`}
        >
          <Text
            className={`text-xs font-bold ${
              isMonth && !showCustomInputs ? 'text-white' : 'text-slate-700 dark:text-slate-300'
            }`}
          >
            This Month
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={handle30Days}
          className={`px-3 py-1.5 rounded-xl border ${
            is30Days && !showCustomInputs
              ? 'bg-emerald-600 border-emerald-600'
              : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-white/10'
          }`}
        >
          <Text
            className={`text-xs font-bold ${
              is30Days && !showCustomInputs ? 'text-white' : 'text-slate-700 dark:text-slate-300'
            }`}
          >
            Last 30 Days
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={handleCustomToggle}
          className={`px-3 py-1.5 rounded-xl border ${
            showCustomInputs || isCustom
              ? 'bg-emerald-600 border-emerald-600'
              : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-white/10'
          }`}
        >
          <Text
            className={`text-xs font-bold ${
              showCustomInputs || isCustom ? 'text-white' : 'text-slate-700 dark:text-slate-300'
            }`}
          >
            Custom 📅
          </Text>
        </TouchableOpacity>
      </View>

      {/* Custom Date Inputs (when expanded or custom) */}
      <View className="flex-row gap-2 mt-2 pt-2 border-t border-slate-100 dark:border-white/5 items-center">
          <View className="flex-1">
            <Text className="text-slate-500 text-[10px] font-bold uppercase mb-1">From Date</Text>
            <DateField compact value={startDate} onChange={(next) => onRangeChange(next, endDate)} />
          </View>

          <Text className="text-slate-400 font-black text-xs self-end mb-2">→</Text>

          <View className="flex-1">
            <Text className="text-slate-500 text-[10px] font-bold uppercase mb-1">To Date</Text>
            <DateField compact value={endDate} onChange={(next) => onRangeChange(startDate, next)} />
          </View>

          {(startDate || endDate) && (
            <TouchableOpacity
              onPress={handleAll}
              className="self-end mb-1 p-2 rounded-lg bg-slate-100 dark:bg-slate-800"
            >
              <Ionicons name="close" size={16} color="#64748b" />
            </TouchableOpacity>
          )}
        </View>
    </View>
  );
}
