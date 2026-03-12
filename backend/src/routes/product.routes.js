const express = require('express');
const router = express.Router();
const multer = require('multer');
const AppError = require('../utils/AppError');
const productController = require('../controllers/product.controller');
const { protect, restrictTo } = require('../middleware/auth');

const path = require('path');
const fs = require('fs');

const uploadDir = path.join(__dirname, '../../uploads/products');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        cb(null, `product-${uniqueSuffix}${ext}`);
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB per file
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) cb(null, true);
        else cb(new AppError('Only image files allowed', 400));
    }
});

router.get('/', productController.getAll);
router.get('/:slug', productController.getBySlug);
router.get('/:id/related', productController.getRelated);

router.use(protect);
router.use(restrictTo('admin'));

router.post('/', productController.create);
router.put('/:id', productController.update);
router.delete('/:id', productController.remove);
router.post('/:id/images', upload.array('images', 10), productController.uploadImages);

module.exports = router;
