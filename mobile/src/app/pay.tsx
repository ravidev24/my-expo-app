import React, { useState } from 'react';
import {
  Image,
  Linking,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { ScreenBg } from '../components/screen-bg';
import { formatMoney } from '../lib/format';
import { card, heading, subtle } from '../lib/ui';

export default function PublicPayScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    pa?: string;
    pn?: string;
    am?: string;
    cu?: string;
  }>();

  const upiId = params.pa || 'ravim66835-2@okhdfcbank';
  const shopName = params.pn || 'Digimart';
  const totalDueAmount = Number(params.am) || 0;
  const currency = params.cu || 'INR';

  // Dynamic Amount State
  const [customAmount, setCustomAmount] = useState<string>(String(totalDueAmount > 0 ? totalDueAmount : ''));
  const [copied, setCopied] = useState(false);

  const parsedCustomAmount = Number(customAmount);
  const effectiveAmount = !isNaN(parsedCustomAmount) && parsedCustomAmount > 0 ? parsedCustomAmount : totalDueAmount;
  const remainingDue = Math.max(0, totalDueAmount - effectiveAmount);

  // Generate UPI deep link URI
  const upiUri = `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(
    shopName
  )}&am=${effectiveAmount}&cu=${currency}`;

  // Generate QR code URL
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=350x350&data=${encodeURIComponent(
    upiUri
  )}`;

  const handleCopyUpi = async () => {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(upiId);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    } catch {
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    }
  };

  const [downloadingQr, setDownloadingQr] = useState(false);

  const handleDownloadQr = async () => {
    setDownloadingQr(true);
    try {
      if (typeof window !== 'undefined' && typeof document !== 'undefined') {
        const res = await fetch(qrUrl);
        const blob = await res.blob();
        const blobUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = `${shopName.replace(/[^a-zA-Z0-9]/g, '_')}_QR_Rs${effectiveAmount}.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(blobUrl);
        alert(`✓ QR Code for ₹${effectiveAmount} saved to Gallery/Downloads! Open Google Pay, PhonePe, or Paytm to pay.`);
      } else {
        Linking.openURL(qrUrl);
      }
    } catch {
      Linking.openURL(qrUrl);
    } finally {
      setDownloadingQr(false);
    }
  };

  const handleOpenUpiApp = () => {
    Linking.openURL(upiUri).catch(() => {
      alert(
        'Could not launch a UPI app automatically. Please scan the QR code above or copy the UPI ID to pay in your preferred app (Google Pay, PhonePe, Paytm, BHIM).'
      );
    });
  };

  return (
    <ScreenBg>
      <ScrollView contentContainerStyle={{ flexGrow: 1, padding: 16, alignItems: 'center', justifyContent: 'center' }}>
        <View className={`w-full max-w-md rounded-3xl p-6 border border-slate-200 dark:border-white/10 ${card} shadow-2xl items-center`}>
          {/* Shop Header */}
          <View className="w-12 h-12 rounded-2xl bg-emerald-500/20 items-center justify-center mb-2">
            <Ionicons name="storefront-outline" size={24} color="#10b981" />
          </View>
          <Text className={`text-2xl font-black text-center ${heading}`}>{shopName}</Text>
          <Text className={`${subtle} text-xs text-center mt-0.5`}>Customer Bill Payment Portal</Text>

          {/* Total Bill Overview Banner */}
          {totalDueAmount > 0 && (
            <View className="w-full bg-slate-100 dark:bg-slate-800/80 rounded-xl px-4 py-2.5 flex-row justify-between items-center my-3">
              <Text className="text-slate-500 text-xs font-semibold">Total Bill / Outstanding Due:</Text>
              <Text className="text-slate-900 dark:text-white font-black text-sm">{formatMoney(totalDueAmount)}</Text>
            </View>
          )}

          {/* Dynamic Amount Input Box */}
          <View className="w-full bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-4 my-2">
            <Text className="text-emerald-800 dark:text-emerald-300 font-extrabold text-[11px] uppercase tracking-wider mb-1.5">
              AMOUNT TO PAY (₹)
            </Text>
            <View className="flex-row items-center gap-2 bg-white dark:bg-slate-950 rounded-xl px-3 border border-emerald-500/40 h-12">
              <Text className="text-emerald-700 dark:text-emerald-400 font-black text-xl">₹</Text>
              <TextInput
                value={customAmount}
                onChangeText={setCustomAmount}
                placeholder="Enter custom amount"
                placeholderTextColor="#94a3b8"
                keyboardType="numeric"
                className="flex-1 font-black text-xl text-emerald-800 dark:text-emerald-300 h-12"
              />
              {totalDueAmount > 0 && customAmount !== String(totalDueAmount) && (
                <TouchableOpacity
                  onPress={() => setCustomAmount(String(totalDueAmount))}
                  className="bg-emerald-100 dark:bg-emerald-900/50 px-2.5 py-1 rounded-lg"
                >
                  <Text className="text-emerald-700 dark:text-emerald-300 text-xs font-extrabold">Full Due</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Quick Amount Suggestion Chips */}
            <View className="flex-row flex-wrap gap-2 mt-2.5">
              {totalDueAmount > 0 && (
                <TouchableOpacity
                  onPress={() => setCustomAmount(String(totalDueAmount))}
                  className={`px-3 py-1 rounded-lg border ${
                    customAmount === String(totalDueAmount)
                      ? 'bg-emerald-600 border-emerald-600'
                      : 'bg-white dark:bg-slate-800 border-slate-300 dark:border-white/15'
                  }`}
                >
                  <Text className={`text-xs font-bold ${customAmount === String(totalDueAmount) ? 'text-white' : 'text-slate-700 dark:text-slate-300'}`}>
                    Full (₹{totalDueAmount})
                  </Text>
                </TouchableOpacity>
              )}

              {totalDueAmount > 500 && (
                <TouchableOpacity
                  onPress={() => setCustomAmount('500')}
                  className={`px-3 py-1 rounded-lg border ${
                    customAmount === '500'
                      ? 'bg-emerald-600 border-emerald-600'
                      : 'bg-white dark:bg-slate-800 border-slate-300 dark:border-white/15'
                  }`}
                >
                  <Text className={`text-xs font-bold ${customAmount === '500' ? 'text-white' : 'text-slate-700 dark:text-slate-300'}`}>
                    ₹500
                  </Text>
                </TouchableOpacity>
              )}

              {totalDueAmount > 1000 && (
                <TouchableOpacity
                  onPress={() => setCustomAmount('1000')}
                  className={`px-3 py-1 rounded-lg border ${
                    customAmount === '1000'
                      ? 'bg-emerald-600 border-emerald-600'
                      : 'bg-white dark:bg-slate-800 border-slate-300 dark:border-white/15'
                  }`}
                >
                  <Text className={`text-xs font-bold ${customAmount === '1000' ? 'text-white' : 'text-slate-700 dark:text-slate-300'}`}>
                    ₹1,000
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Remaining Balance After Payment */}
            {totalDueAmount > 0 && (
              <View className="flex-row justify-between items-center mt-2.5 pt-2.5 border-t border-emerald-500/20">
                <Text className="text-slate-500 text-xs font-medium">Balance After Payment:</Text>
                <Text className="text-slate-800 dark:text-slate-200 font-extrabold text-xs">
                  ₹{remainingDue.toFixed(2)}
                </Text>
              </View>
            )}
          </View>

          {/* Dynamic QR Code Container */}
          <View className="bg-white p-3.5 rounded-2xl border-2 border-emerald-600 shadow-md my-2 items-center">
            <Image
              source={{ uri: qrUrl }}
              style={{ width: 200, height: 200 }}
              resizeMode="contain"
            />
            <Text className="text-slate-500 text-[10px] font-bold mt-2 text-center uppercase tracking-wider">
              Live QR for ₹{effectiveAmount}
            </Text>
          </View>

          {/* UPI ID Row with 1-Click Copy */}
          <View className="w-full bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl p-3 my-2 flex-row items-center justify-between">
            <View className="flex-1 pr-2">
              <Text className="text-slate-500 text-[10px] font-bold uppercase">SHOP UPI ID (VPA)</Text>
              <Text className="text-slate-900 dark:text-white font-black text-sm select-all mt-0.5" numberOfLines={1}>
                {upiId}
              </Text>
            </View>
            <TouchableOpacity
              onPress={handleCopyUpi}
              className={`px-3 py-1.5 rounded-xl flex-row items-center gap-1 border ${
                copied
                  ? 'bg-emerald-600 border-emerald-600'
                  : 'bg-white dark:bg-slate-800 border-slate-300 dark:border-white/15'
              }`}
            >
              <Ionicons
                name={copied ? 'checkmark' : 'copy-outline'}
                size={14}
                color={copied ? '#fff' : '#10b981'}
              />
              <Text className={`text-xs font-bold ${copied ? 'text-white' : 'text-emerald-600 dark:text-emerald-400'}`}>
                {copied ? 'Copied!' : 'Copy'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* 1-Tap Pay via UPI App with Dynamic Amount */}
          <TouchableOpacity
            onPress={handleOpenUpiApp}
            className="w-full bg-emerald-600 active:bg-emerald-700 rounded-xl h-12 flex-row items-center justify-center gap-2 shadow-lg mb-2"
          >
            <Ionicons name="phone-portrait-outline" size={18} color="#fff" />
            <Text className="text-white font-black text-sm">
              Pay ₹{effectiveAmount} in UPI App (GPay / PhonePe)
            </Text>
          </TouchableOpacity>

          {/* Save QR Image to Gallery Button with Dynamic Amount */}
          <TouchableOpacity
            onPress={handleDownloadQr}
            disabled={downloadingQr}
            className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-white/15 rounded-xl h-11 flex-row items-center justify-center gap-2 mb-3"
          >
            <Ionicons name="download-outline" size={16} color="#059669" />
            <Text className="text-emerald-700 dark:text-emerald-400 font-bold text-xs">
              {downloadingQr ? 'Saving QR Image...' : `Save ₹${effectiveAmount} QR to Gallery`}
            </Text>
          </TouchableOpacity>

          {/* Supported UPI Apps Badges */}
          <View className="flex-row items-center justify-center flex-wrap gap-2 pt-2 border-t border-slate-200 dark:border-white/10 w-full">
            {['Google Pay', 'PhonePe', 'Paytm', 'BHIM', 'Cred'].map((appName) => (
              <View
                key={appName}
                className="bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-md border border-slate-200 dark:border-white/10"
              >
                <Text className="text-[10px] font-semibold text-slate-600 dark:text-slate-400">{appName}</Text>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
    </ScreenBg>
  );
}
