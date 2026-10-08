import { Platform } from 'react-native';

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

export const printCustomerStatementPdf = (data: CustomerPdfData) => {
  const currency = data.shop.currency || '₹';
  const shopName = data.shop.name || 'FreshMart Grocery';
  const shopPhone = data.shop.phone || '+91 63795 17503';
  const shopAddress = data.shop.address || '';
  const upiId = data.shop.upiId || '';

  const dateRangeStr =
    data.startDate && data.endDate
      ? `${data.startDate} to ${data.endDate}`
      : data.startDate
      ? `From ${data.startDate}`
      : 'Full Account History';

  const rowsHtml = data.transactions
    .map(
      (tx, idx) => `
      <tr style="border-bottom: 1px solid #e2e8f0; background: ${idx % 2 === 0 ? '#ffffff' : '#f8fafc'};">
        <td style="padding: 10px; font-size: 12px; color: #334155;">${tx.date ? new Date(tx.date).toLocaleDateString('en-IN') : '-'}</td>
        <td style="padding: 10px; font-size: 12px; font-weight: bold; color: #1e293b;">${tx.billNo || '-'}</td>
        <td style="padding: 10px; font-size: 12px; color: #475569;">${tx.description || '-'}</td>
        <td style="padding: 10px; font-size: 12px; font-weight: bold; color: #dc2626; text-align: right;">
          ${tx.debit && tx.debit > 0 ? `${currency}${Number(tx.debit).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '-'}
        </td>
        <td style="padding: 10px; font-size: 12px; font-weight: bold; color: #16a34a; text-align: right;">
          ${tx.credit && tx.credit > 0 ? `${currency}${Number(tx.credit).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '-'}
        </td>
        <td style="padding: 10px; font-size: 12px; font-weight: 800; color: #0f172a; text-align: right;">
          ${tx.runningBalance !== undefined ? `${currency}${Number(tx.runningBalance).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '-'}
        </td>
      </tr>
    `
    )
    .join('');

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8" />
      <title>Account Statement - ${data.customer.name}</title>
      <style>
        @page { size: A4 portrait; margin: 15mm; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b; margin: 0; padding: 10px; }
        .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #10b981; padding-bottom: 16px; margin-bottom: 20px; }
        .shop-title { font-size: 24px; font-weight: 900; color: #065f46; margin: 0; }
        .shop-sub { font-size: 12px; color: #64748b; margin-top: 4px; }
        .doc-title { font-size: 18px; font-weight: 900; color: #0f172a; text-align: right; text-transform: uppercase; letter-spacing: 0.5px; }
        .doc-date { font-size: 11px; color: #64748b; text-align: right; margin-top: 4px; }
        .summary-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 20px; }
        .summary-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; text-align: center; }
        .summary-card.due { background: #fef2f2; border-color: #fecaca; }
        .summary-card.got { background: #f0fdf4; border-color: #bbf7d0; }
        .card-label { font-size: 10px; font-weight: 800; color: #64748b; text-transform: uppercase; }
        .card-val { font-size: 18px; font-weight: 900; margin-top: 4px; }
        .cust-box { background: #f1f5f9; border-radius: 8px; padding: 12px; margin-bottom: 16px; }
        table { width: 100%; border-collapse: collapse; margin-top: 10px; }
        th { background: #1e293b; color: #ffffff; padding: 10px; font-size: 11px; font-weight: bold; text-transform: uppercase; text-align: left; }
        th.num { text-align: right; }
        .footer { margin-top: 40px; display: flex; justify-content: space-between; align-items: flex-end; border-top: 1px solid #cbd5e1; padding-top: 20px; }
        .sig-box { text-align: center; width: 180px; }
        .sig-line { border-top: 1px dashed #94a3b8; margin-top: 40px; padding-top: 6px; font-size: 11px; font-weight: bold; color: #475569; }
        @media print {
          button { display: none !important; }
        }
      </style>
    </head>
    <body>
      <div class="header">
        <div>
          <h1 class="shop-title">🏪 ${shopName}</h1>
          <div class="shop-sub">${shopAddress ? `${shopAddress} • ` : ''}Phone: ${shopPhone}</div>
          ${upiId ? `<div class="shop-sub" style="font-weight: bold; color: #059669;">UPI ID: ${upiId}</div>` : ''}
        </div>
        <div>
          <div class="doc-title">CUSTOMER STATEMENT</div>
          <div class="doc-date">Period: ${dateRangeStr}</div>
          <div class="doc-date">Generated: ${new Date().toLocaleString('en-IN')}</div>
        </div>
      </div>

      <div class="cust-box">
        <div style="font-size: 14px; font-weight: 900; color: #0f172a;">Customer: ${data.customer.name}</div>
        <div style="font-size: 12px; color: #475569; margin-top: 2px;">
          ${data.customer.phone ? `📱 ${data.customer.phone} ` : ''}
          ${data.customer.email ? `• ✉️ ${data.customer.email}` : ''}
          ${data.customer.address ? `• 📍 ${data.customer.address}` : ''}
        </div>
      </div>

      <div class="summary-grid">
        <div class="summary-card">
          <div class="card-label">Opening Balance</div>
          <div class="card-val" style="color: #475569;">${currency}${Number(data.openingBalance || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
        </div>
        <div class="summary-card due">
          <div class="card-label" style="color: #991b1b;">Total Purchases (Gave)</div>
          <div class="card-val" style="color: #dc2626;">+${currency}${Number(data.periodPurchases || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
        </div>
        <div class="summary-card got">
          <div class="card-label" style="color: #166534;">Total Received (Got)</div>
          <div class="card-val" style="color: #16a34a;">-${currency}${Number(data.periodPayments || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
        </div>
        <div class="summary-card due">
          <div class="card-label" style="color: #991b1b;">Net Balance Due</div>
          <div class="card-val" style="color: #b91c1c;">${currency}${Number(data.closingBalance || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>Ref / Bill No</th>
            <th>Description / Details</th>
            <th class="num">Debit (You Gave)</th>
            <th class="num">Credit (You Got)</th>
            <th class="num">Running Balance</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml || '<tr><td colspan="6" style="padding: 20px; text-align: center; color: #94a3b8;">No transactions found for this date range.</td></tr>'}
        </tbody>
      </table>

      <div class="footer">
        <div>
          <div style="font-size: 11px; color: #64748b;">Terms: Please verify transactions and clear outstanding dues promptly.</div>
          <div style="font-size: 10px; color: #94a3b8; margin-top: 4px;">FreshMart Digital Ledger • 100% Secure & Verified</div>
        </div>
        <div class="sig-box">
          <div class="sig-line">Authorized Signatory</div>
        </div>
      </div>

      <script>
        window.onload = function() {
          window.print();
        }
      </script>
    </body>
    </html>
  `;

  if (typeof window !== 'undefined') {
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.open();
      printWindow.document.write(htmlContent);
      printWindow.document.close();
    }
  }
};

export const printGallaReportPdf = (data: GallaPdfData) => {
  const currency = data.shop.currency || '₹';
  const shopName = data.shop.name || 'FreshMart Grocery';
  const shopPhone = data.shop.phone || '+91 63795 17503';

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8" />
      <title>Daily Galla Report - ${data.startDate}</title>
      <style>
        @page { size: A4 portrait; margin: 15mm; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b; margin: 0; padding: 10px; }
        .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #10b981; padding-bottom: 16px; margin-bottom: 20px; }
        .shop-title { font-size: 24px; font-weight: 900; color: #065f46; margin: 0; }
        .doc-title { font-size: 18px; font-weight: 900; color: #0f172a; text-align: right; text-transform: uppercase; }
        .doc-date { font-size: 11px; color: #64748b; text-align: right; margin-top: 4px; }
        .summary-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 20px; }
        .summary-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px; text-align: center; }
        .card-label { font-size: 10px; font-weight: 800; color: #64748b; text-transform: uppercase; }
        .card-val { font-size: 20px; font-weight: 900; margin-top: 4px; }
        table { width: 100%; border-collapse: collapse; margin-top: 16px; }
        td { padding: 12px; font-size: 13px; border-bottom: 1px solid #e2e8f0; }
        .footer { margin-top: 40px; display: flex; justify-content: space-between; align-items: flex-end; border-top: 1px solid #cbd5e1; padding-top: 20px; }
        @media print { button { display: none !important; } }
      </style>
    </head>
    <body>
      <div class="header">
        <div>
          <h1 class="shop-title">🏪 ${shopName}</h1>
          <div style="font-size: 12px; color: #64748b; margin-top: 4px;">Phone: ${shopPhone}</div>
        </div>
        <div>
          <div class="doc-title">DAILY GALLA DAY-BOOK REPORT</div>
          <div class="doc-date">Date Range: ${data.startDate} to ${data.endDate}</div>
          <div class="doc-date">Status: ${data.status === 'closed' ? '✓ Closed & Balanced' : '🟢 Active Day'}</div>
        </div>
      </div>

      <div class="summary-grid">
        <div class="summary-card">
          <div class="card-label">Opening Drawer Cash</div>
          <div class="card-val" style="color: #475569;">${currency}${Number(data.openingCash || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
        </div>
        <div class="summary-card">
          <div class="card-label" style="color: #166534;">Direct Cash Sales</div>
          <div class="card-val" style="color: #16a34a;">+${currency}${Number(data.cashSales || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
        </div>
        <div class="summary-card">
          <div class="card-label" style="color: #166534;">Customer Udhaar Collected</div>
          <div class="card-val" style="color: #16a34a;">+${currency}${Number(data.customerCollected || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
        </div>
        <div class="summary-card">
          <div class="card-label" style="color: #991b1b;">Drawer Expenses</div>
          <div class="card-val" style="color: #dc2626;">-${currency}${Number(data.expenses || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
        </div>
        <div class="summary-card" style="background: #ecfdf5; border-color: #a7f3d0;">
          <div class="card-label" style="color: #065f46;">Expected Cash in Drawer</div>
          <div class="card-val" style="color: #047857;">${currency}${Number(data.expectedCash || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
        </div>
        ${
          data.closingCashCounted !== undefined && data.closingCashCounted !== null
            ? `
          <div class="summary-card" style="background: #f1f5f9;">
            <div class="card-label">Physical Cash Counted</div>
            <div class="card-val" style="color: #0f172a;">${currency}${Number(data.closingCashCounted || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
          </div>
        `
            : ''
        }
      </div>

      <div class="footer">
        <div style="font-size: 11px; color: #94a3b8;">Generated via FreshMart Daily Galla Register</div>
        <div style="text-align: center; width: 180px; border-top: 1px dashed #94a3b8; padding-top: 6px; font-size: 11px; font-weight: bold; color: #475569;">
          Shop Owner Signature
        </div>
      </div>

      <script>
        window.onload = function() {
          window.print();
        }
      </script>
    </body>
    </html>
  `;

  if (typeof window !== 'undefined') {
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.open();
      printWindow.document.write(htmlContent);
      printWindow.document.close();
    }
  }
};
