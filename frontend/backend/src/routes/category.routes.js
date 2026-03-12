const express = require('express');
const router = express.Router();
const categoryController = require('../controllers/category.controller');
const { protect, restrictTo } = require('../middleware/auth');

router.get('/', categoryController.getAll);
router.get('/:slug', categoryController.getOne);

router.use(protect);
router.use(restrictTo('admin'));

router.post('/', categoryController.create);
router.put('/:id', categoryController.update);
router.delete('/:id', categoryController.remove);

module.exports = router;
