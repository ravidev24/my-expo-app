import React, { useState } from 'react';
import { ActivityIndicator, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { AppShell } from '../components/app-shell';
import { authApi } from '../services/api';

export default function ChangePasswordScreen() {
  const router = useRouter();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const handleSave = async () => {
    if (!currentPassword || !newPassword) {
      setError('Enter your current password and a new password');
      setNotice(null);
      return;
    }
    if (newPassword.length < 6) {
      setError('New password must be at least 6 characters');
      setNotice(null);
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('New password and confirm password do not match');
      setNotice(null);
      return;
    }
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const res = await authApi.changePassword({ currentPassword, newPassword });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setNotice(res.message || 'Password changed successfully.');
    } catch (err: any) {
      setError(err.message || 'Could not change password');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppShell>
      <TouchableOpacity onPress={() => router.back()}>
        <Text className="text-emerald-700 dark:text-emerald-300 font-bold mb-3">← Back</Text>
      </TouchableOpacity>
      <View className="bg-white/90 dark:bg-slate-950/80 border border-slate-200 dark:border-white/10 rounded-3xl p-5">
        <Text className="text-slate-900 dark:text-white text-2xl font-extrabold mb-4">Change password</Text>
        <Text className="text-slate-600 dark:text-slate-300 text-xs font-bold mb-2">CURRENT PASSWORD</Text>
        <TextInput value={currentPassword} onChangeText={setCurrentPassword} secureTextEntry placeholder="Current password" placeholderTextColor="#94a3b8" className="bg-white dark:bg-slate-950/70 border border-slate-200 dark:border-white/15 rounded-xl text-slate-900 dark:text-white px-4 h-12" />
        <Text className="text-slate-600 dark:text-slate-300 text-xs font-bold mt-4 mb-2">NEW PASSWORD</Text>
        <TextInput value={newPassword} onChangeText={setNewPassword} secureTextEntry placeholder="New password" placeholderTextColor="#94a3b8" className="bg-white dark:bg-slate-950/70 border border-slate-200 dark:border-white/15 rounded-xl text-slate-900 dark:text-white px-4 h-12" />
        <Text className="text-slate-600 dark:text-slate-300 text-xs font-bold mt-4 mb-2">CONFIRM PASSWORD</Text>
        <TextInput value={confirmPassword} onChangeText={setConfirmPassword} secureTextEntry placeholder="Confirm new password" placeholderTextColor="#94a3b8" className="bg-white dark:bg-slate-950/70 border border-slate-200 dark:border-white/15 rounded-xl text-slate-900 dark:text-white px-4 h-12" />
        {error && <Text className="text-red-700 dark:text-red-200 mt-3">{error}</Text>}
        {notice && <Text className="text-emerald-700 dark:text-emerald-200 mt-3">{notice}</Text>}
        <TouchableOpacity onPress={handleSave} disabled={saving} className="bg-emerald-600 rounded-xl h-12 items-center justify-center mt-5">
          {saving ? <ActivityIndicator color="#fff" /> : <Text className="text-white font-bold">Save password</Text>}
        </TouchableOpacity>
      </View>
    </AppShell>
  );
}
