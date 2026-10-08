const CustomerProfile = require('../models/CustomerProfile');
const Purchase = require('../models/Purchase');
const Payment = require('../models/Payment');
const Shop = require('../models/Shop');

// Helper to get CustomerProfile for the logged-in customer
const getCustomerForUser = async (userId) => {
  return await CustomerProfile.findOne({ userId });
};

// @desc    Get Customer's Own Expense Overview & Balance
// @route   GET /api/customer-expenses/overview
// @access  Private (Customer only)
const getMyExpenseOverview = async (req, res, next) => {
  try {
    const customer = await getCustomerForUser(req.user._id);

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: 'Customer profile not found for this account.',
      });
    }

    const shop = await Shop.findById(customer.shopId);

    // Current Month Spending
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    const thisMonthAgg = await Purchase.aggregate([
      {
        $match: {
          customerId: customer._id,
          date: { $gte: startOfMonth, $lte: endOfMonth },
        },
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$totalAmount' },
          count: { $sum: 1 },
        },
      },
    ]);

    const thisMonthSpent = thisMonthAgg.length > 0 ? thisMonthAgg[0].total : 0;
    const thisMonthPurchases = thisMonthAgg.length > 0 ? thisMonthAgg[0].count : 0;

    // Last Purchase
    const lastPurchase = await Purchase.findOne({ customerId: customer._id }).sort({ date: -1 });

    // Last Payment
    const lastPayment = await Payment.findOne({ customerId: customer._id }).sort({ date: -1 });

    // Monthly breakdown (last 6 months)
    const monthlyBreakdown = [];
    for (let i = 5; i >= 0; i--) {
      const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const mStart = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1, 0, 0, 0);
      const mEnd = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0, 23, 59, 59, 999);
      const monthName = monthDate.toLocaleString('default', { month: 'short' });

      const mAgg = await Purchase.aggregate([
        {
          $match: {
            customerId: customer._id,
            date: { $gte: mStart, $lte: mEnd },
          },
        },
        { $group: { _id: null, total: { $sum: '$totalAmount' } } },
      ]);

      monthlyBreakdown.push({
        month: monthName,
        year: monthDate.getFullYear(),
        amount: mAgg.length > 0 ? Math.round(mAgg[0].total * 100) / 100 : 0,
      });
    }

    res.json({
      success: true,
      shop: shop
        ? {
            id: shop._id,
            name: shop.name,
            phone: shop.phone,
            address: shop.address,
            currency: shop.currency,
            upiId: shop.upiId || 'freshmart@okaxis',
          }
        : null,
      profile: {
        id: customer._id,
        name: customer.name,
        email: customer.email,
        phone: customer.phone,
        creditLimit: customer.creditLimit,
        totalPurchases: customer.totalPurchases,
        totalPayments: customer.totalPayments,
        outstandingBalance: customer.outstandingBalance,
      },
      stats: {
        thisMonthSpent: Math.round(thisMonthSpent * 100) / 100,
        thisMonthPurchases,
        totalSpentAllTime: customer.totalPurchases,
        totalPaidAllTime: customer.totalPayments,
        outstandingBalance: customer.outstandingBalance,
        lastPurchaseDate: lastPurchase ? lastPurchase.date : null,
        lastPaymentDate: lastPayment ? lastPayment.date : null,
      },
      monthlyBreakdown,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get Customer's Own Purchases (Read-Only with full item breakdowns)
// @route   GET /api/customer-expenses/purchases
// @access  Private (Customer only)
const getMyPurchases = async (req, res, next) => {
  try {
    const customer = await getCustomerForUser(req.user._id);
    if (!customer) {
      return res.status(404).json({ success: false, message: 'Customer profile not found.' });
    }

    const { month, year, search, page = 1, limit = 50 } = req.query;

    let query = { customerId: customer._id };

    if (month && year) {
      const m = parseInt(month, 10) - 1;
      const y = parseInt(year, 10);
      const start = new Date(y, m, 1);
      const end = new Date(y, m + 1, 0, 23, 59, 59, 999);
      query.date = { $gte: start, $lte: end };
    }

    if (search && search.trim()) {
      const searchRegex = new RegExp(search.trim(), 'i');
      query.$or = [
        { billNo: searchRegex },
        { 'items.name': searchRegex },
      ];
    }

    const skip = (Number(page) - 1) * Number(limit);
    const total = await Purchase.countDocuments(query);
    const purchases = await Purchase.find(query)
      .sort({ date: -1, createdAt: -1 })
      .skip(skip)
      .limit(Number(limit));

    res.json({
      success: true,
      count: purchases.length,
      total,
      page: Number(page),
      totalPages: Math.ceil(total / Number(limit)),
      purchases,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get Customer's Own Payments
// @route   GET /api/customer-expenses/payments
// @access  Private (Customer only)
const getMyPayments = async (req, res, next) => {
  try {
    const customer = await getCustomerForUser(req.user._id);
    if (!customer) {
      return res.status(404).json({ success: false, message: 'Customer profile not found.' });
    }

    const { page = 1, limit = 50 } = req.query;
    const query = { customerId: customer._id };

    const skip = (Number(page) - 1) * Number(limit);
    const total = await Payment.countDocuments(query);
    const payments = await Payment.find(query)
      .sort({ date: -1, createdAt: -1 })
      .skip(skip)
      .limit(Number(limit));

    res.json({
      success: true,
      count: payments.length,
      total,
      page: Number(page),
      totalPages: Math.ceil(total / Number(limit)),
      payments,
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getMyExpenseOverview,
  getMyPurchases,
  getMyPayments,
};
