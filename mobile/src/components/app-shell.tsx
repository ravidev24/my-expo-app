import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { usePathname, useRouter } from 'expo-router';
import { useColorScheme } from 'nativewind';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../context/AuthContext';
import { notificationApi } from '../services/api';
import { body, heading } from '../lib/ui';
import { useI18n } from '../lib/i18n';
import { ScreenBg } from './screen-bg';
import { NotificationModal } from './notification-modal';
import { VoiceMicModal } from './voice-mic-modal';
import { UpiLockModal } from './upi-lock-modal';

const homeForRole = (role?: string) => {
  if (role === 'system_admin') return '/(system-admin)/users';
  if (role === 'shop_owner') return '/(shop-owner)/customers';
  return '/(customer)/home';
};

const roleLabel = (role?: string) => {
  if (role === 'system_admin') return 'System Admin';
  if (role === 'shop_owner') return 'Admin';
  return 'Customer';
};

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const { colorScheme, setColorScheme } = useColorScheme();
  const dark = colorScheme !== 'light';
  const icon = dark ? '#e2e8f0' : '#0f172a';
  const { t, lang, setLang } = useI18n();
  const router = useRouter();
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [voiceModalOpen, setVoiceModalOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    let isMounted = true;
    const loadUnreadCount = async () => {
      try {
        const res = await notificationApi.getMyNotifications({ limit: 1 });
        if (isMounted && res.success) {
          setUnreadCount(res.unreadCount || 0);
        }
      } catch {}
    };

    if (user) {
      loadUnreadCount();
      const interval = setInterval(loadUnreadCount, 15000); // Check every 15s
      return () => {
        isMounted = false;
        clearInterval(interval);
      };
    }
  }, [user]);

  const toggleTheme = async () => {
    const next = dark ? 'light' : 'dark';
    setColorScheme(next);
    await AsyncStorage.setItem('fm-theme', next);
  };

  const confirmLogout = async () => {
    setLoggingOut(true);
    await logout();
    setLoggingOut(false);
    setConfirmOpen(false);
    router.replace('/login');
  };

  const go = (path: string) => {
    setMenuOpen(false);
    router.push(path as never);
  };

  const isOwner = user?.role === 'shop_owner';

  const moreItems = [
    { name: 'Daily Galla', path: '/(shop-owner)/galla', icon: 'cash-outline' as const },
    { name: 'Regulars', path: '/(shop-owner)/regulars', icon: 'cart-outline' as const },
    { name: 'QR Standee', path: '/(shop-owner)/qr-standee', icon: 'qr-code-outline' as const },
  ];

  return (
    <ScreenBg>
      <View className="flex-1" style={{ position: 'relative' }}>
        {/* Top App Bar */}
        <View className="bg-white/90 dark:bg-slate-950/85 border-b border-slate-200 dark:border-white/10" style={{ zIndex: 20 }}>
          <View style={styles.bar}>
            <TouchableOpacity onPress={() => router.replace(homeForRole(user?.role) as never)} className="flex-row items-center gap-2">
              <Ionicons name="leaf" size={22} color="#059669" />
              <View>
                <Text className={`text-lg font-extrabold ${heading}`}>FreshMart</Text>
                <Text className="text-emerald-600 dark:text-emerald-300 text-xs">{roleLabel(user?.role)}</Text>
              </View>
            </TouchableOpacity>

            <View className="flex-row items-center gap-2">
              {/* Global Voice Assistant Mic Button for Shop Owners */}
              {isOwner && (
                <TouchableOpacity
                  onPress={() => setVoiceModalOpen(true)}
                  className="w-10 h-10 rounded-full bg-emerald-500/15 border border-emerald-500/30 items-center justify-center relative"
                  accessibilityLabel="Voice Assistant"
                >
                  <Ionicons name="mic" size={19} color="#10b981" />
                </TouchableOpacity>
              )}

              <TouchableOpacity
                onPress={() => setNotificationsOpen(true)}
                className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800/80 items-center justify-center relative"
                accessibilityLabel="Notifications"
              >
                <Ionicons name="notifications-outline" size={20} color={icon} />
                {unreadCount > 0 && (
                  <View className="absolute -top-1 -right-1 bg-emerald-600 rounded-full min-w-[18px] h-[18px] items-center justify-center px-1 border-2 border-white dark:border-slate-900">
                    <Text className="text-[10px] font-black text-white">{unreadCount > 9 ? '9+' : unreadCount}</Text>
                  </View>
                )}
              </TouchableOpacity>

              {!isOwner && (
                <TouchableOpacity
                  onPress={() => setMenuOpen((open) => !open)}
                  className="w-10 h-10 rounded-full bg-emerald-600 items-center justify-center shadow"
                >
                  <Text className="text-white font-extrabold">{user?.name?.charAt(0)?.toUpperCase() || 'U'}</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>

        {/* Global Modals */}
        <UpiLockModal />

        <NotificationModal
          visible={notificationsOpen}
          onClose={() => setNotificationsOpen(false)}
          onCountChange={(cnt) => setUnreadCount(cnt)}
        />

        <VoiceMicModal
          visible={voiceModalOpen}
          onClose={() => setVoiceModalOpen(false)}
        />

        <ScrollView className="flex-1" contentContainerStyle={[styles.page, isOwner && { paddingBottom: 120 }]}>
          {children}
        </ScrollView>

        {isOwner && (
          <View style={styles.bottomBar} className="bg-white/95 dark:bg-slate-950/95 border-t border-slate-200 dark:border-white/10">
            <TouchableOpacity onPress={() => router.push('/(shop-owner)/customers' as never)} style={styles.bottomItem}>
              <Ionicons name="people" size={22} color={pathname.includes('customers') ? '#059669' : icon} />
              <Text className={`text-[11px] font-bold mt-0.5 ${pathname.includes('customers') ? 'text-emerald-700 dark:text-emerald-300' : heading}`}>{t.customers}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => router.push('/(shop-owner)/add-customer' as never)}
              style={styles.addBtn}
              accessibilityLabel={t.addCustomer}
            >
              <Ionicons name="person-add" size={26} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setMenuOpen(true)} style={styles.bottomItem}>
              <Ionicons name="person-circle" size={22} color={menuOpen || pathname === '/profile' ? '#059669' : icon} />
              <Text className={`text-[11px] font-bold mt-0.5 ${menuOpen || pathname === '/profile' ? 'text-emerald-700 dark:text-emerald-300' : heading}`}>{t.profile}</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Side Menu */}
        {menuOpen && (
          <View style={[StyleSheet.absoluteFill, { zIndex: 40 }]}>
            <Pressable style={StyleSheet.absoluteFill} onPress={() => setMenuOpen(false)} />
            <View style={isOwner ? styles.sheet : styles.menu} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl overflow-hidden shadow-2xl">
              {isOwner && moreItems.map((item) => (
                <MenuRow key={item.path} icon={item.icon} label={item.name} color={icon} onPress={() => go(item.path)} />
              ))}
              <MenuRow icon="person-outline" label={t.profile} color={icon} onPress={() => go('/profile')} />
              <MenuRow icon="key-outline" label="Change password" color={icon} onPress={() => go('/change-password')} />
              {isOwner && (
                <View className="flex-row items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-white/10">
                  <Text className={`font-semibold ${heading}`}>{t.language}</Text>
                  <View className="flex-row gap-2">
                    <TouchableOpacity onPress={() => setLang('en')} className={`px-3 py-1.5 rounded-lg ${lang === 'en' ? 'bg-emerald-600' : 'bg-slate-100 dark:bg-slate-800'}`}>
                      <Text className={lang === 'en' ? 'text-white font-bold text-xs' : `font-bold text-xs ${heading}`}>{t.english}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => setLang('ta')} className={`px-3 py-1.5 rounded-lg ${lang === 'ta' ? 'bg-emerald-600' : 'bg-slate-100 dark:bg-slate-800'}`}>
                      <Text className={lang === 'ta' ? 'text-white font-bold text-xs' : `font-bold text-xs ${heading}`}>{t.tamil}</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
              <MenuRow icon={dark ? 'sunny-outline' : 'moon-outline'} label={dark ? 'Light mode' : 'Dark mode'} color={icon} onPress={toggleTheme} />
              <MenuRow icon="log-out-outline" label="Logout" color="#dc2626" danger onPress={() => { setMenuOpen(false); setConfirmOpen(true); }} />
            </View>
          </View>
        )}

        {/* Logout Confirm Modal */}
        {confirmOpen && (
          <View style={[StyleSheet.absoluteFill, styles.confirm, { zIndex: 60 }]} className="bg-black/60">
            <View className="w-full max-w-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl p-5">
              <Text className={`text-xl font-extrabold ${heading}`}>Log out?</Text>
              <Text className={`${body} mt-2`}>Are you sure you want to log out of this account?</Text>
              <View className="flex-row gap-3 mt-5">
                <TouchableOpacity onPress={() => setConfirmOpen(false)} className="flex-1 h-11 rounded-xl border border-slate-300 dark:border-white/15 items-center justify-center">
                  <Text className={`font-bold ${heading}`}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={confirmLogout} disabled={loggingOut} className="flex-1 h-11 rounded-xl bg-red-600 items-center justify-center">
                  <Text className="text-white font-bold">{loggingOut ? 'Logging out...' : 'Log out'}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}
      </View>
    </ScreenBg>
  );
}

function MenuRow({ icon, label, color, onPress, danger }: { icon: keyof typeof Ionicons.glyphMap; label: string; color: string; onPress: () => void; danger?: boolean }) {
  return (
    <TouchableOpacity onPress={onPress} className="flex-row items-center gap-3 px-4 py-3 border-b border-slate-100 dark:border-white/10">
      <Ionicons name={icon} size={18} color={danger ? '#dc2626' : color} />
      <Text className={danger ? 'text-red-600 font-semibold' : `font-semibold ${heading}`}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  bar: { width: '100%', maxWidth: 760, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 10 },
  tabBar: { width: '100%', maxWidth: 760, alignSelf: 'center', paddingHorizontal: 16, paddingBottom: 10 },
  tabScroll: { flexDirection: 'row', alignItems: 'center' },
  page: { padding: 16, paddingBottom: 48, width: '100%', maxWidth: 760, alignSelf: 'center' },
  menu: { position: 'absolute', top: 64, right: 16, width: 230, elevation: 12 },
  sheet: { position: 'absolute', left: 12, right: 12, bottom: 88, maxWidth: 760, alignSelf: 'center', elevation: 16 },
  bottomBar: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 72, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', paddingHorizontal: 24 },
  bottomItem: { alignItems: 'center', justifyContent: 'center', minWidth: 88, paddingBottom: 6 },
  addBtn: { width: 58, height: 58, borderRadius: 29, backgroundColor: '#059669', alignItems: 'center', justifyContent: 'center', marginTop: -28, elevation: 8 },
  confirm: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
});
