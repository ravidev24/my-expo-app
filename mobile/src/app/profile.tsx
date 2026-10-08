import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useColorScheme } from 'nativewind';
import { AppShell } from '../components/app-shell';
import { useAuth } from '../context/AuthContext';
import { authApi, dashboardApi } from '../services/api';
import { card, heading, label, subtle } from '../lib/ui';
import { useI18n } from '../lib/i18n';

const roleLabel = (role?: string) => {
  if (role === 'system_admin') return 'System Admin';
  if (role === 'shop_owner') return 'Shop Owner';
  return 'Customer';
};

const homeForRole = (role?: string) => {
  if (role === 'system_admin') return '/(system-admin)/users';
  if (role === 'shop_owner') return '/(shop-owner)/customers';
  return '/(customer)/home';
};

export default function ProfileScreen() {
  const { user, shop, customerProfile, updateShop, refreshUser } = useAuth();
  const router = useRouter();
  const { colorScheme } = useColorScheme();
  const { t, lang, setLang } = useI18n();
  const icon = colorScheme === 'light' ? '#334155' : '#e2e8f0';

  const isOwner = user?.role === 'shop_owner';
  const isCustomer = user?.role === 'customer';

  // Personal Profile State
  const [profileName, setProfileName] = useState(user?.name || '');
  const [profilePhone, setProfilePhone] = useState(user?.phone || customerProfile?.phone || '');
  const [profileAddress, setProfileAddress] = useState(customerProfile?.address || '');
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileSuccessMsg, setProfileSuccessMsg] = useState<string | null>(null);
  const [profileErrorMsg, setProfileErrorMsg] = useState<string | null>(null);

  // Shop Owner State
  const [shopName, setShopName] = useState('');
  const [upiId, setUpiId] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [tagline, setTagline] = useState('');
  const [loadingShop, setLoadingShop] = useState(false);
  const [savingShop, setSavingShop] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      setProfileName(user.name || '');
      setProfilePhone(user.phone || customerProfile?.phone || '');
    }
    if (customerProfile?.address) {
      setProfileAddress(customerProfile.address);
    }
  }, [user, customerProfile]);

  useEffect(() => {
    if (isOwner) {
      const loadShop = async () => {
        setLoadingShop(true);
        try {
          const res = await dashboardApi.getShopStats();
          if (res.success && res.shop) {
            setShopName(res.shop.name || '');
            setUpiId(res.shop.upiId || '');
            setPhone(res.shop.phone || '');
            setAddress(res.shop.address || '');
            setTagline(res.shop.tagline || 'Scan to Pay or Check Balance');
          }
        } catch {}
        finally {
          setLoadingShop(false);
        }
      };
      loadShop();
    }
  }, [isOwner]);

  const handleSaveProfile = async () => {
    if (!profileName.trim()) {
      setProfileErrorMsg('Name is required');
      return;
    }
    setSavingProfile(true);
    setProfileErrorMsg(null);
    setProfileSuccessMsg(null);
    try {
      const res = await authApi.updateProfile({
        name: profileName.trim(),
        phone: profilePhone.trim(),
        address: profileAddress.trim(),
      });
      if (res.success) {
        await refreshUser();
        setProfileSuccessMsg('✓ Profile & phone number updated successfully!');
        setTimeout(() => setProfileSuccessMsg(null), 3500);
      }
    } catch (err: any) {
      setProfileErrorMsg(err.message || 'Could not update profile');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleSaveShop = async () => {
    if (!upiId.trim()) {
      setErrorMsg('Please provide a valid Shop UPI ID (e.g. yourshop@okaxis)');
      return;
    }
    setSavingShop(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const res = await dashboardApi.updateShop({
        name: shopName.trim(),
        upiId: upiId.trim(),
        phone: phone.trim(),
        address: address.trim(),
        tagline: tagline.trim(),
      });
      if (res.success) {
        if (res.shop) {
          updateShop(res.shop);
        }
        await refreshUser();
        setSuccessMsg('✓ Shop details & UPI ID updated successfully! Redirecting...');
        setTimeout(() => {
          router.replace('/(shop-owner)/customers');
        }, 1200);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Could not update shop details');
    } finally {
      setSavingShop(false);
    }
  };

  return (
    <AppShell>
      {/* Back button for all users */}
      <TouchableOpacity
        onPress={() => router.replace(homeForRole(user?.role) as never)}
        className="flex-row items-center gap-1.5 mb-3"
      >
        <Ionicons name="arrow-back" size={16} color="#059669" />
        <Text className="text-emerald-700 dark:text-emerald-300 font-bold text-sm">
          {t.back}
        </Text>
      </TouchableOpacity>

      <View className="flex-row items-center justify-between mb-4">
        <Text className={`font-bold ${heading}`}>{t.language}</Text>
        <View className="flex-row gap-2">
          <TouchableOpacity onPress={() => setLang('en')} className={`px-3 py-1.5 rounded-lg ${lang === 'en' ? 'bg-emerald-600' : 'bg-slate-100 dark:bg-slate-800'}`}>
            <Text className={lang === 'en' ? 'text-white font-bold text-xs' : `font-bold text-xs ${heading}`}>{t.english}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setLang('ta')} className={`px-3 py-1.5 rounded-lg ${lang === 'ta' ? 'bg-emerald-600' : 'bg-slate-100 dark:bg-slate-800'}`}>
            <Text className={lang === 'ta' ? 'text-white font-bold text-xs' : `font-bold text-xs ${heading}`}>{t.tamil}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Header */}
      <View className="flex-row items-center gap-2 mb-4">
        <Ionicons name="person-circle-outline" size={26} color={icon} />
        <Text className={`text-2xl font-black ${heading}`}>
          {isOwner ? 'My Profile & Shop Settings' : isCustomer ? 'Customer Profile & Settings' : 'My Profile'}
        </Text>
      </View>

      {/* User Info Overview Card */}
      <View className={`rounded-3xl p-5 mb-4 border border-slate-200 dark:border-white/10 ${card}`}>
        <View className="flex-row items-center gap-4 mb-4">
          <View className="w-14 h-14 rounded-2xl bg-emerald-600 items-center justify-center shadow">
            <Text className="text-white text-2xl font-black">
              {user?.name?.charAt(0)?.toUpperCase() || 'U'}
            </Text>
          </View>
          <View className="flex-1">
            <Text className={`text-xl font-black ${heading}`}>{user?.name}</Text>
            <Text className="text-emerald-600 dark:text-emerald-400 font-bold text-xs">
              {roleLabel(user?.role)}
            </Text>
            <Text className={`${subtle} text-xs mt-0.5`}>{user?.email}</Text>
            {user?.phone ? (
              <Text className="text-slate-700 dark:text-slate-300 text-xs font-semibold mt-1">
                📱 {user.phone}
              </Text>
            ) : (
              <Text className="text-amber-600 dark:text-amber-400 text-xs font-medium mt-1">
                ⚠️ Phone number not added
              </Text>
            )}
          </View>
        </View>

        {/* Customer Shop & Balance Overview Banner */}
        {isCustomer && (
          <View className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/40 rounded-2xl p-3.5 mb-3">
            <View className="flex-row justify-between items-center mb-1">
              <Text className="text-emerald-900 dark:text-emerald-200 text-xs font-bold">
                🏪 Associated Shop
              </Text>
              <Text className="text-emerald-800 dark:text-emerald-300 font-black text-xs">
                {shop?.name || 'FreshMart Grocery'}
              </Text>
            </View>
            {customerProfile && (
              <View className="flex-row justify-between items-center pt-2 border-t border-emerald-200/60 dark:border-emerald-800/60">
                <Text className="text-slate-600 dark:text-slate-400 text-xs font-medium">
                  Current Balance Due:
                </Text>
                <Text
                  className={`font-black text-sm ${
                    customerProfile.outstandingBalance > 0 ? 'text-red-600 dark:text-red-400' : 'text-emerald-600'
                  }`}
                >
                  {shop?.currency || '₹'}
                  {Number(customerProfile.outstandingBalance || 0).toLocaleString('en-IN')}
                </Text>
              </View>
            )}
          </View>
        )}

        <TouchableOpacity
          onPress={() => router.push('/change-password')}
          className="bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-xl h-11 flex-row items-center justify-center gap-2"
        >
          <Ionicons name="key-outline" size={16} color={icon} />
          <Text className="text-slate-800 dark:text-slate-200 font-bold text-xs">Change Password</Text>
        </TouchableOpacity>
      </View>

      {/* Edit Personal Details (Name, Phone / WhatsApp & Address) */}
      <View className={`rounded-3xl p-6 mb-4 border border-slate-200 dark:border-white/10 ${card} shadow-sm`}>
        <View className="flex-row items-center gap-2 mb-2">
          <View className="w-8 h-8 rounded-xl bg-emerald-500/20 items-center justify-center">
            <Ionicons name="person-outline" size={18} color="#10b981" />
          </View>
          <Text className="text-slate-900 dark:text-white text-lg font-black">
            {isCustomer ? 'Customer Details & Phone' : 'Personal Details'}
          </Text>
        </View>

        <Text className="text-slate-500 text-xs mb-4">
          Update your phone number to receive WhatsApp / SMS bill receipts, statements, and payment reminders.
        </Text>

        <Text className="text-slate-600 dark:text-slate-300 text-xs font-bold mb-1">
          FULL NAME *
        </Text>
        <TextInput
          value={profileName}
          onChangeText={setProfileName}
          placeholder="e.g. Ramesh Kumar"
          placeholderTextColor="#94a3b8"
          className="bg-white dark:bg-slate-950/70 border border-slate-200 dark:border-white/15 rounded-xl px-4 h-12 text-slate-900 dark:text-white mb-3 text-sm font-semibold"
        />

        <Text className="text-slate-600 dark:text-slate-300 text-xs font-bold mb-1">
          PHONE / WHATSAPP NUMBER (+91)
        </Text>
        <TextInput
          value={profilePhone}
          onChangeText={setProfilePhone}
          placeholder="+91 98765 43210 or 10-digit number"
          placeholderTextColor="#94a3b8"
          keyboardType="phone-pad"
          className="bg-white dark:bg-slate-950/70 border border-slate-200 dark:border-white/15 rounded-xl px-4 h-12 text-slate-900 dark:text-white mb-3 text-sm font-semibold"
        />

        {isCustomer && (
          <>
            <Text className="text-slate-600 dark:text-slate-300 text-xs font-bold mb-1">
              DELIVERY / RESIDENTIAL ADDRESS
            </Text>
            <TextInput
              value={profileAddress}
              onChangeText={setProfileAddress}
              placeholder="e.g. Flat 302, Green Valley Apts, Main Road"
              placeholderTextColor="#94a3b8"
              className="bg-white dark:bg-slate-950/70 border border-slate-200 dark:border-white/15 rounded-xl px-4 h-12 text-slate-900 dark:text-white mb-3 text-sm font-semibold"
            />
          </>
        )}

        <Text className="text-slate-600 dark:text-slate-300 text-xs font-bold mb-1">
          EMAIL ADDRESS (Read-only)
        </Text>
        <TextInput
          value={user?.email || ''}
          editable={false}
          className="bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-xl px-4 h-12 text-slate-500 dark:text-slate-400 mb-4 text-sm font-medium"
        />

        {profileErrorMsg && <Text className="text-red-600 text-xs mb-3">{profileErrorMsg}</Text>}
        {profileSuccessMsg && <Text className="text-emerald-600 font-bold text-xs mb-3">{profileSuccessMsg}</Text>}

        <TouchableOpacity
          onPress={handleSaveProfile}
          disabled={savingProfile}
          className="bg-emerald-600 active:bg-emerald-700 rounded-xl h-12 items-center justify-center shadow"
        >
          {savingProfile ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text className="text-white font-black text-sm">
              {isCustomer ? 'Save Customer Profile & Phone' : 'Save Profile Changes'}
            </Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Shop Owner Settings (UPI ID & Shop Details) */}
      {isOwner && (
        <View className={`rounded-3xl p-6 border border-slate-200 dark:border-white/10 ${card} shadow-sm`}>
          <View className="flex-row items-center justify-between mb-2">
            <View className="flex-row items-center gap-2">
              <View className="w-8 h-8 rounded-xl bg-emerald-500/20 items-center justify-center">
                <Ionicons name="storefront-outline" size={18} color="#10b981" />
              </View>
              <Text className="text-slate-900 dark:text-white text-lg font-black">
                Shop & UPI Payment Settings
              </Text>
            </View>
          </View>

          <Text className="text-slate-500 text-xs mb-4">
            Customers under your shop will automatically pay into this UPI ID via Google Pay, PhonePe, and Paytm.
          </Text>

          {/* UPI ID Status Badge */}
          <View
            className={`p-3.5 rounded-2xl mb-4 flex-row items-center gap-3 border ${
              upiId.trim()
                ? 'bg-emerald-500/10 border-emerald-500/30'
                : 'bg-amber-500/10 border-amber-500/30'
            }`}
          >
            <Ionicons
              name={upiId.trim() ? 'checkmark-circle' : 'alert-circle'}
              size={22}
              color={upiId.trim() ? '#10b981' : '#f59e0b'}
            />
            <View className="flex-1">
              <Text
                className={`font-black text-xs uppercase ${
                  upiId.trim() ? 'text-emerald-800 dark:text-emerald-200' : 'text-amber-800 dark:text-amber-200'
                }`}
              >
                {upiId.trim() ? '✓ Direct UPI Payments Active' : '⚠️ Action Required: Add Shop UPI ID'}
              </Text>
              <Text className="text-slate-600 dark:text-slate-400 text-xs mt-0.5">
                {upiId.trim()
                  ? `Linked VPA: ${upiId}`
                  : 'Enter your bank or merchant UPI ID below to start accepting customer dues.'}
              </Text>
            </View>
          </View>

          {loadingShop ? (
            <ActivityIndicator color="#10b981" className="my-4" />
          ) : (
            <>
              <Text className="text-slate-600 dark:text-slate-300 text-xs font-bold mb-1">
                SHOP NAME *
              </Text>
              <TextInput
                value={shopName}
                onChangeText={setShopName}
                placeholder="e.g. Sharma Groceries / FreshMart"
                placeholderTextColor="#94a3b8"
                className="bg-white dark:bg-slate-950/70 border border-slate-200 dark:border-white/15 rounded-xl px-4 h-12 text-slate-900 dark:text-white mb-3 text-sm font-semibold"
              />

              <Text className="text-slate-600 dark:text-slate-300 text-xs font-bold mb-1">
                SHOP UPI ID (VPA) *
              </Text>
              <TextInput
                value={upiId}
                onChangeText={setUpiId}
                placeholder="e.g. yourshop@okhdfcbank or 9876543210@paytm"
                placeholderTextColor="#94a3b8"
                autoCapitalize="none"
                className="bg-white dark:bg-slate-950/70 border border-emerald-500/40 rounded-xl px-4 h-12 text-emerald-700 dark:text-emerald-400 mb-3 text-base font-extrabold"
              />

              <Text className="text-slate-600 dark:text-slate-300 text-xs font-bold mb-1">
                SHOP CONTACT NUMBER
              </Text>
              <TextInput
                value={phone}
                onChangeText={setPhone}
                placeholder="+91 98765 43210"
                placeholderTextColor="#94a3b8"
                keyboardType="phone-pad"
                className="bg-white dark:bg-slate-950/70 border border-slate-200 dark:border-white/15 rounded-xl px-4 h-12 text-slate-900 dark:text-white mb-3 text-sm"
              />

              <Text className="text-slate-600 dark:text-slate-300 text-xs font-bold mb-1">
                SHOP ADDRESS / LOCATION
              </Text>
              <TextInput
                value={address}
                onChangeText={setAddress}
                placeholder="e.g. Main Bazaar Road, Market complex"
                placeholderTextColor="#94a3b8"
                className="bg-white dark:bg-slate-950/70 border border-slate-200 dark:border-white/15 rounded-xl px-4 h-12 text-slate-900 dark:text-white mb-3 text-sm"
              />

              <Text className="text-slate-600 dark:text-slate-300 text-xs font-bold mb-1">
                STAND-EE TAGLINE
              </Text>
              <TextInput
                value={tagline}
                onChangeText={setTagline}
                placeholder="e.g. Scan with GPay/PhonePe to Pay or Check Balance"
                placeholderTextColor="#94a3b8"
                className="bg-white dark:bg-slate-950/70 border border-slate-200 dark:border-white/15 rounded-xl px-4 h-12 text-slate-900 dark:text-white mb-4 text-sm"
              />

              {errorMsg && <Text className="text-red-600 text-xs mb-3">{errorMsg}</Text>}
              {successMsg && <Text className="text-emerald-600 font-bold text-xs mb-3">{successMsg}</Text>}

              <TouchableOpacity
                onPress={handleSaveShop}
                disabled={savingShop}
                className="bg-emerald-600 rounded-xl h-12 items-center justify-center shadow"
              >
                {savingShop ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text className="text-white font-black text-sm">Save & Update Shop UPI ID</Text>
                )}
              </TouchableOpacity>
            </>
          )}
        </View>
      )}
    </AppShell>
  );
}
