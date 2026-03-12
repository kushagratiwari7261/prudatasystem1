import React, { useState, useEffect, useCallback } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';

const API = 'http://10.184.34.191:5000/api/v1';

const localProductImages = [
    '/images/products/tshirt_black.png',
    '/images/products/dress_pink.png',
    '/images/products/jeans_dark.png',
    '/images/products/hoodie_navy.png',
    '/images/products/kurta_saffron.png',
    '/images/products/sneakers_white.png',
    '/images/products/jacket_olive.png',
];

const Shop = () => {
    const [searchParams, setSearchParams] = useSearchParams();
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [categories, setCategories] = useState([]);
    const [addingToCart, setAddingToCart] = useState(false);
    const [sortBy, setSortBy] = useState('newest');
    const [filters, setFilters] = useState({
        category: searchParams.get('category') || '',
        minPrice: '',
        maxPrice: '',
        sizes: [],
    });
    const [page, setPage] = useState(1);
    const [total, setTotal] = useState(0);
    const navigate = useNavigate();
    const limit = 12;

    const fetchProducts = useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            params.set('page', page);
            params.set('limit', limit);
            if (filters.category) params.set('category', filters.category);
            if (filters.minPrice) params.set('minPrice', filters.minPrice);
            if (filters.maxPrice) params.set('maxPrice', filters.maxPrice);
            if (sortBy === 'price_asc') { params.set('sortBy', 'price'); params.set('order', 'asc'); }
            if (sortBy === 'price_desc') { params.set('sortBy', 'price'); params.set('order', 'desc'); }
            if (sortBy === 'newest') { params.set('sortBy', 'createdAt'); params.set('order', 'desc'); }
            if (sortBy === 'rating') { params.set('sortBy', 'rating'); params.set('order', 'desc'); }

            const res = await fetch(`${API}/products?${params}`);
            const data = await res.json();
            const productList = data.data?.products || data.data || [];
            setProducts(productList);
            setTotal(data.data?.total || data.total || productList.length);
        } catch (err) {
            console.error('Failed to fetch products:', err);
        }
        setLoading(false);
    }, [page, filters, sortBy]);

    useEffect(() => { fetchProducts(); }, [fetchProducts]);

    useEffect(() => {
        const categoryFromUrl = searchParams.get('category') || '';
        if (filters.category !== categoryFromUrl) {
            setFilters(prev => ({ ...prev, category: categoryFromUrl }));
            setPage(1);
        }
    }, [searchParams]);

    useEffect(() => {
        fetch(`${API}/categories`)
            .then(r => r.json())
            .then(d => setCategories(d.data || []))
            .catch(() => { });
    }, []);

    const handleCategoryChange = (slug) => {
        setFilters(prev => ({ ...prev, category: prev.category === slug ? '' : slug }));
        setPage(1);
        if (slug) searchParams.set('category', slug);
        else searchParams.delete('category');
        setSearchParams(searchParams);
    };

    const handleSizeToggle = (size) => {
        setFilters(prev => ({
            ...prev,
            sizes: prev.sizes.includes(size)
                ? prev.sizes.filter(s => s !== size)
                : [...prev.sizes, size]
        }));
    };

    const addToCart = async (product) => {
        setAddingToCart(true);

        try {
            const token = localStorage.getItem('accessToken');

            // Check if product has variants
            if (!product.variants || product.variants.length === 0) {
                // Redirect to product page to select variant
                toast.info('Please select size and color on product page');
                navigate(`/products/${product.slug || product.id}`);
                setAddingToCart(false);
                return;
            }

            // Get the first variant
            const variant = product.variants[0];

            if (!variant || !variant.id) {
                toast.error('Product variant not found');
                setAddingToCart(false);
                return;
            }

            const cartData = {
                variant_id: variant.id,
                quantity: 1
            };

            // For guest users
            if (!token) {
                let sessionId = localStorage.getItem('guestSessionId');
                if (!sessionId) {
                    sessionId = 'guest_' + Math.random().toString(36).substr(2, 9);
                    localStorage.setItem('guestSessionId', sessionId);
                }
                cartData.sessionId = sessionId;
            }

            // Set headers
            const headers = {
                'Content-Type': 'application/json'
            };
            if (token) {
                headers['Authorization'] = `Bearer ${token}`;
            }

            const res = await fetch(`${API}/cart/add`, {
                method: 'POST',
                headers,
                body: JSON.stringify(cartData)
            });

            const data = await res.json();

            if (res.ok && data.success) {
                // Dispatch event to update cart count
                const cartCountEvent = new CustomEvent('cartUpdated', {
                    detail: { count: data.data?.item_count || data.data?.cart_count || data.data?.items?.length || 1 }
                });
                window.dispatchEvent(cartCountEvent);
            } else {
                toast.error(data.message || 'Failed to add to cart');
            }
        } catch (error) {
            console.error('Add to cart error:', error);
            toast.error('Failed to add to cart');
        } finally {
            setAddingToCart(false);
        }
    };

    const totalPages = Math.ceil(total / limit);
    const sizes = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];
    const colors = ['#000', '#fff', '#ff3f6c', '#1976d2', '#388e3c', '#ff9800', '#9c27b0', '#795548'];

    return (
        <div className="container">
            {/* Breadcrumb */}
            <div className="pdp-breadcrumb" style={{ padding: '16px 0 0' }}>
                <Link to="/">Home</Link> <span>/</span>
                <span style={{ color: '#282c3f', fontWeight: 600 }}>
                    {filters.category ? filters.category.charAt(0).toUpperCase() + filters.category.slice(1) : 'All Products'}
                </span>
            </div>

            <div className="shop-layout">
                {/* Sidebar Filters */}
                <aside className="shop-sidebar">
                    <div className="filter-section">
                        <h3 className="filter-title">Categories</h3>
                        {['men', 'women', 'kids', 'footwear', 'sports', 'accessories'].map(cat => (
                            <label className="filter-option" key={cat}>
                                <input
                                    type="checkbox"
                                    checked={filters.category === cat}
                                    onChange={() => handleCategoryChange(cat)}
                                />
                                {cat.charAt(0).toUpperCase() + cat.slice(1)}
                            </label>
                        ))}
                        {categories.length > 0 && categories.map(cat => (
                            <label className="filter-option" key={cat.id}>
                                <input
                                    type="checkbox"
                                    checked={filters.category === cat.slug}
                                    onChange={() => handleCategoryChange(cat.slug)}
                                />
                                {cat.name}
                            </label>
                        ))}
                    </div>

                    <div className="filter-section">
                        <h3 className="filter-title">Price Range</h3>
                        <input
                            type="range"
                            className="price-range-input"
                            min="0"
                            max="5000"
                            step="100"
                            value={filters.maxPrice || 5000}
                            onChange={(e) => setFilters(prev => ({ ...prev, maxPrice: e.target.value }))}
                        />
                        <div className="price-range-display">
                            <span>₹{filters.minPrice || 0}</span>
                            <span>₹{filters.maxPrice || '5000+'}</span>
                        </div>
                    </div>

                    <div className="filter-section">
                        <h3 className="filter-title">Size</h3>
                        <div className="filter-sizes">
                            {sizes.map(size => (
                                <button
                                    key={size}
                                    className={`filter-size-btn ${filters.sizes.includes(size) ? 'active' : ''}`}
                                    onClick={() => handleSizeToggle(size)}
                                >
                                    {size}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="filter-section">
                        <h3 className="filter-title">Color</h3>
                        <div className="filter-color-grid">
                            {colors.map(color => (
                                <div
                                    key={color}
                                    className="filter-color-swatch"
                                    style={{ background: color }}
                                />
                            ))}
                        </div>
                    </div>

                    <div className="filter-section">
                        <h3 className="filter-title">Discount</h3>
                        {['10', '20', '30', '40', '50'].map(d => (
                            <label className="filter-option" key={d}>
                                <input type="checkbox" />
                                {d}% and above
                            </label>
                        ))}
                    </div>
                </aside>

                {/* Main Content */}
                <main>
                    {/* Sort Bar */}
                    <div className="sort-bar">
                        <div className="results-count">
                            Showing <strong>{total}</strong> results
                            {filters.category && <> for <strong>{filters.category}</strong></>}
                        </div>
                        <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
                            <option value="newest">Sort by: Newest</option>
                            <option value="price_asc">Price: Low to High</option>
                            <option value="price_desc">Price: High to Low</option>
                            <option value="rating">Customer Rating</option>
                            <option value="popular">Popularity</option>
                        </select>
                    </div>

                    {/* Product Grid */}
                    {loading ? (
                        <div className="spinner-container"><div className="spinner" /></div>
                    ) : products.length === 0 ? (
                        <div className="empty-state">
                            <div className="empty-state-icon">🔍</div>
                            <h3 className="empty-state-title">No products found</h3>
                            <p className="empty-state-text">Try adjusting your filters or search for something else.</p>
                            <Link to="/shop" className="btn-primary" style={{ marginTop: '12px' }}>Clear Filters</Link>
                        </div>
                    ) : (
                        <div className="product-grid">
                            {products.map(p => (
                                <ProductCard
                                    key={p.id}
                                    product={p}
                                    onAdd={addToCart}
                                    isAdding={addingToCart}
                                />
                            ))}
                        </div>
                    )}

                    {/* Pagination */}
                    {totalPages > 1 && (
                        <div style={{
                            display: 'flex',
                            justifyContent: 'center',
                            gap: '8px',
                            marginTop: '40px',
                            paddingBottom: '20px'
                        }}>
                            {page > 1 && (
                                <button
                                    onClick={() => setPage(p => p - 1)}
                                    style={{
                                        padding: '8px 16px',
                                        border: '1px solid #d4d5d9',
                                        borderRadius: '4px',
                                        background: 'white',
                                        cursor: 'pointer',
                                        fontWeight: 600
                                    }}
                                >
                                    ← Previous
                                </button>
                            )}
                            {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => i + 1).map(p => (
                                <button
                                    key={p}
                                    onClick={() => setPage(p)}
                                    style={{
                                        padding: '8px 14px',
                                        border: `1px solid ${page === p ? '#ff3f6c' : '#d4d5d9'}`,
                                        borderRadius: '4px',
                                        background: page === p ? '#ff3f6c' : 'white',
                                        color: page === p ? 'white' : '#282c3f',
                                        cursor: 'pointer',
                                        fontWeight: 700
                                    }}
                                >
                                    {p}
                                </button>
                            ))}
                            {page < totalPages && (
                                <button
                                    onClick={() => setPage(p => p + 1)}
                                    style={{
                                        padding: '8px 16px',
                                        border: '1px solid #d4d5d9',
                                        borderRadius: '4px',
                                        background: 'white',
                                        cursor: 'pointer',
                                        fontWeight: 600
                                    }}
                                >
                                    Next →
                                </button>
                            )}
                        </div>
                    )}
                </main>
            </div>
        </div>
    );
};

const ProductCard = ({ product, onAdd, isAdding }) => {
    const navigate = useNavigate();
    const [adding, setAdding] = useState(false);

    const images = product.images || [];
    const fallbackIdx = Math.abs((product.id || '').toString().split('').reduce((a, c) => a + c.charCodeAt(0), 0)) % localProductImages.length;
    let imgUrl = localProductImages[fallbackIdx];

    if (product.fallbackImg) {
        imgUrl = product.fallbackImg;
    } else if (images.length > 0) {
        const img = images[0];
        if (typeof img === 'string') {
            imgUrl = img.startsWith('/uploads') ? `http://10.184.34.191:5000${img}` : (img.startsWith('http') ? img : img);
        } else if (img?.url) {
            imgUrl = img.url.startsWith('/') ? `http://10.184.34.191:5000${img.url}` : img.url;
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

        // Check if product has variants
        if (!product.variants || product.variants.length === 0) {
            // Redirect to product page to select variant
            toast.info('Please select size and color on product page');
            navigate(`/products/${product.slug || product.id}`);
            setAdding(false);
            return;
        }

        // Call the parent add function
        await onAdd(product);
        setAdding(false);
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
                className="product-card-wishlist"
                onClick={(e) => e.stopPropagation()}
            >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
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

export default Shop;