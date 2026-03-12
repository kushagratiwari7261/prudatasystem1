const express = require('express');
const router = express.Router();
const { protect, restrictTo } = require('../middleware/auth');
const paymentController = require('../controllers/payment.controller');

router.post('/create-order', protect, paymentController.createOrder);
router.post('/verify', protect, paymentController.verifyPayment);
router.post('/cancel', protect, paymentController.cancelPayment);
router.post('/refund', protect, restrictTo('admin'), paymentController.refund);

module.exports = router;
