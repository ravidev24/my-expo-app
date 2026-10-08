const express = require('express');
const router = express.Router();
const {
  getPlatformStats,
  getShopOwners,
  createShopOwner,
  toggleShopOwnerStatus,
  getUsers,
  createUser,
} = require('../controllers/systemAdminController');
const { protect } = require('../middleware/auth');
const { authorize } = require('../middleware/role');

// All system admin routes require system_admin role
router.use(protect);
router.use(authorize('system_admin'));

router.get('/users', getUsers);
router.post('/users', createUser);
router.get('/stats', getPlatformStats);
router.get('/shop-owners', getShopOwners);
router.post('/shop-owners', createShopOwner);
router.patch('/shop-owners/:id/status', toggleShopOwnerStatus);

module.exports = router;
