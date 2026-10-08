export type RiskLevel = 'low' | 'medium' | 'high';

export interface CustomerRiskInfo {
  level: RiskLevel;
  score: number; // 0 to 100
  label: string;
  badgeBg: string;
  badgeText: string;
  borderColor: string;
  dotColor: string;
  reason: string;
  overdueDays: number;
}

export const evaluateCustomerRisk = (customer: {
  outstandingBalance?: number;
  creditLimit?: number;
  lastPaymentDate?: string | Date | null;
  updatedAt?: string | Date;
  createdAt?: string | Date;
  riskCategory?: string;
}): CustomerRiskInfo => {
  const balance = Number(customer.outstandingBalance) || 0;
  const limit = Number(customer.creditLimit) || 10000;

  // If manually set on customer
  if (customer.riskCategory === 'high') {
    return {
      level: 'high',
      score: 85,
      label: 'High Risk',
      badgeBg: 'bg-red-500/15 dark:bg-red-500/20',
      badgeText: 'text-red-700 dark:text-red-300',
      borderColor: 'border-red-500/30',
      dotColor: '#ef4444',
      reason: 'Flagged as high overdue risk',
      overdueDays: 45,
    };
  }

  // Calculate days since last payment or activity
  const refDate = customer.lastPaymentDate || customer.updatedAt || customer.createdAt || new Date();
  const diffTime = Math.abs(Date.now() - new Date(refDate).getTime());
  const overdueDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

  const usageRatio = limit > 0 ? balance / limit : 0;

  // 1. Zero or negative balance -> always Low Risk
  if (balance <= 0) {
    return {
      level: 'low',
      score: 10,
      label: 'Clear Account',
      badgeBg: 'bg-emerald-500/15 dark:bg-emerald-500/20',
      badgeText: 'text-emerald-700 dark:text-emerald-300',
      borderColor: 'border-emerald-500/30',
      dotColor: '#10b981',
      reason: 'Zero outstanding dues',
      overdueDays: 0,
    };
  }

  // 2. High Risk: >80% limit OR > 30 days overdue
  if (usageRatio > 0.85 || overdueDays > 30 || balance > limit) {
    return {
      level: 'high',
      score: 90,
      label: 'High Risk',
      badgeBg: 'bg-red-500/15 dark:bg-red-500/20',
      badgeText: 'text-red-700 dark:text-red-300',
      borderColor: 'border-red-500/30',
      dotColor: '#ef4444',
      reason:
        balance > limit
          ? `Exceeded credit limit (₹${balance}/₹${limit})`
          : overdueDays > 30
          ? `No payment in ${overdueDays} days`
          : 'High credit utilization',
      overdueDays,
    };
  }

  // 3. Medium Risk: 50%-85% limit OR 15-30 days
  if (usageRatio >= 0.5 || overdueDays >= 15) {
    return {
      level: 'medium',
      score: 55,
      label: 'Attention Due',
      badgeBg: 'bg-amber-500/15 dark:bg-amber-500/20',
      badgeText: 'text-amber-700 dark:text-amber-300',
      borderColor: 'border-amber-500/30',
      dotColor: '#f59e0b',
      reason: overdueDays >= 15 ? `Pending for ${overdueDays} days` : 'Moderate credit usage',
      overdueDays,
    };
  }

  // 4. Low Risk
  return {
    level: 'low',
    score: 25,
    label: 'Good Standing',
    badgeBg: 'bg-emerald-500/15 dark:bg-emerald-500/20',
    badgeText: 'text-emerald-700 dark:text-emerald-300',
    borderColor: 'border-emerald-500/30',
    dotColor: '#10b981',
    reason: 'Recent payments within limit',
    overdueDays,
  };
};
