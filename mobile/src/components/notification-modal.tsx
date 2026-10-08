import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColorScheme } from 'nativewind';
import { notificationApi } from '../services/api';
import { body, card, heading } from '../lib/ui';

interface NotificationItem {
  _id: string;
  type: string;
  title: string;
  body: string;
  data?: any;
  isRead: boolean;
  createdAt: string;
}

interface NotificationModalProps {
  visible: boolean;
  onClose: () => void;
  onCountChange?: (count: number) => void;
}

export function NotificationModal({ visible, onClose, onCountChange }: NotificationModalProps) {
  const { colorScheme } = useColorScheme();
  const dark = colorScheme !== 'light';
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const res = await notificationApi.getMyNotifications({ limit: 40 });
      if (res.success) {
        setNotifications(res.notifications || []);
        setUnreadCount(res.unreadCount || 0);
        if (onCountChange) onCountChange(res.unreadCount || 0);
      }
    } catch (err: any) {
      console.warn('[NotificationModal Fetch]:', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (visible) {
      fetchNotifications();
    }
  }, [visible]);

  const markAllRead = async () => {
    try {
      await notificationApi.markAllRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
      if (onCountChange) onCountChange(0);
    } catch (err) {
      console.warn(err);
    }
  };

  const markSingleRead = async (id: string) => {
    try {
      await notificationApi.markRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n._id === id ? { ...n, isRead: true } : n))
      );
      setUnreadCount((prev) => {
        const next = Math.max(0, prev - 1);
        if (onCountChange) onCountChange(next);
        return next;
      });
    } catch (err) {
      console.warn(err);
    }
  };

  const formatTime = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      const now = new Date();
      const diffMs = now.getTime() - d.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      if (diffMins < 1) return 'Just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      const diffHours = Math.floor(diffMins / 60);
      if (diffHours < 24) return `${diffHours}h ago`;
      return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch {
      return dateStr;
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-3xl p-5 w-full max-w-md shadow-2xl max-h-[85%]">
          {/* Header */}
          <View className="flex-row items-center justify-between pb-4 border-b border-slate-100 dark:border-white/10">
            <View className="flex-row items-center gap-2">
              <View className="w-9 h-9 rounded-xl bg-emerald-500/10 items-center justify-center">
                <Ionicons name="notifications" size={20} color="#059669" />
              </View>
              <View>
                <Text className={`text-lg font-black ${heading}`}>Notifications</Text>
                <Text className="text-xs text-slate-500 dark:text-slate-400">
                  {unreadCount > 0 ? `${unreadCount} unread update${unreadCount > 1 ? 's' : ''}` : 'All caught up'}
                </Text>
              </View>
            </View>
            <View className="flex-row items-center gap-2">
              {unreadCount > 0 && (
                <TouchableOpacity onPress={markAllRead} className="px-2.5 py-1 rounded-lg bg-emerald-600/10 active:bg-emerald-600/20">
                  <Text className="text-xs font-bold text-emerald-600 dark:text-emerald-400">Mark all read</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity onPress={onClose} className="p-1.5 rounded-full bg-slate-100 dark:bg-slate-800">
                <Ionicons name="close" size={20} color={dark ? '#cbd5e1' : '#475569'} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Body */}
          {loading ? (
            <View className="py-12 items-center justify-center">
              <ActivityIndicator size="large" color="#059669" />
              <Text className="text-xs text-slate-400 mt-2">Checking notifications...</Text>
            </View>
          ) : notifications.length === 0 ? (
            <View className="py-12 items-center justify-center">
              <Ionicons name="notifications-off-outline" size={42} color={dark ? '#64748b' : '#94a3b8'} />
              <Text className={`text-base font-bold mt-3 ${heading}`}>No Notifications Yet</Text>
              <Text className="text-xs text-slate-400 text-center mt-1 px-6">
                Whenever a new purchase amount or payment is recorded, you will receive instant push and in-app alerts here.
              </Text>
            </View>
          ) : (
            <ScrollView className="mt-2 divide-y divide-slate-100 dark:divide-white/5" showsVerticalScrollIndicator={false}>
              {notifications.map((item) => {
                const isPurchase = item.type === 'purchase' || item.type === 'purchase_update';
                return (
                  <TouchableOpacity
                    key={item._id}
                    onPress={() => !item.isRead && markSingleRead(item._id)}
                    activeOpacity={0.7}
                    className={`py-3.5 px-3 rounded-2xl mb-2 transition-all ${
                      !item.isRead
                        ? 'bg-emerald-500/10 dark:bg-emerald-950/40 border border-emerald-500/20'
                        : 'bg-slate-50/60 dark:bg-slate-800/40 border border-transparent'
                    }`}
                  >
                    <View className="flex-row items-start gap-3">
                      <View
                        className={`w-9 h-9 rounded-xl items-center justify-center ${
                          isPurchase ? 'bg-amber-500/15' : 'bg-emerald-500/15'
                        }`}
                      >
                        <Ionicons
                          name={isPurchase ? 'cart' : 'cash'}
                          size={18}
                          color={isPurchase ? '#d97706' : '#059669'}
                        />
                      </View>
                      <View className="flex-1">
                        <View className="flex-row items-center justify-between mb-0.5">
                          <Text className={`text-sm font-black ${heading} flex-1 mr-2`} numberOfLines={1}>
                            {item.title}
                          </Text>
                          <Text className="text-[11px] text-slate-400 font-medium">
                            {formatTime(item.createdAt)}
                          </Text>
                        </View>
                        <Text className={`text-xs ${body} leading-relaxed mt-0.5`}>
                          {item.body}
                        </Text>
                        {item.data?.amount && (
                          <View className="flex-row items-center gap-2 mt-2">
                            <View className="px-2 py-0.5 rounded-md bg-emerald-500/15 dark:bg-emerald-900/30">
                              <Text className="text-[11px] font-extrabold text-emerald-700 dark:text-emerald-300">
                                Amount: ₹{Number(item.data.amount).toFixed(2)}
                              </Text>
                            </View>
                            {item.data?.balance !== undefined && (
                              <View className="px-2 py-0.5 rounded-md bg-slate-200/70 dark:bg-slate-700/60">
                                <Text className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                                  Balance: ₹{Number(item.data.balance).toFixed(2)}
                                </Text>
                              </View>
                            )}
                          </View>
                        )}
                      </View>
                      {!item.isRead && (
                        <View className="w-2.5 h-2.5 rounded-full bg-emerald-500 mt-1 self-center" />
                      )}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
});
