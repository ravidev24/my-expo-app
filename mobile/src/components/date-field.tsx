import { Platform, TextInput } from 'react-native';

export function DateField({ value, onChange }: { value: string; onChange: (next: string) => void }) {
  if (Platform.OS === 'web') {
    return <input className="fm-date" type="date" value={value} onChange={(event) => onChange(event.target.value)} />;
  }

  return (
    <TextInput
      value={value}
      onChangeText={onChange}
      placeholder="YYYY-MM-DD"
      placeholderTextColor="#94a3b8"
      className="bg-slate-950/70 border border-white/15 rounded-xl text-white px-4 h-12"
    />
  );
}
