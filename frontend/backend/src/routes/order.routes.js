const express = require('express');
const router = express.Router();
const { protect, restrictTo } = require('../middleware/auth');
const orderController = require('../controllers/order.controller');

router.get('/', protect, orderController.getMyOrders);
router.get('/admin/all', protect, restrictTo('admin'), orderController.getAllOrders);
router.get('/:id', protect, orderController.getOrderById);
router.post('/:id/cancel', protect, orderController.cancelOrder);
router.put('/:id/status', protect, restrictTo('admin'), orderController.updateOrderStatus);
router.delete('/:id', protect, restrictTo('admin'), orderController.deleteOrder); // Add this line

module.exports = router;