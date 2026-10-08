import { downloadPdf } from '../services/api';

interface CustomerPdfData {
  shop: {
    name?: string;
    phone?: string;
    address?: string;
    upiId?: string;
    currency?: string;
  };
  customer: {
    name: string;
    phone?: string;
    email?: string;
    address?: string;
  };
  startDate?: string;
  endDate?: string;
  openingBalance: number;
  periodPurchases: number;
  periodPayments: number;
  closingBalance: number;
  transactions: Array<{
    date: string;
    billNo?: string;
    description: string;
    debit?: number;
    credit?: number;
    runningBalance?: number;
    paymentMethod?: string;
  }>;
}

interface GallaPdfData {
  shop: {
    name?: string;
    phone?: string;
    address?: string;
    currency?: string;
  };
  startDate: string;
  endDate: string;
  openingCash: number;
  cashSales: number;
  customerCollected: number;
  expenses: number;
  expectedCash: number;
  closingCashCounted?: number;
  difference?: number;
  status?: string;
}

const fileName = (prefix: string, label: string) =>
  `${prefix}-${String(label || 'report').replace(/[^a-zA-Z0-9]+/g, '-')}.pdf`;

export const printCustomerStatementPdf = (data: CustomerPdfData) =>
  downloadPdf('/reports/statement', data, fileName('statement', data.customer.name));

export const printGallaReportPdf = (data: GallaPdfData) =>
  downloadPdf('/reports/galla', data, fileName('galla', data.startDate));
