const mongoose = require('mongoose');
const CustomerProfile = require('../models/CustomerProfile');
const Purchase = require('../models/Purchase');
const Payment = require('../models/Payment');

/**
 * Recalculate customer's total purchases, total payments, and outstanding balance
 * @param {string|mongoose.Types.ObjectId} customerId 
 */
const recalculateCustomerBalance = async (customerId) => {
  const cId = new mongoose.Types.ObjectId(customerId);

  // Aggregate total purchases
  const purchaseAgg = await Purchase.aggregate([
    { $match: { customerId: cId } },
    { $group: { _id: null, total: { $sum: '$totalAmount' } } },
  ]);
  const totalPurchases = purchaseAgg.length > 0 ? purchaseAgg[0].total : 0;

  // Aggregate total payments
  const paymentAgg = await Payment.aggregate([
    { $match: { customerId: cId } },
    { $group: { _id: null, total: { $sum: '$amount' } } },
  ]);
  const totalPayments = paymentAgg.length > 0 ? paymentAgg[0].total : 0;

  const outstandingBalance = totalPurchases - totalPayments;

  // Update customer profile
  const updatedCustomer = await CustomerProfile.findByIdAndUpdate(
    cId,
    {
      totalPurchases: Math.round(totalPurchases * 100) / 100,
      totalPayments: Math.round(totalPayments * 100) / 100,
      outstandingBalance: Math.round(outstandingBalance * 100) / 100,
    },
    { new: true }
  );

  return updatedCustomer;
};

module.exports = { recalculateCustomerBalance };
