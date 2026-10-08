const crypto = require('crypto');
const User = require('../models/User');
const Shop = require('../models/Shop');
const CustomerProfile = require('../models/CustomerProfile');
const Purchase = require('../models/Purchase');
const Payment = require('../models/Payment');
const { sendPasswordSetupEmail, sendLoginPasswordEmail } = require('../config/mailer');
const { generatePassword } = require('../utils/password');
const { recalculateCustomerBalance } = require('../utils/balanceCalculator');

// Helper to get active shopId for the current user (shop_owner or system_admin)
const getShopIdForUser = async (user, requestedShopId) => {
  if (user.role === 'system_admin' && requestedShopId) {
    return requestedShopId;
  }
  const shop = await Shop.findOne({ ownerId: user._id });
  return shop ? shop._id : user.shopId;
};

// @desc    Create new Customer with secure password setup link
// @route   POST /api/customers
// @access  Private (Shop Owner / System Admin)
const createCustomer = async (req, res, next) => {
  try {
    const { name, email, phone, address, creditLimit, notes, shopId: reqShopId } = req.body;
    const digits = String(phone || '').replace(/\D/g, '');
    const realEmail = email ? String(email).trim().toLowerCase() : '';
    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(realEmail);

    if (!name || digits.length < 10 || !emailOk) {
      return res.status(400).json({
        success: false,
        message: 'Customer name, a valid phone number, and a valid email are required.',
      });
    }

    const shopId = await getShopIdForUser(req.user, reqShopId);
    if (!shopId) {
      return res.status(400).json({
        success: false,
        message: 'No active shop found for this account.',
      });
    }

    const storedEmail = realEmail;

    const existingProfile = await CustomerProfile.findOne({
      shopId,
      $or: [{ phone: digits }, { email: storedEmail }],
    });

    if (existingProfile) {
      return res.status(400).json({
        success: false,
        message: 'A customer with this phone number or email already exists in your shop.',
      });
    }

    const existingUser = await User.findOne({ email: storedEmail });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'A customer with this email already exists.',
      });
    }

    const password = generatePassword();
    const user = await User.create({
      name,
      email: storedEmail,
      password,
      role: 'customer',
      phone: digits,
      shopId,
      status: 'active',
    });

    const profile = await CustomerProfile.create({
      userId: user._id,
      shopId,
      name,
      email: storedEmail,
      phone: digits,
      address: address || '',
      creditLimit: Number(creditLimit) || 10000,
      notes: notes || '',
      status: 'active',
    });

    const mailResult = await sendLoginPasswordEmail({
      to: user.email,
      name: user.name,
      password,
      role: 'Customer',
    });

    res.status(201).json({
      success: true,
      message:
        mailResult.mode === 'smtp'
          ? 'Customer added. Login password emailed.'
          : 'Customer added. Email is not configured, so the password was not sent.',
      customer: profile,
      emailSent: mailResult.mode === 'smtp',
      temporaryPassword: mailResult.mode === 'smtp' ? undefined : password,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get Customers with search and filtering
// @route   GET /api/customers
// @access  Private (Shop Owner / System Admin)
const getCustomers = async (req, res, next) => {
  try {
    const { search, balanceFilter, status, shopId: reqShopId, page = 1, limit = 50 } = req.query;

    const shopId = await getShopIdForUser(req.user, reqShopId);
    if (!shopId) {
      return res.status(400).json({ success: false, message: 'Shop ID required.' });
    }

    let query = { shopId };

    // Search by name, email, or phone
    if (search && search.trim()) {
      const searchRegex = new RegExp(search.trim(), 'i');
      query.$or = [
        { name: searchRegex },
        { email: searchRegex },
        { phone: searchRegex },
      ];
    }

    // Filter by balance
    if (balanceFilter === 'has_balance') {
      query.outstandingBalance = { $gt: 0 };
    } else if (balanceFilter === 'settled') {
      query.outstandingBalance = { $lte: 0 };
    }

    if (status) {
      query.status = status;
    }

    const skip = (Number(page) - 1) * Number(limit);
    const total = await CustomerProfile.countDocuments(query);
    const customers = await CustomerProfile.find(query)
      .sort({ outstandingBalance: -1, updatedAt: -1 })
      .skip(skip)
      .limit(Number(limit));

    // Summary calculations
    const summaryAgg = await CustomerProfile.aggregate([
      { $match: { shopId } },
      {
        $group: {
          _id: null,
          totalCustomers: { $sum: 1 },
          totalOutstanding: { $sum: '$outstandingBalance' },
          totalPurchases: { $sum: '$totalPurchases' },
          totalPayments: { $sum: '$totalPayments' },
        },
      },
    ]);

    const summary = summaryAgg.length > 0
      ? summaryAgg[0]
      : { totalCustomers: 0, totalOutstanding: 0, totalPurchases: 0, totalPayments: 0 };

    res.json({
      success: true,
      count: customers.length,
      total,
      page: Number(page),
      totalPages: Math.ceil(total / Number(limit)),
      summary: {
        totalCustomers: summary.totalCustomers,
        totalOutstanding: Math.round(summary.totalOutstanding * 100) / 100,
        totalPurchases: Math.round(summary.totalPurchases * 100) / 100,
        totalPayments: Math.round(summary.totalPayments * 100) / 100,
      },
      customers,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get Customer details & Ledger summary
// @route   GET /api/customers/:id
// @access  Private (Shop Owner / System Admin)
const getCustomerById = async (req, res, next) => {
  try {
    const customer = await CustomerProfile.findById(req.params.id);

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: 'Customer not found.',
      });
    }

    const recentPurchases = await Purchase.find({ customerId: customer._id })
      .sort({ date: -1 })
      .limit(10);

    const recentPayments = await Payment.find({ customerId: customer._id })
      .sort({ date: -1 })
      .limit(10);

    const shop = await Shop.findById(customer.shopId);

    res.json({
      success: true,
      customer,
      shop: shop
        ? {
            id: shop._id,
            name: shop.name,
            upiId: shop.upiId || '',
            phone: shop.phone,
            currency: shop.currency,
          }
        : null,
      recentPurchases,
      recentPayments,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get Customer Full Ledger (Chronological combined purchases & payments)
// @route   GET /api/customers/:id/ledger
// @access  Private (Shop Owner / System Admin)
const getCustomerLedger = async (req, res, next) => {
  try {
    const customer = await CustomerProfile.findById(req.params.id);
    if (!customer) {
      return res.status(404).json({ success: false, message: 'Customer not found.' });
    }

    const purchases = await Purchase.find({ customerId: customer._id }).sort({ date: 1 });
    const payments = await Payment.find({ customerId: customer._id }).sort({ date: 1 });

    // Combine transactions into single chronological ledger
    const transactions = [];

    purchases.forEach((p) => {
      transactions.push({
        id: p._id,
        type: 'purchase',
        date: p.date,
        billNo: p.billNo,
        description: `Grocery Purchase (${p.items.length} items)`,
        items: p.items,
        debit: p.totalAmount, // Increases amount owed
        credit: 0,
        notes: p.notes,
        raw: p,
      });
    });

    payments.forEach((pay) => {
      transactions.push({
        id: pay._id,
        type: 'payment',
        date: pay.date,
        billNo: pay.receiptNo,
        description: `Payment Received (${pay.paymentMethod.toUpperCase()})`,
        debit: 0,
        credit: pay.amount, // Decreases amount owed
        paymentMethod: pay.paymentMethod,
        referenceNo: pay.referenceNo,
        notes: pay.notes,
        raw: pay,
      });
    });

    // Sort chronologically ascending to calculate running balance
    transactions.sort((a, b) => new Date(a.date) - new Date(b.date));

    let runningBalance = 0;
    const ledger = transactions.map((tx) => {
      runningBalance += tx.debit - tx.credit;
      return {
        ...tx,
        runningBalance: Math.round(runningBalance * 100) / 100,
      };
    });

    res.json({
      success: true,
      customer,
      summary: {
        totalPurchases: customer.totalPurchases,
        totalPayments: customer.totalPayments,
        outstandingBalance: customer.outstandingBalance,
      },
      ledger,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Update Customer Profile
// @route   PUT /api/customers/:id
// @access  Private (Shop Owner / System Admin)
const updateCustomer = async (req, res, next) => {
  try {
    const { name, phone, address, creditLimit, notes, status, promiseToPayDate, promiseAmount, riskCategory } = req.body;

    const customer = await CustomerProfile.findById(req.params.id);
    if (!customer) {
      return res.status(404).json({ success: false, message: 'Customer not found.' });
    }

    if (name) customer.name = name;
    if (phone !== undefined) customer.phone = phone;
    if (address !== undefined) customer.address = address;
    if (creditLimit !== undefined) customer.creditLimit = Number(creditLimit);
    if (notes !== undefined) customer.notes = notes;
    if (status) customer.status = status;
    if (promiseToPayDate !== undefined) customer.promiseToPayDate = promiseToPayDate ? new Date(promiseToPayDate) : null;
    if (promiseAmount !== undefined) customer.promiseAmount = Number(promiseAmount) || 0;
    if (riskCategory) customer.riskCategory = riskCategory;

    await customer.save();

    // Also update name on user record if linked
    if (name && customer.userId) {
      await User.findByIdAndUpdate(customer.userId, { name });
    }

    res.json({
      success: true,
      message: 'Customer updated successfully.',
      customer,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Resend password setup link
// @route   POST /api/customers/:id/resend-setup
// @access  Private (Shop Owner / System Admin)
const resendPasswordSetupLink = async (req, res, next) => {
  try {
    const customer = await CustomerProfile.findById(req.params.id);
    if (!customer) {
      return res.status(404).json({ success: false, message: 'Customer not found.' });
    }

    const shop = await Shop.findById(customer.shopId);
    let user = await User.findById(customer.userId);

    if (!user) {
      return res.status(404).json({ success: false, message: 'User account not found.' });
    }

    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenExpires = new Date(Date.now() + 48 * 60 * 60 * 1000);

    user.passwordSetupToken = rawToken;
    user.passwordSetupExpires = tokenExpires;
    user.status = 'pending_setup';
    await user.save();

    const mailResult = await sendPasswordSetupEmail({
      to: user.email,
      name: user.name,
      token: rawToken,
      role: 'Customer',
      shopName: shop ? shop.name : 'FreshMart Grocery',
    });

    res.json({
      success: true,
      message: 'Password setup link has been regenerated and sent to customer.',
      setupUrl: mailResult.setupUrl,
      token: rawToken,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Send Payment Reminder & UPI Link (via WhatsApp, Email, Push)
// @route   POST /api/customers/:id/send-reminder
// @access  Private (Shop Owner / System Admin)
const sendPaymentReminder = async (req, res, next) => {
  try {
    const { sendPaymentReminderNotification } = require('../utils/notificationService');
    const result = await sendPaymentReminderNotification({
      customerId: req.params.id,
      shopId: req.user.shopId,
      reason: req.body.reason || undefined,
    });

    res.json({
      success: true,
      message: result.channel === 'whatsapp_phone'
        ? 'Payment reminder & WhatsApp link generated successfully!'
        : 'Payment reminder & UPI link sent to customer email successfully!',
      result,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Scan and trigger automated payment reminders for overdue (>1 month) or high-balance (>2000) customers
// @route   POST /api/customers/check-auto-reminders
// @access  Private (Shop Owner)
const checkShopAutoReminders = async (req, res, next) => {
  try {
    const shopId = await getShopIdForUser(req.user, req.query.shopId);
    if (!shopId) {
      return res.status(400).json({ success: false, message: 'Shop ID required.' });
    }

    const { checkAndSendAutoReminders } = require('../utils/notificationService');
    const customersWithDue = await CustomerProfile.find({
      shopId,
      outstandingBalance: { $gt: 0 },
      status: 'active',
    });

    const triggeredList = [];
    for (const cust of customersWithDue) {
      const triggerRes = await checkAndSendAutoReminders({ customerId: cust._id, shopId });
      if (triggerRes.triggered) {
        triggeredList.push({
          customerId: cust._id,
          name: cust.name,
          balance: cust.outstandingBalance,
          phone: cust.phone,
          reason: triggerRes.reason,
          whatsappUrl: triggerRes.result?.whatsappUrl || null,
        });
      }
    }

    res.json({
      success: true,
      scannedCount: customersWithDue.length,
      triggeredCount: triggeredList.length,
      reminders: triggeredList,
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  createCustomer,
  getCustomers,
  getCustomerById,
  getCustomerLedger,
  updateCustomer,
  resendPasswordSetupLink,
  sendPaymentReminder,
  checkShopAutoReminders,
};
