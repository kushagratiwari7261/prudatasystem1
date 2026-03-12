const express = require('express');
const router = express.Router();
const inventoryController = require('../controllers/inventory.controller');
const { protect, restrictTo } = require('../middleware/auth');

router.use(protect);
router.use(restrictTo('admin'));

router.get('/low-stock', inventoryController.getLowStock);
router.get('/product/:productId', inventoryController.getProductInventory);
router.post('/product/:productId/variant', inventoryController.createVariantWithInventory);
router.put('/variant/:variantId', inventoryController.adjustStock);

module.exports = router;
