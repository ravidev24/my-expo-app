const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Shop = require('../models/Shop');
const CustomerProfile = require('../models/CustomerProfile');

// Generate JWT Token
const generateToken = (id, tokenVersion = 0) => {
  return jwt.sign(
    { id, tv: tokenVersion },
    process.env.JWT_SECRET || 'grocery_expense_super_secret_jwt_key_2026_xyz!',
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
};

// @desc    Auth user & get token
// @route   POST /api/auth/login
// @access  Public
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide both email and password',
      });
    }

    // Check user and explicitly include password field
    const user = await User.findOne({ email: email.toLowerCase() }).select('+password');

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials. User not found.',
      });
    }

    if (user.status === 'pending_setup') {
      return res.status(403).json({
        success: false,
        message: 'Please complete your account password setup using the link sent to your email.',
        requiresSetup: true,
      });
    }

    if (user.status === 'inactive') {
      return res.status(403).json({
        success: false,
        message: 'Your account is deactivated. Please contact the administrator.',
      });
    }

    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.',
      });
    }

    // Fetch related details based on role
    let shop = null;
    let customerProfile = null;

    if (user.role === 'shop_owner') {
      shop = await Shop.findOne({ ownerId: user._id });
    } else if (user.role === 'customer') {
      customerProfile = await CustomerProfile.findOne({ userId: user._id });
      if (!customerProfile && user.email) {
        customerProfile = await CustomerProfile.findOne({ email: user.email.toLowerCase() });
        if (customerProfile && !customerProfile.userId) {
          customerProfile.userId = user._id;
          await customerProfile.save();
        }
      }
      if (customerProfile && customerProfile.shopId) {
        shop = await Shop.findById(customerProfile.shopId);
      }
    }

    const token = generateToken(user._id, user.tokenVersion || 0);

    res.json({
      success: true,
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        phone: user.phone,
        status: user.status,
        avatar: user.avatar,
        shopId: shop ? shop._id : user.shopId,
      },
      shop: shop
        ? {
            id: shop._id,
            name: shop.name,
            phone: shop.phone,
            address: shop.address,
            currency: shop.currency,
            currencyCode: shop.currencyCode,
            upiId: shop.upiId || '',
            tagline: shop.tagline || '',
          }
        : null,
      customerProfile: customerProfile
        ? {
            id: customerProfile._id,
            name: customerProfile.name,
            email: customerProfile.email,
            phone: customerProfile.phone,
            address: customerProfile.address,
            creditLimit: customerProfile.creditLimit,
            outstandingBalance: customerProfile.outstandingBalance,
            totalPurchases: customerProfile.totalPurchases,
            totalPayments: customerProfile.totalPayments,
          }
        : null,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get current logged in user
// @route   GET /api/auth/me
// @access  Private
const getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);
    let shop = null;
    let customerProfile = null;

    if (user.role === 'shop_owner') {
      shop = await Shop.findOne({ ownerId: user._id });
    } else if (user.role === 'customer') {
      customerProfile = await CustomerProfile.findOne({ userId: user._id });
      if (!customerProfile && user.email) {
        customerProfile = await CustomerProfile.findOne({ email: user.email.toLowerCase() });
        if (customerProfile && !customerProfile.userId) {
          customerProfile.userId = user._id;
          await customerProfile.save();
        }
      }
      if (customerProfile && customerProfile.shopId) {
        shop = await Shop.findById(customerProfile.shopId);
      }
    }

    res.json({
      success: true,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        phone: user.phone,
        status: user.status,
        avatar: user.avatar,
        shopId: shop ? shop._id : user.shopId,
      },
      shop: shop
        ? {
            id: shop._id,
            name: shop.name,
            phone: shop.phone,
            address: shop.address,
            currency: shop.currency,
            currencyCode: shop.currencyCode,
            upiId: shop.upiId || '',
            tagline: shop.tagline || '',
          }
        : null,
      customerProfile: customerProfile
        ? {
            id: customerProfile._id,
            name: customerProfile.name,
            email: customerProfile.email,
            phone: customerProfile.phone,
            address: customerProfile.address,
            creditLimit: customerProfile.creditLimit,
            outstandingBalance: customerProfile.outstandingBalance,
            totalPurchases: customerProfile.totalPurchases,
            totalPayments: customerProfile.totalPayments,
          }
        : null,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Set up password using setup token
// @route   POST /api/auth/setup-password
// @access  Public
const setupPassword = async (req, res, next) => {
  try {
    const { token, email, password } = req.body;

    if (!token || !password) {
      return res.status(400).json({
        success: false,
        message: 'Token and new password are required.',
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters long.',
      });
    }

    const query = {
      passwordSetupToken: token,
      passwordSetupExpires: { $gt: Date.now() },
    };

    if (email) {
      query.email = email.toLowerCase();
    }

    const user = await User.findOne(query).select('+passwordSetupToken +passwordSetupExpires');

    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired setup token. Please request a new setup link from your shop owner.',
      });
    }

    // Set new password
    user.password = password;
    user.status = 'active';
    user.passwordSetupToken = undefined;
    user.passwordSetupExpires = undefined;
    await user.save();

    const authToken = generateToken(user._id, user.tokenVersion || 0);

    res.json({
      success: true,
      message: 'Password set up successfully! You are now logged in.',
      token: authToken,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        phone: user.phone,
        status: user.status,
      },
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Google Authentication (Simulated & Token exchange)
// @route   POST /api/auth/google
// @access  Public
const googleAuth = async (req, res, next) => {
  try {
    const { email, name, googleId, avatar } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email is required for Google sign-in',
      });
    }

    let user = await User.findOne({ email: email.toLowerCase() });

    if (!user) {
      // Create new customer account if signing up with Google
      user = await User.create({
        name: name || email.split('@')[0],
        email: email.toLowerCase(),
        role: 'customer',
        googleId: googleId || `google_${Date.now()}`,
        avatar: avatar || '',
        status: 'active',
      });
    } else {
      if (googleId && !user.googleId) {
        user.googleId = googleId;
      }
      if (avatar && !user.avatar) {
        user.avatar = avatar;
      }
      await user.save();
    }

    let shop = null;
    let customerProfile = null;

    if (user.role === 'shop_owner') {
      shop = await Shop.findOne({ ownerId: user._id });
    } else if (user.role === 'customer') {
      customerProfile = await CustomerProfile.findOne({ userId: user._id });
      if (customerProfile && customerProfile.shopId) {
        shop = await Shop.findById(customerProfile.shopId);
      }
    }

    const token = generateToken(user._id, user.tokenVersion || 0);

    res.json({
      success: true,
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        phone: user.phone,
        status: user.status,
        avatar: user.avatar,
        shopId: shop ? shop._id : user.shopId,
      },
      shop,
      customerProfile,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Revoke the current session token
// @route   POST /api/auth/logout
// @access  Private
const logout = async (req, res, next) => {
  try {
    req.user.tokenVersion = (req.user.tokenVersion || 0) + 1;
    await req.user.save();

    res.json({
      success: true,
      message: 'Logged out successfully.',
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Change the logged-in user's password
// @route   POST /api/auth/change-password
// @access  Private
const changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Current password and new password are required.',
      });
    }

    if (String(newPassword).length < 6) {
      return res.status(400).json({
        success: false,
        message: 'New password must be at least 6 characters.',
      });
    }

    const user = await User.findById(req.user._id).select('+password');
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    const matches = await user.matchPassword(currentPassword);
    if (!matches) {
      return res.status(401).json({
        success: false,
        message: 'Current password is incorrect.',
      });
    }

    user.password = newPassword;
    await user.save();

    res.json({
      success: true,
      message: 'Password changed successfully.',
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Register or update user push notification token
// @route   POST /api/auth/push-token
// @access  Private
const registerPushToken = async (req, res, next) => {
  try {
    const { pushToken, platform = 'expo' } = req.body;

    if (!pushToken || typeof pushToken !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'Push token string is required.',
      });
    }

    const cleanToken = pushToken.trim();
    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    if (!Array.isArray(user.pushTokens)) {
      user.pushTokens = [];
    }

    // Check if token already exists
    const existingIndex = user.pushTokens.findIndex((pt) => pt.token === cleanToken);
    if (existingIndex > -1) {
      user.pushTokens[existingIndex].updatedAt = new Date();
      user.pushTokens[existingIndex].platform = platform;
    } else {
      user.pushTokens.push({
        token: cleanToken,
        platform,
        updatedAt: new Date(),
      });
    }

    await user.save();

    res.json({
      success: true,
      message: 'Push notification token registered successfully.',
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Remove push notification token on logout
// @route   DELETE /api/auth/push-token
// @access  Private
const removePushToken = async (req, res, next) => {
  try {
    const { pushToken } = req.body;
    const user = await User.findById(req.user._id);

    if (user && Array.isArray(user.pushTokens)) {
      if (pushToken) {
        user.pushTokens = user.pushTokens.filter((pt) => pt.token !== pushToken.trim());
      } else {
        user.pushTokens = [];
      }
      await user.save();
    }

    res.json({
      success: true,
      message: 'Push notification token unregistered.',
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Update user profile (Name, Phone / WhatsApp, Address)
// @route   PUT /api/auth/profile
// @access  Private
const updateProfile = async (req, res, next) => {
  try {
    const { name, phone, address } = req.body;
    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    if (name) user.name = name.trim();
    if (phone !== undefined) user.phone = phone.trim();
    await user.save();

    let customerProfile = null;
    let shop = null;

    if (user.role === 'customer') {
      customerProfile = await CustomerProfile.findOne({ userId: user._id });
      if (!customerProfile && user.email) {
        customerProfile = await CustomerProfile.findOne({ email: user.email.toLowerCase() });
        if (customerProfile && !customerProfile.userId) {
          customerProfile.userId = user._id;
        }
      }
      if (customerProfile) {
        if (name) customerProfile.name = name.trim();
        if (phone !== undefined) customerProfile.phone = phone.trim();
        if (address !== undefined) customerProfile.address = address.trim();
        await customerProfile.save();
        if (customerProfile.shopId) {
          shop = await Shop.findById(customerProfile.shopId);
        }
      }
    } else if (user.role === 'shop_owner') {
      shop = await Shop.findOne({ ownerId: user._id });
      if (shop && phone !== undefined && !shop.phone) {
        shop.phone = phone.trim();
        await shop.save();
      }
    }

    res.json({
      success: true,
      message: 'Profile updated successfully.',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        phone: user.phone,
        status: user.status,
        avatar: user.avatar,
        shopId: shop ? shop._id : user.shopId,
      },
      shop: shop
        ? {
            id: shop._id,
            name: shop.name,
            phone: shop.phone,
            address: shop.address,
            currency: shop.currency,
            currencyCode: shop.currencyCode,
            upiId: shop.upiId || '',
            tagline: shop.tagline || '',
          }
        : null,
      customerProfile: customerProfile
        ? {
            id: customerProfile._id,
            name: customerProfile.name,
            email: customerProfile.email,
            phone: customerProfile.phone,
            address: customerProfile.address,
            creditLimit: customerProfile.creditLimit,
            outstandingBalance: customerProfile.outstandingBalance,
            totalPurchases: customerProfile.totalPurchases,
            totalPayments: customerProfile.totalPayments,
          }
        : null,
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  login,
  getMe,
  updateProfile,
  setupPassword,
  googleAuth,
  logout,
  changePassword,
  registerPushToken,
  removePushToken,
};
