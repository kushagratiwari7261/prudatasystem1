import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';

const API = 'http://localhost:5000/api/v1';

const categories = [
    { name: 'Men', icon: '👔', slug: 'men', image: '/images/categories/men.png' },
    { name: 'Women', icon: '👗', slug: 'women', image: '/images/categories/women.png' },
    { name: 'Kids', icon: '🧒', slug: 'kids' },
    { name: 'Footwear', icon: '👟', slug: 'footwear' },
    { name: 'Sports', icon: '🏃', slug: 'sports' },
    { name: 'Accessories', icon: '⌚', slug: 'accessories' },
];

// Fallback products when API returns nothing
const fallbackProducts = [
    { id: 'fb1', name: 'Oversized Graphic Tee', brand: 'ZENWAIR', slug: 'oversized-graphic-tee', fallbackImg: '/images/products/tshirt_black.png', price: 899, mrp: 1499 },
    { id: 'fb2', name: 'Floral Summer Dress', brand: 'ZENWAIR', slug: 'floral-summer-dress', fallbackImg: '/images/products/dress_pink.png', price: 1299, mrp: 2199 },
    { id: 'fb3', name: 'Premium Denim Jeans', brand: 'ZENWAIR', slug: 'premium-denim-jeans', fallbackImg: '/images/products/jeans_dark.png', price: 1599, mrp: 2999 },
    { id: 'fb4', name: 'Streetwear Hoodie', brand: 'ZENWAIR', slug: 'streetwear-hoodie', fallbackImg: '/images/products/hoodie_navy.png', price: 1799, mrp: 2999 },
    { id: 'fb5', name: 'Ethnic Cotton Kurta', brand: 'ZENWAIR', slug: 'ethnic-cotton-kurta', fallbackImg: '/images/products/kurta_saffron.png', price: 999, mrp: 1799 },
    { id: 'fb6', name: 'Minimalist Sneakers', brand: 'ZENWAIR', slug: 'minimalist-sneakers', fallbackImg: '/images/products/sneakers_white.png', price: 2499, mrp: 3999 },
    { id: 'fb7', name: 'Bomber Jacket', brand: 'ZENWAIR', slug: 'bomber-jacket', fallbackImg: '/images/products/jacket_olive.png', price: 2299, mrp: 3999 },
    { id: 'fb8', name: 'Classic Black Tee', brand: 'ZENWAIR', slug: 'classic-black-tee', fallbackImg: '/images/products/tshirt_black.png', price: 699, mrp: 1199 },
];

const Home = () => {
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [dealTime, setDealTime] = useState({ hours: 5, minutes: 32, seconds: 15 });
    const navigate = useNavigate();

    useEffect(() => {
        fetchProducts();
    }, []);

    const fetchProducts = async () => {
        try {
            const res = await fetch(`${API}/products?limit=8`);
            const data = await res.json();
            const fetched = data.data?.products || data.data || [];
            setProducts(fetched.length > 0 ? fetched : fallbackProducts);
        } catch (error) {
            console.error('Error fetching products:', error);
            setProducts(fallbackProducts);
        } finally {
            setLoading(false);
        }
    };

    // Deal countdown timer
    useEffect(() => {
        const timer = setInterval(() => {
            setDealTime(prev => {
                let { hours, minutes, seconds } = prev;
                seconds--;
                if (seconds < 0) { seconds = 59; minutes--; }
                if (minutes < 0) { minutes = 59; hours--; }
                if (hours < 0) { hours = 23; minutes = 59; seconds = 59; }
                return { hours, minutes, seconds };
            });
        }, 1000);
        return () => clearInterval(timer);
    }, []);

    return (
        <div>
            {/* Hero Banner with Logo */}
            <div className="hero-logo-banner">
                <img src="/LOGO.png" alt="Zenwair — Wear Your Culture" />
            </div>

            {/* Hero Image Banner */}
            <section style={{ position: 'relative', overflow: 'hidden' }}>
                <img
                    src="/images/banners/hero_banner.png"
                    alt="Zenwair Fashion — Flat 50-80% Off"
                    style={{
                        width: '100%',
                        height: '420px',
                        objectFit: 'cover',
                        display: 'block'
                    }}
                />
                <div style={{
                    position: 'absolute',
                    bottom: '0',
                    left: '0',
                    right: '0',
                    background: 'linear-gradient(transparent, rgba(0,0,0,0.6))',
                    padding: '40px 48px 32px',
                    color: 'white'
                }}>
                    <h2 style={{ fontSize: '42px', fontWeight: 900, letterSpacing: '-1px', marginBottom: '8px', textShadow: '0 2px 8px rgba(0,0,0,0.3)' }}>
                        New Season Collection
                    </h2>
                    <p style={{ fontSize: '16px', opacity: 0.9, marginBottom: '16px' }}>
                        Premium fashion that blends comfort with style — wear your culture
                    </p>
                    <Link to="/shop" className="hero-cta" style={{ display: 'inline-block' }}>
                        Shop Now →
                    </Link>
                </div>
            </section>

            {/* Sale Banner Image */}
            <Link to="/shop" style={{ display: 'block' }}>
                <img
                    src="/images/banners/sale_banner.png"
                    alt="End of Season Sale — Up to 80% Off"
                    style={{
                        width: '100%',
                        height: 'auto',
                        maxHeight: '300px',
                        objectFit: 'contain',
                        display: 'block',
                        background: 'linear-gradient(135deg, #1a1a2e, #16213e)'
                    }}
                />
            </Link>

            {/* Categories */}
            <section className="section">
                <div className="container">
                    <div className="section-header">
                        <h2 className="section-title">Shop by Category</h2>
                        <p className="section-subtitle">Explore our curated collections</p>
                    </div>
                    <div className="category-grid">
                        {categories.map(cat => (
                            <Link to={`/shop?category=${cat.slug}`} key={cat.slug} className="category-card">
                                <div className="category-icon" style={cat.image ? { padding: 0, border: 'none' } : {}}>
                                    {cat.image ? (
                                        <img src={cat.image} alt={cat.name} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
                                    ) : (
                                        <span>{cat.icon}</span>
                                    )}
                                </div>
                                <span className="category-label">{cat.name}</span>
                            </Link>
                        ))}
                    </div>
                </div>
            </section>

            {/* Deals of the Day */}
            <section className="deals-banner">
                <div className="container">
                    <div className="section-header">
                        <h2 className="section-title">Deals of the Day</h2>
                    </div>
                    <div className="deals-timer">
                        <div className="deals-timer-block">
                            <span className="number">{String(dealTime.hours).padStart(2, '0')}</span>
                            <span className="label">Hrs</span>
                        </div>
                        <span className="deals-timer-sep">:</span>
                        <div className="deals-timer-block">
                            <span className="number">{String(dealTime.minutes).padStart(2, '0')}</span>
                            <span className="label">Min</span>
                        </div>
                        <span className="deals-timer-sep">:</span>
                        <div className="deals-timer-block">
                            <span className="number">{String(dealTime.seconds).padStart(2, '0')}</span>
                            <span className="label">Sec</span>
                        </div>
                    </div>
                    {loading ? (
                        <div className="spinner-container"><div className="spinner" /></div>
                    ) : (
                        <div className="product-grid" style={{ maxWidth: '1000px', margin: '0 auto' }}>
                            {products.slice(0, 4).map(p => (
                                <ProductCard
                                    key={p.id}
                                    product={p}
                                />
                            ))}
                        </div>
                    )}
                </div>
            </section>

            {/* Trending Now */}
            <section className="section">
                <div className="container">
                    <div className="section-header">
                        <h2 className="section-title">Trending Now</h2>
                        <p className="section-subtitle">Most popular picks this week</p>
                    </div>
                    {loading ? (
                        <div className="spinner-container"><div className="spinner" /></div>
                    ) : (
                        <div className="product-grid">
                            {products.slice(0, 8).map(p => (
                                <ProductCard
                                    key={p.id}
                                    product={p}
                                />
                            ))}
                        </div>
                    )}
                    <div style={{ textAlign: 'center', marginTop: '40px' }}>
                        <Link to="/shop" className="hero-cta">
                            View All Products →
                        </Link>
                    </div>
                </div>
            </section>

            {/* Promotional Strip Banners */}
            <section style={{ padding: '0' }}>
                <div className="container" style={{ padding: '48px 24px' }}>
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(3, 1fr)',
                        gap: '16px'
                    }}>
                        <Link to="/shop?category=men" style={{
                            position: 'relative', borderRadius: '12px', overflow: 'hidden', aspectRatio: '4/5'
                        }}>
                            <img src="/images/products/hoodie_navy.png" alt="Streetwear Collection" style={{
                                width: '100%', height: '100%', objectFit: 'cover'
                            }} />
                            <div style={{
                                position: 'absolute', bottom: 0, left: 0, right: 0,
                                background: 'linear-gradient(transparent, rgba(0,0,0,0.7))',
                                padding: '40px 20px 20px', color: 'white', textAlign: 'center'
                            }}>
                                <div style={{ fontSize: '18px', fontWeight: 800, letterSpacing: '1px' }}>STREETWEAR</div>
                                <div style={{ fontSize: '13px', opacity: 0.9 }}>Starting ₹799</div>
                            </div>
                        </Link>
                        <Link to="/shop?category=women" style={{
                            position: 'relative', borderRadius: '12px', overflow: 'hidden', aspectRatio: '4/5'
                        }}>
                            <img src="/images/products/dress_pink.png" alt="Women's Collection" style={{
                                width: '100%', height: '100%', objectFit: 'cover'
                            }} />
                            <div style={{
                                position: 'absolute', bottom: 0, left: 0, right: 0,
                                background: 'linear-gradient(transparent, rgba(0,0,0,0.7))',
                                padding: '40px 20px 20px', color: 'white', textAlign: 'center'
                            }}>
                                <div style={{ fontSize: '18px', fontWeight: 800, letterSpacing: '1px' }}>WOMEN'S</div>
                                <div style={{ fontSize: '13px', opacity: 0.9 }}>Starting ₹599</div>
                            </div>
                        </Link>
                        <Link to="/shop?category=footwear" style={{
                            position: 'relative', borderRadius: '12px', overflow: 'hidden', aspectRatio: '4/5'
                        }}>
                            <img src="/images/products/sneakers_white.png" alt="Footwear Collection" style={{
                                width: '100%', height: '100%', objectFit: 'cover'
                            }} />
                            <div style={{
                                position: 'absolute', bottom: 0, left: 0, right: 0,
                                background: 'linear-gradient(transparent, rgba(0,0,0,0.7))',
                                padding: '40px 20px 20px', color: 'white', textAlign: 'center'
                            }}>
                                <div style={{ fontSize: '18px', fontWeight: 800, letterSpacing: '1px' }}>FOOTWEAR</div>
                                <div style={{ fontSize: '13px', opacity: 0.9 }}>Starting ₹1,499</div>
                            </div>
                        </Link>
                    </div>
                </div>
            </section>

            {/* Trust Banner */}
            <section style={{
                background: '#fafafa',
                padding: '48px 24px',
                borderTop: '1px solid #eaeaec',
                borderBottom: '1px solid #eaeaec'
            }}>
                <div className="container" style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                    gap: '32px',
                    textAlign: 'center'
                }}>
                    {[
                        { title: 'Free Shipping', sub: 'On orders over ₹999' },
                        { title: 'Easy Returns', sub: '30-day return policy' },
                        { title: '100% Authentic', sub: 'Genuine products only' },
                        { title: 'Secure Payments', sub: 'SSL encrypted checkout' },
                    ].map(item => (
                        <div key={item.title}>
                            <div style={{ fontSize: '36px', marginBottom: '8px' }}>{item.icon}</div>
                            <div style={{ fontWeight: 700, fontSize: '15px', marginBottom: '4px' }}>{item.title}</div>
                            <div style={{ fontSize: '13px', color: '#94969f' }}>{item.sub}</div>
                        </div>
                    ))}
                </div>
            </section>
        </div>
    );
};

const ProductCard = ({ product }) => {
    const navigate = useNavigate();

    const images = product.images || [];
    let imgUrl = product.fallbackImg || `/images/products/tshirt_black.png`;

    if (images.length > 0) {
        const img = images[0];
        if (typeof img === 'string') {
            imgUrl = img.startsWith('/uploads') ? `http://localhost:5000${img}` : img;
        } else if (img?.url) {
            imgUrl = img.url.startsWith('/') ? `http://localhost:5000${img.url}` : img.url;
        }
    }

    const price = product.discount_price || product.variants?.[0]?.price || product.price || product.base_price || 999;
    const mrp = product.base_price || product.variants?.[0]?.mrp || product.mrp || Math.round(price * 1.5);
    const discount = mrp > price ? Math.round(((mrp - price) / mrp) * 100) : 0;
    const rating = product.rating_avg || product.rating || (3.5 + Math.random() * 1.5).toFixed(1);
    const productName = product.title || product.name || 'Product';

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
        </div>
    );
};

export default Home;