const express = require('express');
const router = express.Router();
const reviewController = require('../controllers/review.controller');
const { protect, restrictTo } = require('../middleware/auth');

// Public routes
router.get('/product/:productId', reviewController.getProductReviews);

// Protected routes (Logged in users)
router.post('/', protect, reviewController.addReview);

// Admin routes
router.get('/admin/product/:productId', protect, restrictTo('admin'), reviewController.getAdminReviews);
router.delete('/:id', protect, restrictTo('admin'), reviewController.deleteReview);

module.exports = router;
