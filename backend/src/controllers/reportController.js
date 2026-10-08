const PDFDocument = require('pdfkit');

const money = (value) => {
  const amount = Number(value) || 0;
  return `Rs ${amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const sendPdf = (res, filename, draw) => {
  const doc = new PDFDocument({ margin: 40, size: 'A4' });
  const chunks = [];
  doc.on('data', (chunk) => chunks.push(chunk));
  doc.on('end', () => {
    const pdf = Buffer.concat(chunks);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', pdf.length);
    res.send(pdf);
  });
  draw(doc);
  doc.end();
};

const statementPdf = (req, res) => {
  const data = req.body || {};
  const shop = data.shop || {};
  const customer = data.customer || {};
  const transactions = Array.isArray(data.transactions) ? data.transactions : [];
  const shopName = shop.name || 'Digimart';
  const safeName = String(customer.name || 'customer').replace(/[^a-zA-Z0-9]+/g, '-');
  const period =
    data.startDate && data.endDate
      ? `${data.startDate} to ${data.endDate}`
      : data.startDate
        ? `From ${data.startDate}`
        : 'Full account history';

  sendPdf(res, `statement-${safeName}.pdf`, (doc) => {
    doc.fontSize(20).fillColor('#065f46').text(shopName);
    doc.moveDown(0.2);
    doc.fontSize(10).fillColor('#64748b').text([shop.address, shop.phone].filter(Boolean).join('  |  ') || 'Digimart');
    if (shop.upiId) doc.text(`UPI: ${shop.upiId}`);
    doc.moveDown(0.4);
    doc.fontSize(14).fillColor('#0f172a').text('CUSTOMER STATEMENT', { align: 'right' });
    doc.fontSize(10).fillColor('#64748b').text(`Period: ${period}`, { align: 'right' });
    doc.text(`Generated: ${new Date().toLocaleString('en-IN')}`, { align: 'right' });
    doc.moveDown();
    doc.fontSize(12).fillColor('#0f172a').text(`Customer: ${customer.name || '-'}`);
    doc.fontSize(10).fillColor('#475569').text([customer.phone, customer.email].filter(Boolean).join('  |  ') || '');
    doc.moveDown();
    doc.fontSize(11).fillColor('#0f172a');
    doc.text(`Opening balance: ${money(data.openingBalance)}`);
    doc.text(`Purchases: ${money(data.periodPurchases)}`);
    doc.text(`Received: ${money(data.periodPayments)}`);
    doc.text(`Balance due: ${money(data.closingBalance)}`);
    doc.moveDown();

    const startY = doc.y;
    const columns = [40, 110, 180, 340, 420, 500];
    doc.fontSize(9).fillColor('#ffffff');
    doc.rect(40, startY, 515, 18).fill('#1e293b');
    doc.fillColor('#ffffff').text('Date', columns[0] + 4, startY + 5, { width: 66 });
    doc.text('Bill', columns[1] + 4, startY + 5, { width: 66 });
    doc.text('Details', columns[2] + 4, startY + 5, { width: 150 });
    doc.text('Debit', columns[3] + 4, startY + 5, { width: 70 });
    doc.text('Credit', columns[4] + 4, startY + 5, { width: 70 });
    doc.text('Balance', columns[5] + 4, startY + 5, { width: 50 });
    doc.fillColor('#0f172a');
    let y = startY + 24;

    if (!transactions.length) {
      doc.fontSize(10).text('No transactions for this date range.', 40, y);
      return;
    }

    transactions.forEach((tx) => {
      if (y > 760) {
        doc.addPage();
        y = 50;
      }
      const date = tx.date ? new Date(tx.date).toLocaleDateString('en-IN') : '-';
      doc.fontSize(9).fillColor('#334155');
      doc.text(date, columns[0], y, { width: 66 });
      doc.text(tx.billNo || '-', columns[1], y, { width: 66 });
      doc.text(tx.description || '-', columns[2], y, { width: 150 });
      doc.text(tx.debit > 0 ? money(tx.debit) : '-', columns[3], y, { width: 74 });
      doc.text(tx.credit > 0 ? money(tx.credit) : '-', columns[4], y, { width: 74 });
      doc.text(tx.runningBalance !== undefined ? money(tx.runningBalance) : '-', columns[5], y, { width: 55 });
      y += 18;
    });

    doc.moveDown(2);
    doc.fontSize(9).fillColor('#94a3b8').text('Digimart Digital Ledger', 40, Math.max(y + 20, doc.y));
  });
};

const gallaPdf = (req, res) => {
  const data = req.body || {};
  const shop = data.shop || {};
  const shopName = shop.name || 'Digimart';

  sendPdf(res, `galla-${data.startDate || 'report'}.pdf`, (doc) => {
    doc.fontSize(20).fillColor('#065f46').text(shopName);
    doc.moveDown(0.3);
    doc.fontSize(14).fillColor('#0f172a').text('DAILY GALLA DAY-BOOK');
    doc.fontSize(10).fillColor('#64748b').text(`Date range: ${data.startDate || '-'} to ${data.endDate || '-'}`);
    doc.text(`Status: ${data.status === 'closed' ? 'Closed' : 'Active day'}`);
    doc.moveDown();
    doc.fontSize(12).fillColor('#0f172a');
    const lines = [
      ['Opening drawer cash', data.openingCash],
      ['Direct cash sales', data.cashSales],
      ['Customer udhaar collected', data.customerCollected],
      ['Drawer expenses', data.expenses],
      ['Expected cash in drawer', data.expectedCash],
    ];
    lines.forEach(([label, value]) => {
      doc.text(`${label}: ${money(value)}`);
    });
    if (data.closingCashCounted !== undefined && data.closingCashCounted !== null) {
      doc.text(`Physical cash counted: ${money(data.closingCashCounted)}`);
      doc.text(`Difference: ${money(data.difference)}`);
    }
    doc.moveDown(2);
    doc.fontSize(9).fillColor('#94a3b8').text('Generated via Digimart Daily Galla Register');
  });
};

module.exports = { statementPdf, gallaPdf };
