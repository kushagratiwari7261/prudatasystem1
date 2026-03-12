const cloudinary = require('cloudinary').v2;

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

const uploadImage = async (filePath, folder = 'zenwair/products') => {
    const result = await cloudinary.uploader.upload(filePath, { folder });
    return {
        url: result.secure_url,
        public_id: result.public_id
    };
};

const uploadBuffer = (buffer, folder = 'zenwair/products') => {
    return new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
            { folder },
            (error, result) => {
                if (error) return reject(error);
                resolve({
                    url: result.secure_url,
                    public_id: result.public_id
                });
            }
        );
        stream.end(buffer);
    });
};

const deleteImage = async (publicId) => {
    const result = await cloudinary.uploader.destroy(publicId);
    return result;
};

const getOptimizedUrl = (publicId, options = {}) => {
    return cloudinary.url(publicId, {
        quality: 'auto',
        fetch_format: 'auto',
        ...options
    });
};

module.exports = {
    uploadImage,
    uploadBuffer,
    deleteImage,
    getOptimizedUrl
};
