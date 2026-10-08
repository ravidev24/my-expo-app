const express = require('express');
const router = express.Router();
const {
  getTodayGalla,
  setOpeningCash,
  addQuickCashSale,
  addDrawerExpense,
  closeDailyGalla,
  getGallaHistory,
} = require('../controllers/gallaController');
const { protect } = require('../middleware/auth');
const { authorize } = require('../middleware/role');

router.use(protect);
router.use(authorize('shop_owner', 'system_admin'));

router.get('/today', getTodayGalla);
router.post('/opening-cash', setOpeningCash);
router.post('/quick-sale', addQuickCashSale);
router.post('/expense', addDrawerExpense);
router.post('/close', closeDailyGalla);
router.get('/history', getGallaHistory);

module.exports = router;
