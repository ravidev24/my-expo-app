const User = require('../models/User');
const Shop = require('../models/Shop');
const CustomerProfile = require('../models/CustomerProfile');
const Notification = require('../models/Notification');
const { sendPaymentReminderEmail, sendPaymentReceiptEmail } = require('../config/mailer');

/**
 * Send Push Notification via Expo HTTP Push API
 */
const sendExpoPushNotification = async (pushTokens, { title, body, data = {} }) => {
  const rawTokens = Array.isArray(pushTokens) ? pushTokens : [pushTokens];
  const validTokens = rawTokens
    .filter((t) => typeof t === 'string' && t.trim().length > 0)
    .map((t) => t.trim());

  if (validTokens.length === 0) {
    console.log('[Push Notification] No push tokens provided. Skipped.');
    return { success: false, reason: 'no_tokens' };
  }

  const expoTokens = validTokens.filter(
    (token) =>
      token.startsWith('ExponentPushToken[') ||
      token.startsWith('ExpoPushToken[') ||
      token.startsWith('SIMULATED_')
  );

  console.log(`\n======================================================`);
  console.log(`[PUSH NOTIFICATION DISPATCH]`);
  console.log(`Recipients (${validTokens.length}):`, validTokens.join(', '));
  console.log(`Title: ${title}`);
  console.log(`Body: ${body}`);
  console.log(`Data:`, JSON.stringify(data));
  console.log(`======================================================\n`);

  const realExpoTokens = expoTokens.filter((token) => !token.startsWith('SIMULATED_'));
  if (realExpoTokens.length === 0) {
    return { success: true, count: validTokens.length, mode: 'simulated' };
  }

  try {
    const messages = realExpoTokens.map((token) => ({
      to: token,
      sound: 'default',
      title,
      body,
      data,
      priority: 'high',
      channelId: 'freshmart_updates',
    }));

    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Accept-encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(messages),
    });

    const result = await response.json();
    return { success: true, result };
  } catch (err) {
    console.error('[Expo Push API Error]:', err.message);
    return { success: false, error: err.message };
  }
};

/**
 * Dispatch Notification when a new purchase / bill is added
 */
const sendPurchaseNotification = async ({ customerUserId, customerId, shopId, purchase, updatedBalance }) => {
  try {
    if (!customerUserId) return;

    let shopName = 'FreshMart';
    let currency = '₹';
    if (shopId) {
      const shop = await Shop.findById(shopId);
      if (shop) {
        shopName = shop.name || shopName;
        currency = shop.currency || currency;
      }
    }

    const title = `🛒 New Purchase Added • ${shopName}`;
    const formattedAmount = `${currency} ${Number(purchase.totalAmount).toFixed(2)}`;
    const formattedBalance = `${currency} ${Number(updatedBalance).toFixed(2)}`;
    const itemsCount = Array.isArray(purchase.items) ? purchase.items.length : 1;
    const itemsSummary =
      Array.isArray(purchase.items) && purchase.items.length > 0
        ? ` (${purchase.items.map((i) => i.name).slice(0, 2).join(', ')}${itemsCount > 2 ? ` +${itemsCount - 2} more` : ''})`
        : '';

    const body = `A new bill #${purchase.billNo} of ${formattedAmount}${itemsSummary} has been added. Your current balance is ${formattedBalance}.`;

    const payloadData = {
      type: 'purchase',
      purchaseId: purchase._id ? purchase._id.toString() : '',
      billNo: purchase.billNo,
      amount: purchase.totalAmount,
      balance: updatedBalance,
      shopId: shopId ? shopId.toString() : '',
      date: purchase.date,
    };

    // 1. Create In-App Notification record in database
    await Notification.create({
      userId: customerUserId,
      customerId: customerId || null,
      shopId: shopId || null,
      type: 'purchase',
      title,
      body,
      data: payloadData,
      isRead: false,
    });

    // 2. Fetch customer's registered push tokens
    const user = await User.findById(customerUserId);
    if (user && Array.isArray(user.pushTokens) && user.pushTokens.length > 0) {
      const tokens = user.pushTokens.map((pt) => pt.token);
      await sendExpoPushNotification(tokens, { title, body, data: payloadData });
    }
  } catch (err) {
    console.error('[sendPurchaseNotification Error]:', err.message);
  }
};

/**
 * Dispatch Notification when a payment is recorded (Push + In-App + Email Receipt)
 */
const sendPaymentNotification = async ({ customerUserId, customerId, shopId, payment, updatedBalance }) => {
  try {
    if (!customerUserId) return;

    let shopName = 'FreshMart';
    let currency = '₹';
    if (shopId) {
      const shop = await Shop.findById(shopId);
      if (shop) {
        shopName = shop.name || shopName;
        currency = shop.currency || currency;
      }
    }

    const title = `💳 Payment Received • ${shopName}`;
    const formattedAmount = `${currency} ${Number(payment.amount).toFixed(2)}`;
    const formattedBalance = `${currency} ${Number(updatedBalance).toFixed(2)}`;
    const methodStr = payment.paymentMethod ? ` via ${payment.paymentMethod.toUpperCase()}` : '';

    const body = `Payment of ${formattedAmount}${methodStr} recorded (Receipt #${payment.receiptNo}). Outstanding balance is now ${formattedBalance}. Thank you!`;

    const payloadData = {
      type: 'payment',
      paymentId: payment._id ? payment._id.toString() : '',
      receiptNo: payment.receiptNo,
      amount: payment.amount,
      balance: updatedBalance,
      shopId: shopId ? shopId.toString() : '',
      date: payment.date,
    };

    // 1. Create In-App Notification record
    await Notification.create({
      userId: customerUserId,
      customerId: customerId || null,
      shopId: shopId || null,
      type: 'payment',
      title,
      body,
      data: payloadData,
      isRead: false,
    });

    // 2. Send Push Notification if registered
    const user = await User.findById(customerUserId);
    if (user && Array.isArray(user.pushTokens) && user.pushTokens.length > 0) {
      const tokens = user.pushTokens.map((pt) => pt.token);
      await sendExpoPushNotification(tokens, { title, body, data: payloadData });
    }

    // 3. Send Official Email Receipt if customer has an email address
    if (user && user.email) {
      sendPaymentReceiptEmail({
        to: user.email,
        name: user.name,
        shopName,
        amount: payment.amount,
        receiptNo: payment.receiptNo,
        paymentMethod: payment.paymentMethod || 'cash',
        remainingBalance: updatedBalance,
        currency,
      }).catch((err) => console.error('[Payment Receipt Mail Error]:', err.message));
    }
  } catch (err) {
    console.error('[sendPaymentNotification Error]:', err.message);
  }
};

/**
 * Helpers for Indian Phone (+91) Formatting
 */
const formatIndiaPhoneNumber = (phone) => {
  if (!phone) return '';
  const digits = String(phone).replace(/\D/g, '');
  if (digits.length === 10) {
    return `91${digits}`;
  }
  if (digits.length === 11 && digits.startsWith('0')) {
    return `91${digits.slice(1)}`;
  }
  if (digits.length === 12 && digits.startsWith('91')) {
    return digits;
  }
  return digits;
};

const formatDisplayIndiaPhone = (phone) => {
  if (!phone) return '+91 63795 17503';
  const digits = String(phone).replace(/\D/g, '');
  const tenDigits = digits.length >= 10 ? digits.slice(-10) : digits;
  if (tenDigits.length === 10) {
    return `+91 ${tenDigits.slice(0, 5)} ${tenDigits.slice(5)}`;
  }
  return `+91 ${phone}`;
};

/**
 * Send Payment Reminder with UPI Link via WhatsApp / Phone / Email and Push
 * Uses India +91 phone formatting and shop sender contact (+91 63795 17503)
 */
const sendPaymentReminderNotification = async ({ customerId, shopId, reason, customMessage }) => {
  try {
    const customer = await CustomerProfile.findById(customerId);
    if (!customer) throw new Error('Customer not found');

    const shop = await Shop.findById(shopId || customer.shopId);
    const shopName = shop ? shop.name : 'FreshMart Grocery';
    const upiId = shop?.upiId || '';
    const senderRawPhone = shop?.phone || '6379517503';
    const formattedSenderPhone = formatDisplayIndiaPhone(senderRawPhone);
    const currency = shop?.currency || '₹';
    const amountDue = customer.outstandingBalance;

    const upiPayLink = upiId
      ? `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(shopName)}&am=${amountDue}&cu=INR`
      : '';

    const title = `🔔 Payment Reminder • ${shopName}`;
    const body = `Your outstanding balance is ${currency}${amountDue.toFixed(2)} at ${shopName}. Tap to pay directly via UPI.`;

    // 1. In-App Notification record
    await Notification.create({
      userId: customer.userId,
      customerId: customer._id,
      shopId: shop?._id || customer.shopId,
      type: 'payment_reminder',
      title,
      body,
      data: {
        type: 'reminder',
        amount: amountDue,
        upiId,
        upiPayLink,
        reason: reason || '',
      },
      isRead: false,
    });

    // 2. Prepare WhatsApp / SMS Link with +91 Indian code & Sender Phone (6379517503)
    let whatsappUrl = null;
    let smsUrl = null;
    const cleanCustomerPhone = formatIndiaPhoneNumber(customer.phone);
    const qrImageUrl = upiPayLink
      ? `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(upiPayLink)}`
      : '';

    if (cleanCustomerPhone) {
      const waText =
        customMessage ||
        `🙏 *Payment Reminder from ${shopName}*\n\n` +
        `Hello *${customer.name}*,\n` +
        `Your outstanding balance is *${currency}${amountDue.toFixed(2)}*.\n` +
        (reason ? `📌 *Note:* ${reason}\n\n` : '\n') +
        (upiPayLink ? `💳 *Pay via UPI (GPay / PhonePe / Paytm):*\n${upiPayLink}\n\n` : '') +
        (qrImageUrl ? `🖼️ *Download QR Code Image:*\n${qrImageUrl}\n\n` : '') +
        `📱 *Shop UPI ID:* ${upiId || 'Not set'}\n` +
        `🏪 *Sender Contact:* ${formattedSenderPhone}\n\n` +
        `Thank you for shopping with us!`;

      whatsappUrl = `https://wa.me/${cleanCustomerPhone}?text=${encodeURIComponent(waText)}`;
      smsUrl = `sms:+${cleanCustomerPhone}?body=${encodeURIComponent(waText)}`;
    }

    // 3. Email Reminder with dynamic UPI link & QR Code
    let emailResult = null;
    if (customer.email) {
      emailResult = await sendPaymentReminderEmail({
        to: customer.email,
        name: customer.name,
        shopName,
        amount: amountDue,
        upiId: upiId || 'yourshop@upi',
        currency,
      });
    }

    // 4. Push Notification if user device is registered
    const user = await User.findById(customer.userId);
    if (user && Array.isArray(user.pushTokens) && user.pushTokens.length > 0) {
      const tokens = user.pushTokens.map((pt) => pt.token);
      await sendExpoPushNotification(tokens, {
        title,
        body,
        data: { type: 'reminder', amount: amountDue, upiId },
      });
    }

    return {
      success: true,
      channel: cleanCustomerPhone ? 'whatsapp_phone' : 'email',
      whatsappUrl,
      smsUrl,
      emailSent: Boolean(emailResult),
      phone: customer.phone ? formatDisplayIndiaPhone(customer.phone) : null,
      rawPhone: cleanCustomerPhone,
      email: customer.email,
      customerName: customer.name,
      outstandingBalance: amountDue,
      upiPayLink,
      upiId,
      senderPhone: formattedSenderPhone,
      reason: reason || null,
    };
  } catch (err) {
    console.error('[sendPaymentReminderNotification Error]:', err.message);
    throw err;
  }
};

/**
 * Automatically check and dispatch reminders if:
 * 1. Customer's balance exceeds ₹2,000 (> 2000) OR
 * 2. Customer's balance is > 0 and last paid date is > 1 month (30 days) ago
 */
const checkAndSendAutoReminders = async ({ customerId, shopId }) => {
  try {
    const customer = await CustomerProfile.findById(customerId);
    if (!customer || customer.outstandingBalance <= 0) {
      return { triggered: false, reason: 'zero_balance' };
    }

    const now = Date.now();
    const isHighBalance = customer.outstandingBalance > 2000;
    
    // Check last payment date or account creation date
    const lastPaidTime = customer.lastPaymentDate
      ? new Date(customer.lastPaymentDate).getTime()
      : new Date(customer.createdAt).getTime();
    
    const oneMonthMs = 30 * 24 * 60 * 60 * 1000;
    const isOverdueOneMonth = (now - lastPaidTime) > oneMonthMs;

    if (!isHighBalance && !isOverdueOneMonth) {
      return { triggered: false, reason: 'conditions_not_met' };
    }

    // Throttle duplicate reminders to once every 48 hours
    const recentReminder = await Notification.findOne({
      customerId: customer._id,
      type: 'payment_reminder',
      createdAt: { $gte: new Date(now - 48 * 60 * 60 * 1000) },
    });

    if (recentReminder) {
      console.log(`[Auto-Reminder] Reminder for ${customer.name} throttled within 48 hours.`);
      return { triggered: false, reason: 'throttled' };
    }

    let reasonText = '';
    if (isHighBalance && isOverdueOneMonth) {
      reasonText = 'Balance exceeds ₹2,000 & payment pending for over 1 month.';
    } else if (isHighBalance) {
      reasonText = 'Balance has exceeded ₹2,000.';
    } else {
      reasonText = 'No payment has been received in over 1 month.';
    }

    console.log(`[Auto-Reminder Triggered] Customer ${customer.name} (Balance: ₹${customer.outstandingBalance}): ${reasonText}`);
    const result = await sendPaymentReminderNotification({
      customerId: customer._id,
      shopId: shopId || customer.shopId,
      reason: reasonText,
    });

    return { triggered: true, reason: reasonText, result };
  } catch (err) {
    console.error('[checkAndSendAutoReminders Error]:', err.message);
    return { triggered: false, error: err.message };
  }
};

module.exports = {
  formatIndiaPhoneNumber,
  formatDisplayIndiaPhone,
  sendExpoPushNotification,
  sendPurchaseNotification,
  sendPaymentNotification,
  sendPaymentReminderNotification,
  checkAndSendAutoReminders,
  checkAndSendHighBalanceReminder: checkAndSendAutoReminders,
};
