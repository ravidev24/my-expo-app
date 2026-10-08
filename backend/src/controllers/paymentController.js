const Payment = require('../models/Payment');
const CustomerProfile = require('../models/CustomerProfile');
const Shop = require('../models/Shop');
const { recalculateCustomerBalance } = require('../utils/balanceCalculator');
const { sendPaymentNotification } = require('../utils/notificationService');

// Helper to generate receipt number
const generateReceiptNo = async (shopId) => {
  const today = new Date();
  const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
  const countToday = await Payment.countDocuments({
    shopId,
    createdAt: {
      $gte: new Date(today.setHours(0, 0, 0, 0)),
      $lt: new Date(today.setHours(23, 59, 59, 999)),
    },
  });
  return `RCPT-${dateStr}-${String(countToday + 1).padStart(3, '0')}`;
};

// @desc    Record Customer Payment
// @route   POST /api/payments
// @access  Private (Shop Owner / System Admin)
const recordPayment = async (req, res, next) => {
  try {
    const {
      customerId,
      amount,
      paymentMethod = 'cash',
      referenceNo = '',
      notes = '',
      date,
      receiptNo: customReceiptNo,
    } = req.body;

    if (!customerId || !amount || Number(amount) <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Customer ID and a valid payment amount are required.',
      });
    }

    const customer = await CustomerProfile.findById(customerId);
    if (!customer) {
      return res.status(404).json({ success: false, message: 'Customer not found.' });
    }

    const shopId = customer.shopId;
    const receiptNo = customReceiptNo || (await generateReceiptNo(shopId));

    const payment = await Payment.create({
      shopId,
      customerId: customer._id,
      customerUserId: customer.userId,
      receiptNo,
      date: date ? new Date(date) : new Date(),
      amount: Math.round(Number(amount) * 100) / 100,
      paymentMethod,
      referenceNo: referenceNo.trim(),
      notes: notes.trim(),
      recordedBy: req.user._id,
    });

    // Recalculate customer balance
    const updatedCustomer = await recalculateCustomerBalance(customer._id);
    if (updatedCustomer) {
      updatedCustomer.lastPaymentDate = new Date();
      await updatedCustomer.save();
    }

    // Send push & in-app notification to customer
    sendPaymentNotification({
      customerUserId: customer.userId,
      customerId: customer._id,
      shopId,
      payment,
      updatedBalance: updatedCustomer.outstandingBalance,
    }).catch((err) => console.error('[Notification Trigger Error]:', err.message));

    res.status(201).json({
      success: true,
      message: 'Payment recorded successfully.',
      payment,
      customerSummary: {
        totalPurchases: updatedCustomer.totalPurchases,
        totalPayments: updatedCustomer.totalPayments,
        outstandingBalance: updatedCustomer.outstandingBalance,
      },
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get Payments list with filters
// @route   GET /api/payments
// @access  Private (Shop Owner / System Admin)
const getPayments = async (req, res, next) => {
  try {
    const {
      customerId,
      startDate,
      endDate,
      paymentMethod,
      search,
      page = 1,
      limit = 50,
    } = req.query;

    let shopId = req.user.shopId;
    if (req.user.role === 'shop_owner') {
      const shop = await Shop.findOne({ ownerId: req.user._id });
      if (shop) shopId = shop._id;
    }

    let query = {};
    if (shopId) query.shopId = shopId;
    if (customerId) query.customerId = customerId;
    if (paymentMethod) query.paymentMethod = paymentMethod;

    if (startDate || endDate) {
      query.date = {};
      if (startDate) query.date.$gte = new Date(startDate);
      if (endDate) {
        const eDate = new Date(endDate);
        eDate.setHours(23, 59, 59, 999);
        query.date.$lte = eDate;
      }
    }

    if (search && search.trim()) {
      const searchRegex = new RegExp(search.trim(), 'i');
      query.$or = [
        { receiptNo: searchRegex },
        { referenceNo: searchRegex },
        { notes: searchRegex },
      ];
    }

    const skip = (Number(page) - 1) * Number(limit);
    const total = await Payment.countDocuments(query);
    const payments = await Payment.find(query)
      .populate('customerId', 'name email phone outstandingBalance')
      .sort({ date: -1, createdAt: -1 })
      .skip(skip)
      .limit(Number(limit));

    // Summary of collections
    const totalCollectedAgg = await Payment.aggregate([
      { $match: query },
      { $group: { _id: null, totalCollected: { $sum: '$amount' } } },
    ]);
    const totalCollected = totalCollectedAgg.length > 0 ? totalCollectedAgg[0].totalCollected : 0;

    res.json({
      success: true,
      count: payments.length,
      total,
      page: Number(page),
      totalPages: Math.ceil(total / Number(limit)),
      totalCollected: Math.round(totalCollected * 100) / 100,
      payments,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Delete Payment
// @route   DELETE /api/payments/:id
// @access  Private (Shop Owner / System Admin)
const deletePayment = async (req, res, next) => {
  try {
    const payment = await Payment.findById(req.params.id);
    if (!payment) {
      return res.status(404).json({ success: false, message: 'Payment not found.' });
    }

    const customerId = payment.customerId;
    await payment.deleteOne();

    // Recalculate customer balance
    const updatedCustomer = await recalculateCustomerBalance(customerId);

    res.json({
      success: true,
      message: 'Payment deleted and customer balance adjusted.',
      customerSummary: {
        totalPurchases: updatedCustomer.totalPurchases,
        totalPayments: updatedCustomer.totalPayments,
        outstandingBalance: updatedCustomer.outstandingBalance,
      },
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  recordPayment,
  getPayments,
  deletePayment,
};
