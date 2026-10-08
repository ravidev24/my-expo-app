import React, { useEffect } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../context/AuthContext';

export default function IndexScreen() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;

    if (!user) {
      router.replace('/login');
      return;
    }

    if (user.role === 'system_admin') {
      router.replace('/(system-admin)/users');
    } else if (user.role === 'shop_owner') {
      router.replace('/(shop-owner)/customers');
    } else if (user.role === 'customer') {
      router.replace('/(customer)/home');
    } else {
      router.replace('/login');
    }
  }, [user, isLoading]);

  return (
    <View className="flex-1 items-center justify-center">
      <Text className="text-slate-900 dark:text-white text-2xl font-extrabold mb-4">Digimart</Text>
      <ActivityIndicator size="large" color="#ffffff" />
    </View>
  );
}
