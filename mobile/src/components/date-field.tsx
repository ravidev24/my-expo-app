import { useState } from 'react';
import { Platform, Pressable, Text, View } from 'react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';

function toInputDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function fromInputDate(value: string) {
  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day) return new Date();
  return new Date(year, month - 1, day);
}

export function DateField({
  value,
  onChange,
  compact,
}: {
  value: string;
  onChange: (next: string) => void;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);

  if (Platform.OS === 'web') {
    return (
      <input
        className={compact ? 'fm-date fm-date-compact' : 'fm-date'}
        type="date"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    );
  }

  return (
    <View>
      <Pressable
        onPress={() => setOpen(true)}
        className="flex-row items-center gap-2 bg-white dark:bg-slate-950/70 border border-slate-200 dark:border-white/15 rounded-xl px-3"
        style={{ height: compact ? 40 : 48 }}
      >
        <Ionicons name="calendar-outline" size={16} color="#059669" />
        <Text className={value ? 'text-slate-900 dark:text-white font-bold text-xs' : 'text-slate-400 text-xs'}>
          {value || 'Select date'}
        </Text>
      </Pressable>
      {open ? (
        <DateTimePicker
          value={fromInputDate(value)}
          mode="date"
          display="default"
          onChange={(event: DateTimePickerEvent, date?: Date) => {
            setOpen(false);
            if (event.type === 'dismissed' || !date) return;
            onChange(toInputDate(date));
          }}
        />
      ) : null}
    </View>
  );
}
