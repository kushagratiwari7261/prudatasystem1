import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import API from '../services/api';
import './ProductDetail.css';

const ProductDetail = () => {
    const { slug } = useParams();
    const navigate = useNavigate();
    const [product, setProduct] = useState(null);
    const [selectedVariant, setSelectedVariant] = useState(null);
    const [selectedSize, setSelectedSize] = useState('');
    const [selectedColor, setSelectedColor] = useState('');
    const [quantity, setQuantity] = useState(1);
    const [loading, setLoading] = useState(true);
    const [addingToCart, setAddingToCart] = useState(false);
    const [activeImage, setActiveImage] = useState(0);
    const [imageErrors, setImageErrors] = useState({});
    
    // Reviews State
    const [reviews, setReviews] = useState([]);
    const [reviewsLoading, setReviewsLoading] = useState(false);
    const [reviewStats, setReviewStats] = useState({ avg: 0, count: 0 });
    const [reviewModalOpen, setReviewModalOpen] = useState(false);
    const [reviewData, setReviewData] = useState({ rating: 5, comment: '' });
    const [submittingReview, setSubmittingReview] = useState(false);

    // Get the base URL for images from environment or default to backend
    const IMAGE_BASE_URL = process.env.REACT_APP_API_URL
        ? process.env.REACT_APP_API_URL.replace('/api/v1', '')
        : 'http://localhost:5000';

    useEffect(() => {
        fetchProduct();
    }, [slug]);

    const fetchProduct = async () => {
        try {
            setLoading(true);
            const response = await API.get(`/products/${slug}`);
            if (response.data.success) {
                const productData = response.data.data.product;

                // Process images to ensure they have full URLs
                if (productData.images) {
                    productData.images = productData.images.map(img => {
                        // If it's already a full URL, use it as is
                        if (img.startsWith('http')) {
                            return img;
                        }
                        // If it's a relative path starting with /uploads, prepend backend URL
                        if (img.startsWith('/uploads')) {
                            return `${IMAGE_BASE_URL}${img}`;
                        }
                        // Otherwise, assume it's a filename and construct path
                        return `${IMAGE_BASE_URL}/uploads/products/${img}`;
                    });
                }

                setProduct(productData);

                // Set default selections if variants exist
                if (productData.variants?.length > 0) {
                    const variants = productData.variants;
                    // Group by size and color for selection
                    const sizes = [...new Set(variants.map(v => v.size).filter(Boolean))];
                    const colors = [...new Set(variants.map(v => v.color).filter(Boolean))];

                    if (sizes.length > 0) setSelectedSize(sizes[0]);
                    if (colors.length > 0) setSelectedColor(colors[0]);
                }

                setReviewStats({ 
                    avg: productData.rating_avg || 0, 
                    count: productData.rating_count || 0 
                });

                fetchReviews(productData.id);
            }
        } catch (error) {
            console.error('Error fetching product:', error);
            toast.error('Failed to load product');
        } finally {
            setLoading(false);
        }
    };

    const fetchReviews = async (productId) => {
        try {
            setReviewsLoading(true);
            const response = await API.get(`/reviews/product/${productId}`);
            if (response.data.success) {
                setReviews(response.data.data || []);
            }
        } catch (error) {
            console.error('Error fetching reviews:', error);
        } finally {
            setReviewsLoading(false);
        }
    };

    const handleSubmitReview = async (e) => {
        e.preventDefault();
        const token = localStorage.getItem('accessToken');
        if (!token) {
            alert('Please login to leave a review.');
            return;
        }
        if (!reviewData.rating) return alert('Please provide a star rating.');
        
        setSubmittingReview(true);
        try {
            const response = await API.post('/reviews', {
                product_id: product.id,
                rating: reviewData.rating,
                comment: reviewData.comment
            });
            if (response.data.success) {
                toast.success('Thank you for your review!');
                setReviewModalOpen(false);
                fetchReviews(product.id);
            }
        } catch (error) {
            const errorMsg = error.response?.data?.message || 'Failed to submit review. (Note: You must have purchased and received this item)';
            toast.error(errorMsg);
            console.error(error);
        } finally {
            setSubmittingReview(false);
        }
    };

    const calculateStarDistribution = () => {
        const dist = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
        reviews.forEach(r => {
            if (dist[r.rating] !== undefined) dist[r.rating]++;
        });
        return dist;
    };
    const starDist = calculateStarDistribution();

    // Update selected variant when size/color changes
    useEffect(() => {
        if (product?.variants) {
            const variant = product.variants.find(v =>
                (selectedSize ? v.size === selectedSize : true) &&
                (selectedColor ? v.color === selectedColor : true)
            );
            setSelectedVariant(variant || null);
        }
    }, [selectedSize, selectedColor, product]);

    const handleAddToCart = async () => {
        try {
            // Validation checks
            if (!product) {
                toast.error('Product not found');
                return;
            }

            // For products with variants, we need a variant_id
            if (product.variants?.length > 0) {
                if (!selectedVariant) {
                    toast.warning('Please select a size and color');
                    return;
                }
                if (selectedVariant.available === 0) {
                    toast.warning('Selected variant is out of stock');
                    return;
                }
                if (quantity > selectedVariant.available) {
                    toast.warning(`Only ${selectedVariant.available} items available`);
                    return;
                }
            } else {
                // For products without variants, we need to use the product itself as variant
                // Some backends require variant_id even for simple products
                toast.warning('This product cannot be added to cart - no variants available');
                return;
            }

            setAddingToCart(true);
            console.log('Adding to cart - Product:', product.title);
            console.log('Selected Variant:', selectedVariant);

            const token = localStorage.getItem('accessToken');
            console.log('User is authenticated:', !!token);

            // Prepare cart data - backend specifically requires variant_id
            const cartData = {
                variant_id: selectedVariant.id,
                quantity: quantity
            };

            // Add session_id for guest users
            if (!token) {
                let sessionId = localStorage.getItem('guestSessionId');
                if (!sessionId) {
                    sessionId = 'guest_' + Math.random().toString(36).substr(2, 9);
                    localStorage.setItem('guestSessionId', sessionId);
                    console.log('New guest session created:', sessionId);
                }
                cartData.session_id = sessionId;
            }

            console.log('Sending cart data:', cartData);

            // Set headers
            const config = {
                headers: {
                    'Content-Type': 'application/json'
                }
            };

            if (token) {
                config.headers['Authorization'] = `Bearer ${token}`;
            }

            // Make API call to add to cart
            const response = await API.post('/cart/add', cartData, config);

            console.log('Cart API response:', response.data);

            if (response.data.success) {
                // Reset quantity to 1 after successful add
                setQuantity(1);

                // Get cart count from response
                const cartCount = response.data.data?.cart_count ||
                    response.data.data?.item_count ||
                    response.data.data?.total_items || 0;

                // Update cart count in navbar
                const cartCountEvent = new CustomEvent('cartUpdated', {
                    detail: { count: cartCount }
                });
                window.dispatchEvent(cartCountEvent);

                // Fetch updated cart data in background
                setTimeout(async () => {
                    try {
                        await API.get('/cart');
                    } catch (e) {
                        console.log('Background cart fetch failed:', e);
                    }
                }, 500);
            } else {
                toast.error(response.data.message || 'Failed to add to cart');
            }

        } catch (error) {
            console.error('Add to cart failed - Full error:', error);

            // Handle different error scenarios
            if (error.response) {
                console.error('Error response data:', error.response.data);
                console.error('Error response status:', error.response.status);

                if (error.response.status === 401) {
                    toast.error('Please login to add items to cart');
                    navigate('/login', { state: { from: `/product/${slug}` } });
                } else if (error.response.status === 400) {
                    const errorMsg = error.response.data?.message ||
                        error.response.data?.error ||
                        'Invalid request';
                    toast.error(errorMsg);

                    // If the error is about missing variant_id, show specific message
                    if (errorMsg.toLowerCase().includes('variant')) {
                        toast.error('Product configuration error. Please try a different product.');
                    }
                } else if (error.response.status === 404) {
                    toast.error('Cart service unavailable');
                } else {
                    toast.error(error.response.data?.message || 'Failed to add to cart');
                }
            } else if (error.request) {
                console.error('No response received:', error.request);
                toast.error('Cannot connect to server. Please try again.');
            } else {
                console.error('Error setting up request:', error.message);
                toast.error('An error occurred. Please try again.');
            }
        } finally {
            setAddingToCart(false);
        }
    };

    const handleBuyNow = async () => {
        await handleAddToCart();
        // Navigate to checkout if add to cart was successful
        setTimeout(() => {
            navigate('/checkout');
        }, 500);
    };

    const handleQuantityChange = (type) => {
        const maxStock = selectedVariant?.available || product?.stock_quantity || 10;

        if (type === 'increase') {
            if (quantity < maxStock) {
                setQuantity(prev => prev + 1);
            }
        } else {
            if (quantity > 1) {
                setQuantity(prev => prev - 1);
            }
        }
    };

    const handleImageError = (index) => {
        setImageErrors(prev => ({ ...prev, [index]: true }));
        console.error(`Image failed to load: ${product?.images?.[index]}`);
    };

    if (loading) {
        return <div className="loading-spinner">Loading...</div>;
    }

    if (!product) {
        return <div className="not-found">Product not found</div>;
    }

    // Get unique sizes and colors from variants
    const sizes = product.variants
        ? [...new Set(product.variants.map(v => v.size).filter(Boolean))]
        : [];
    const colors = product.variants
        ? [...new Set(product.variants.map(v => v.color).filter(Boolean))]
        : [];

    // Determine max quantity based on stock
    const maxQuantity = selectedVariant?.available || product?.stock_quantity || 10;

    // Check if product has variants
    const hasVariants = product.variants && product.variants.length > 0;

    return (
        <div className="product-detail-container">
            <div className="product-images">
                <div className="main-image">
                    <img
                        src={!imageErrors[activeImage] && product.images?.[activeImage]
                            ? product.images[activeImage]
                            : '/placeholder-image.png'}
                        alt={product.title}
                        onError={() => handleImageError(activeImage)}
                    />
                </div>
                {product.images?.length > 1 && (
                    <div className="thumbnail-images">
                        {product.images.map((img, index) => (
                            <img
                                key={index}
                                src={!imageErrors[index] ? img : '/placeholder-image.png'}
                                alt={`${product.title} ${index + 1}`}
                                className={activeImage === index ? 'active' : ''}
                                onClick={() => setActiveImage(index)}
                                onError={() => handleImageError(index)}
                            />
                        ))}
                    </div>
                )}
            </div>

            <div className="product-info">
                <h1>{product.title}</h1>

                {product.brand_name && (
                    <p className="brand">Brand: {product.brand_name}</p>
                )}

                <div className="price-section">
                    {product.discount_price ? (
                        <>
                            <span className="discount-price">₹{product.discount_price}</span>
                            <span className="original-price">₹{product.base_price}</span>
                            <span className="discount-percent">
                                {Math.round(((product.base_price - product.discount_price) / product.base_price) * 100)}% OFF
                            </span>
                        </>
                    ) : (
                        <span className="price">₹{product.base_price}</span>
                    )}
                </div>

                {reviewStats.count > 0 && (
                    <div className="rating" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                        <div style={{ 
                            background: '#03a685', color: 'white', padding: '2px 8px', 
                            borderRadius: '4px', fontSize: '14px', fontWeight: 700,
                            display: 'flex', alignItems: 'center', gap: '4px'
                        }}>
                            {reviewStats.avg} ★
                        </div>
                        <span style={{ fontSize: '14px', color: '#535766' }}>
                            ({reviewStats.count} Verified Buyer{reviewStats.count > 1 ? 's' : ''})
                        </span>
                    </div>
                )}

                {/* Stock Status */}
                <div className="stock-status">
                    {hasVariants ? (
                        selectedVariant ? (
                            selectedVariant.available > 0 ? (
                                <span className="in-stock">✓ In Stock</span>
                            ) : (
                                <span className="out-of-stock">✗ Out of Stock</span>
                            )
                        ) : (
                            <span className="select-variant">Please select options</span>
                        )
                    ) : (
                        <span className="out-of-stock">✗ Not available for purchase</span>
                    )}
                </div>

                {/* Size Selection */}
                {sizes.length > 0 && (
                    <div className="size-selection">
                        <h3>Select Size</h3>
                        <div className="size-options">
                            {sizes.map(size => (
                                <button
                                    key={size}
                                    className={`size-btn ${selectedSize === size ? 'active' : ''}`}
                                    onClick={() => setSelectedSize(size)}
                                    disabled={!product.variants.some(v =>
                                        v.size === size && v.available > 0
                                    )}
                                >
                                    {size}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* Color Selection */}
                {colors.length > 0 && (
                    <div className="color-selection">
                        <h3>Select Color</h3>
                        <div className="color-options">
                            {colors.map(color => (
                                <button
                                    key={color}
                                    className={`color-btn ${selectedColor === color ? 'active' : ''}`}
                                    onClick={() => setSelectedColor(color)}
                                    style={{ backgroundColor: color.toLowerCase() }}
                                >
                                    {color}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* Quantity Selector - Only show if variant selected or product has variants */}
                {hasVariants && selectedVariant && (
                    <div className="quantity-selector">
                        <h3>Quantity</h3>
                        <div className="quantity-controls">
                            <button
                                onClick={() => handleQuantityChange('decrease')}
                                disabled={quantity <= 1}
                            >
                                -
                            </button>
                            <span>{quantity}</span>
                            <button
                                onClick={() => handleQuantityChange('increase')}
                                disabled={quantity >= selectedVariant.available}
                            >
                                +
                            </button>
                        </div>
                    </div>
                )}

                {/* Action Buttons */}
                <div className="action-buttons">
                    <button
                        className="add-to-cart-btn"
                        onClick={handleAddToCart}
                        disabled={addingToCart || !selectedVariant || selectedVariant.available === 0}
                    >
                        {addingToCart ? 'Adding...' : 'Add to Cart'}
                    </button>
                    <button
                        className="buy-now-btn"
                        onClick={handleBuyNow}
                        disabled={addingToCart || !selectedVariant || selectedVariant.available === 0}
                    >
                        Buy Now
                    </button>
                </div>

                {/* Product Description */}
                <div className="product-description">
                    <h3>Product Description</h3>
                    <p>{product.description}</p>
                </div>

                {/* Product Details */}
                <div className="product-details">
                    <h3>Product Details</h3>
                    <ul>
                        {product.category_name && (
                            <li>Category: {product.category_name}</li>
                        )}
                        {product.tags && product.tags.length > 0 && (
                            <li>Tags: {product.tags.join(', ')}</li>
                        )}
                    </ul>
                </div>
            </div>

            {/* Customer Reviews Section */}
            <div className="product-reviews-section">
                <h2 className="reviews-heading">Customer Reviews</h2>
                
                {reviewStats.count > 0 ? (
                    <div className="reviews-layout">
                        {/* Left Summary Pane */}
                        <div className="reviews-summary-pane">
                            <div className="average-rating-block">
                                <div className="avg-rating-value">
                                    {Number(reviewStats.avg).toFixed(1)} <span className="avg-star">★</span>
                                </div>
                                <div className="avg-rating-text">
                                    {reviewStats.count} Verified Ratings
                                </div>
                            </div>
                            
                            <div className="rating-distribution">
                                {[5, 4, 3, 2, 1].map(star => {
                                    const count = starDist[star];
                                    const percentage = reviewStats.count > 0 ? (count / reviewStats.count) * 100 : 0;
                                    return (
                                        <div key={star} className="rating-bar-row">
                                            <span className="star-label">{star} ★</span>
                                            <div className="progress-bar-bg">
                                                <div 
                                                    className="progress-bar-fill" 
                                                    style={{ 
                                                        width: `${percentage}%`,
                                                        backgroundColor: star >= 4 ? '#14958f' : star === 3 ? '#ff9f00' : '#ff6161'
                                                    }}
                                                />
                                            </div>
                                            <span className="count-label">{count}</span>
                                        </div>
                                    );
                                })}
                            </div>

                            <button onClick={() => setReviewModalOpen(true)} className="write-review-btn-large">
                                Write a Product Review
                            </button>
                        </div>
                        
                        {/* Right Reviews List Pane */}
                        <div className="reviews-list-pane">
                            {reviewsLoading ? (
                                <div className="spinner"></div>
                            ) : (
                                reviews.map(review => (
                                    <div key={review.id} className="review-card">
                                        <div className="review-header">
                                            <div className={`review-badge ${review.rating >= 4 ? 'good' : review.rating === 3 ? 'avg' : 'poor'}`}>
                                                {review.rating} ★
                                            </div>
                                            <span className="review-title">
                                                {review.rating >= 4 ? 'Excellent' : review.rating === 3 ? 'Good' : 'Needs Improvement'}
                                            </span>
                                        </div>
                                        {review.comment && (
                                            <p className="review-comment">
                                                {review.comment}
                                            </p>
                                        )}
                                        <div className="review-footer">
                                            <div className="reviewer-info">
                                                <span className="reviewer-name">{review.user_name}</span>
                                                <span className="review-divider">|</span>
                                                <span className="review-date">
                                                    {new Date(review.created_at).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}
                                                </span>
                                            </div>
                                            <div className="verified-badge">
                                                ✓ Verified Buyer
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                ) : (
                    <div style={{ textAlign: 'center', padding: '40px 0', background: '#f5f5f6', borderRadius: '8px' }}>
                        <h4 style={{ fontSize: '16px', fontWeight: 600, color: '#535766' }}>No reviews yet</h4>
                        <p style={{ color: '#94969f', marginTop: '8px' }}>Be the first to review this product after purchasing.</p>
                    </div>
                )}
            </div>

            {/* Review Modal */}
            {reviewModalOpen && (
                <div className="modal-overlay">
                    <div className="modal-content" style={{ maxWidth: '500px' }}>
                        <div className="modal-header">
                            <h2>Write a Review</h2>
                            <button className="modal-close" onClick={() => setReviewModalOpen(false)}>✕</button>
                        </div>
                        <div className="modal-body">
                            <form onSubmit={handleSubmitReview}>
                                <div style={{ marginBottom: '20px', display: 'flex', justifyContent: 'center', gap: '8px' }}>
                                    {[1, 2, 3, 4, 5].map((star) => (
                                        <button
                                            key={star}
                                            type="button"
                                            onClick={() => setReviewData({ ...reviewData, rating: star })}
                                            style={{
                                                background: 'none', border: 'none', fontSize: '32px', cursor: 'pointer',
                                                color: star <= reviewData.rating ? '#ff9f00' : '#eaeaec'
                                            }}
                                        >
                                            ★
                                        </button>
                                    ))}
                                </div>
                                <div style={{ marginBottom: '20px' }}>
                                    <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, fontSize: '14px' }}>Your Feedback</label>
                                    <textarea
                                        value={reviewData.comment}
                                        onChange={(e) => setReviewData({ ...reviewData, comment: e.target.value })}
                                        placeholder="What did you like or dislike? How's the fit and fabric?"
                                        style={{ width: '100%', padding: '12px', boxSizing: 'border-box', border: '1px solid #d4d5d9', borderRadius: '4px', minHeight: '100px', resize: 'vertical' }}
                                    />
                                </div>
                                <button type="submit" className="btn-primary" style={{ width: '100%' }} disabled={submittingReview}>
                                    {submittingReview ? 'Submitting...' : 'Submit Review'}
                                </button>
                            </form>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ProductDetail;