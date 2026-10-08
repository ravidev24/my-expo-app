const express = require('express');
const { protect } = require('../middleware/auth');
const { statementPdf, gallaPdf } = require('../controllers/reportController');

const router = express.Router();

router.post('/statement', protect, statementPdf);
router.post('/galla', protect, gallaPdf);

module.exports = router;
