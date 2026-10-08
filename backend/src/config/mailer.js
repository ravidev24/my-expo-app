const nodemailer = require('nodemailer');

// Configure transporter
const createTransporter = () => {
  if (process.env.SMTP_HOST && process.env.SMTP_USER) {
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }
  
  // Return null if no SMTP is configured - will log simulated emails
  return null;
};

const sendPasswordSetupEmail = async ({ to, name, token, role, shopName }) => {
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:8081';
  const setupUrl = `${frontendUrl}/setup-password?token=${token}&email=${encodeURIComponent(to)}`;
  
  const transporter = createTransporter();
  const subject = `Welcome to ${shopName || 'FreshMart Grocery'} - Set Up Your Account Password`;
  const textContent = `Hello ${name},\n\nYou have been registered as a ${role || 'customer'} at ${shopName || 'our grocery store'}.\n\nPlease set up your secure password by opening the link below:\n\n${setupUrl}\n\nThis link will expire in 48 hours.\n\nThank you!`;
  const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
      <h2 style="color: #059669;">Welcome to ${shopName || 'FreshMart Grocery'}</h2>
      <p>Hello <strong>${name}</strong>,</p>
      <p>You have been registered as a <strong>${role || 'Customer'}</strong>. You can view your purchase history, grocery receipts, and track your expenses and balances anytime.</p>
      <p>Please click the button below to set up your account password:</p>
      <div style="text-align: center; margin: 30px 0;">
        <a href="${setupUrl}" style="background-color: #059669; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
          Set Up Password
        </a>
      </div>
      <p style="color: #64748b; font-size: 13px;">Or copy and paste this link in your browser:<br/><a href="${setupUrl}">${setupUrl}</a></p>
      <p style="color: #94a3b8; font-size: 12px; margin-top: 30px; border-top: 1px solid #e2e8f0; padding-top: 10px;">
        This invitation link expires in 48 hours. If you did not expect this email, please ignore it.
      </p>
    </div>
  `;

  if (transporter) {
    try {
      const info = await transporter.sendMail({
        from: process.env.EMAIL_FROM || '"FreshMart Grocery" <noreply@freshmart.com>',
        to,
        subject,
        text: textContent,
        html: htmlContent,
      });
      console.log(`[Mailer] Setup email sent to ${to}: ${info.messageId}`);
      return { success: true, mode: 'smtp', messageId: info.messageId, setupUrl };
    } catch (err) {
      console.error(`[Mailer] Failed to send email via SMTP:`, err.message);
    }
  }

  // Simulated mode (Dev / No SMTP)
  console.log(`\n======================================================`);
  console.log(`[EMAIL SIMULATOR] To: ${to}`);
  console.log(`[EMAIL SIMULATOR] Subject: ${subject}`);
  console.log(`[EMAIL SIMULATOR] Password Setup URL: ${setupUrl}`);
  console.log(`======================================================\n`);

  return {
    success: true,
    mode: 'simulated',
    setupUrl,
    token,
  };
};

const sendLoginPasswordEmail = async ({ to, name, password, role }) => {
  const roleLabel = role || 'user';
  const transporter = createTransporter();
  const loginUrl = process.env.FRONTEND_URL || 'http://localhost:8081';

  const subject = 'Your FreshMart account password';
  const textContent = `Hello ${name},\n\nAn account was created for you as ${roleLabel}.\n\nEmail: ${to}\nPassword: ${password}\n\nSign in at ${loginUrl}/login\n\nPlease keep this password private.`;
  const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
      <h2 style="color: #059669;">Your FreshMart account</h2>
      <p>Hello <strong>${name}</strong>,</p>
      <p>An account was created for you as <strong>${roleLabel}</strong>.</p>
      <p>Email: <strong>${to}</strong><br/>Password: <strong>${password}</strong></p>
      <p>Sign in at <a href="${loginUrl}/login">${loginUrl}/login</a></p>
    </div>
  `;

  if (transporter) {
    try {
      const info = await transporter.sendMail({
        from: process.env.EMAIL_FROM || '"FreshMart Grocery" <noreply@freshmart.com>',
        to,
        subject,
        text: textContent,
        html: htmlContent,
      });
      console.log(`[Mailer] Password email sent to ${to}: ${info.messageId}`);
      return { success: true, mode: 'smtp', messageId: info.messageId };
    } catch (err) {
      console.error('[Mailer] Failed to send password email via SMTP:', err.message);
    }
  }

  console.log(`\n======================================================`);
  console.log(`[EMAIL SIMULATOR] To: ${to}`);
  console.log(`[EMAIL SIMULATOR] Subject: ${subject}`);
  console.log(`[EMAIL SIMULATOR] Role: ${roleLabel}`);
  console.log(`[EMAIL SIMULATOR] Password: ${password}`);
  console.log(`======================================================\n`);

  return { success: true, mode: 'simulated', password };
};

// Send Payment Reminder Email with Instant UPI Pay Link & QR code
const sendPaymentReminderEmail = async ({ to, name, shopName, amount, upiId, currency = '₹' }) => {
  const cleanShopName = shopName || 'FreshMart Grocery';
  const cleanUpiId = upiId || 'freshmart@okaxis';
  const upiLink = `upi://pay?pa=${encodeURIComponent(cleanUpiId)}&pn=${encodeURIComponent(cleanShopName)}&am=${amount}&cu=INR`;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(upiLink)}`;
  const subject = `Payment Reminder: ${currency}${amount} Outstanding Balance at ${cleanShopName}`;
  const textContent = `Hello ${name},\n\nYour outstanding account balance at ${cleanShopName} is ${currency}${amount}.\n\nPay easily with any UPI App (GPay, PhonePe, Paytm, BHIM) using this link:\n${upiLink}\n\nShop UPI ID: ${cleanUpiId}\n\nThank you for shopping with us!`;

  const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 580px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background: #ffffff;">
      <div style="text-align: center; border-bottom: 2px solid #059669; padding-bottom: 16px; margin-bottom: 20px;">
        <h2 style="color: #059669; margin: 0;">${cleanShopName}</h2>
        <p style="color: #64748b; font-size: 13px; margin: 4px 0 0 0;">Customer Account Statement & Payment Link</p>
      </div>
      <p style="font-size: 15px; color: #334155;">Hello <strong>${name}</strong>,</p>
      <p style="font-size: 14px; color: #475569;">
        Here is a friendly reminder of your outstanding account balance at <strong>${cleanShopName}</strong>:
      </p>
      
      <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 18px; text-align: center; margin: 20px 0;">
        <span style="font-size: 12px; font-weight: bold; color: #166534; text-transform: uppercase;">Amount Due</span>
        <h1 style="color: #15803d; margin: 6px 0 0 0; font-size: 32px;">${currency}${Number(amount).toFixed(2)}</h1>
      </div>

      <div style="text-align: center; margin: 24px 0;">
        <a href="${upiLink}" style="background-color: #059669; color: #ffffff; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px; display: inline-block; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
          📱 Pay Now via UPI
        </a>
      </div>

      <div style="text-align: center; margin: 20px 0;">
        <p style="font-size: 12px; color: #64748b; margin-bottom: 10px;">Or scan this QR Code with Google Pay / PhonePe / Paytm / BHIM:</p>
        <img src="${qrUrl}" alt="UPI Payment QR Code" style="width: 180px; height: 180px; border: 2px solid #e2e8f0; border-radius: 8px; padding: 4px;" />
        <p style="font-size: 13px; font-weight: bold; color: #334155; margin-top: 8px;">Shop UPI ID: ${cleanUpiId}</p>
      </div>
    </div>
  `;

  const transporter = createTransporter();
  if (transporter) {
    try {
      const info = await transporter.sendMail({
        from: process.env.EMAIL_FROM || `"${cleanShopName}" <noreply@freshmart.com>`,
        to,
        subject,
        text: textContent,
        html: htmlContent,
      });
      console.log(`[Mailer] Payment reminder sent to ${to}: ${info.messageId}`);
      return { success: true, mode: 'smtp', messageId: info.messageId, upiLink };
    } catch (err) {
      console.error('[Mailer] Failed to send payment reminder email:', err.message);
    }
  }

  console.log(`\n======================================================`);
  console.log(`[EMAIL SIMULATOR - PAYMENT REMINDER & UPI LINK]`);
  console.log(`To: ${to} (${name})`);
  console.log(`Shop: ${cleanShopName}`);
  console.log(`Due Amount: ${currency}${amount}`);
  console.log(`UPI Link: ${upiLink}`);
  console.log(`======================================================\n`);

  return { success: true, mode: 'simulated', upiLink };
};

// Send Payment Receipt Email Confirmation
const sendPaymentReceiptEmail = async ({ to, name, shopName, amount, receiptNo, paymentMethod, remainingBalance, currency = '₹' }) => {
  const cleanShopName = shopName || 'FreshMart Grocery';
  const loginUrl = process.env.FRONTEND_URL || 'http://localhost:8081';

  const subject = `Payment Receipt #${receiptNo} - ${cleanShopName}`;
  const textContent = `Hello ${name},\n\nWe have received your payment of ${currency}${amount} via ${paymentMethod.toUpperCase()}.\nReceipt No: ${receiptNo}\nUpdated Outstanding Balance: ${currency}${remainingBalance}\n\nThank you for shopping with ${cleanShopName}!`;

  const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 580px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background: #ffffff;">
      <div style="text-align: center; border-bottom: 2px solid #059669; padding-bottom: 16px; margin-bottom: 20px;">
        <h2 style="color: #059669; margin: 0;">${cleanShopName}</h2>
        <p style="color: #64748b; font-size: 13px; margin: 4px 0 0 0;">Official Payment Receipt</p>
      </div>
      <p style="font-size: 15px; color: #334155;">Hello <strong>${name}</strong>,</p>
      <p style="font-size: 14px; color: #475569;">
        Thank you! We have successfully received and recorded your payment.
      </p>

      <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
        <tr style="background: #f8fafc;">
          <td style="padding: 10px; border: 1px solid #e2e8f0; font-size: 13px; color: #64748b;">Receipt No</td>
          <td style="padding: 10px; border: 1px solid #e2e8f0; font-size: 13px; font-weight: bold; color: #1e293b;">${receiptNo}</td>
        </tr>
        <tr>
          <td style="padding: 10px; border: 1px solid #e2e8f0; font-size: 13px; color: #64748b;">Amount Paid</td>
          <td style="padding: 10px; border: 1px solid #e2e8f0; font-size: 16px; font-weight: bold; color: #059669;">${currency}${Number(amount).toFixed(2)}</td>
        </tr>
        <tr style="background: #f8fafc;">
          <td style="padding: 10px; border: 1px solid #e2e8f0; font-size: 13px; color: #64748b;">Payment Method</td>
          <td style="padding: 10px; border: 1px solid #e2e8f0; font-size: 13px; font-weight: bold; color: #1e293b; text-transform: uppercase;">${paymentMethod}</td>
        </tr>
        <tr>
          <td style="padding: 10px; border: 1px solid #e2e8f0; font-size: 13px; color: #64748b;">Remaining Balance</td>
          <td style="padding: 10px; border: 1px solid #e2e8f0; font-size: 14px; font-weight: bold; color: #1e293b;">${currency}${Number(remainingBalance).toFixed(2)}</td>
        </tr>
      </table>

      <div style="border-top: 1px solid #e2e8f0; padding-top: 16px; margin-top: 24px; text-align: center;">
        <p style="font-size: 13px; color: #64748b;">
          View your full purchase & payment ledger anytime at: <br/>
          <a href="${loginUrl}/login" style="color: #059669; font-weight: bold;">${loginUrl}/login</a>
        </p>
      </div>
    </div>
  `;

  const transporter = createTransporter();
  if (transporter) {
    try {
      const info = await transporter.sendMail({
        from: process.env.EMAIL_FROM || `"${cleanShopName}" <noreply@freshmart.com>`,
        to,
        subject,
        text: textContent,
        html: htmlContent,
      });
      console.log(`[Mailer] Payment receipt sent to ${to}: ${info.messageId}`);
      return { success: true, mode: 'smtp', messageId: info.messageId };
    } catch (err) {
      console.error('[Mailer] Failed to send payment receipt email:', err.message);
    }
  }

  console.log(`\n======================================================`);
  console.log(`[EMAIL SIMULATOR - PAYMENT RECEIPT]`);
  console.log(`To: ${to} (${name})`);
  console.log(`Receipt #${receiptNo}: ${currency}${amount} via ${paymentMethod}`);
  console.log(`Remaining Balance: ${currency}${remainingBalance}`);
  console.log(`======================================================\n`);

  return { success: true, mode: 'simulated' };
};

module.exports = {
  sendPasswordSetupEmail,
  sendLoginPasswordEmail,
  sendPaymentReminderEmail,
  sendPaymentReceiptEmail,
};
