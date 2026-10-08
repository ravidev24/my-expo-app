const express = require('express');
const router = express.Router();
const {
  recordPayment,
  getPayments,
  deletePayment,
} = require('../controllers/paymentController');
const { protect } = require('../middleware/auth');
const { authorize } = require('../middleware/role');

router.use(protect);
router.use(authorize('shop_owner', 'system_admin'));

router.route('/')
  .post(recordPayment)
  .get(getPayments);

router.route('/:id')
  .delete(deletePayment);

module.exports = router;
