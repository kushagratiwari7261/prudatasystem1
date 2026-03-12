const express = require('express');
const router = express.Router();
const { protect, restrictTo } = require('../middleware/auth');
const couponController = require('../controllers/coupon.controller');

router.post('/validate', protect, couponController.validate);

// Admin routes
router.get('/', protect, restrictTo('admin'), couponController.getAll);
router.post('/', protect, restrictTo('admin'), couponController.create);
router.put('/:id', protect, restrictTo('admin'), couponController.update);
router.delete('/:id', protect, restrictTo('admin'), couponController.remove);

module.exports = router;
