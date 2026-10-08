import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { AppShell } from '../../components/app-shell';
import { useAuth } from '../../context/AuthContext';
import { dashboardApi } from '../../services/api';
import { body, card, heading, subtle } from '../../lib/ui';

export default function QrStandeeScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [shopName, setShopName] = useState('Digimart');
  const [upiId, setUpiId] = useState('shop@upi');
  const [phone, setPhone] = useState('+91 98765 43210');
  const [tagline, setTagline] = useState('Scan to Pay or Check Outstanding Balance');
  const [showSettings, setShowSettings] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

  useEffect(() => {
    const loadShop = async () => {
      try {
        const res = await dashboardApi.getShopStats();
        if (res.success && res.shop) {
          setShopName(res.shop.name || 'Digimart');
          setUpiId(res.shop.upiId || 'shop@upi');
          setPhone(res.shop.phone || '+91 98765 43210');
          setTagline(res.shop.tagline || 'Scan to Pay or Check Outstanding Balance');
        }
      } catch {}
    };
    loadShop();
  }, []);

  const handleSaveSettings = async () => {
    setSavingSettings(true);
    setSavedMsg(null);
    try {
      const res = await dashboardApi.updateShop({
        name: shopName,
        upiId: upiId.trim(),
        phone: phone.trim(),
        tagline: tagline.trim(),
      });
      if (res.success) {
        setSavedMsg('✓ Shop details & UPI ID saved successfully!');
        setTimeout(() => setSavedMsg(null), 3000);
      }
    } catch {}
    finally {
      setSavingSettings(false);
    }
  };

  // Generate UPI payment URI
  const upiPayload = `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(shopName)}&cu=INR`;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=350x350&data=${encodeURIComponent(upiPayload)}`;

  const handlePrint = () => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.print();
    }
  };

  return (
    <AppShell>
      {/* Header */}
      <View className="flex-row items-center justify-between mb-4">
        <View className="flex-row items-center gap-2">
          <View className="w-10 h-10 rounded-2xl bg-emerald-500/20 items-center justify-center">
            <Ionicons name="qr-code-outline" size={22} color="#10b981" />
          </View>
          <View>
            <Text className={`text-2xl font-black ${heading}`}>Counter QR Standee</Text>
            <Text className="text-slate-500 text-xs">Printable UPI Payment Board</Text>
          </View>
        </View>

        <View className="flex-row gap-2">
          <TouchableOpacity
            onPress={() => setShowSettings(!showSettings)}
            className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 items-center justify-center border border-slate-200 dark:border-white/10"
          >
            <Ionicons name="options-outline" size={18} color="#64748b" />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handlePrint}
            className="bg-emerald-600 rounded-xl px-3.5 h-10 flex-row items-center gap-1.5 shadow"
          >
            <Ionicons name="print-outline" size={18} color="#fff" />
            <Text className="text-white font-bold text-xs">Print Standee</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Settings Form */}
      {showSettings && (
        <View className={`rounded-3xl p-5 mb-4 border border-emerald-500/30 ${card}`}>
          <Text className="text-sm font-extrabold text-slate-900 dark:text-white mb-3">
            Customise Shop & UPI ID
          </Text>
          <Text className="text-xs font-bold text-slate-500 mb-1">SHOP NAME</Text>
          <TextInput
            value={shopName}
            onChangeText={setShopName}
            className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-white/15 rounded-xl px-3 h-10 text-slate-900 dark:text-white mb-2"
          />
          <Text className="text-xs font-bold text-slate-500 mb-1">SHOP UPI ID (e.g. yourshop@okaxis / phonepe)</Text>
          <TextInput
            value={upiId}
            onChangeText={setUpiId}
            placeholder="e.g. shop@upi"
            placeholderTextColor="#94a3b8"
            className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-white/15 rounded-xl px-3 h-10 text-slate-900 dark:text-white mb-2 font-bold text-emerald-600"
          />
          <Text className="text-xs font-bold text-slate-500 mb-1">PHONE NUMBER</Text>
          <TextInput
            value={phone}
            onChangeText={setPhone}
            className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-white/15 rounded-xl px-3 h-10 text-slate-900 dark:text-white mb-2"
          />
          <Text className="text-xs font-bold text-slate-500 mb-1">TAGLINE</Text>
          <TextInput
            value={tagline}
            onChangeText={setTagline}
            className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-white/15 rounded-xl px-3 h-10 text-slate-900 dark:text-white mb-3"
          />

          {savedMsg && <Text className="text-emerald-600 font-bold text-xs mb-3">{savedMsg}</Text>}

          <TouchableOpacity
            onPress={handleSaveSettings}
            disabled={savingSettings}
            className="bg-emerald-600 rounded-xl h-11 items-center justify-center shadow"
          >
            {savingSettings ? <ActivityIndicator color="#fff" /> : <Text className="text-white font-black text-xs">Save Shop UPI Details</Text>}
          </TouchableOpacity>
        </View>
      )}

      {/* Printable Poster Standee Canvas */}
      <View
        id="printable-standee"
        className="bg-white border-2 border-emerald-700 rounded-3xl p-6 items-center shadow-xl mb-6 mx-auto w-full max-w-sm"
      >
        {/* Top Shop Banner */}
        <View className="bg-emerald-700 w-full rounded-2xl py-3 px-4 items-center mb-4">
          <Ionicons name="leaf" size={24} color="#fff" />
          <Text className="text-white text-xl font-black text-center mt-1">
            {shopName}
          </Text>
          <Text className="text-emerald-100 text-xs font-semibold">{phone}</Text>
        </View>

        {/* Tagline */}
        <Text className="text-slate-800 text-xs font-bold text-center px-4 mb-4">
          {tagline}
        </Text>

        {/* QR Code Container */}
        <View className="bg-white p-3 rounded-2xl border-2 border-slate-300 shadow-inner mb-4">
          <Image
            source={{ uri: qrUrl }}
            style={{ width: 220, height: 220 }}
            resizeMode="contain"
          />
        </View>

        {/* UPI ID display */}
        <View className="bg-emerald-50 px-4 py-1.5 rounded-full border border-emerald-300 mb-4">
          <Text className="text-emerald-900 font-extrabold text-xs">
            UPI ID: {upiId}
          </Text>
        </View>

        {/* Accepted Payment Apps Icons */}
        <View className="border-t border-slate-200 w-full pt-3 items-center">
          <Text className="text-slate-500 text-[10px] font-bold uppercase tracking-wider mb-2">
            Accepted UPI Apps
          </Text>
          <View className="flex-row items-center gap-3">
            <Text className="text-xs font-black text-slate-700">GPay</Text>
            <Text className="text-slate-300">|</Text>
            <Text className="text-xs font-black text-slate-700">PhonePe</Text>
            <Text className="text-slate-300">|</Text>
            <Text className="text-xs font-black text-slate-700">Paytm</Text>
            <Text className="text-slate-300">|</Text>
            <Text className="text-xs font-black text-slate-700">BHIM UPI</Text>
          </View>
        </View>
      </View>

      <Text className="text-center text-slate-500 text-xs mb-8">
        💡 Tip: Print this on A4 cardstock or laminate it to place on your cash counter!
      </Text>
    </AppShell>
  );
}
