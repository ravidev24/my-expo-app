const Purchase = require('../models/Purchase');
const CustomerProfile = require('../models/CustomerProfile');
const Shop = require('../models/Shop');
const { recalculateCustomerBalance } = require('../utils/balanceCalculator');
const { sendPurchaseNotification, checkAndSendHighBalanceReminder } = require('../utils/notificationService');

// Helper to generate sequential/unique bill number
const generateBillNo = async (shopId) => {
  const today = new Date();
  const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
  const countToday = await Purchase.countDocuments({
    shopId,
    createdAt: {
      $gte: new Date(today.setHours(0, 0, 0, 0)),
      $lt: new Date(today.setHours(23, 59, 59, 999)),
    },
  });
  return `BILL-${dateStr}-${String(countToday + 1).padStart(3, '0')}`;
};

// @desc    Record new Customer Purchase
// @route   POST /api/purchases
// @access  Private (Shop Owner / System Admin)
const createPurchase = async (req, res, next) => {
  try {
    const {
      customerId,
      items,
      date,
      discount = 0,
      tax = 0,
      notes = '',
      paidAmount = 0,
      billNo: customBillNo,
    } = req.body;

    if (!customerId) {
      return res.status(400).json({ success: false, message: 'Customer ID is required.' });
    }

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'At least one grocery line item is required.',
      });
    }

    const customer = await CustomerProfile.findById(customerId);
    if (!customer) {
      return res.status(404).json({ success: false, message: 'Customer not found.' });
    }

    const shopId = customer.shopId;

    // Process each line item with automatic amount calculation
    let calculatedSubtotal = 0;
    const processedItems = items.map((item, index) => {
      const name = item.name ? item.name.trim() : `Item #${index + 1}`;
      const quantity = Number(item.quantity) || 1;
      const unit = item.unit ? item.unit.trim() : 'pcs';
      const unitPrice = Number(item.unitPrice) || 0;
      const amount = Math.round(quantity * unitPrice * 100) / 100;
      
      calculatedSubtotal += amount;

      return {
        name,
        quantity,
        unit,
        unitPrice,
        amount,
        category: item.category || 'General',
        notes: item.notes || '',
      };
    });

    const subtotal = Math.round(calculatedSubtotal * 100) / 100;
    const discountAmount = Math.max(0, Number(discount) || 0);
    const taxAmount = Math.max(0, Number(tax) || 0);
    const totalAmount = Math.max(0, Math.round((subtotal - discountAmount + taxAmount) * 100) / 100);

    const billNo = customBillNo || (await generateBillNo(shopId));

    let paymentStatus = 'unpaid';
    const numPaid = Number(paidAmount) || 0;
    if (numPaid >= totalAmount && totalAmount > 0) {
      paymentStatus = 'paid';
    } else if (numPaid > 0) {
      paymentStatus = 'partially_paid';
    }

    const purchase = await Purchase.create({
      shopId,
      customerId: customer._id,
      customerUserId: customer.userId,
      billNo,
      date: date ? new Date(date) : new Date(),
      items: processedItems,
      subtotal,
      discount: discountAmount,
      tax: taxAmount,
      totalAmount,
      paidAmount: numPaid,
      paymentStatus,
      notes: notes || '',
      createdBy: req.user._id,
    });

    // Automatically recalculate customer's balance
    const updatedCustomer = await recalculateCustomerBalance(customer._id);

    // Send push & in-app notification to customer
    sendPurchaseNotification({
      customerUserId: customer.userId,
      customerId: customer._id,
      shopId,
      purchase,
      updatedBalance: updatedCustomer.outstandingBalance,
    }).catch((err) => console.error('[Notification Trigger Error]:', err.message));

    // If customer balance reaches or exceeds ₹2,000, automatically trigger payment reminder link
    if (updatedCustomer.outstandingBalance >= 2000) {
      checkAndSendHighBalanceReminder({
        customerId: customer._id,
        shopId,
        threshold: 2000,
      }).catch((err) => console.error('[High Balance Reminder Error]:', err.message));
    }

    res.status(201).json({
      success: true,
      message: 'Grocery purchase recorded successfully.',
      purchase,
      customerSummary: {
        totalPurchases: updatedCustomer.totalPurchases,
        outstandingBalance: updatedCustomer.outstandingBalance,
      },
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get Purchases with filters (Date Range, Month, Year, Customer, Search)
// @route   GET /api/purchases
// @access  Private (Shop Owner / System Admin)
const getPurchases = async (req, res, next) => {
  try {
    const {
      customerId,
      startDate,
      endDate,
      month,
      year,
      search,
      paymentStatus,
      page = 1,
      limit = 50,
    } = req.query;

    let shopId = req.user.shopId;
    if (req.user.role === 'shop_owner') {
      const shop = await Shop.findOne({ ownerId: req.user._id });
      if (shop) shopId = shop._id;
    }

    let query = {};
    if (shopId) {
      query.shopId = shopId;
    }

    if (customerId) {
      query.customerId = customerId;
    }

    if (paymentStatus) {
      query.paymentStatus = paymentStatus;
    }

    // Date range filter
    if (startDate || endDate) {
      query.date = {};
      if (startDate) query.date.$gte = new Date(startDate);
      if (endDate) {
        const eDate = new Date(endDate);
        eDate.setHours(23, 59, 59, 999);
        query.date.$lte = eDate;
      }
    } else if (month && year) {
      const m = parseInt(month, 10) - 1;
      const y = parseInt(year, 10);
      const start = new Date(y, m, 1);
      const end = new Date(y, m + 1, 0, 23, 59, 59, 999);
      query.date = { $gte: start, $lte: end };
    } else if (year) {
      const y = parseInt(year, 10);
      const start = new Date(y, 0, 1);
      const end = new Date(y, 11, 31, 23, 59, 59, 999);
      query.date = { $gte: start, $lte: end };
    }

    if (search && search.trim()) {
      const searchRegex = new RegExp(search.trim(), 'i');
      query.$or = [
        { billNo: searchRegex },
        { 'items.name': searchRegex },
        { notes: searchRegex },
      ];
    }

    const skip = (Number(page) - 1) * Number(limit);
    const total = await Purchase.countDocuments(query);
    const purchases = await Purchase.find(query)
      .populate('customerId', 'name email phone outstandingBalance')
      .sort({ date: -1, createdAt: -1 })
      .skip(skip)
      .limit(Number(limit));

    // Summary statistics for query
    const totalAmountAgg = await Purchase.aggregate([
      { $match: query },
      { $group: { _id: null, totalSales: { $sum: '$totalAmount' } } },
    ]);
    const totalSales = totalAmountAgg.length > 0 ? totalAmountAgg[0].totalSales : 0;

    res.json({
      success: true,
      count: purchases.length,
      total,
      page: Number(page),
      totalPages: Math.ceil(total / Number(limit)),
      totalSales: Math.round(totalSales * 100) / 100,
      purchases,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get Purchase by ID
// @route   GET /api/purchases/:id
// @access  Private (Shop Owner / System Admin / Customer owner)
const getPurchaseById = async (req, res, next) => {
  try {
    const purchase = await Purchase.findById(req.params.id)
      .populate('customerId', 'name email phone address outstandingBalance creditLimit')
      .populate('shopId', 'name phone address currency');

    if (!purchase) {
      return res.status(404).json({ success: false, message: 'Purchase not found.' });
    }

    // Role check: customer can only view their own purchase
    if (
      req.user.role === 'customer' &&
      purchase.customerUserId.toString() !== req.user._id.toString()
    ) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: You can only view your own purchases.',
      });
    }

    res.json({
      success: true,
      purchase,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Update Purchase with dynamic recalculation
// @route   PUT /api/purchases/:id
// @access  Private (Shop Owner / System Admin)
const updatePurchase = async (req, res, next) => {
  try {
    const { items, date, discount = 0, tax = 0, notes, paymentStatus } = req.body;

    const purchase = await Purchase.findById(req.params.id);
    if (!purchase) {
      return res.status(404).json({ success: false, message: 'Purchase not found.' });
    }

    if (items && Array.isArray(items) && items.length > 0) {
      let calculatedSubtotal = 0;
      const processedItems = items.map((item, index) => {
        const name = item.name ? item.name.trim() : `Item #${index + 1}`;
        const quantity = Number(item.quantity) || 1;
        const unit = item.unit ? item.unit.trim() : 'pcs';
        const unitPrice = Number(item.unitPrice) || 0;
        const amount = Math.round(quantity * unitPrice * 100) / 100;

        calculatedSubtotal += amount;

        return {
          name,
          quantity,
          unit,
          unitPrice,
          amount,
          category: item.category || 'General',
          notes: item.notes || '',
        };
      });

      const subtotal = Math.round(calculatedSubtotal * 100) / 100;
      const discountAmount = Math.max(0, Number(discount) || 0);
      const taxAmount = Math.max(0, Number(tax) || 0);
      const totalAmount = Math.max(0, Math.round((subtotal - discountAmount + taxAmount) * 100) / 100);

      purchase.items = processedItems;
      purchase.subtotal = subtotal;
      purchase.discount = discountAmount;
      purchase.tax = taxAmount;
      purchase.totalAmount = totalAmount;
    }

    if (date) purchase.date = new Date(date);
    if (notes !== undefined) purchase.notes = notes;
    if (paymentStatus) purchase.paymentStatus = paymentStatus;

    await purchase.save();

    // Recalculate customer balance
    const updatedCustomer = await recalculateCustomerBalance(purchase.customerId);

    res.json({
      success: true,
      message: 'Purchase updated and balance recalculated successfully.',
      purchase,
      customerSummary: {
        totalPurchases: updatedCustomer.totalPurchases,
        outstandingBalance: updatedCustomer.outstandingBalance,
      },
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Delete Purchase
// @route   DELETE /api/purchases/:id
// @access  Private (Shop Owner / System Admin)
const deletePurchase = async (req, res, next) => {
  try {
    const purchase = await Purchase.findById(req.params.id);
    if (!purchase) {
      return res.status(404).json({ success: false, message: 'Purchase not found.' });
    }

    const customerId = purchase.customerId;
    await purchase.deleteOne();

    // Recalculate customer balance
    const updatedCustomer = await recalculateCustomerBalance(customerId);

    res.json({
      success: true,
      message: 'Purchase deleted and customer balance adjusted.',
      customerSummary: {
        totalPurchases: updatedCustomer.totalPurchases,
        outstandingBalance: updatedCustomer.outstandingBalance,
      },
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  createPurchase,
  getPurchases,
  getPurchaseById,
  updatePurchase,
  deletePurchase,
};
