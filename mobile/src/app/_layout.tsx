import { useEffect } from 'react';
import { Stack, usePathname, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Platform } from 'react-native';
import Head from 'expo-router/head';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useColorScheme } from 'nativewind';
import { AuthProvider, useAuth } from '../context/AuthContext';
import { LanguageProvider } from '../lib/i18n';
import '../global.css';

function ThemeBoot() {
  const { colorScheme, setColorScheme } = useColorScheme();

  useEffect(() => {
    AsyncStorage.getItem('fm-theme').then((value) => {
      setColorScheme(value === 'light' ? 'light' : 'dark');
    });
  }, []);

  useEffect(() => {
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      document.documentElement.classList.toggle('dark', colorScheme !== 'light');
    }
  }, [colorScheme]);

  return null;
}

function SessionGuard() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (isLoading || user) return;
    if (pathname === '/login' || pathname === '/' || pathname === '/pay' || pathname.startsWith('/pay')) return;
    router.replace('/login');
  }, [user, isLoading, pathname]);

  return null;
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <LanguageProvider>
      <ThemeBoot />
      {Platform.OS === 'web' && (
        <Head>
          <title>FreshMart Grocery Pro - Expense & Ledger Management</title>
          <link rel="preconnect" href="https://fonts.googleapis.com" />
          <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
          <link
            href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap"
            rel="stylesheet"
          />
          <style>{`
            * {
              box-sizing: border-box;
              font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            }
            body, html, #root {
              height: 100%;
              width: 100%;
              margin: 0;
              padding: 0;
            }
            #root {
              display: flex;
              flex-direction: column;
            }
          `}</style>
        </Head>
      )}
      <SessionGuard />
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: 'transparent' },
          animation: 'fade',
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="login" />
        <Stack.Screen name="pay" />
        <Stack.Screen name="profile" />
        <Stack.Screen name="change-password" />
        <Stack.Screen name="(system-admin)" />
        <Stack.Screen name="(shop-owner)" />
        <Stack.Screen name="(customer)" />
      </Stack>
      </LanguageProvider>
    </AuthProvider>
  );
}
