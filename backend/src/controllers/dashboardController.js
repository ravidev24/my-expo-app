const Shop = require('../models/Shop');
const CustomerProfile = require('../models/CustomerProfile');
const Purchase = require('../models/Purchase');
const Payment = require('../models/Payment');

// @desc    Get Shop Owner Dashboard Stats & Metrics
// @route   GET /api/dashboard
// @access  Private (Shop Owner / System Admin)
const getShopDashboard = async (req, res, next) => {
  try {
    let shopId = req.user.shopId;
    if (req.user.role === 'shop_owner') {
      const shop = await Shop.findOne({ ownerId: req.user._id });
      if (shop) shopId = shop._id;
    } else if (req.query.shopId) {
      shopId = req.query.shopId;
    }

    if (!shopId) {
      return res.status(400).json({ success: false, message: 'Shop ID required.' });
    }

    const shop = await Shop.findById(shopId);

    // Date calculations
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    // 1. Customer metrics
    const totalCustomers = await CustomerProfile.countDocuments({ shopId });
    const activeCustomers = await CustomerProfile.countDocuments({ shopId, status: 'active' });
    const customersWithBalance = await CustomerProfile.countDocuments({
      shopId,
      outstandingBalance: { $gt: 0 },
    });

    // 2. Today's sales
    const todaySalesAgg = await Purchase.aggregate([
      { $match: { shopId, date: { $gte: startOfToday, $lte: endOfToday } } },
      { $group: { _id: null, total: { $sum: '$totalAmount' }, count: { $sum: 1 } } },
    ]);
    const todaySales = todaySalesAgg.length > 0 ? todaySalesAgg[0].total : 0;
    const todayPurchasesCount = todaySalesAgg.length > 0 ? todaySalesAgg[0].count : 0;

    // 3. Today's payments collected
    const todayPaymentsAgg = await Payment.aggregate([
      { $match: { shopId, date: { $gte: startOfToday, $lte: endOfToday } } },
      { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } },
    ]);
    const todayCollected = todayPaymentsAgg.length > 0 ? todayPaymentsAgg[0].total : 0;

    // 4. Monthly sales
    const monthlySalesAgg = await Purchase.aggregate([
      { $match: { shopId, date: { $gte: startOfMonth, $lte: endOfMonth } } },
      { $group: { _id: null, total: { $sum: '$totalAmount' }, count: { $sum: 1 } } },
    ]);
    const monthlySales = monthlySalesAgg.length > 0 ? monthlySalesAgg[0].total : 0;

    // 5. Monthly payments collected
    const monthlyPaymentsAgg = await Payment.aggregate([
      { $match: { shopId, date: { $gte: startOfMonth, $lte: endOfMonth } } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]);
    const monthlyCollected = monthlyPaymentsAgg.length > 0 ? monthlyPaymentsAgg[0].total : 0;

    // 6. Total Outstanding Balances (Receivables)
    const outstandingAgg = await CustomerProfile.aggregate([
      { $match: { shopId } },
      {
        $group: {
          _id: null,
          totalOutstanding: { $sum: '$outstandingBalance' },
          totalPurchasesAllTime: { $sum: '$totalPurchases' },
          totalPaymentsAllTime: { $sum: '$totalPayments' },
        },
      },
    ]);
    const totalOutstanding = outstandingAgg.length > 0 ? outstandingAgg[0].totalOutstanding : 0;
    const totalPurchasesAllTime = outstandingAgg.length > 0 ? outstandingAgg[0].totalPurchasesAllTime : 0;
    const totalPaymentsAllTime = outstandingAgg.length > 0 ? outstandingAgg[0].totalPaymentsAllTime : 0;

    // 7. Recent Transactions (Purchases & Payments combined)
    const recentPurchases = await Purchase.find({ shopId })
      .populate('customerId', 'name phone outstandingBalance')
      .sort({ date: -1, createdAt: -1 })
      .limit(6);

    const recentPayments = await Payment.find({ shopId })
      .populate('customerId', 'name phone outstandingBalance')
      .sort({ date: -1, createdAt: -1 })
      .limit(6);

    const combinedRecent = [
      ...recentPurchases.map((p) => ({
        id: p._id,
        type: 'purchase',
        billNo: p.billNo,
        customerName: p.customerId ? p.customerId.name : 'Unknown',
        customerId: p.customerId ? p.customerId._id : null,
        amount: p.totalAmount,
        itemCount: p.items ? p.items.length : 0,
        date: p.date,
      })),
      ...recentPayments.map((pay) => ({
        id: pay._id,
        type: 'payment',
        billNo: pay.receiptNo,
        customerName: pay.customerId ? pay.customerId.name : 'Unknown',
        customerId: pay.customerId ? pay.customerId._id : null,
        amount: pay.amount,
        paymentMethod: pay.paymentMethod,
        date: pay.date,
      })),
    ]
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, 8);

    // 8. Monthly Trends for last 6 months
    const monthlyTrends = [];
    for (let i = 5; i >= 0; i--) {
      const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const mStart = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1, 0, 0, 0);
      const mEnd = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0, 23, 59, 59, 999);
      const monthName = monthDate.toLocaleString('default', { month: 'short' });

      const mSalesAgg = await Purchase.aggregate([
        { $match: { shopId, date: { $gte: mStart, $lte: mEnd } } },
        { $group: { _id: null, total: { $sum: '$totalAmount' } } },
      ]);

      const mPayAgg = await Payment.aggregate([
        { $match: { shopId, date: { $gte: mStart, $lte: mEnd } } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]);

      monthlyTrends.push({
        month: monthName,
        year: monthDate.getFullYear(),
        sales: mSalesAgg.length > 0 ? Math.round(mSalesAgg[0].total) : 0,
        collected: mPayAgg.length > 0 ? Math.round(mPayAgg[0].total) : 0,
      });
    }

    res.json({
      success: true,
      shop: shop
        ? {
            id: shop._id,
            name: shop.name,
            currency: shop.currency,
            phone: shop.phone,
            address: shop.address,
            upiId: shop.upiId || 'freshmart@okaxis',
            tagline: shop.tagline || 'Scan to Pay or Check Balance',
          }
        : null,
      metrics: {
        totalCustomers,
        activeCustomers,
        customersWithBalance,
        todaySales: Math.round(todaySales * 100) / 100,
        todayPurchasesCount,
        todayCollected: Math.round(todayCollected * 100) / 100,
        monthlySales: Math.round(monthlySales * 100) / 100,
        monthlyCollected: Math.round(monthlyCollected * 100) / 100,
        totalOutstanding: Math.round(totalOutstanding * 100) / 100,
        totalPurchasesAllTime: Math.round(totalPurchasesAllTime * 100) / 100,
        totalPaymentsAllTime: Math.round(totalPaymentsAllTime * 100) / 100,
      },
      recentTransactions: combinedRecent,
      monthlyTrends,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Update Shop Details (UPI ID, Name, Phone, Address, Tagline)
// @route   PUT /api/dashboard/shop
// @access  Private (Shop Owner / System Admin)
const updateShopSettings = async (req, res, next) => {
  try {
    let shopId = req.user.shopId;
    if (req.user.role === 'shop_owner') {
      const s = await Shop.findOne({ ownerId: req.user._id });
      if (s) shopId = s._id;
    } else if (req.body.shopId) {
      shopId = req.body.shopId;
    }

    if (!shopId) {
      return res.status(400).json({ success: false, message: 'Shop ID required.' });
    }

    const { name, phone, address, upiId, tagline, currency } = req.body;
    const shop = await Shop.findById(shopId);
    if (!shop) {
      return res.status(404).json({ success: false, message: 'Shop not found.' });
    }

    if (name) shop.name = name.trim();
    if (phone !== undefined) shop.phone = phone.trim();
    if (address !== undefined) shop.address = address.trim();
    if (upiId !== undefined) shop.upiId = upiId.trim();
    if (tagline !== undefined) shop.tagline = tagline.trim();
    if (currency) shop.currency = currency;

    await shop.save();

    res.json({
      success: true,
      message: 'Shop settings & UPI ID updated successfully.',
      shop: {
        id: shop._id,
        name: shop.name,
        phone: shop.phone,
        address: shop.address,
        currency: shop.currency,
        upiId: shop.upiId,
        tagline: shop.tagline,
      },
    });
  } catch (err) {
    next(err);
  }
};

module.exports = { getShopDashboard, updateShopSettings };
