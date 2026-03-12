const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const addressController = require('../controllers/address.controller');

router.use(protect);

router.get('/', addressController.getAll);
router.post('/', addressController.create);
router.put('/:id', addressController.update);
router.delete('/:id', addressController.remove);
router.put('/:id/default', addressController.setDefault);

module.exports = router;
