const mongoose = require('mongoose');
const User = require('../models/User');
const Shop = require('../models/Shop');
const CustomerProfile = require('../models/CustomerProfile');
const Purchase = require('../models/Purchase');
const Payment = require('../models/Payment');
const { recalculateCustomerBalance } = require('./balanceCalculator');

const seedDatabase = async () => {
  try {
    console.log('[Seeder] Checking and populating initial seed data...');

    // Check if system admin already exists
    const adminExists = await User.findOne({ role: 'system_admin' });
    if (adminExists) {
      console.log('[Seeder] System admin already exists. Skipping initial seed.');
      return;
    }

    console.log('[Seeder] Cleaning existing collections...');
    await User.deleteMany({});
    await Shop.deleteMany({});
    await CustomerProfile.deleteMany({});
    await Purchase.deleteMany({});
    await Payment.deleteMany({});

    // 1. Create System Admin
    const systemAdmin = await User.create({
      name: 'System Administrator',
      email: 'admin@system.com',
      password: 'Admin@123',
      role: 'system_admin',
      phone: '+91 90000 00001',
      status: 'active',
    });
    console.log('[Seeder] Created System Admin: admin@system.com');

    // 2. Create Shop Owner & FreshMart Grocery Shop
    const shopOwner = await User.create({
      name: 'Rajesh Kumar',
      email: 'owner@freshmart.com',
      password: 'Owner@123',
      role: 'shop_owner',
      phone: '+91 98765 00001',
      status: 'active',
    });

    const shop = await Shop.create({
      name: 'FreshMart Grocery & Provisions',
      ownerId: shopOwner._id,
      phone: '+91 98765 00001',
      email: 'owner@freshmart.com',
      address: 'Shop #14, Main Market, MG Road',
      city: 'Bangalore',
      currency: '₹',
      currencyCode: 'INR',
    });

    shopOwner.shopId = shop._id;
    await shopOwner.save();
    console.log('[Seeder] Created Shop Owner: owner@freshmart.com and Shop: FreshMart Grocery');

    // 3. Create Sample Customers
    const customer1User = await User.create({
      name: 'John Doe',
      email: 'john@example.com',
      password: 'Customer@123',
      role: 'customer',
      phone: '+91 98765 43210',
      shopId: shop._id,
      status: 'active',
    });

    const customer1Profile = await CustomerProfile.create({
      userId: customer1User._id,
      shopId: shop._id,
      name: 'John Doe',
      email: 'john@example.com',
      phone: '+91 98765 43210',
      address: 'Flat 402, Green Valley Apartments',
      creditLimit: 15000,
      notes: 'Regular customer. Pays on 5th of every month.',
      status: 'active',
    });

    const customer2User = await User.create({
      name: 'Sarah Jenkins',
      email: 'sarah@example.com',
      password: 'Customer@123',
      role: 'customer',
      phone: '+91 98765 43211',
      shopId: shop._id,
      status: 'active',
    });

    const customer2Profile = await CustomerProfile.create({
      userId: customer2User._id,
      shopId: shop._id,
      name: 'Sarah Jenkins',
      email: 'sarah@example.com',
      phone: '+91 98765 43211',
      address: 'House #88, 3rd Cross, Indiranagar',
      creditLimit: 10000,
      notes: 'Prefers UPI payment receipts via WhatsApp.',
      status: 'active',
    });

    const customer3User = await User.create({
      name: 'Amit Sharma',
      email: 'amit@example.com',
      password: 'Customer@123',
      role: 'customer',
      phone: '+91 98765 43212',
      shopId: shop._id,
      status: 'active',
    });

    const customer3Profile = await CustomerProfile.create({
      userId: customer3User._id,
      shopId: shop._id,
      name: 'Amit Sharma',
      email: 'amit@example.com',
      phone: '+91 98765 43212',
      address: 'Plot 12, Koramangala 4th Block',
      creditLimit: 12000,
      notes: 'Weekly staples customer.',
      status: 'active',
    });

    console.log('[Seeder] Created 3 Customers (john@example.com, sarah@example.com, amit@example.com)');

    // 4. Create Sample Multi-Item Purchases
    const now = new Date();
    const daysAgo = (d) => new Date(now.getTime() - d * 24 * 60 * 60 * 1000);

    // Purchase 1 for Customer 1 (John) - 5 days ago
    await Purchase.create({
      shopId: shop._id,
      customerId: customer1Profile._id,
      customerUserId: customer1User._id,
      billNo: 'BILL-20260918-001',
      date: daysAgo(5),
      items: [
        { name: 'India Gate Basmati Rice', quantity: 5, unit: 'kg', unitPrice: 95, amount: 475, category: 'Grains' },
        { name: 'Fortune Sunflower Oil', quantity: 2, unit: 'L', unitPrice: 160, amount: 320, category: 'Oils' },
        { name: 'Madhur Pure Sugar', quantity: 3, unit: 'kg', unitPrice: 46, amount: 138, category: 'Staples' },
        { name: 'Tata Salt Crystal Salt', quantity: 1, unit: 'packet', unitPrice: 28, amount: 28, category: 'Spices' },
      ],
      subtotal: 961,
      discount: 21,
      tax: 0,
      totalAmount: 940,
      paymentStatus: 'unpaid',
      notes: 'Home delivery requested.',
      createdBy: shopOwner._id,
    });

    // Purchase 2 for Customer 1 (John) - 2 days ago
    await Purchase.create({
      shopId: shop._id,
      customerId: customer1Profile._id,
      customerUserId: customer1User._id,
      billNo: 'BILL-20260921-002',
      date: daysAgo(2),
      items: [
        { name: 'Aashirvaad Shudh Chakki Atta', quantity: 10, unit: 'kg', unitPrice: 42, amount: 420, category: 'Flour' },
        { name: 'Tata Sampann Toor Dal', quantity: 2, unit: 'kg', unitPrice: 175, amount: 350, category: 'Pulses' },
        { name: 'Amul Butter Salted', quantity: 2, unit: 'packet', unitPrice: 56, amount: 112, category: 'Dairy' },
        { name: 'Nandini GoodLife Milk', quantity: 4, unit: 'packet', unitPrice: 32, amount: 128, category: 'Dairy' },
      ],
      subtotal: 1010,
      discount: 10,
      tax: 0,
      totalAmount: 1000,
      paymentStatus: 'unpaid',
      notes: 'Monthly staples',
      createdBy: shopOwner._id,
    });

    // Purchase 3 for Customer 2 (Sarah) - 3 days ago
    await Purchase.create({
      shopId: shop._id,
      customerId: customer2Profile._id,
      customerUserId: customer2User._id,
      billNo: 'BILL-20260920-001',
      date: daysAgo(3),
      items: [
        { name: 'Organic Cold-Pressed Olive Oil', quantity: 1, unit: 'bottle', unitPrice: 650, amount: 650, category: 'Oils' },
        { name: 'Kellogg’s Almond Corn Flakes', quantity: 1, unit: 'box', unitPrice: 320, amount: 320, category: 'Breakfast' },
        { name: 'Bru Gold Instant Coffee', quantity: 1, unit: 'jar', unitPrice: 280, amount: 280, category: 'Beverages' },
      ],
      subtotal: 1250,
      discount: 50,
      tax: 0,
      totalAmount: 1200,
      paymentStatus: 'unpaid',
      notes: 'Paid partially during billing',
      createdBy: shopOwner._id,
    });

    // Purchase 4 for Customer 3 (Amit) - Today
    await Purchase.create({
      shopId: shop._id,
      customerId: customer3Profile._id,
      customerUserId: customer3User._id,
      billNo: 'BILL-20260923-001',
      date: now,
      items: [
        { name: 'Sona Masoori Rice', quantity: 10, unit: 'kg', unitPrice: 58, amount: 580, category: 'Grains' },
        { name: 'Everest Garam Masala', quantity: 2, unit: 'packet', unitPrice: 65, amount: 130, category: 'Spices' },
        { name: 'Dettol Handwash Refill', quantity: 2, unit: 'pouch', unitPrice: 99, amount: 198, category: 'Hygiene' },
      ],
      subtotal: 908,
      discount: 8,
      tax: 0,
      totalAmount: 900,
      paymentStatus: 'unpaid',
      notes: '',
      createdBy: shopOwner._id,
    });

    console.log('[Seeder] Created sample grocery purchases with itemized breakdown.');

    // 5. Create Sample Payments
    // Customer 1 pays 500 via UPI (4 days ago)
    await Payment.create({
      shopId: shop._id,
      customerId: customer1Profile._id,
      customerUserId: customer1User._id,
      receiptNo: 'RCPT-20260919-001',
      date: daysAgo(4),
      amount: 500,
      paymentMethod: 'upi',
      referenceNo: 'UPI/625342110982',
      notes: 'Google Pay payment',
      recordedBy: shopOwner._id,
    });

    // Customer 2 pays 800 via Cash (2 days ago)
    await Payment.create({
      shopId: shop._id,
      customerId: customer2Profile._id,
      customerUserId: customer2User._id,
      receiptNo: 'RCPT-20260921-001',
      date: daysAgo(2),
      amount: 800,
      paymentMethod: 'cash',
      referenceNo: 'CASH-REF-01',
      notes: 'Cash received at shop counter',
      recordedBy: shopOwner._id,
    });

    console.log('[Seeder] Created sample payments.');

    // 6. Recalculate all Customer Balances
    await recalculateCustomerBalance(customer1Profile._id);
    await recalculateCustomerBalance(customer2Profile._id);
    await recalculateCustomerBalance(customer3Profile._id);

    console.log('[Seeder] Recalculated and synchronized all customer balances.');
    console.log('[Seeder] Seed complete!');
  } catch (err) {
    console.error('[Seeder] Error during seed:', err);
  }
};

module.exports = { seedDatabase };
