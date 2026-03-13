import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import ProductCard from '../components/ProductCard';
import SkeletonCard from '../components/SkeletonCard';

const API = 'http://localhost:5000/api/v1';

const Shop = () => {
    const [searchParams, setSearchParams] = useSearchParams();
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [availableFilters, setAvailableFilters] = useState({
        categories: [],
        brands: [],
        colors: [],
        sizes: []
    });
    const [addingToCart, setAddingToCart] = useState(false);
    const [sortBy, setSortBy] = useState('newest');
    const [wishlistIds, setWishlistIds] = useState(new Set());
    const [filters, setFilters] = useState({
        category: searchParams.get('category') || '',
        brands: searchParams.get('brands') ? searchParams.get('brands').split(',') : [],
        minPrice: '',
        maxPrice: searchParams.get('maxPrice') || '',
        sizes: searchParams.get('sizes') ? searchParams.get('sizes').split(',') : [],
        colors: searchParams.get('colors') ? searchParams.get('colors').split(',') : [],
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
            if (filters.brands.length > 0) params.set('brand', filters.brands.join(','));
            if (filters.colors.length > 0) params.set('colors', filters.colors.join(','));
            if (filters.sizes.length > 0) params.set('sizes', filters.sizes.join(','));
            if (filters.minPrice) params.set('min_price', filters.minPrice);
            if (filters.maxPrice) params.set('max_price', filters.maxPrice);
            
            if (sortBy === 'price_asc') params.set('sort', 'price_asc');
            else if (sortBy === 'price_desc') params.set('sort', 'price_desc');
            else if (sortBy === 'newest') params.set('sort', 'newest');
            else if (sortBy === 'rating') params.set('sort', 'popular');
            else if (sortBy === 'popular') params.set('sort', 'popular');

            const res = await fetch(`${API}/products?${params}`);
            const data = await res.json();
            const productList = data.data?.products || data.data || [];
            setProducts(productList);
            setTotal(data.data?.pagination?.total || data.data?.total || productList.length);

            // Fetch wishlist if logged in
            const token = localStorage.getItem('accessToken');
            if (token) {
                const wishlistRes = await fetch(`${API}/wishlist`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                const wishlistData = await wishlistRes.json();
                if (wishlistData.success) {
                    setWishlistIds(new Set((wishlistData.data || []).map(p => p.id)));
                }
            }
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
        // Fetch Filter Options
        fetch(`${API}/products/filters`)
            .then(r => r.json())
            .then(d => {
                if (d.success) setAvailableFilters(d.data);
            })
            .catch(() => { });
    }, []);

    const handleFilterToggle = (type, value) => {
        setFilters(prev => {
            const current = [...prev[type]];
            const updated = current.includes(value)
                ? current.filter(item => item !== value)
                : [...current, value];
            
            const newFilters = { ...prev, [type]: updated };
            
            // Update URL
            if (updated.length > 0) searchParams.set(type === 'brands' ? 'brands' : type, updated.join(','));
            else searchParams.delete(type === 'brands' ? 'brands' : type);
            setSearchParams(searchParams);
            
            return newFilters;
        });
        setPage(1);
    };

    const handleCategoryChange = (slug) => {
        const newCat = filters.category === slug ? '' : slug;
        setFilters(prev => ({ ...prev, category: newCat }));
        setPage(1);
        if (newCat) searchParams.set('category', newCat);
        else searchParams.delete('category');
        setSearchParams(searchParams);
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
                    <div className="filter-section" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <h3 className="filter-title" style={{ marginBottom: 0 }}>Filters</h3>
                        <button 
                            onClick={() => {
                                setFilters({ category: '', brands: [], minPrice: '', maxPrice: '', sizes: [], colors: [] });
                                setSearchParams({});
                                setPage(1);
                            }}
                            style={{ background: 'none', color: 'var(--primary)', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', cursor: 'pointer' }}
                        >
                            Clear All
                        </button>
                    </div>

                    <div className="filter-section">
                        <h3 className="filter-title">Categories</h3>
                        {availableFilters.categories.map(cat => (
                            <label className="filter-option" key={cat.slug}>
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
                        <h3 className="filter-title">Brands</h3>
                        {availableFilters.brands.map(brand => (
                            <label className="filter-option" key={brand.slug}>
                                <input
                                    type="checkbox"
                                    checked={filters.brands.includes(brand.slug)}
                                    onChange={() => handleFilterToggle('brands', brand.slug)}
                                />
                                {brand.name}
                            </label>
                        ))}
                    </div>

                    <div className="filter-section">
                        <h3 className="filter-title">Price Range</h3>
                        <input
                            type="range"
                            className="price-range-input"
                            min="0"
                            max="10000"
                            step="500"
                            value={filters.maxPrice || 10000}
                            onChange={(e) => {
                                setFilters(prev => ({ ...prev, maxPrice: e.target.value }));
                                searchParams.set('maxPrice', e.target.value);
                                setSearchParams(searchParams);
                            }}
                        />
                        <div className="price-range-display">
                            <span>₹{filters.minPrice || 0}</span>
                            <span>₹{filters.maxPrice || '10000+'}</span>
                        </div>
                    </div>

                    <div className="filter-section">
                        <h3 className="filter-title">Size</h3>
                        <div className="filter-sizes">
                            {availableFilters.sizes.map(size => (
                                <button
                                    key={size}
                                    className={`filter-size-btn ${filters.sizes.includes(size) ? 'active' : ''}`}
                                    onClick={() => handleFilterToggle('sizes', size)}
                                >
                                    {size}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="filter-section">
                        <h3 className="filter-title">Color</h3>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '8px' }}>
                            {availableFilters.colors.map(color => (
                                <button
                                    key={color}
                                    onClick={() => handleFilterToggle('colors', color)}
                                    style={{
                                        width: '28px',
                                        height: '28px',
                                        borderRadius: '50%',
                                        background: color,
                                        border: filters.colors.includes(color) ? '2px solid var(--primary)' : '1px solid #ddd',
                                        cursor: 'pointer',
                                        position: 'relative',
                                        boxShadow: filters.colors.includes(color) ? '0 0 0 2px white inset' : 'none'
                                    }}
                                    title={color}
                                />
                            ))}
                        </div>
                    </div>
                </aside>

                {/* Main Content */}
                <main>
                    {/* Sort Bar */}
                    {/* Product Grid */}
                    {loading ? (
                        <div className="product-grid">
                            {Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} />)}
                        </div>
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
                                    isWishlistedInitial={wishlistIds.has(p.id)}
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

export default Shop;