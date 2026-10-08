const express = require('express');
const router = express.Router();
const {
  createPurchase,
  getPurchases,
  getPurchaseById,
  updatePurchase,
  deletePurchase,
} = require('../controllers/purchaseController');
const { protect } = require('../middleware/auth');
const { authorize } = require('../middleware/role');

router.use(protect);

// Read single purchase (accessible to shop_owner, system_admin, and the customer who made it)
router.get('/:id', getPurchaseById);

// Creation, listing, editing and deleting restricted to shop_owner and system_admin
router.route('/')
  .post(authorize('shop_owner', 'system_admin'), createPurchase)
  .get(authorize('shop_owner', 'system_admin'), getPurchases);

router.route('/:id')
  .put(authorize('shop_owner', 'system_admin'), updatePurchase)
  .delete(authorize('shop_owner', 'system_admin'), deletePurchase);

module.exports = router;
