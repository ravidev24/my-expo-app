const mongoose = require('mongoose');

const regularItemSchema = new mongoose.Schema({
  customerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'CustomerProfile',
    required: true,
  },
  customerName: {
    type: String,
    required: true,
  },
  itemName: {
    type: String,
    required: true,
    trim: true,
  },
  quantity: {
    type: Number,
    required: true,
    default: 1,
    min: 0.1,
  },
  unit: {
    type: String,
    default: 'pkt',
  },
  unitPrice: {
    type: Number,
    required: true,
    min: 0,
  },
  active: {
    type: Boolean,
    default: true,
  },
  lastLoggedDate: {
    type: String, // YYYY-MM-DD
    default: '',
  },
});

const regularSubscriptionSchema = new mongoose.Schema(
  {
    shopId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Shop',
      required: true,
      unique: true,
    },
    items: [regularItemSchema],
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('RegularSubscription', regularSubscriptionSchema);
