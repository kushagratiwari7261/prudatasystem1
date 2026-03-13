import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import ProductCard from '../components/ProductCard';

const API = 'http://localhost:5000/api/v1';

const Wishlist = () => {
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();
    const token = localStorage.getItem('accessToken');

    useEffect(() => {
        if (!token) {
            navigate('/login');
            return;
        }

        const fetchWishlist = async () => {
            try {
                const res = await fetch(`${API}/wishlist`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                const data = await res.json();
                if (data.success) {
                    setProducts(data.data || []);
                }
            } catch (error) {
                console.error('Error fetching wishlist:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchWishlist();
    }, [token, navigate]);

    const addToCart = (product) => {
        // From wishlist, we redirect to product detail to choose specific variants correctly
        navigate(`/products/${product.slug || product.id}`);
    };

    if (loading) return <div className="spinner-container" style={{ minHeight: '60vh' }}><div className="spinner" /></div>;

    return (
        <div className="container">
            <div className="pdp-breadcrumb" style={{ padding: '16px 0 0' }}>
                <Link to="/">Home</Link> <span>/</span>
                <span style={{ color: '#282c3f', fontWeight: 600 }}>My Wishlist</span>
            </div>

            <div className="wishlist-header" style={{ margin: '24px 0 32px' }}>
                <h1 style={{ fontSize: '20px', fontWeight: 800, color: '#282c3f' }}>
                    My Wishlist 
                    <span style={{ fontWeight: 400, color: '#7e818c', marginLeft: '8px' }}>
                        ({products.length} {products.length === 1 ? 'item' : 'items'})
                    </span>
                </h1>
            </div>

            {products.length === 0 ? (
                <div className="empty-state" style={{ padding: '80px 0', minHeight: '50vh' }}>
                    <div className="empty-state-icon" style={{ fontSize: '64px', marginBottom: '16px' }}>❤️</div>
                    <h3 className="empty-state-title" style={{ fontSize: '20px', fontWeight: 700 }}>Your wishlist is empty</h3>
                    <p className="empty-state-text" style={{ maxWidth: '400px', margin: '8px auto', color: '#7e818c' }}>
                        Save items that you like in your wishlist. Review them anytime and easily move them to bag.
                    </p>
                    <Link to="/shop" className="btn-primary" style={{ marginTop: '24px', padding: '12px 40px', display: 'inline-block' }}>
                        Continue Shopping
                    </Link>
                </div>
            ) : (
                <div className="product-grid" style={{ marginBottom: '60px' }}>
                    {products.map(p => (
                        <ProductCard
                            key={p.id}
                            product={p}
                            onAdd={() => addToCart(p)}
                            isWishlistedInitial={true}
                        />
                    ))}
                </div>
            )}
        </div>
    );
};

export default Wishlist;
