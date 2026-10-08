import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { User, Shop, CustomerProfile, UserRole } from '../types';
import { authApi, setStoredAuthToken, getStoredAuthToken } from '../services/api';
import { registerForPushNotificationsAsync, unregisterPushNotificationsAsync } from '../services/notifications';

interface AuthContextType {
  user: User | null;
  shop: Shop | null;
  customerProfile: CustomerProfile | null;
  token: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string; role?: UserRole; shop?: Shop | null }>;
  googleLogin: (email: string, name?: string) => Promise<{ success: boolean; error?: string }>;
  quickDemoLogin: (role: UserRole) => Promise<boolean>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  updateShop: (shop: Shop) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [shop, setShop] = useState<Shop | null>(null);
  const [customerProfile, setCustomerProfile] = useState<CustomerProfile | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Load stored auth session on mount
  useEffect(() => {
    const bootstrap = async () => {
      try {
        const storedToken = await getStoredAuthToken();
        if (storedToken) {
          setToken(storedToken);
          const res = await authApi.getMe();
          if (res.success && res.user) {
            setUser(res.user);
            if (res.shop) setShop(res.shop);
            if (res.customerProfile) setCustomerProfile(res.customerProfile);
            // Register device for push notifications
            registerForPushNotificationsAsync().catch((err) => console.warn(err));
          }
        }
      } catch (err) {
        console.warn('[AuthContext] Session restore failed:', err);
        await setStoredAuthToken(null);
      } finally {
        setIsLoading(false);
      }
    };

    bootstrap();
  }, []);

  const login = async (email: string, password: string) => {
    try {
      setIsLoading(true);
      const res = await authApi.login({ email, password });
      if (res.success && res.token) {
        setToken(res.token);
        await setStoredAuthToken(res.token);
        setUser(res.user);
        if (res.shop) setShop(res.shop);
        if (res.customerProfile) setCustomerProfile(res.customerProfile);
        // Register device for push notifications
        registerForPushNotificationsAsync().catch((err) => console.warn(err));
        return { success: true, role: res.user.role, shop: res.shop || null };
      }
      return { success: false, error: res.message || 'Login failed' };
    } catch (err: any) {
      return { success: false, error: err.message || 'Network error or invalid credentials' };
    } finally {
      setIsLoading(false);
    }
  };

  const googleLogin = async (email: string, name?: string) => {
    try {
      setIsLoading(true);
      const res = await authApi.googleLogin({ email, name });
      if (res.success && res.token) {
        setToken(res.token);
        await setStoredAuthToken(res.token);
        setUser(res.user);
        if (res.shop) setShop(res.shop);
        if (res.customerProfile) setCustomerProfile(res.customerProfile);
        return { success: true };
      }
      return { success: false, error: res.message || 'Google login failed' };
    } catch (err: any) {
      return { success: false, error: err.message || 'Google login failed' };
    } finally {
      setIsLoading(false);
    }
  };

  const quickDemoLogin = async (role: UserRole) => {
    const credentials: Record<UserRole, { email: string; pass: string }> = {
      system_admin: { email: 'admin@system.com', pass: 'Admin@123' },
      shop_owner: { email: 'owner@freshmart.com', pass: 'Owner@123' },
      customer: { email: 'john@example.com', pass: 'Customer@123' },
    };

    const target = credentials[role];
    if (target) {
      const res = await login(target.email, target.pass);
      return res.success;
    }
    return false;
  };

  const logout = async () => {
    try {
      await unregisterPushNotificationsAsync().catch(() => {});
      await authApi.logout();
    } catch (err) {
      console.warn('[AuthContext] Logout API failed:', err);
    }
    setUser(null);
    setShop(null);
    setCustomerProfile(null);
    setToken(null);
    await setStoredAuthToken(null);
  };

  const refreshUser = async () => {
    try {
      const res = await authApi.getMe();
      if (res.success && res.user) {
        setUser(res.user);
        if (res.shop) setShop(res.shop);
        if (res.customerProfile) setCustomerProfile(res.customerProfile);
      }
    } catch (err) {
      console.warn('[AuthContext] Refresh user error:', err);
    }
  };

  const updateShop = (newShop: Shop) => {
    setShop(newShop);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        shop,
        customerProfile,
        token,
        isLoading,
        login,
        googleLogin,
        quickDemoLogin,
        logout,
        refreshUser,
        updateShop,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
