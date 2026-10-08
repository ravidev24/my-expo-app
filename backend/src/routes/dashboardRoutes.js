const express = require('express');
const router = express.Router();
const { getShopDashboard, updateShopSettings } = require('../controllers/dashboardController');
const { protect } = require('../middleware/auth');
const { authorize } = require('../middleware/role');

router.use(protect);
router.use(authorize('shop_owner', 'system_admin'));

router.get('/', getShopDashboard);
router.put('/shop', updateShopSettings);

module.exports = router;
