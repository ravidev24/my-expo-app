export const formatMoney = (value: number) => {
  const amount = Math.abs(Number(value) || 0).toFixed(2);
  return Number(value) < 0 ? `-₹${amount}` : `₹${amount}`;
};

export const formatDate = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

export const todayInput = () => new Date().toISOString().slice(0, 10);

export const getMonthStartInput = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
};

export const getLast30DaysInput = () => {
  const past = new Date();
  past.setDate(past.getDate() - 30);
  return past.toISOString().slice(0, 10);
};

export type HistoryItem = {
  name: string;
  quantity: number;
  unitPrice: number;
  amount: number;
};

export type HistoryRow = {
  id: string;
  date: string;
  createdAt?: string;
  kind: 'purchase' | 'payment';
  items: HistoryItem[];
  delta: number;
  balance: number;
  billNo?: string;
  receiptNo?: string;
  paymentMethod?: string;
  notes?: string;
};

export const buildHistory = (
  purchases: Array<{
    _id: string;
    date: string;
    createdAt?: string;
    totalAmount: number;
    billNumber?: string;
    items?: HistoryItem[];
    notes?: string;
  }>,
  payments: Array<{
    _id: string;
    date: string;
    createdAt?: string;
    amount: number;
    receiptNumber?: string;
    paymentMethod?: string;
    notes?: string;
  }>
): HistoryRow[] => {
  const rows = [
    ...purchases.map((purchase) => ({
      id: String(purchase._id),
      date: purchase.date,
      createdAt: purchase.createdAt || purchase.date,
      kind: 'purchase' as const,
      items: purchase.items || [],
      delta: Number(purchase.totalAmount) || 0,
      billNo: purchase.billNumber,
      notes: purchase.notes,
    })),
    ...payments.map((payment) => ({
      id: String(payment._id),
      date: payment.date,
      createdAt: payment.createdAt || payment.date,
      kind: 'payment' as const,
      items: [] as HistoryItem[],
      delta: -(Number(payment.amount) || 0),
      receiptNo: payment.receiptNumber,
      paymentMethod: payment.paymentMethod || 'cash',
      notes: payment.notes,
    })),
  ].sort((a, b) => {
    const byDate = new Date(a.date).getTime() - new Date(b.date).getTime();
    if (byDate !== 0) return byDate;
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  });

  let balance = 0;
  return rows.map((row) => {
    balance = Math.round((balance + row.delta) * 100) / 100;
    return {
      id: row.id,
      date: row.date,
      createdAt: row.createdAt,
      kind: row.kind,
      items: row.items,
      delta: row.delta,
      balance,
      billNo: (row as any).billNo,
      receiptNo: (row as any).receiptNo,
      paymentMethod: (row as any).paymentMethod,
      notes: (row as any).notes,
    };
  });
};

export interface FilteredHistorySummary {
  openingBalance: number;
  periodPurchases: number;
  periodPayments: number;
  closingBalance: number;
  filteredRows: HistoryRow[];
}

export const filterHistoryByDateRange = (
  allRows: HistoryRow[],
  startDate?: string,
  endDate?: string
): FilteredHistorySummary => {
  const startNormalized = startDate ? startDate.trim().slice(0, 10) : '';
  const endNormalized = endDate ? endDate.trim().slice(0, 10) : '';

  let openingBalance = 0;
  let periodPurchases = 0;
  let periodPayments = 0;
  const filteredRows: HistoryRow[] = [];

  for (const row of allRows) {
    const rowDateStr = (row.date || '').slice(0, 10);

    if (startNormalized && rowDateStr < startNormalized) {
      openingBalance = Math.round((openingBalance + row.delta) * 100) / 100;
      continue;
    }

    if (endNormalized && rowDateStr > endNormalized) {
      continue;
    }

    // Inside the range
    if (row.kind === 'purchase') {
      periodPurchases = Math.round((periodPurchases + Math.abs(row.delta)) * 100) / 100;
    } else {
      periodPayments = Math.round((periodPayments + Math.abs(row.delta)) * 100) / 100;
    }
    filteredRows.push(row);
  }

  const closingBalance = Math.round((openingBalance + periodPurchases - periodPayments) * 100) / 100;

  return {
    openingBalance,
    periodPurchases,
    periodPayments,
    closingBalance,
    filteredRows,
  };
};

export const balanceClass = (value: number) => {
  if (value < 0) return 'text-sky-700 dark:text-sky-300';
  if (value > 0) return 'text-amber-700 dark:text-amber-300';
  return 'text-emerald-700 dark:text-emerald-300';
};

