import React, { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useColorScheme } from 'nativewind';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../context/AuthContext';
import { ScreenBg } from '../components/screen-bg';
import { body, card, field, heading, label } from '../lib/ui';

export default function LoginScreen() {
  const router = useRouter();
  const { login, isLoading } = useAuth();
  const { colorScheme, setColorScheme } = useColorScheme();
  const dark = colorScheme !== 'light';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const toggleTheme = async () => {
    const next = dark ? 'light' : 'dark';
    setColorScheme(next);
    await AsyncStorage.setItem('fm-theme', next);
  };

  const handleLogin = async () => {
    if (!email.trim() || !password) {
      setErrorMessage('Please enter your email and password');
      return;
    }
    setErrorMessage(null);
    setSubmitting(true);
    const res = await login(email.trim(), password);
    setSubmitting(false);
    if (!res.success || !res.role) {
      setErrorMessage(res.error || 'Login failed. Please check credentials.');
      return;
    }
    if (res.role === 'system_admin') {
      router.replace('/(system-admin)/users');
    } else if (res.role === 'shop_owner') {
      // If Shop Owner has not configured their UPI ID, redirect directly to profile
      if (!res.shop?.upiId || !res.shop.upiId.trim()) {
        router.replace('/profile');
      } else {
        router.replace('/(shop-owner)/customers');
      }
    } else {
      router.replace('/(customer)/home');
    }
  };

  return (
    <ScreenBg>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="flex-1">
        <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', alignItems: 'center', padding: 16 }}>
          <TouchableOpacity onPress={toggleTheme} className="absolute top-6 right-6 w-11 h-11 rounded-full bg-white/90 dark:bg-slate-900 items-center justify-center">
            <Ionicons name={dark ? 'sunny-outline' : 'moon-outline'} size={20} color={dark ? '#e2e8f0' : '#0f172a'} />
          </TouchableOpacity>
          <View className={`w-full max-w-md rounded-3xl p-6 ${card}`}>
            <View className="items-center mb-2">
              <Ionicons name="leaf" size={28} color="#059669" />
            </View>
            <Text className={`text-3xl font-extrabold text-center ${heading}`}>FreshMart Pro</Text>
            <Text className={`${body} text-center mt-2 mb-6`}>Sign in to your account</Text>
            {errorMessage && <Text className="text-red-700 dark:text-red-200 bg-red-500/15 rounded-xl p-3 mb-3">{errorMessage}</Text>}
            <Text className={label}>EMAIL</Text>
            <TextInput value={email} onChangeText={setEmail} placeholder="name@email.com" placeholderTextColor="#94a3b8" autoCapitalize="none" keyboardType="email-address" className={field} />
            <Text className={`${label} mt-4`}>PASSWORD</Text>
            <View className="flex-row items-center bg-white dark:bg-slate-950/70 border border-slate-200 dark:border-white/15 rounded-xl px-4 h-12">
              <TextInput value={password} onChangeText={setPassword} placeholder="Password" placeholderTextColor="#94a3b8" secureTextEntry={!showPassword} className={`flex-1 h-12 ${heading}`} />
              <TouchableOpacity onPress={() => setShowPassword((show) => !show)}>
                <Text className="text-emerald-700 dark:text-emerald-300 font-bold">{showPassword ? 'Hide' : 'Show'}</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity onPress={handleLogin} disabled={submitting || isLoading} className="bg-emerald-600 rounded-xl h-12 items-center justify-center mt-6">
              {submitting ? <ActivityIndicator color="#fff" /> : <Text className="text-white font-bold text-base">Sign In</Text>}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenBg>
  );
}
