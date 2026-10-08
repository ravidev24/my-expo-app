const BASE_URL = 'http://localhost:5000/api';

const runTests = async () => {
  console.log('===============================================================');
  console.log('🧪 Starting Full System Integration & Role Verification Test');
  console.log('===============================================================\n');

  let passed = 0;
  let failed = 0;

  const assert = (condition, title, details = '') => {
    if (condition) {
      console.log(`✅ [PASS] ${title}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${title} - ${details}`);
      failed++;
    }
  };

  try {
    // 1. Healthcheck
    const health = await (await fetch(`${BASE_URL}/health`)).json();
    assert(health.status === 'OK', '1. API Healthcheck returns OK');

    // 2. Authentication: System Admin Login
    const adminLogin = await (
      await fetch(`${BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'admin@system.com', password: 'Admin@123' }),
      })
    ).json();
    assert(adminLogin.success && adminLogin.user.role === 'system_admin', '2. System Admin Login succeeds with role system_admin');
    const adminToken = adminLogin.token;

    // 3. System Admin: Get Stats & Shop Owners
    const statsRes = await (
      await fetch(`${BASE_URL}/system-admin/stats`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      })
    ).json();
    assert(statsRes.success && statsRes.stats.totalShopOwners >= 1, '3. System Admin reads platform stats');

    // 4. System Admin creates a new Shop Owner & Shop
    const newOwnerRes = await (
      await fetch(`${BASE_URL}/system-admin/shop-owners`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          name: 'Vikram Patel',
          email: `vikram_${Date.now()}@patelmart.com`,
          password: 'Owner@123',
          shopName: 'Patel Supermarket',
          phone: '+91 99887 76655',
          currency: '₹',
        }),
      })
    ).json();
    assert(newOwnerRes.success && newOwnerRes.shopOwner?.shop?.name === 'Patel Supermarket', '4. System Admin successfully creates new Shop Owner & Shop');

    // 5. Authentication: Shop Owner Login
    const ownerLogin = await (
      await fetch(`${BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'owner@freshmart.com', password: 'Owner@123' }),
      })
    ).json();
    assert(ownerLogin.success && ownerLogin.user.role === 'shop_owner', '5. Shop Owner Login succeeds with role shop_owner');
    const ownerToken = ownerLogin.token;

    // 6. Shop Owner Dashboard
    const dashRes = await (
      await fetch(`${BASE_URL}/dashboard`, {
        headers: { Authorization: `Bearer ${ownerToken}` },
      })
    ).json();
    assert(dashRes.success && dashRes.metrics?.totalCustomers >= 3, '6. Shop Owner reads shop dashboard metrics & sales');

    // 7. Shop Owner creates a new Customer & verifies setup link generation
    const custEmail = `newcustomer_${Date.now()}@test.com`;
    const createCustRes = await (
      await fetch(`${BASE_URL}/customers`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${ownerToken}`,
        },
        body: JSON.stringify({
          name: 'Meera Nambiar',
          email: custEmail,
          phone: '+91 91234 56789',
          address: 'Villa 108, Palm Meadows',
          creditLimit: 20000,
          notes: 'New onboarding test customer',
        }),
      })
    ).json();
    assert(
      createCustRes.success && createCustRes.token && createCustRes.setupUrl,
      '7. Shop Owner creates Customer & system generates secure password setup link',
      JSON.stringify(createCustRes)
    );
    const createdCustomerId = createCustRes.customer._id;
    const setupToken = createCustRes.token;

    // 8. New Customer completes password setup via token
    const setupRes = await (
      await fetch(`${BASE_URL}/auth/setup-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: setupToken,
          email: custEmail,
          password: 'CustomerPass@123',
        }),
      })
    ).json();
    assert(setupRes.success && setupRes.user.status === 'active', '8. Customer sets up password using invitation token');
    const newCustToken = setupRes.token;

    // 9. Shop Owner records a Multi-Item Purchase with auto-calculation
    // Item 1: 5 kg Basmati Rice @ 90/kg = 450
    // Item 2: 2 L Cooking Oil @ 160/L = 320
    // Item 3: 4 pcs Soap @ 35/pcs = 140
    // Subtotal = 910, Discount = 10 -> Grand Total = 900
    const createPurchaseRes = await (
      await fetch(`${BASE_URL}/purchases`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${ownerToken}`,
        },
        body: JSON.stringify({
          customerId: createdCustomerId,
          items: [
            { name: 'Basmati Rice', quantity: 5, unit: 'kg', unitPrice: 90 },
            { name: 'Cooking Oil', quantity: 2, unit: 'L', unitPrice: 160 },
            { name: 'Soap Bars', quantity: 4, unit: 'pcs', unitPrice: 35 },
          ],
          discount: 10,
          notes: 'First grocery bill for Meera',
        }),
      })
    ).json();
    assert(
      createPurchaseRes.success &&
      createPurchaseRes.purchase.totalAmount === 900 &&
      createPurchaseRes.purchase.subtotal === 910 &&
      createPurchaseRes.customerSummary.outstandingBalance === 900,
      '9. Multi-item purchase automatically calculates line items (450+320+140=910 - 10 = 900) and updates customer balance to 900'
    );
    const purchaseId = createPurchaseRes.purchase._id;

    // 10. Shop Owner edits the purchase: updates Basmati Rice quantity from 5 to 6 (+90)
    // New total: 540 + 320 + 140 = 1000 - 10 = 990
    const editPurchaseRes = await (
      await fetch(`${BASE_URL}/purchases/${purchaseId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${ownerToken}`,
        },
        body: JSON.stringify({
          items: [
            { name: 'Basmati Rice', quantity: 6, unit: 'kg', unitPrice: 90 },
            { name: 'Cooking Oil', quantity: 2, unit: 'L', unitPrice: 160 },
            { name: 'Soap Bars', quantity: 4, unit: 'pcs', unitPrice: 35 },
          ],
          discount: 10,
        }),
      })
    ).json();
    assert(
      editPurchaseRes.success &&
      editPurchaseRes.purchase.totalAmount === 990 &&
      editPurchaseRes.customerSummary.outstandingBalance === 990,
      '10. Editing purchase automatically recalculates totals and synchronizes customer balance to 990'
    );

    // 11. Shop Owner records a customer payment of 400 via UPI
    const paymentRes = await (
      await fetch(`${BASE_URL}/payments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${ownerToken}`,
        },
        body: JSON.stringify({
          customerId: createdCustomerId,
          amount: 400,
          paymentMethod: 'upi',
          referenceNo: 'UPI/9876543210',
          notes: 'Google Pay transfer',
        }),
      })
    ).json();
    assert(
      paymentRes.success &&
      paymentRes.customerSummary.outstandingBalance === 590 &&
      paymentRes.customerSummary.totalPayments === 400,
      '11. Recording customer payment of 400 reduces outstanding balance from 990 to 590'
    );

    // 12. Shop Owner retrieves customer detailed ledger
    const ledgerRes = await (
      await fetch(`${BASE_URL}/customers/${createdCustomerId}/ledger`, {
        headers: { Authorization: `Bearer ${ownerToken}` },
      })
    ).json();
    assert(
      ledgerRes.success &&
      ledgerRes.ledger.length === 2 &&
      ledgerRes.summary.outstandingBalance === 590,
      '12. Customer Ledger lists chronological transactions with accurate running balance'
    );

    // 13. Customer Read-Only Overview Access
    const custOverview = await (
      await fetch(`${BASE_URL}/customer-expenses/overview`, {
        headers: { Authorization: `Bearer ${newCustToken}` },
      })
    ).json();
    assert(
      custOverview.success &&
      custOverview.stats.outstandingBalance === 590 &&
      custOverview.stats.totalSpentAllTime === 990 &&
      custOverview.stats.totalPaidAllTime === 400,
      '13. Customer reads own expense overview (Balance: 590, Spent: 990, Paid: 400)'
    );

    // 14. Customer Read-Only Itemized Purchases
    const custPurchases = await (
      await fetch(`${BASE_URL}/customer-expenses/purchases`, {
        headers: { Authorization: `Bearer ${newCustToken}` },
      })
    ).json();
    assert(
      custPurchases.success &&
      custPurchases.purchases.length === 1 &&
      custPurchases.purchases[0].items.length === 3,
      '14. Customer views detailed itemized grocery receipt breakdown'
    );

    // 15. Security & RBAC: Customer attempting to create/modify purchases MUST be blocked (403 Forbidden)
    const unauthorizedCreate = await (
      await fetch(`${BASE_URL}/purchases`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${newCustToken}`,
        },
        body: JSON.stringify({
          customerId: createdCustomerId,
          items: [{ name: 'Illegal item', quantity: 1, unit: 'pcs', unitPrice: 100 }],
        }),
      })
    ).json();
    assert(
      unauthorizedCreate.success === false,
      '15. Backend RBAC strictly blocks Customer from creating/editing purchases (403 Forbidden)'
    );

    // 16. Security & Role Policy: System Admin attempting to create Customer MUST be rejected
    const adminCustomerCreate = await (
      await fetch(`${BASE_URL}/system-admin/users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          name: 'Unauthorized Customer',
          email: `admincust_${Date.now()}@test.com`,
          role: 'customer',
        }),
      })
    ).json();
    assert(
      adminCustomerCreate.success === false && adminCustomerCreate.message.includes('System Admin cannot add customers'),
      '16. System Admin is strictly prevented from adding Customers (Only Shop Owners can register customers)'
    );

    // 17. Security & Route Protection: System Admin calling POST /api/customers directly is blocked
    const directCustPost = await (
      await fetch(`${BASE_URL}/customers`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          name: 'Direct Cust',
          email: `direct_${Date.now()}@test.com`,
        }),
      })
    ).json();
    assert(
      directCustPost.success === false,
      '17. Direct POST /api/customers is restricted to Shop Owners only (403 Forbidden for System Admin)'
    );

    // 18. High Balance (>= 2000) Payment Reminder with UPI link dispatch
    const highBalancePurchase = await (
      await fetch(`${BASE_URL}/purchases`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${ownerToken}`,
        },
        body: JSON.stringify({
          customerId: createdCustomerId,
          items: [
            { name: 'Refined Oil Tin (15L)', quantity: 1, unit: 'tin', unitPrice: 2200 },
          ],
        }),
      })
    ).json();
    assert(
      highBalancePurchase.success && highBalancePurchase.customerSummary.outstandingBalance >= 2000,
      '18. High balance purchase (>= ₹2,000) auto-triggers balance notification and direct UPI pay link'
    );

    // 19. Customer updates their own Profile & Phone Number
    const updateCustomerProfileRes = await (
      await fetch(`${BASE_URL}/auth/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${newCustToken}`,
        },
        body: JSON.stringify({
          name: 'Updated Customer Name',
          phone: '+91 98765 43210',
          address: 'No. 45 Green Street, Chennai',
        }),
      })
    ).json();
    assert(
      updateCustomerProfileRes.success &&
        updateCustomerProfileRes.user.phone === '+91 98765 43210' &&
        updateCustomerProfileRes.customerProfile.phone === '+91 98765 43210' &&
        updateCustomerProfileRes.customerProfile.address === 'No. 45 Green Street, Chennai',
      '19. Customer successfully updates their Name, Phone (+91 98765 43210), and Address in their Profile'
    );

    console.log('\n===============================================================');
    console.log(`🎉 TEST SUMMARY: ${passed} Passed, ${failed} Failed`);
    console.log('===============================================================\n');

    process.exit(failed > 0 ? 1 : 0);
  } catch (err) {
    console.error('Test execution error:', err);
    process.exit(1);
  }
};

runTests();
