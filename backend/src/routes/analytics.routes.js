const express = require('express');
const router = express.Router();
const analyticsController = require('../controllers/analytics.controller');
const { protect, adminOnly } = require('../middleware/auth');

router.use(protect);
router.use(adminOnly);

router.get('/sales-trend', analyticsController.getSalesTrend);
router.get('/top-products', analyticsController.getTopProducts);

module.exports = router;
