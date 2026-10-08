import React, { useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Platform,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Contacts from 'expo-contacts/legacy';
import { AppShell } from '../../components/app-shell';
import { useAuth } from '../../context/AuthContext';
import { customerApi } from '../../services/api';
import { useI18n } from '../../lib/i18n';
import { heading } from '../../lib/ui';

function digitsOnly(value: string) {
  return value.replace(/\D/g, '');
}

export default function AddCustomerScreen() {
  const router = useRouter();
  const { shop } = useAuth();
  const { t } = useI18n();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<{ name: string; phone: string; id?: string } | null>(null);

  const pickContact = async () => {
    setError(null);
    if (Platform.OS === 'web') {
      const contactsApi = (navigator as Navigator & { contacts?: { select: (props: string[], opts: { multiple: boolean }) => Promise<Array<{ name?: string[]; tel?: string[] }>> } }).contacts;
      if (!contactsApi?.select) {
        setError(t.contactsUnsupported);
        return;
      }
      try {
        const picked = await contactsApi.select(['name', 'tel'], { multiple: false });
        const person = picked?.[0];
        if (!person) return;
        if (person.name?.[0]) setName(person.name[0]);
        if (person.tel?.[0]) setPhone(person.tel[0]);
      } catch {
        setError(t.contactsDenied);
      }
      return;
    }

    try {
      const perm = await Contacts.requestPermissionsAsync();
      if (perm.status !== 'granted') {
        setError(t.contactsDenied);
        return;
      }
      const person = await Contacts.presentContactPickerAsync();
      if (!person) return;
      const pickedName = person.name || [person.firstName, person.lastName].filter(Boolean).join(' ');
      if (pickedName) setName(pickedName);
      const tel = person.phoneNumbers?.[0]?.number;
      if (tel) setPhone(tel);
    } catch {
      setError(t.contactsUnsupported);
    }
  };

  const handleAdd = async () => {
    if (!name.trim() || digitsOnly(phone).length < 10) {
      setError(t.phoneRequired);
      setCreated(null);
      return;
    }
    setSaving(true);
    setError(null);
    setCreated(null);
    try {
      const res = await customerApi.create({
        name: name.trim(),
        phone: digitsOnly(phone),
      });
      setCreated({
        name: res.customer?.name || name.trim(),
        phone: res.customer?.phone || digitsOnly(phone),
        id: res.customer?._id,
      });
      setName('');
      setPhone('');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not add customer');
    } finally {
      setSaving(false);
    }
  };

  const upiMessage = () => {
    if (!created) return '';
    const shopName = shop?.name || 'FreshMart';
    const upiId = shop?.upiId || '';
    const payLink = upiId
      ? `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(shopName)}&cu=INR`
      : '';
    return `Hello ${created.name}, this is ${shopName}. Pay your khata with UPI${upiId ? ` (${upiId})` : ''}${payLink ? `: ${payLink}` : ''}`;
  };

  const share = (channel: 'whatsapp' | 'sms') => {
    if (!created) return;
    if (!shop?.upiId) {
      setError(t.noUpi);
      return;
    }
    const phoneDigits = digitsOnly(created.phone).slice(-10);
    const text = encodeURIComponent(upiMessage());
    const url = channel === 'whatsapp'
      ? `https://wa.me/91${phoneDigits}?text=${text}`
      : `sms:+91${phoneDigits}?body=${text}`;
    Linking.openURL(url);
  };

  return (
    <AppShell>
      <TouchableOpacity onPress={() => router.replace('/(shop-owner)/customers')} className="flex-row items-center gap-1 mb-3">
        <Ionicons name="arrow-back" size={16} color="#059669" />
        <Text className="text-emerald-700 dark:text-emerald-300 font-bold">{t.back}</Text>
      </TouchableOpacity>

      <View className="bg-white/90 dark:bg-slate-950/80 border border-slate-200 dark:border-white/10 rounded-3xl p-6 shadow-sm">
        <Text className={`text-2xl font-black ${heading}`}>{t.addCustomer}</Text>
        <Text className="text-slate-600 dark:text-slate-400 text-xs mt-1 mb-4 leading-4">{t.contactsAsk}</Text>

        <TouchableOpacity
          onPress={pickContact}
          className="bg-emerald-600 rounded-2xl h-12 flex-row items-center justify-center gap-2 mb-4"
        >
          <Ionicons name="people" size={18} color="#fff" />
          <Text className="text-white font-black">{t.pickContacts}</Text>
        </TouchableOpacity>

        <Text className="text-slate-600 dark:text-slate-300 text-xs font-bold mb-1">{t.name}</Text>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="Ramesh Kumar"
          placeholderTextColor="#94a3b8"
          className="bg-white dark:bg-slate-950/70 border border-slate-200 dark:border-white/15 rounded-xl text-slate-900 dark:text-white px-4 h-12 mb-3"
        />

        <Text className="text-slate-600 dark:text-slate-300 text-xs font-bold mb-1">{t.phone}</Text>
        <TextInput
          value={phone}
          onChangeText={setPhone}
          placeholder="9876543210"
          placeholderTextColor="#94a3b8"
          keyboardType="phone-pad"
          className="bg-white dark:bg-slate-950/70 border border-slate-200 dark:border-white/15 rounded-xl text-slate-900 dark:text-white px-4 h-12 mb-4"
        />

        {error && <Text className="text-red-700 dark:text-red-200 text-xs mb-3">{error}</Text>}

        <TouchableOpacity
          onPress={handleAdd}
          disabled={saving}
          className="bg-emerald-700 rounded-2xl h-12 items-center justify-center"
        >
          {saving ? <ActivityIndicator color="#fff" /> : <Text className="text-white font-black">{t.save}</Text>}
        </TouchableOpacity>

        {created && (
          <View className="mt-5 p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30">
            <Text className="text-emerald-800 dark:text-emerald-200 font-black text-sm">{t.added}</Text>
            <Text className="text-slate-700 dark:text-slate-300 text-xs mt-1">{created.name} · {created.phone}</Text>
            <View className="flex-row gap-2 mt-3">
              <TouchableOpacity onPress={() => share('whatsapp')} className="flex-1 bg-emerald-600 py-2.5 rounded-xl flex-row items-center justify-center gap-1">
                <Ionicons name="logo-whatsapp" size={15} color="#fff" />
                <Text className="text-white font-bold text-xs">{t.sendWhatsapp}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => share('sms')} className="flex-1 bg-slate-800 py-2.5 rounded-xl flex-row items-center justify-center gap-1">
                <Ionicons name="chatbubble-outline" size={15} color="#fff" />
                <Text className="text-white font-bold text-xs">{t.sendSms}</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>
    </AppShell>
  );
}
