const express = require('express');
const router = express.Router();
const wishlistController = require('../controllers/wishlist.controller');
const { protect } = require('../middleware/auth');

router.use(protect);

router.post('/', wishlistController.toggleWishlist);
router.get('/', wishlistController.getWishlist);

module.exports = router;
