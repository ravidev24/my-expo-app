const express = require('express');
const router = express.Router();
const {
  createCustomer,
  getCustomers,
  getCustomerById,
  getCustomerLedger,
  updateCustomer,
  resendPasswordSetupLink,
  sendPaymentReminder,
  checkShopAutoReminders,
} = require('../controllers/customerController');
const { protect } = require('../middleware/auth');
const { authorize } = require('../middleware/role');

// Base protection
router.use(protect);

router.post('/check-auto-reminders', authorize('shop_owner'), checkShopAutoReminders);

router.route('/')
  .post(authorize('shop_owner'), createCustomer)
  .get(authorize('shop_owner', 'system_admin'), getCustomers);

router.route('/:id')
  .get(getCustomerById)
  .put(updateCustomer);

router.get('/:id/ledger', getCustomerLedger);
router.post('/:id/resend-setup', resendPasswordSetupLink);
router.post('/:id/send-reminder', sendPaymentReminder);

module.exports = router;
