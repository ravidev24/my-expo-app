const express = require('express');
const router = express.Router();
const {
  getRegulars,
  addOrUpdateRegularItem,
  removeRegularItem,
  batchRecordRegulars,
} = require('../controllers/regularController');
const { protect } = require('../middleware/auth');
const { authorize } = require('../middleware/role');

router.use(protect);
router.use(authorize('shop_owner', 'system_admin'));

router.get('/', getRegulars);
router.post('/item', addOrUpdateRegularItem);
router.delete('/item/:id', removeRegularItem);
router.post('/batch-record', batchRecordRegulars);

module.exports = router;
