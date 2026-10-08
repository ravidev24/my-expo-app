import { Platform } from 'react-native';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { authApi } from './api';

const PUSH_TOKEN_KEY = 'freshmart_push_token';

// Configure foreground notification presentation
if (Platform.OS !== 'web') {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
      shouldShowBanner: true,
      shouldPresentAlert: true,
    } as any),
  });
}

/**
 * Register device for push notifications with Expo and backend
 */
export const registerForPushNotificationsAsync = async (): Promise<string | null> => {
  let token: string | null = null;

  try {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('freshmart_updates', {
        name: 'FreshMart Account & Bill Updates',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#059669',
        sound: 'default',
        enableLights: true,
        enableVibrate: true,
      });
    }

    if (Device.isDevice) {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus === 'granted') {
        const projectId =
          Constants?.expoConfig?.extra?.eas?.projectId ??
          Constants?.easConfig?.projectId;

        const tokenData = await Notifications.getExpoPushTokenAsync(
          projectId ? { projectId } : undefined
        );
        token = tokenData.data;
      } else {
        console.log('[Push] Notification permission not granted by user.');
      }
    } else {
      // Running on Simulator / Web - Generate a mock/local token for testing
      console.log('[Push] Physical device required for real APNs/FCM push. Using simulator token.');
      let existingSimToken = await AsyncStorage.getItem(PUSH_TOKEN_KEY);
      if (!existingSimToken) {
        existingSimToken = `SIMULATED_${Platform.OS.toUpperCase()}_${Math.random().toString(36).substring(2, 10)}`;
      }
      token = existingSimToken;
    }

    if (token) {
      await AsyncStorage.setItem(PUSH_TOKEN_KEY, token);
      // Register with backend
      await authApi.registerPushToken(token, Platform.OS);
      console.log('[Push Notification Token Registered]:', token);
    }
  } catch (err: any) {
    console.warn('[Push Registration Notice]:', err.message);
  }

  return token;
};

/**
 * Unregister push notification token on logout
 */
export const unregisterPushNotificationsAsync = async (): Promise<void> => {
  try {
    const token = await AsyncStorage.getItem(PUSH_TOKEN_KEY);
    if (token) {
      await authApi.removePushToken(token);
      await AsyncStorage.removeItem(PUSH_TOKEN_KEY);
    }
  } catch (err: any) {
    console.warn('[Push Unregister Error]:', err.message);
  }
};
