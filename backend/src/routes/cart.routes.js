const express = require('express');
const router = express.Router();
const { protect, optionalAuth } = require('../middleware/auth');

// Force clear cache and get fresh controller
delete require.cache[require.resolve('../controllers/cart.controller')];
const cartController = require('../controllers/cart.controller');

// Debug - log available functions
console.log('🛒 Cart Controller Functions:', Object.keys(cartController));

// Combined routes that work for both guest and authenticated users
router.get('/', optionalAuth, cartController.getCart);
router.post('/add', optionalAuth, cartController.addItem);
router.put('/update', optionalAuth, cartController.updateItem);
router.delete('/item/:variantId', optionalAuth, cartController.removeItem);
router.post('/coupon', optionalAuth, cartController.applyCoupon);
router.delete('/coupon', optionalAuth, cartController.removeCoupon);
router.delete('/clear', optionalAuth, cartController.clearCart);
router.post('/merge', protect, cartController.mergeCart);

module.exports = router;