const mongoose = require('mongoose');

const customerProfileSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    shopId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Shop',
      required: true,
    },
    name: {
      type: String,
      required: [true, 'Customer name is required'],
      trim: true,
    },
    email: {
      type: String,
      lowercase: true,
      trim: true,
      default: '',
    },
    phone: {
      type: String,
      trim: true,
      default: '',
    },
    address: {
      type: String,
      trim: true,
      default: '',
    },
    creditLimit: {
      type: Number,
      default: 10000,
      min: 0,
    },
    totalPurchases: {
      type: Number,
      default: 0,
      min: 0,
    },
    totalPayments: {
      type: Number,
      default: 0,
      min: 0,
    },
    outstandingBalance: {
      type: Number,
      default: 0,
    },
    notes: {
      type: String,
      default: '',
    },
    status: {
      type: String,
      enum: ['active', 'inactive'],
      default: 'active',
    },
    promiseToPayDate: {
      type: Date,
      default: null,
    },
    promiseAmount: {
      type: Number,
      default: 0,
    },
    riskCategory: {
      type: String,
      enum: ['low', 'medium', 'high'],
      default: 'low',
    },
    lastPaymentDate: {
      type: Date,
      default: null,
    },
    disputeCount: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for unique customer per shop
customerProfileSchema.index({ shopId: 1, email: 1 }, { unique: true });
customerProfileSchema.index({ shopId: 1, phone: 1 });

module.exports = mongoose.model('CustomerProfile', customerProfileSchema);
