import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';

const API = 'http://localhost:5000/api/v1';

const localProductImages = [
    '/images/products/tshirt_black.png',
    '/images/products/dress_pink.png',
    '/images/products/jeans_dark.png',
    '/images/products/hoodie_navy.png',
    '/images/products/kurta_saffron.png',
    '/images/products/sneakers_white.png',
    '/images/products/jacket_olive.png',
];

const ProductCard = ({ product, onAdd, isAdding, isWishlistedInitial = false }) => {
    const navigate = useNavigate();
    const [adding, setAdding] = useState(false);
    const [isWishlisted, setIsWishlisted] = useState(isWishlistedInitial);
    const [togglingWishlist, setTogglingWishlist] = useState(false);

    const images = product.images || [];
    const fallbackIdx = Math.abs((product.id || '').toString().split('').reduce((a, c) => a + c.charCodeAt(0), 0)) % localProductImages.length;
    let imgUrl = localProductImages[fallbackIdx];

    if (product.fallbackImg) {
        imgUrl = product.fallbackImg;
    } else if (images.length > 0) {
        const img = images[0];
        if (typeof img === 'string') {
            imgUrl = img.startsWith('/uploads') ? `http://localhost:5000${img}` : (img.startsWith('http') ? img : img);
        } else if (img?.url) {
            imgUrl = img.url.startsWith('/') ? `http://localhost:5000${img.url}` : img.url;
        }
    }

    const price = product.discount_price || product.variants?.[0]?.price || product.price || product.base_price || 999;
    const mrp = product.base_price || product.variants?.[0]?.mrp || product.mrp || Math.round(price * 1.5);
    const discount = mrp > price ? Math.round(((mrp - price) / mrp) * 100) : 0;
    const rating = product.rating_avg || product.rating || (3.5 + Math.random() * 1.5).toFixed(1);
    const productName = product.title || product.name || 'Product';

    const handleAddToCart = async (e) => {
        e.stopPropagation();
        setAdding(true);
        if (!product.variants || product.variants.length === 0) {
            toast.info('Please select size and color on product page');
            navigate(`/products/${product.slug || product.id}`);
            setAdding(false);
            return;
        }
        await onAdd(product);
        setAdding(false);
    };

    const handleToggleWishlist = async (e) => {
        e.stopPropagation();
        const token = localStorage.getItem('accessToken');
        if (!token) {
            toast.info('Please login to add items to wishlist');
            navigate('/login');
            return;
        }

        setTogglingWishlist(true);
        try {
            const res = await fetch(`${API}/wishlist`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ product_id: product.id })
            });
            const data = await res.json();
            if (data.success) {
                setIsWishlisted(data.data.action === 'added');
                toast.success(data.message);
            } else {
                toast.error(data.message || 'Failed to update wishlist');
            }
        } catch (error) {
            console.error('Wishlist toggle error:', error);
            toast.error('Failed to update wishlist');
        } finally {
            setTogglingWishlist(false);
        }
    };

    const handleCardClick = () => {
        navigate(`/products/${product.slug || product.id}`);
    };

    return (
        <div className="product-card" onClick={handleCardClick}>
            <div className="product-card-image">
                <img src={imgUrl} alt={productName} loading="lazy" />
                <div className="product-card-rating">
                    <svg viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" /></svg>
                    {rating}
                </div>
            </div>

            <button
                className={`product-card-wishlist ${isWishlisted ? 'active' : ''}`}
                onClick={handleToggleWishlist}
                disabled={togglingWishlist}
            >
                <svg width="16" height="16" viewBox="0 0 24 24" fill={isWishlisted ? '#ff3f6c' : 'none'} stroke={isWishlisted ? '#ff3f6c' : 'currentColor'} strokeWidth="2">
                    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                </svg>
            </button>

            <div className="product-card-info">
                <div className="product-card-brand">{product.brand_name || product.brand?.name || product.brand || 'ZENWAIR'}</div>
                <div className="product-card-name">{productName}</div>
                <div className="product-card-price">
                    <span className="price-current">₹{price}</span>
                    {discount > 0 && (
                        <>
                            <span className="price-original">₹{mrp}</span>
                            <span className="price-off">({discount}% OFF)</span>
                        </>
                    )}
                </div>
            </div>

            <div className="product-card-overlay">
                <button
                    className="product-card-add-btn"
                    onClick={handleAddToCart}
                    disabled={adding || isAdding}
                >
                    {adding ? 'Adding...' : 'Add to Bag'}
                </button>
            </div>
        </div>
    );
};

export default ProductCard;
