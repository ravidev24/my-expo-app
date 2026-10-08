const mongoose = require('mongoose');

const quickSaleItemSchema = new mongoose.Schema({
  amount: {
    type: Number,
    required: true,
    min: 0.01,
  },
  note: {
    type: String,
    default: 'Quick Cash Sale',
    trim: true,
  },
  time: {
    type: Date,
    default: Date.now,
  },
  source: {
    type: String,
    enum: ['voice', 'manual', 'keypad'],
    default: 'manual',
  },
  recordedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
});

const drawerExpenseSchema = new mongoose.Schema({
  amount: {
    type: Number,
    required: true,
    min: 0.01,
  },
  category: {
    type: String,
    default: 'General',
    enum: ['Tea/Snacks', 'Helper Wages', 'Electricity/Bill', 'Shop Supplies', 'Vendor/Delivery', 'Other', 'General'],
  },
  note: {
    type: String,
    default: '',
    trim: true,
  },
  time: {
    type: Date,
    default: Date.now,
  },
  recordedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
});

const dailyGallaSchema = new mongoose.Schema(
  {
    shopId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Shop',
      required: true,
    },
    date: {
      type: String, // Format: YYYY-MM-DD
      required: true,
    },
    openingCash: {
      type: Number,
      default: 0,
      min: 0,
    },
    quickCashSales: [quickSaleItemSchema],
    expenses: [drawerExpenseSchema],
    closingCashCounted: {
      type: Number,
      default: null,
    },
    expectedCash: {
      type: Number,
      default: 0,
    },
    difference: {
      type: Number,
      default: 0,
    },
    status: {
      type: String,
      enum: ['open', 'closed'],
      default: 'open',
    },
    notes: {
      type: String,
      default: '',
    },
    closedAt: {
      type: Date,
      default: null,
    },
    closedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

dailyGallaSchema.index({ shopId: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('DailyGalla', dailyGallaSchema);
