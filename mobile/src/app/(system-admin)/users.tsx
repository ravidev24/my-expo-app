import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { AppShell } from '../../components/app-shell';
import { systemAdminApi } from '../../services/api';

type RoleValue = 'shop_owner' | 'system_admin';

const ROLES: { value: RoleValue; label: string }[] = [
  { value: 'shop_owner', label: 'Admin (Shop Owner)' },
  { value: 'system_admin', label: 'System Admin' },
];

type ListedUser = { id: string; name: string; email: string; roleLabel: string };

export default function AddUserScreen() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<RoleValue>('shop_owner');
  const [users, setUsers] = useState<ListedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = async () => {
    try {
      const usersRes = await systemAdminApi.getUsers();
      setUsers(usersRes.users || []);
    } catch (err: any) {
      setError(err.message || 'Could not load users');
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(useCallback(() => { load(); }, []));

  const handleCreate = async () => {
    if (!name.trim() || !email.trim()) {
      setError('Name and email are required');
      setNotice(null);
      return;
    }
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const res = await systemAdminApi.createUser({
        name: name.trim(),
        email: email.trim(),
        role,
      });
      setName('');
      setEmail('');
      const passwordNote = res.temporaryPassword ? ` Temporary password: ${res.temporaryPassword}` : '';
      setNotice(`${res.message}${passwordNote}`);
      await load();
    } catch (err: any) {
      setError(err.message || 'Could not add user');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppShell>
      <Text className="text-slate-900 dark:text-white text-2xl font-extrabold mb-1">Add Platform User</Text>
      <Text className="text-slate-500 text-xs mb-4">
        System Admin can onboard Shop Owners and System Admins. Customers are registered directly by their respective Shop Owners.
      </Text>

      <View className="bg-white/90 dark:bg-slate-950/80 border border-slate-200 dark:border-white/10 rounded-3xl p-5 mb-5 shadow-sm">
        <Text className="text-slate-600 dark:text-slate-300 text-xs font-bold mb-2">FULL NAME *</Text>
        <TextInput value={name} onChangeText={setName} placeholder="Full name" placeholderTextColor="#94a3b8" className="bg-white dark:bg-slate-950/70 border border-slate-200 dark:border-white/15 rounded-xl text-slate-900 dark:text-white px-4 h-12" />
        <Text className="text-slate-600 dark:text-slate-300 text-xs font-bold mt-4 mb-2">EMAIL ADDRESS *</Text>
        <TextInput value={email} onChangeText={setEmail} placeholder="name@email.com" placeholderTextColor="#94a3b8" autoCapitalize="none" keyboardType="email-address" className="bg-white dark:bg-slate-950/70 border border-slate-200 dark:border-white/15 rounded-xl text-slate-900 dark:text-white px-4 h-12" />
        <Text className="text-slate-600 dark:text-slate-300 text-xs font-bold mt-4 mb-2">ACCOUNT ROLE *</Text>
        <View className="flex-row flex-wrap gap-2">
          {ROLES.map((item) => (
            <TouchableOpacity key={item.value} onPress={() => setRole(item.value)} className={`rounded-full px-4 py-2 border ${role === item.value ? 'bg-emerald-600 border-emerald-600' : 'border-white/15'}`}>
              <Text className="text-slate-900 dark:text-white font-bold">{item.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {error && <Text className="text-red-600 dark:text-red-200 text-xs mt-3">{error}</Text>}
        {notice && <Text className="text-emerald-700 dark:text-emerald-200 text-xs font-bold mt-3">{notice}</Text>}
        <TouchableOpacity onPress={handleCreate} disabled={saving} className="bg-emerald-600 rounded-xl h-12 items-center justify-center mt-5 shadow">
          {saving ? <ActivityIndicator color="#fff" /> : <Text className="text-white font-bold">Create Account</Text>}
        </TouchableOpacity>
        <Text className="text-slate-500 dark:text-slate-400 text-xs mt-3">A secure login password is generated and sent to this email address automatically.</Text>
      </View>
      <Text className="text-slate-900 dark:text-white text-xl font-extrabold mb-3">Users</Text>
      {loading ? <ActivityIndicator color="#34d399" /> : users.map((item) => (
        <View key={item.id} className="flex-row items-center bg-white/90 dark:bg-slate-950/80 border border-slate-200 dark:border-white/10 rounded-2xl p-4 mb-2">
          <View className="flex-1">
            <Text className="text-slate-900 dark:text-white font-bold">{item.name}</Text>
            <Text className="text-slate-600 dark:text-slate-300">{item.email}</Text>
          </View>
          <Text className="text-emerald-700 dark:text-emerald-300 font-bold">{item.roleLabel}</Text>
        </View>
      ))}
    </AppShell>
  );
}
