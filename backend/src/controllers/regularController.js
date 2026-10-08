const RegularSubscription = require('../models/RegularSubscription');
const CustomerProfile = require('../models/CustomerProfile');
const Purchase = require('../models/Purchase');
const Shop = require('../models/Shop');
const { recalculateCustomerBalance } = require('../utils/balanceCalculator');

// Helper to get active shopId
const getShopIdForUser = async (user, requestedShopId) => {
  if (user.role === 'system_admin' && requestedShopId) {
    return requestedShopId;
  }
  const shop = await Shop.findOne({ ownerId: user._id });
  return shop ? shop._id : user.shopId;
};

// Helper for today's date string
const getTodayString = () => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// @desc    Get All Regular Items / Subscriptions for this shop
// @route   GET /api/regulars
// @access  Private (Shop Owner / System Admin)
const getRegulars = async (req, res, next) => {
  try {
    const shopId = await getShopIdForUser(req.user, req.query.shopId);
    if (!shopId) {
      return res.status(400).json({ success: false, message: 'Shop ID required.' });
    }

    let sub = await RegularSubscription.findOne({ shopId }).populate('items.customerId', 'name phone outstandingBalance');
    if (!sub) {
      sub = await RegularSubscription.create({ shopId, items: [] });
    }

    const todayStr = getTodayString();
    res.json({
      success: true,
      today: todayStr,
      items: sub.items,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Add / Update a Regular Subscription Item (e.g. Ramesh - 1 Milk packet @ ₹30)
// @route   POST /api/regulars/item
// @access  Private (Shop Owner / System Admin)
const addOrUpdateRegularItem = async (req, res, next) => {
  try {
    const { customerId, itemName, quantity, unit, unitPrice } = req.body;

    if (!customerId || !itemName || !unitPrice) {
      return res.status(400).json({ success: false, message: 'Customer, item name, and price are required.' });
    }

    const shopId = await getShopIdForUser(req.user, req.body.shopId);
    if (!shopId) {
      return res.status(400).json({ success: false, message: 'Shop ID required.' });
    }

    const customer = await CustomerProfile.findById(customerId);
    if (!customer) {
      return res.status(404).json({ success: false, message: 'Customer not found.' });
    }

    let sub = await RegularSubscription.findOne({ shopId });
    if (!sub) {
      sub = await RegularSubscription.create({ shopId, items: [] });
    }

    // Check if item already exists for this customer
    const existingIndex = sub.items.findIndex(
      (item) => item.customerId.toString() === customerId && item.itemName.toLowerCase() === itemName.toLowerCase().trim()
    );

    if (existingIndex >= 0) {
      sub.items[existingIndex].quantity = Number(quantity) || 1;
      sub.items[existingIndex].unit = unit || 'pkt';
      sub.items[existingIndex].unitPrice = Number(unitPrice);
      sub.items[existingIndex].active = true;
    } else {
      sub.items.push({
        customerId: customer._id,
        customerName: customer.name,
        itemName: itemName.trim(),
        quantity: Number(quantity) || 1,
        unit: unit || 'pkt',
        unitPrice: Number(unitPrice),
        active: true,
      });
    }

    await sub.save();

    res.json({
      success: true,
      message: `Added ${itemName} to daily regulars for ${customer.name}.`,
      items: sub.items,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Remove a Regular Subscription Item
// @route   DELETE /api/regulars/item/:id
// @access  Private (Shop Owner / System Admin)
const removeRegularItem = async (req, res, next) => {
  try {
    const shopId = await getShopIdForUser(req.user, req.query.shopId);
    let sub = await RegularSubscription.findOne({ shopId });
    if (!sub) {
      return res.status(404).json({ success: false, message: 'Not found.' });
    }

    sub.items = sub.items.filter((item) => item._id.toString() !== req.params.id);
    await sub.save();

    res.json({
      success: true,
      message: 'Regular item removed.',
      items: sub.items,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Bulk Record Selected Daily Regulars (1-Tap Batch Purchase Entry)
// @route   POST /api/regulars/batch-record
// @access  Private (Shop Owner / System Admin)
const batchRecordRegulars = async (req, res, next) => {
  try {
    const { itemIds, date } = req.body; // Array of item _ids from RegularSubscription

    if (!Array.isArray(itemIds) || itemIds.length === 0) {
      return res.status(400).json({ success: false, message: 'Please select at least one customer item.' });
    }

    const shopId = await getShopIdForUser(req.user, req.body.shopId);
    if (!shopId) {
      return res.status(400).json({ success: false, message: 'Shop ID required.' });
    }

    const sub = await RegularSubscription.findOne({ shopId });
    if (!sub) {
      return res.status(404).json({ success: false, message: 'No regular subscriptions found.' });
    }

    const todayStr = date || getTodayString();
    const selectedItems = sub.items.filter((item) => itemIds.includes(item._id.toString()));

    let recordedCount = 0;
    const errors = [];

    for (const item of selectedItems) {
      try {
        const customer = await CustomerProfile.findById(item.customerId);
        if (!customer) continue;

        const lineAmount = Math.round(item.quantity * item.unitPrice * 100) / 100;
        const billNo = `REG-${Date.now().toString().slice(-6)}-${Math.floor(Math.random() * 100)}`;

        await Purchase.create({
          shopId,
          customerId: customer._id,
          customerUserId: customer.userId,
          billNo,
          date: new Date(),
          items: [
            {
              name: item.itemName,
              quantity: item.quantity,
              unit: item.unit,
              unitPrice: item.unitPrice,
              amount: lineAmount,
              category: 'Daily Regulars',
            },
          ],
          subtotal: lineAmount,
          discount: 0,
          tax: 0,
          totalAmount: lineAmount,
          paymentStatus: 'unpaid',
          notes: `Daily Regular Delivery (${todayStr})`,
          createdBy: req.user._id,
        });

        await recalculateCustomerBalance(customer._id);
        item.lastLoggedDate = todayStr;
        recordedCount++;
      } catch (err) {
        errors.push({ item: item.itemName, error: err.message });
      }
    }

    await sub.save();

    res.json({
      success: true,
      message: `Successfully logged daily items for ${recordedCount} customer(s)!`,
      recordedCount,
      errors,
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getRegulars,
  addOrUpdateRegularItem,
  removeRegularItem,
  batchRecordRegulars,
};
