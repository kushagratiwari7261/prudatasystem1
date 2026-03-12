const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { protect, restrictTo } = require('../middleware/auth');
const { sendSuccess } = require('../utils/response');
const AppError = require('../utils/AppError');

// Ensure upload directory exists
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
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB limit (increased from 5MB)
    },
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new AppError('Only image files are allowed', 400));
        }
    }
});

// POST /api/v1/upload — Upload product images (admin only)
router.post(
    '/',
    protect,
    restrictTo('admin'),
    (req, res, next) => {
        // Use multer with error handling
        const uploadMiddleware = upload.array('images', 10); // Max 10 files at once

        uploadMiddleware(req, res, function (err) {
            // Handle Multer-specific errors
            if (err instanceof multer.MulterError) {
                if (err.code === 'LIMIT_FILE_SIZE') {
                    return next(new AppError('File too large. Maximum size is 10MB per file.', 400));
                }
                if (err.code === 'LIMIT_FILE_COUNT') {
                    return next(new AppError('Too many files. Maximum is 10 files at once.', 400));
                }
                if (err.code === 'LIMIT_UNEXPECTED_FILE') {
                    return next(new AppError('Unexpected field name. Use "images" as field name.', 400));
                }
                return next(new AppError(`Upload error: ${err.message}`, 400));
            }
            // Handle other errors (like from fileFilter)
            else if (err) {
                return next(err);
            }

            // No error, continue with processing
            try {
                // Check if files were uploaded
                if (!req.files || req.files.length === 0) {
                    return next(new AppError('No images provided', 400));
                }

                // Map files to response format
                const images = req.files.map(file => ({
                    url: `/uploads/products/${file.filename}`,
                    filename: file.filename,
                    originalName: file.originalname,
                    size: file.size,
                    mimetype: file.mimetype
                }));

                // Send success response
                sendSuccess(
                    res,
                    {
                        images,
                        count: images.length,
                        totalSize: req.files.reduce((acc, file) => acc + file.size, 0)
                    },
                    `${images.length} image(s) uploaded successfully`
                );
            } catch (error) {
                next(error);
            }
        });
    }
);

// Optional: Single file upload endpoint (if needed)
router.post(
    '/single',
    protect,
    restrictTo('admin'),
    (req, res, next) => {
        const uploadSingle = upload.single('image');

        uploadSingle(req, res, function (err) {
            if (err instanceof multer.MulterError) {
                if (err.code === 'LIMIT_FILE_SIZE') {
                    return next(new AppError('File too large. Maximum size is 10MB.', 400));
                }
                return next(new AppError(`Upload error: ${err.message}`, 400));
            } else if (err) {
                return next(err);
            }

            try {
                if (!req.file) {
                    return next(new AppError('No image provided', 400));
                }

                const image = {
                    url: `/uploads/products/${req.file.filename}`,
                    filename: req.file.filename,
                    originalName: req.file.originalname,
                    size: req.file.size,
                    mimetype: req.file.mimetype
                };

                sendSuccess(res, { image }, 'Image uploaded successfully');
            } catch (error) {
                next(error);
            }
        });
    }
);

// DELETE /api/v1/upload/:filename — Delete an uploaded image (admin only)
router.delete(
    '/:filename',
    protect,
    restrictTo('admin'),
    (req, res, next) => {
        try {
            const filename = req.params.filename;
            const filepath = path.join(uploadDir, filename);

            // Check if file exists
            if (!fs.existsSync(filepath)) {
                return next(new AppError('File not found', 404));
            }

            // Delete the file
            fs.unlinkSync(filepath);

            sendSuccess(res, null, 'Image deleted successfully');
        } catch (error) {
            next(error);
        }
    }
);

module.exports = router;