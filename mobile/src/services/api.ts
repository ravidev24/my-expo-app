import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const STORAGE_KEYS = {
  TOKEN: 'grocery_auth_token',
  USER: 'grocery_auth_user',
  API_URL: 'grocery_custom_api_url',
};

// Determine default API base URL
const getDefaultApiUrl = () => {
  if (Platform.OS === 'android') {
    return 'https://my-expo-app-8ohi.onrender.com/api';
  }
  return 'http://localhost:5000/api';
};

let currentApiUrl = getDefaultApiUrl();
let authToken: string | null = null;

const isStorageAvailable = () => {
  if (Platform.OS === 'web') {
    return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
  }
  return true;
};

export const setApiBaseUrl = async (url: string) => {
  currentApiUrl = url.replace(/\/+$/, '');
  if (isStorageAvailable()) {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.API_URL, currentApiUrl);
    } catch {}
  }
};

export const getApiBaseUrl = () => currentApiUrl;

export const setStoredAuthToken = async (token: string | null) => {
  authToken = token;
  if (isStorageAvailable()) {
    try {
      if (token) {
        await AsyncStorage.setItem(STORAGE_KEYS.TOKEN, token);
      } else {
        await AsyncStorage.removeItem(STORAGE_KEYS.TOKEN);
        await AsyncStorage.removeItem(STORAGE_KEYS.USER);
      }
    } catch {}
  }
};

export const getStoredAuthToken = async () => {
  if (authToken) return authToken;
  if (isStorageAvailable()) {
    try {
      authToken = await AsyncStorage.getItem(STORAGE_KEYS.TOKEN);
    } catch {}
  }
  return authToken;
};

// Generic HTTP fetcher
const request = async <T = any>(endpoint: string, options: RequestInit = {}): Promise<T> => {
  const token = await getStoredAuthToken();
  const url = `${currentApiUrl}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  try {
    const res = await fetch(url, {
      ...options,
      headers,
    });

    const data = await res.json();

    if (!res.ok) {
      const errorMsg = data.message || `Request failed with status ${res.status}`;
      throw new Error(errorMsg);
    }

    return data as T;
  } catch (err: any) {
    console.warn(`[API Error] ${options.method || 'GET'} ${url}:`, err.message);
    throw err;
  }
};

// API Services
export const authApi = {
  login: (credentials: { email: string; password: string }) =>
    request('/auth/login', { method: 'POST', body: JSON.stringify(credentials) }),

  getMe: () => request('/auth/me'),

  updateProfile: (data: { name?: string; phone?: string; address?: string }) =>
    request('/auth/profile', { method: 'PUT', body: JSON.stringify(data) }),

  logout: () => request('/auth/logout', { method: 'POST' }),

  changePassword: (payload: { currentPassword: string; newPassword: string }) =>
    request('/auth/change-password', { method: 'POST', body: JSON.stringify(payload) }),

  setupPassword: (payload: { token: string; email?: string; password: string }) =>
    request('/auth/setup-password', { method: 'POST', body: JSON.stringify(payload) }),

  googleLogin: (payload: { email: string; name?: string; googleId?: string; avatar?: string }) =>
    request('/auth/google', { method: 'POST', body: JSON.stringify(payload) }),

  registerPushToken: (pushToken: string, platform?: string) =>
    request('/auth/push-token', { method: 'POST', body: JSON.stringify({ pushToken, platform }) }),

  removePushToken: (pushToken?: string) =>
    request('/auth/push-token', { method: 'DELETE', body: JSON.stringify({ pushToken }) }),
};

export const systemAdminApi = {
  getUsers: () => request('/system-admin/users'),
  createUser: (data: {
    name: string;
    email: string;
    role: 'system_admin' | 'shop_owner' | 'customer';
    shopOwnerId?: string;
  }) => request('/system-admin/users', { method: 'POST', body: JSON.stringify(data) }),
  getStats: () => request('/system-admin/stats'),
  getShopOwners: () => request('/system-admin/shop-owners'),
  createShopOwner: (data: {
    name: string;
    email: string;
    password?: string;
    phone?: string;
    shopName: string;
    shopAddress?: string;
    currency?: string;
  }) => request('/system-admin/shop-owners', { method: 'POST', body: JSON.stringify(data) }),
  toggleStatus: (id: string) => request(`/system-admin/shop-owners/${id}/status`, { method: 'PATCH' }),
};

export const customerApi = {
  create: (data: {
    name: string;
    phone: string;
    email?: string;
    address?: string;
    creditLimit?: number;
    notes?: string;
  }) => request('/customers', { method: 'POST', body: JSON.stringify(data) }),

  getAll: (params: { search?: string; balanceFilter?: string; status?: string; page?: number; limit?: number } = {}) => {
    const query = new URLSearchParams(params as any).toString();
    return request(`/customers?${query}`);
  },

  getById: (id: string) => request(`/customers/${id}`),

  getLedger: (id: string) => request(`/customers/${id}/ledger`),

  update: (id: string, data: any) =>
    request(`/customers/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

  resendSetupLink: (id: string) =>
    request(`/customers/${id}/resend-setup`, { method: 'POST' }),

  sendPaymentReminder: (id: string, data?: { reason?: string }) =>
    request(`/customers/${id}/send-reminder`, { method: 'POST', body: JSON.stringify(data || {}) }),

  checkAutoReminders: () =>
    request('/customers/check-auto-reminders', { method: 'POST' }),
};

export const purchaseApi = {
  create: (data: {
    customerId: string;
    items: Array<{ name: string; quantity: number; unit: string; unitPrice: number; category?: string; notes?: string }>;
    date?: string;
    discount?: number;
    tax?: number;
    notes?: string;
    paidAmount?: number;
    billNo?: string;
  }) => request('/purchases', { method: 'POST', body: JSON.stringify(data) }),

  getAll: (params: {
    customerId?: string;
    startDate?: string;
    endDate?: string;
    month?: number;
    year?: number;
    search?: string;
    paymentStatus?: string;
    page?: number;
    limit?: number;
  } = {}) => {
    const query = new URLSearchParams(params as any).toString();
    return request(`/purchases?${query}`);
  },

  getById: (id: string) => request(`/purchases/${id}`),

  update: (id: string, data: any) =>
    request(`/purchases/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

  delete: (id: string) => request(`/purchases/${id}`, { method: 'DELETE' }),
};

export const paymentApi = {
  record: (data: {
    customerId: string;
    amount: number;
    paymentMethod: string;
    referenceNo?: string;
    notes?: string;
    date?: string;
  }) => request('/payments', { method: 'POST', body: JSON.stringify(data) }),

  getAll: (params: { customerId?: string; startDate?: string; endDate?: string; paymentMethod?: string; search?: string; limit?: number } = {}) => {
    const query = new URLSearchParams(params as any).toString();
    return request(`/payments?${query}`);
  },

  delete: (id: string) => request(`/payments/${id}`, { method: 'DELETE' }),
};

export const dashboardApi = {
  getShopStats: (shopId?: string) => {
    const query = shopId ? `?shopId=${shopId}` : '';
    return request(`/dashboard${query}`);
  },
  updateShop: (data: { name?: string; phone?: string; address?: string; upiId?: string; tagline?: string; currency?: string }) =>
    request('/dashboard/shop', { method: 'PUT', body: JSON.stringify(data) }),
};

export const customerExpenseApi = {
  getOverview: () => request('/customer-expenses/overview'),
  getPurchases: (params: { month?: number; year?: number; search?: string; page?: number; limit?: number } = {}) => {
    const query = new URLSearchParams(params as any).toString();
    return request(`/customer-expenses/purchases?${query}`);
  },
  getPayments: (params: { page?: number; limit?: number } = {}) => {
    const query = new URLSearchParams(params as any).toString();
    return request(`/customer-expenses/payments?${query}`);
  },
};

export const notificationApi = {
  getMyNotifications: (params: { page?: number; limit?: number } = {}) => {
    const query = new URLSearchParams(params as any).toString();
    return request(`/notifications?${query}`);
  },
  markRead: (id: string) => request(`/notifications/${id}/read`, { method: 'PATCH' }),
  markAllRead: () => request('/notifications/read-all', { method: 'PATCH' }),
  delete: (id: string) => request(`/notifications/${id}`, { method: 'DELETE' }),
};

export const gallaApi = {
  getToday: (date?: string) => {
    const query = date ? `?date=${date}` : '';
    return request(`/galla/today${query}`);
  },
  setOpeningCash: (amount: number, date?: string) =>
    request('/galla/opening-cash', { method: 'POST', body: JSON.stringify({ amount, date }) }),
  addQuickSale: (data: { amount: number; note?: string; source?: string; date?: string }) =>
    request('/galla/quick-sale', { method: 'POST', body: JSON.stringify(data) }),
  addExpense: (data: { amount: number; category?: string; note?: string; date?: string }) =>
    request('/galla/expense', { method: 'POST', body: JSON.stringify(data) }),
  closeGalla: (data: { closingCashCounted: number; notes?: string; date?: string }) =>
    request('/galla/close', { method: 'POST', body: JSON.stringify(data) }),
  getHistory: (params?: { startDate?: string; endDate?: string; limit?: number }) => {
    const q = params
      ? '?' +
        new URLSearchParams(
          Object.entries(params)
            .filter(([_, v]) => v !== undefined && v !== '')
            .map(([k, v]) => [k, String(v)])
        ).toString()
      : '';
    return request(`/galla/history${q}`);
  },
};

export const regularApi = {
  getAll: () => request('/regulars'),
  addItem: (data: { customerId: string; itemName: string; quantity: number; unit?: string; unitPrice: number }) =>
    request('/regulars/item', { method: 'POST', body: JSON.stringify(data) }),
  removeItem: (id: string) => request(`/regulars/item/${id}`, { method: 'DELETE' }),
  batchRecord: (itemIds: string[], date?: string) =>
    request('/regulars/batch-record', { method: 'POST', body: JSON.stringify({ itemIds, date }) }),
};

export const ocrApi = {
  parseBill: (data: { rawText?: string; sampleType?: string }) =>
    request('/ocr/parse-bill', { method: 'POST', body: JSON.stringify(data) }),
};


