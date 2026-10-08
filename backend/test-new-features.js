const BASE_URL = 'http://localhost:5000/api';

const runNewFeatureTests = async () => {
  console.log('===============================================================');
  console.log('🧪 Testing New Features: Galla, Regulars, OCR, PTP, Risk Badges');
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
    // 1. Login as Shop Owner
    const ownerLogin = await (
      await fetch(`${BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'owner@freshmart.com', password: 'Owner@123' }),
      })
    ).json();
    assert(ownerLogin.success, '1. Shop Owner logs in');
    const token = ownerLogin.token;

    // 2. Test Daily Galla - Get Today
    const gallaRes = await (
      await fetch(`${BASE_URL}/galla/today`, {
        headers: { Authorization: `Bearer ${token}` },
      })
    ).json();
    assert(gallaRes.success && gallaRes.summary, '2. Fetch today Galla record & live cash summary');

    // 3. Set Opening Cash to 1000
    const openRes = await (
      await fetch(`${BASE_URL}/galla/opening-cash`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ amount: 1000 }),
      })
    ).json();
    assert(openRes.success && openRes.summary.openingCash === 1000, '3. Set Opening Cash to ₹1000');

    // 4. Record Voice / Keypad Quick Cash Sale of 56
    const saleRes = await (
      await fetch(`${BASE_URL}/galla/quick-sale`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ amount: 56, note: '56 note cash sale', source: 'voice' }),
      })
    ).json();
    assert(saleRes.success && saleRes.summary.quickCashTotal >= 56, '4. Quick cash sale of ₹56 recorded (Voice-to-Cash)');

    // 5. Record Drawer Expense of 20 for Tea
    const expRes = await (
      await fetch(`${BASE_URL}/galla/expense`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ amount: 20, category: 'Tea/Snacks', note: 'Evening tea' }),
      })
    ).json();
    assert(expRes.success && expRes.summary.totalExpenses >= 20, '5. Drawer cash expense of ₹20 recorded');

    // 6. Test AI OCR Receipt / Slip Parser
    const ocrRes = await (
      await fetch(`${BASE_URL}/ocr/parse-bill`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          rawText: `
Basmati Rice 5kg 90
Cooking Oil 2L 150 = 300
Soap 3pcs 35
          `,
        }),
      })
    ).json();
    assert(ocrRes.success && ocrRes.items.length === 3, '6. OCR & text slip parser extracts 3 items accurately');

    // 7. Test Regular Subscriptions (Parcha / Morning Milk & Water)
    const custsRes = await (
      await fetch(`${BASE_URL}/customers?limit=1`, {
        headers: { Authorization: `Bearer ${token}` },
      })
    ).json();
    const custId = custsRes.customers[0]._id;

    const addRegRes = await (
      await fetch(`${BASE_URL}/regulars/item`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          customerId: custId,
          itemName: 'Full Cream Milk',
          quantity: 1,
          unit: 'pkt',
          unitPrice: 32,
        }),
      })
    ).json();
    assert(addRegRes.success && addRegRes.items.length >= 1, '7. Add recurring daily milk subscription for customer');

    // 8. Test Galla Close & Discrepancy Reconciliation
    const expected = expRes.summary.expectedCash;
    const closeRes = await (
      await fetch(`${BASE_URL}/galla/close`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ closingCashCounted: expected, notes: 'End of day cash matched' }),
      })
    ).json();
    assert(closeRes.success && closeRes.summary.difference === 0, '8. Close Galla with exact cash match (₹0 difference)');

    console.log('\n===============================================================');
    console.log(`🎉 NEW FEATURE TEST SUMMARY: ${passed} Passed, ${failed} Failed`);
    console.log('===============================================================\n');
    process.exit(failed > 0 ? 1 : 0);
  } catch (err) {
    console.error('Error in new feature tests:', err);
    process.exit(1);
  }
};

runNewFeatureTests();
