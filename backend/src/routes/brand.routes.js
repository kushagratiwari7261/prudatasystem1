const express = require('express');
const router = express.Router();
const brandController = require('../controllers/brand.controller');
const { protect, restrictTo } = require('../middleware/auth');

router.get('/', brandController.getAll);
router.get('/:slug', brandController.getOne);

router.use(protect);
router.use(restrictTo('admin'));

router.post('/', brandController.create);
router.put('/:id', brandController.update);
router.delete('/:id', brandController.remove);

module.exports = router;
