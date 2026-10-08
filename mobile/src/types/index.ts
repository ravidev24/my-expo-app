export type UserRole = 'system_admin' | 'shop_owner' | 'customer';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  phone?: string;
  status: 'active' | 'inactive' | 'pending_setup';
  avatar?: string;
  shopId?: string;
}

export interface Shop {
  id: string;
  name: string;
  phone?: string;
  address?: string;
  city?: string;
  currency: string;
  currencyCode?: string;
  upiId?: string;
  tagline?: string;
}

export interface CustomerProfile {
  id: string;
  userId?: string;
  shopId: string;
  name: string;
  email: string;
  phone?: string;
  address?: string;
  creditLimit: number;
  totalPurchases: number;
  totalPayments: number;
  outstandingBalance: number;
  notes?: string;
  status: 'active' | 'inactive';
  createdAt?: string;
  updatedAt?: string;
}

export interface PurchaseItem {
  name: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  amount: number;
  category?: string;
  notes?: string;
}

export interface Purchase {
  _id: string;
  shopId: string | Shop;
  customerId: string | CustomerProfile;
  customerUserId?: string;
  billNo: string;
  date: string;
  items: PurchaseItem[];
  subtotal: number;
  discount: number;
  tax: number;
  totalAmount: number;
  paidAmount: number;
  paymentStatus: 'unpaid' | 'partially_paid' | 'paid';
  notes?: string;
  createdBy?: string;
  createdAt: string;
}

export interface Payment {
  _id: string;
  shopId: string | Shop;
  customerId: string | CustomerProfile;
  customerUserId?: string;
  receiptNo: string;
  date: string;
  amount: number;
  paymentMethod: 'cash' | 'upi' | 'card' | 'bank_transfer' | 'cheque' | 'other';
  referenceNo?: string;
  notes?: string;
  recordedBy?: string;
  createdAt: string;
}

export interface LedgerEntry {
  id: string;
  type: 'purchase' | 'payment';
  date: string;
  billNo: string;
  description: string;
  items?: PurchaseItem[];
  debit: number;
  credit: number;
  runningBalance: number;
  paymentMethod?: string;
  referenceNo?: string;
  notes?: string;
  raw?: Purchase | Payment;
}

export interface DashboardMetrics {
  totalCustomers: number;
  activeCustomers: number;
  customersWithBalance: number;
  todaySales: number;
  todayPurchasesCount: number;
  todayCollected: number;
  monthlySales: number;
  monthlyCollected: number;
  totalOutstanding: number;
  totalPurchasesAllTime: number;
  totalPaymentsAllTime: number;
}

export interface MonthlyTrend {
  month: string;
  year: number;
  sales: number;
  collected: number;
}

export interface CustomerExpenseStats {
  thisMonthSpent: number;
  thisMonthPurchases: number;
  totalSpentAllTime: number;
  totalPaidAllTime: number;
  outstandingBalance: number;
  lastPurchaseDate?: string;
  lastPaymentDate?: string;
}

export interface CustomerExpenseOverview {
  shop: Shop;
  profile: CustomerProfile;
  stats: CustomerExpenseStats;
  monthlyBreakdown: { month: string; year: number; amount: number }[];
}

export interface PlatformStats {
  totalShopOwners: number;
  totalShops: number;
  totalCustomers: number;
  totalPurchases: number;
  totalPayments: number;
  totalSales: number;
  totalCollected: number;
  totalOutstanding: number;
}

export interface ShopOwnerItem {
  id: string;
  name: string;
  email: string;
  phone?: string;
  status: 'active' | 'inactive';
  createdAt: string;
  shop: Shop | null;
  customerCount: number;
  purchaseCount: number;
}
