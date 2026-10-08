import React from 'react';
import { View, Text, TouchableOpacity, Modal, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, usePathname } from 'expo-router';
import { useAuth } from '../context/AuthContext';
import { heading, body, card } from '../lib/ui';

export function UpiLockModal() {
  const { user, shop } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const isOwner = user?.role === 'shop_owner';
  const hasUpiId = Boolean(shop?.upiId && shop.upiId.trim().length > 0);
  const isProfilePage = pathname === '/profile';

  // Only show for shop owners who haven't configured their UPI ID and aren't on the profile page
  const shouldShow = isOwner && !hasUpiId && !isProfilePage;

  if (!shouldShow) return null;

  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent>
      <View
        style={{
          flex: 1,
          backgroundColor: 'rgba(15, 23, 42, 0.85)',
          justifyContent: 'center',
          alignItems: 'center',
          padding: 20,
          zIndex: 9999,
        }}
      >
        <View
          className={`w-full max-w-md rounded-3xl p-6 border border-amber-500/30 ${card} shadow-2xl`}
          style={{ elevation: 20 }}
        >
          {/* Warning Icon Badge */}
          <View className="items-center mb-4">
            <View className="w-16 h-16 rounded-2xl bg-amber-500/20 border border-amber-500/40 items-center justify-center">
              <Ionicons name="alert-circle" size={36} color="#f59e0b" />
            </View>
          </View>

          <Text className={`text-2xl font-black text-center ${heading}`}>
            Shop UPI ID Required
          </Text>

          <Text className="text-amber-700 dark:text-amber-300 font-extrabold text-center text-xs mt-1 uppercase tracking-wider">
            Mandatory Action Required
          </Text>

          <Text className={`${body} text-center text-sm mt-3 leading-5`}>
            To start adding customers, recording grocery bills, and accepting payments, you must first update your <Text className="font-bold text-slate-900 dark:text-white">Shop UPI ID</Text> in your profile.
          </Text>

          {/* Why this is required info box */}
          <View className="bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl p-4 my-4">
            <View className="flex-row items-center gap-2 mb-2">
              <Ionicons name="cash-outline" size={16} color="#10b981" />
              <Text className="text-xs font-bold text-slate-900 dark:text-white">
                Why is UPI ID mandatory?
              </Text>
            </View>
            <Text className="text-[12px] text-slate-600 dark:text-slate-400 leading-4">
              • When customers pay their total balance or scan your QR code, money is directly transferred into this UPI ID.
            </Text>
            <Text className="text-[12px] text-slate-600 dark:text-slate-400 leading-4 mt-1">
              • Automatic payment reminders (for balances ≥ ₹2,000) include this payment link.
            </Text>
            <Text className="text-[12px] text-amber-700 dark:text-amber-300 font-bold leading-4 mt-1.5">
              ⚠️ All other shop actions are locked until UPI ID is saved.
            </Text>
          </View>

          {/* Action Button */}
          <TouchableOpacity
            onPress={() => router.push('/profile')}
            className="bg-emerald-600 active:bg-emerald-700 rounded-xl h-13 py-3.5 items-center justify-center shadow-lg flex-row gap-2"
          >
            <Ionicons name="card-outline" size={18} color="#fff" />
            <Text className="text-white font-black text-sm">
              Go to Profile & Update UPI ID ➔
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}
