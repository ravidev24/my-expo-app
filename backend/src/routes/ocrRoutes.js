const express = require('express');
const router = express.Router();
const { parseBill } = require('../controllers/ocrController');
const { protect } = require('../middleware/auth');
const { authorize } = require('../middleware/role');

router.use(protect);
router.use(authorize('shop_owner', 'system_admin'));

router.post('/parse-bill', parseBill);

module.exports = router;
