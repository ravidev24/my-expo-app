const express = require('express');
const router = express.Router();
const {
  login,
  getMe,
  updateProfile,
  setupPassword,
  googleAuth,
  logout,
  changePassword,
  registerPushToken,
  removePushToken,
} = require('../controllers/authController');
const { protect } = require('../middleware/auth');

router.post('/login', login);
router.post('/setup-password', setupPassword);
router.post('/google', googleAuth);
router.get('/me', protect, getMe);
router.put('/profile', protect, updateProfile);
router.post('/logout', protect, logout);
router.post('/change-password', protect, changePassword);
router.post('/push-token', protect, registerPushToken);
router.delete('/push-token', protect, removePushToken);

module.exports = router;
