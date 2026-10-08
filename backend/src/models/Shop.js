const mongoose = require('mongoose');

const shopSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Shop name is required'],
      trim: true,
    },
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    phone: {
      type: String,
      trim: true,
      default: '',
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      default: '',
    },
    address: {
      type: String,
      trim: true,
      default: '',
    },
    city: {
      type: String,
      trim: true,
      default: '',
    },
    currency: {
      type: String,
      default: '₹',
      trim: true,
    },
    currencyCode: {
      type: String,
      default: 'INR',
      trim: true,
    },
    upiId: {
      type: String,
      trim: true,
      default: '',
    },
    tagline: {
      type: String,
      trim: true,
      default: 'Scan to Pay or Check Balance',
    },
    status: {
      type: String,
      enum: ['active', 'inactive'],
      default: 'active',
    },
    settings: {
      taxRatePercent: {
        type: Number,
        default: 0,
      },
      allowOverCreditLimit: {
        type: Boolean,
        default: true,
      },
      defaultUnits: {
        type: [String],
        default: ['kg', 'g', 'L', 'ml', 'pcs', 'packet', 'box', 'dozen', 'bag', 'bottle'],
      },
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Shop', shopSchema);
