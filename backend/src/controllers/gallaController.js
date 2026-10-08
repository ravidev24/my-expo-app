const DailyGalla = require('../models/DailyGalla');
const Payment = require('../models/Payment');
const Shop = require('../models/Shop');

// Helper to get active shopId
const getShopIdForUser = async (user, requestedShopId) => {
  if (user.role === 'system_admin' && requestedShopId) {
    return requestedShopId;
  }
  const shop = await Shop.findOne({ ownerId: user._id });
  return shop ? shop._id : user.shopId;
};

// Helper for today's date string YYYY-MM-DD
const getTodayString = () => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// Helper to calculate live galla financials
const calculateGallaSummary = async (shopId, dateStr, gallaRecord) => {
  const [year, month, day] = dateStr.split('-').map(Number);
  const startOfDay = new Date(year, month - 1, day, 0, 0, 0, 0);
  const endOfDay = new Date(year, month - 1, day, 23, 59, 59, 999);

  // 1. Quick cash sales logged directly in Galla
  const quickCashTotal = (gallaRecord.quickCashSales || []).reduce(
    (sum, item) => sum + (Number(item.amount) || 0),
    0
  );

  // 2. Customer payments received in CASH today
  const cashPayments = await Payment.find({
    shopId,
    paymentMethod: 'cash',
    date: { $gte: startOfDay, $lte: endOfDay },
  }).populate('customerId', 'name phone');

  const customerCashCollected = cashPayments.reduce(
    (sum, pay) => sum + (Number(pay.amount) || 0),
    0
  );

  // 3. Customer payments received in UPI/Card/Bank today (for overview info)
  const digitalPayments = await Payment.find({
    shopId,
    paymentMethod: { $ne: 'cash' },
    date: { $gte: startOfDay, $lte: endOfDay },
  });
  const digitalCollected = digitalPayments.reduce(
    (sum, pay) => sum + (Number(pay.amount) || 0),
    0
  );

  // 4. Expenses paid from drawer
  const totalExpenses = (gallaRecord.expenses || []).reduce(
    (sum, exp) => sum + (Number(exp.amount) || 0),
    0
  );

  const openingCash = Number(gallaRecord.openingCash) || 0;
  const totalCashIn = Math.round((quickCashTotal + customerCashCollected) * 100) / 100;
  const expectedCash = Math.round((openingCash + totalCashIn - totalExpenses) * 100) / 100;

  const counted = gallaRecord.closingCashCounted;
  const difference =
    counted !== null && counted !== undefined
      ? Math.round((Number(counted) - expectedCash) * 100) / 100
      : 0;

  return {
    date: dateStr,
    openingCash,
    quickCashTotal: Math.round(quickCashTotal * 100) / 100,
    quickCashCount: (gallaRecord.quickCashSales || []).length,
    customerCashCollected: Math.round(customerCashCollected * 100) / 100,
    digitalCollected: Math.round(digitalCollected * 100) / 100,
    totalCashIn,
    totalExpenses: Math.round(totalExpenses * 100) / 100,
    expenseCount: (gallaRecord.expenses || []).length,
    expectedCash,
    closingCashCounted: counted,
    difference,
    status: gallaRecord.status,
    notes: gallaRecord.notes || '',
    closedAt: gallaRecord.closedAt,
    recentCashPayments: cashPayments.slice(-5),
  };
};

// @desc    Get Today's Galla (Cash Register)
// @route   GET /api/galla/today
// @access  Private (Shop Owner / System Admin)
const getTodayGalla = async (req, res, next) => {
  try {
    const shopId = await getShopIdForUser(req.user, req.query.shopId);
    if (!shopId) {
      return res.status(400).json({ success: false, message: 'Shop ID required.' });
    }

    const dateStr = req.query.date || getTodayString();
    let galla = await DailyGalla.findOne({ shopId, date: dateStr });

    if (!galla) {
      galla = await DailyGalla.create({
        shopId,
        date: dateStr,
        openingCash: 0,
        quickCashSales: [],
        expenses: [],
        status: 'open',
      });
    }

    const summary = await calculateGallaSummary(shopId, dateStr, galla);

    res.json({
      success: true,
      galla,
      summary,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Set or Update Opening Cash
// @route   POST /api/galla/opening-cash
// @access  Private (Shop Owner / System Admin)
const setOpeningCash = async (req, res, next) => {
  try {
    const { amount, date } = req.body;
    const shopId = await getShopIdForUser(req.user, req.body.shopId);
    if (!shopId) {
      return res.status(400).json({ success: false, message: 'Shop ID required.' });
    }

    const dateStr = date || getTodayString();
    let galla = await DailyGalla.findOne({ shopId, date: dateStr });

    if (!galla) {
      galla = await DailyGalla.create({
        shopId,
        date: dateStr,
        openingCash: Number(amount) || 0,
        status: 'open',
      });
    } else {
      galla.openingCash = Number(amount) || 0;
      await galla.save();
    }

    const summary = await calculateGallaSummary(shopId, dateStr, galla);

    res.json({
      success: true,
      message: 'Opening cash updated successfully.',
      galla,
      summary,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Add Quick Cash Sale (Voice or Manual keypad)
// @route   POST /api/galla/quick-sale
// @access  Private (Shop Owner / System Admin)
const addQuickCashSale = async (req, res, next) => {
  try {
    const { amount, note, source, date } = req.body;
    const numAmount = Number(amount);

    if (!numAmount || numAmount <= 0) {
      return res.status(400).json({ success: false, message: 'Valid sale amount is required.' });
    }

    const shopId = await getShopIdForUser(req.user, req.body.shopId);
    if (!shopId) {
      return res.status(400).json({ success: false, message: 'Shop ID required.' });
    }

    const dateStr = date || getTodayString();
    let galla = await DailyGalla.findOne({ shopId, date: dateStr });

    if (!galla) {
      galla = await DailyGalla.create({
        shopId,
        date: dateStr,
        openingCash: 0,
        quickCashSales: [],
        expenses: [],
        status: 'open',
      });
    }

    galla.quickCashSales.push({
      amount: numAmount,
      note: note || 'Quick Cash Sale',
      source: source || 'manual',
      recordedBy: req.user._id,
      time: new Date(),
    });

    await galla.save();
    const summary = await calculateGallaSummary(shopId, dateStr, galla);

    res.status(201).json({
      success: true,
      message: `₹${numAmount} cash sale recorded.`,
      galla,
      summary,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Add Drawer Cash Expense (Tea, helper wages, electricity, etc.)
// @route   POST /api/galla/expense
// @access  Private (Shop Owner / System Admin)
const addDrawerExpense = async (req, res, next) => {
  try {
    const { amount, category, note, date } = req.body;
    const numAmount = Number(amount);

    if (!numAmount || numAmount <= 0) {
      return res.status(400).json({ success: false, message: 'Valid expense amount is required.' });
    }

    const shopId = await getShopIdForUser(req.user, req.body.shopId);
    if (!shopId) {
      return res.status(400).json({ success: false, message: 'Shop ID required.' });
    }

    const dateStr = date || getTodayString();
    let galla = await DailyGalla.findOne({ shopId, date: dateStr });

    if (!galla) {
      galla = await DailyGalla.create({
        shopId,
        date: dateStr,
        openingCash: 0,
        quickCashSales: [],
        expenses: [],
        status: 'open',
      });
    }

    galla.expenses.push({
      amount: numAmount,
      category: category || 'General',
      note: note || '',
      recordedBy: req.user._id,
      time: new Date(),
    });

    await galla.save();
    const summary = await calculateGallaSummary(shopId, dateStr, galla);

    res.status(201).json({
      success: true,
      message: `₹${numAmount} expense recorded.`,
      galla,
      summary,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Close Daily Galla & Calculate Cash Discrepancy
// @route   POST /api/galla/close
// @access  Private (Shop Owner / System Admin)
const closeDailyGalla = async (req, res, next) => {
  try {
    const { closingCashCounted, notes, date } = req.body;
    const numCounted = Number(closingCashCounted);

    if (isNaN(numCounted) || numCounted < 0) {
      return res.status(400).json({ success: false, message: 'Valid counted cash amount is required.' });
    }

    const shopId = await getShopIdForUser(req.user, req.body.shopId);
    if (!shopId) {
      return res.status(400).json({ success: false, message: 'Shop ID required.' });
    }

    const dateStr = date || getTodayString();
    let galla = await DailyGalla.findOne({ shopId, date: dateStr });

    if (!galla) {
      galla = await DailyGalla.create({
        shopId,
        date: dateStr,
        openingCash: 0,
        status: 'open',
      });
    }

    const summary = await calculateGallaSummary(shopId, dateStr, galla);
    const expected = summary.expectedCash;
    const difference = Math.round((numCounted - expected) * 100) / 100;

    galla.closingCashCounted = numCounted;
    galla.expectedCash = expected;
    galla.difference = difference;
    galla.status = 'closed';
    galla.notes = notes || '';
    galla.closedAt = new Date();
    galla.closedBy = req.user._id;

    await galla.save();
    const updatedSummary = await calculateGallaSummary(shopId, dateStr, galla);

    res.json({
      success: true,
      message:
        difference === 0
          ? '🎉 Daily Galla balanced perfectly!'
          : difference > 0
          ? `Galla closed with ₹${difference} excess cash.`
          : `Galla closed with ₹${Math.abs(difference)} cash shortage.`,
      galla,
      summary: updatedSummary,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get Galla History
// @route   GET /api/galla/history
// @access  Private (Shop Owner / System Admin)
const getGallaHistory = async (req, res, next) => {
  try {
    const shopId = await getShopIdForUser(req.user, req.query.shopId);
    if (!shopId) {
      return res.status(400).json({ success: false, message: 'Shop ID required.' });
    }

    const query = { shopId };
    if (req.query.startDate || req.query.endDate) {
      query.date = {};
      if (req.query.startDate) query.date.$gte = req.query.startDate;
      if (req.query.endDate) query.date.$lte = req.query.endDate;
    }

    const limit = Number(req.query.limit) || 100;

    const records = await DailyGalla.find(query)
      .sort({ date: -1 })
      .limit(limit);

    res.json({
      success: true,
      count: records.length,
      history: records,
    });
  } catch (err) {
    next(err);
  }
};


module.exports = {
  getTodayGalla,
  setOpeningCash,
  addQuickCashSale,
  addDrawerExpense,
  closeDailyGalla,
  getGallaHistory,
};
