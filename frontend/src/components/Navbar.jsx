import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';

const Navbar = () => {
    const [searchQuery, setSearchQuery] = useState('');
    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const [cartCount, setCartCount] = useState(0);
    const [isAnimating, setIsAnimating] = useState(false);
    const navigate = useNavigate();
    const location = useLocation();

    useEffect(() => {
        const token = localStorage.getItem('accessToken');
        setIsLoggedIn(!!token);

        // Get cart count
        const guestCart = JSON.parse(localStorage.getItem('guestCart') || '{"items":[]}');
        setCartCount(guestCart.items?.length || 0);

        if (token) {
            fetch('http://localhost:5000/api/v1/cart', {
                headers: { 'Authorization': `Bearer ${token}` }
            })
                .then(res => res.json())
                .then(data => {
                    if (data.data?.items) setCartCount(data.data.items.length);
                })
                .catch(() => { });
        }
    }, [location.pathname]);

    // Listen for custom cartUpdated events from ProductDetail / Shop
    useEffect(() => {
        const handleCartUpdate = (e) => {
            if (e.detail?.count !== undefined) {
                setCartCount(e.detail.count);
            } else {
                // Determine organically if no count provided
                const token = localStorage.getItem('accessToken');
                if (!token) {
                    const guestCart = JSON.parse(localStorage.getItem('guestCart') || '{"items":[]}');
                    setCartCount(guestCart.items?.length || 0);
                }
            }
            
            if (!e.detail?.isRemoval) {
                setIsAnimating(true);
                setTimeout(() => setIsAnimating(false), 500);
            }
        };

        window.addEventListener('cartUpdated', handleCartUpdate);
        return () => window.removeEventListener('cartUpdated', handleCartUpdate);
    }, []);

    const handleSearch = (e) => {
        e.preventDefault();
        if (searchQuery.trim()) {
            navigate(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
        }
    };

    const handleLogout = () => {
        localStorage.clear();
        setIsLoggedIn(false);
        navigate('/');
    };

    const navLinks = [
        { to: '/shop?category=men', label: 'Men' },
        { to: '/shop?category=women', label: 'Women' },
        { to: '/shop?category=kids', label: 'Kids' },
        { to: '/shop', label: 'Shop All' },
    ];

    return (
        <nav className="navbar">
            <div className="navbar-inner">
                <Link to="/" className="navbar-logo">
                    <img src="/LOGO.png" alt="Zenwair" />
                    <span>Zenwair</span>
                </Link>

                <div className="navbar-links">
                    {navLinks.map(link => (
                        <Link
                            key={link.label}
                            to={link.to}
                            className={`navbar-link ${
                                location.pathname + location.search === link.to || 
                                (link.to === '/shop' && location.pathname === '/shop' && (!location.search || !location.search.includes('category='))) 
                                    ? 'active' 
                                    : ''
                            }`}
                        >
                            {link.label}
                        </Link>
                    ))}
                </div>

                <form className="navbar-search" onSubmit={handleSearch}>
                    <svg className="navbar-search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="11" cy="11" r="8" />
                        <path d="M21 21l-4.35-4.35" />
                    </svg>
                    <input
                        type="text"
                        placeholder="Search for products, brands and more"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </form>

                <div className="navbar-actions">
                    {isLoggedIn ? (
                        <Link to="/account" className="navbar-action-btn">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                                <circle cx="12" cy="7" r="4" />
                            </svg>
                            <span>Profile</span>
                        </Link>
                    ) : (
                        <Link to="/login" className="navbar-action-btn">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                                <circle cx="12" cy="7" r="4" />
                            </svg>
                            <span>Login</span>
                        </Link>
                    )}

                    <Link to="/orders" className="navbar-action-btn">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" />
                            <rect x="9" y="3" width="6" height="4" rx="1" />
                            <path d="M9 14l2 2 4-4" />
                        </svg>
                        <span>Orders</span>
                    </Link>

                    <Link to="/cart" className={`navbar-action-btn ${isAnimating ? 'cart-animating' : ''}`}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
                            <line x1="3" y1="6" x2="21" y2="6" />
                            <path d="M16 10a4 4 0 0 1-8 0" />
                        </svg>
                        {cartCount > 0 && <div className="navbar-badge">{cartCount}</div>}
                        <span>Bag</span>
                    </Link>

                    {isLoggedIn && (
                        <button onClick={handleLogout} className="navbar-action-btn" style={{ color: '#ff3f6c' }}>
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                                <polyline points="16 17 21 12 16 7" />
                                <line x1="21" y1="12" x2="9" y2="12" />
                            </svg>
                            <span>Logout</span>
                        </button>
                    )}
                </div>
            </div>
        </nav>
    );
};

export default Navbar;
