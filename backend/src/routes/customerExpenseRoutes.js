const express = require('express');
const router = express.Router();
const {
  getMyExpenseOverview,
  getMyPurchases,
  getMyPayments,
} = require('../controllers/customerExpenseController');
const { protect } = require('../middleware/auth');
const { authorize } = require('../middleware/role');

// All routes are strictly customer only (read-only)
router.use(protect);
router.use(authorize('customer'));

router.get('/overview', getMyExpenseOverview);
router.get('/purchases', getMyPurchases);
router.get('/payments', getMyPayments);

module.exports = router;
