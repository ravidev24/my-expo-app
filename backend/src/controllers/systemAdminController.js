const User = require('../models/User');
const Shop = require('../models/Shop');
const CustomerProfile = require('../models/CustomerProfile');
const Purchase = require('../models/Purchase');
const Payment = require('../models/Payment');
const { generatePassword } = require('../utils/password');
const { sendLoginPasswordEmail } = require('../config/mailer');

const ROLE_LABELS = {
  system_admin: 'System Admin',
  shop_owner: 'Admin',
  customer: 'Customer',
};

// @desc    Get Platform Global Statistics
// @route   GET /api/system-admin/stats
// @access  Private (System Admin only)
const getPlatformStats = async (req, res, next) => {
  try {
    const totalShopOwners = await User.countDocuments({ role: 'shop_owner' });
    const totalShops = await Shop.countDocuments();
    const totalCustomers = await CustomerProfile.countDocuments();
    const totalPurchases = await Purchase.countDocuments();
    const totalPayments = await Payment.countDocuments();

    // Aggregations
    const salesAgg = await Purchase.aggregate([
      { $group: { _id: null, totalSales: { $sum: '$totalAmount' } } },
    ]);
    const totalSales = salesAgg.length > 0 ? salesAgg[0].totalSales : 0;

    const paymentsAgg = await Payment.aggregate([
      { $group: { _id: null, totalCollected: { $sum: '$amount' } } },
    ]);
    const totalCollected = paymentsAgg.length > 0 ? paymentsAgg[0].totalCollected : 0;

    res.json({
      success: true,
      stats: {
        totalShopOwners,
        totalShops,
        totalCustomers,
        totalPurchases,
        totalPayments,
        totalSales: Math.round(totalSales * 100) / 100,
        totalCollected: Math.round(totalCollected * 100) / 100,
        totalOutstanding: Math.round((totalSales - totalCollected) * 100) / 100,
      },
    });
  } catch (err) {
    next(err);
  }
};

// @desc    List all Shop Owners
// @route   GET /api/system-admin/shop-owners
// @access  Private (System Admin only)
const getShopOwners = async (req, res, next) => {
  try {
    const shopOwners = await User.find({ role: 'shop_owner' }).sort({ createdAt: -1 });

    const results = await Promise.all(
      shopOwners.map(async (owner) => {
        const shop = await Shop.findOne({ ownerId: owner._id });
        const customerCount = shop
          ? await CustomerProfile.countDocuments({ shopId: shop._id })
          : 0;
        const purchaseCount = shop
          ? await Purchase.countDocuments({ shopId: shop._id })
          : 0;

        return {
          id: owner._id,
          name: owner.name,
          email: owner.email,
          phone: owner.phone,
          status: owner.status,
          createdAt: owner.createdAt,
          shop: shop
            ? {
                id: shop._id,
                name: shop.name,
                address: shop.address,
                phone: shop.phone,
                city: shop.city,
                currency: shop.currency,
              }
            : null,
          customerCount,
          purchaseCount,
        };
      })
    );

    res.json({
      success: true,
      count: results.length,
      shopOwners: results,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Create a new Shop Owner & Shop
// @route   POST /api/system-admin/shop-owners
// @access  Private (System Admin only)
const createShopOwner = async (req, res, next) => {
  try {
    const { name, email, password, phone, shopName, shopAddress, shopPhone, currency } = req.body;

    if (!name || !email || !shopName) {
      return res.status(400).json({
        success: false,
        message: 'Name, email, and shop name are required.',
      });
    }

    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'A user with this email address already exists.',
      });
    }

    // Default password if not provided
    const userPassword = password || 'ShopOwner@123';

    const user = await User.create({
      name,
      email: email.toLowerCase(),
      password: userPassword,
      role: 'shop_owner',
      phone: phone || '',
      status: 'active',
    });

    const shop = await Shop.create({
      name: shopName,
      ownerId: user._id,
      phone: shopPhone || phone || '',
      email: email.toLowerCase(),
      address: shopAddress || '',
      currency: currency || '₹',
    });

    user.shopId = shop._id;
    await user.save();

    res.status(201).json({
      success: true,
      message: 'Shop Owner and Grocery Shop created successfully.',
      shopOwner: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        status: user.status,
        shop: {
          id: shop._id,
          name: shop.name,
          address: shop.address,
          currency: shop.currency,
        },
      },
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Toggle Shop Owner Active/Inactive status
// @route   PATCH /api/system-admin/shop-owners/:id/status
// @access  Private (System Admin only)
const toggleShopOwnerStatus = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user || user.role !== 'shop_owner') {
      return res.status(404).json({
        success: false,
        message: 'Shop Owner not found.',
      });
    }

    user.status = user.status === 'active' ? 'inactive' : 'active';
    await user.save();

    res.json({
      success: true,
      message: `Shop Owner is now ${user.status}.`,
      status: user.status,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    List users created on the platform
// @route   GET /api/system-admin/users
// @access  Private (System Admin only)
const getUsers = async (req, res, next) => {
  try {
    const users = await User.find()
      .select('name email role status createdAt')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      count: users.length,
      users: users.map((user) => ({
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        roleLabel: ROLE_LABELS[user.role] || user.role,
        status: user.status,
        createdAt: user.createdAt,
      })),
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Create a user. Password is generated and emailed.
// @route   POST /api/system-admin/users
// @access  Private (System Admin only)
const createUser = async (req, res, next) => {
  try {
    const { name, email, role } = req.body;
    const allowedRoles = ['system_admin', 'shop_owner'];

    if (!name || !email || !role) {
      return res.status(400).json({
        success: false,
        message: 'Name, email, and role are required.',
      });
    }

    if (role === 'customer') {
      return res.status(400).json({
        success: false,
        message: 'System Admin cannot add customers. Customers must be registered directly by their respective Shop Owner.',
      });
    }

    if (!allowedRoles.includes(role)) {
      return res.status(400).json({
        success: false,
        message: 'Role must be System Admin or Shop Owner (Admin).',
      });
    }

    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'A user with this email address already exists.',
      });
    }

    let shop = null;

    const password = generatePassword();
    const user = await User.create({
      name,
      email: email.toLowerCase(),
      password,
      role,
      status: 'active',
      shopId: null,
    });

    if (role === 'shop_owner') {
      shop = await Shop.create({
        name: `${name} Shop`,
        ownerId: user._id,
        email: email.toLowerCase(),
        currency: '₹',
      });
      user.shopId = shop._id;
      await user.save();
    }

    const mailResult = await sendLoginPasswordEmail({
      to: user.email,
      name: user.name,
      password,
      role: ROLE_LABELS[role],
    });

    res.status(201).json({
      success: true,
      message:
        mailResult.mode === 'smtp'
          ? 'User added. A password was emailed to them.'
          : 'User added. Email is not configured, so the password is shown below.',
      emailSent: mailResult.mode === 'smtp',
      temporaryPassword: mailResult.mode === 'simulated' ? password : undefined,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        roleLabel: ROLE_LABELS[role],
        status: user.status,
      },
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getPlatformStats,
  getShopOwners,
  createShopOwner,
  toggleShopOwnerStatus,
  getUsers,
  createUser,
};
