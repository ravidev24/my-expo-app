import React from 'react';
import { Text, View } from 'react-native';
import { evaluateCustomerRisk } from '../lib/creditRisk';

interface RiskBadgeProps {
  customer: {
    outstandingBalance?: number;
    creditLimit?: number;
    lastPaymentDate?: string | Date | null;
    updatedAt?: string | Date;
    createdAt?: string | Date;
    riskCategory?: string;
  };
  showReason?: boolean;
}

export function RiskBadge({ customer, showReason = false }: RiskBadgeProps) {
  const risk = evaluateCustomerRisk(customer);

  return (
    <View className="items-start">
      <View
        className={`flex-row items-center gap-1.5 px-2.5 py-1 rounded-full border ${risk.badgeBg} ${risk.borderColor}`}
      >
        <View
          style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: risk.dotColor }}
        />
        <Text className={`text-[11px] font-bold ${risk.badgeText}`}>
          {risk.label}
        </Text>
      </View>
      {showReason && (
        <Text className="text-slate-500 dark:text-slate-400 text-[11px] mt-1">
          {risk.reason}
        </Text>
      )}
    </View>
  );
}
