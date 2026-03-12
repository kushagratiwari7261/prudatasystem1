import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';

const API = 'http://10.184.34.191:5000/api/v1';

// Image helper function
const getFullImageUrl = (imagePath) => {
    if (!imagePath) return '/placeholder-image.png';

    // If it's already a full URL, return as is
    if (imagePath.startsWith('http')) {
        return imagePath;
    }

    // If it's a relative path starting with /uploads
    if (imagePath.startsWith('/uploads')) {
        return `http://10.184.34.191:5000${imagePath}`;
    }

    // If it's just a filename
    return `http://10.184.34.191:5000/uploads/products/${imagePath}`;
};

const Cart = () => {
    const [cart, setCart] = useState(null);
    const [loading, setLoading] = useState(true);
    const [updating, setUpdating] = useState(false);
    const [couponCode, setCouponCode] = useState('');
    const [showCoupon, setShowCoupon] = useState(false);
    const [toast, setToast] = useState('');
    const [imageErrors, setImageErrors] = useState({});
    const navigate = useNavigate();
    const token = localStorage.getItem('accessToken');

    useEffect(() => {
        if (!token) {
            navigate('/login');
            return;
        }
        fetchCart();
    }, [token, navigate]);

    const fetchCart = async () => {
        try {
            setLoading(true);
            const res = await fetch(`${API}/cart`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            console.log('Cart response:', data);

            if (data.success) {
                // Process images in cart items
                if (data.data?.items) {
                    data.data.items = data.data.items.map(item => ({
                        ...item,
                        processedImage: getFullImageUrl(item.image || item.product?.images?.[0])
                    }));
                }
                setCart(data.data || { items: [], totals: {} });
            } else {
                setCart({ items: [], totals: {} });
            }
        } catch (error) {
            console.error('Error fetching cart:', error);
            setCart({ items: [], totals: {} });
        } finally {
            setLoading(false);
        }
    };

    const showToastMsg = (msg, isError = false) => {
        setToast(msg);
        setTimeout(() => setToast(''), 3000);
    };

    const updateQuantity = async (variantId, newQuantity) => {
        if (newQuantity < 1) return;

        setUpdating(true);

        // Optimistic update
        const updatedItems = cart.items.map(item =>
            item.variant_id === variantId
                ? { ...item, quantity: newQuantity }
                : item
        );

        // Recalculate totals optimistically
        const newTotals = calculateTotals(updatedItems, cart.coupon);

        setCart({
            ...cart,
            items: updatedItems,
            items_total: newTotals.items_total,
            discount_amount: newTotals.discount_amount,
            shipping_charge: newTotals.shipping_charge,
            final_total: newTotals.final_total,
            item_count: newTotals.item_count
        });

        try {
            // ✅ CORRECT PAYLOAD FOR BACKEND
            const payload = {
                variant_id: variantId,
                quantity: newQuantity
            };

            console.log('Updating cart with:', payload);

            const res = await fetch(`${API}/cart/update`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(payload)
            });

            const data = await res.json();

            if (res.ok && data.success) {
                // Process images in response
                if (data.data?.items) {
                    data.data.items = data.data.items.map(item => ({
                        ...item,
                        processedImage: getFullImageUrl(item.image || item.product?.images?.[0])
                    }));
                }
                setCart(data.data);
                showToastMsg('Cart updated');

                const newCount = data.data?.item_count || data.data?.items?.reduce((s,i) => s + (i.quantity || 1), 0) || 0;
                window.dispatchEvent(new CustomEvent('cartUpdated', { detail: { count: newCount, isRemoval: true } }));
            } else {
                // Revert on error
                fetchCart();
                showToastMsg(data.message || 'Failed to update', true);
            }
        } catch (error) {
            console.error('Update error:', error);
            fetchCart(); // Revert to server state
            showToastMsg('Failed to update', true);
        } finally {
            setUpdating(false);
        }
    };

    const removeItem = async (variantId) => {
        setUpdating(true);

        // Optimistic update
        const updatedItems = cart.items.filter(item => item.variant_id !== variantId);
        const newTotals = calculateTotals(updatedItems, cart.coupon);

        setCart({
            ...cart,
            items: updatedItems,
            items_total: newTotals.items_total,
            discount_amount: newTotals.discount_amount,
            shipping_charge: newTotals.shipping_charge,
            final_total: newTotals.final_total,
            item_count: newTotals.item_count
        });

        try {
            const res = await fetch(`${API}/cart/item/${variantId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });

            const data = await res.json();

            if (res.ok && data.success) {
                // Process images in response
                if (data.data?.items) {
                    data.data.items = data.data.items.map(item => ({
                        ...item,
                        processedImage: getFullImageUrl(item.image || item.product?.images?.[0])
                    }));
                }
                setCart(data.data);
                showToastMsg('Item removed');

                const newCount = data.data?.item_count || data.data?.items?.reduce((s,i) => s + (i.quantity || 1), 0) || 0;
                window.dispatchEvent(new CustomEvent('cartUpdated', { detail: { count: newCount, isRemoval: true } }));
            } else {
                fetchCart();
                showToastMsg('Failed to remove', true);
            }
        } catch (error) {
            console.error('Remove error:', error);
            fetchCart();
            showToastMsg('Failed to remove', true);
        } finally {
            setUpdating(false);
        }
    };

    const applyCoupon = async () => {
        if (!couponCode.trim()) return;

        setUpdating(true);

        try {
            const res = await fetch(`${API}/cart/coupon`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ code: couponCode })
            });

            const data = await res.json();

            if (res.ok && data.success) {
                // Process images in response
                if (data.data?.items) {
                    data.data.items = data.data.items.map(item => ({
                        ...item,
                        processedImage: getFullImageUrl(item.image || item.product?.images?.[0])
                    }));
                }
                setCart(data.data);
                showToastMsg('Coupon applied!');
                setCouponCode('');
                setShowCoupon(false);
            } else {
                showToastMsg(data.message || 'Invalid coupon', true);
            }
        } catch (error) {
            console.error('Coupon error:', error);
            showToastMsg('Failed to apply coupon', true);
        } finally {
            setUpdating(false);
        }
    };

    const removeCoupon = async () => {
        setUpdating(true);

        try {
            const res = await fetch(`${API}/cart/coupon`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });

            const data = await res.json();

            if (res.ok && data.success) {
                // Process images in response
                if (data.data?.items) {
                    data.data.items = data.data.items.map(item => ({
                        ...item,
                        processedImage: getFullImageUrl(item.image || item.product?.images?.[0])
                    }));
                }
                setCart(data.data);
                showToastMsg('Coupon removed');
            } else {
                fetchCart();
            }
        } catch (error) {
            console.error('Remove coupon error:', error);
            fetchCart();
        } finally {
            setUpdating(false);
        }
    };

    const calculateTotals = (items, coupon) => {
        const items_total = items.reduce((sum, item) => {
            return sum + (parseFloat(item.final_price || item.price || 0) * parseInt(item.quantity || 1));
        }, 0);

        const discount_amount = coupon?.discount_amount || 0;
        const shipping_charge = (items_total - discount_amount) >= 500 ? 0 : 99;
        const final_total = items_total - discount_amount + shipping_charge;
        const item_count = items.reduce((sum, item) => sum + parseInt(item.quantity || 1), 0);

        return {
            items_total: Math.round(items_total * 100) / 100,
            discount_amount: Math.round(discount_amount * 100) / 100,
            shipping_charge: Math.round(shipping_charge * 100) / 100,
            final_total: Math.round(final_total * 100) / 100,
            item_count
        };
    };

    const handleImageError = (itemId) => {
        setImageErrors(prev => ({ ...prev, [itemId]: true }));
    };

    if (loading) return <div className="spinner-container"><div className="spinner" /></div>;

    const items = cart?.items || [];
    const totals = cart?.totals || {};

    // Use cart totals if available, otherwise calculate
    const totalMRP = items.reduce((s, i) => s + ((parseFloat(i.base_price) || parseFloat(i.mrp) || parseFloat(i.final_price) || parseFloat(i.price) || 0) * (i.quantity || 1)), 0);
    const itemsTotal = cart?.items_total !== undefined ? cart.items_total : items.reduce((s, i) => s + ((parseFloat(i.final_price) || parseFloat(i.price) || 0) * (i.quantity || 1)), 0);
    const discountOnMRP = totalMRP - itemsTotal;
    const couponDiscount = cart?.coupon?.discount_amount || 0;
    const shippingCharge = cart?.shipping_charge !== undefined ? cart.shipping_charge : (itemsTotal - couponDiscount >= 500 ? 0 : 99);
    const finalTotal = cart?.final_total !== undefined ? cart.final_total : (itemsTotal - couponDiscount + shippingCharge);
    const itemCount = cart?.item_count !== undefined ? cart.item_count : items.reduce((s, i) => s + (i.quantity || 1), 0);

    return (
        <div className="cart-page">
            <div className="container">
                {/* Progress Steps */}
                <div className="cart-steps">
                    <div className="cart-step active">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
                        </svg>
                        BAG
                    </div>
                    <div className="cart-step-line" />
                    <div className="cart-step">ADDRESS</div>
                    <div className="cart-step-line" />
                    <div className="cart-step">PAYMENT</div>
                </div>

                {items.length === 0 ? (
                    <div className="empty-state" style={{ minHeight: '40vh' }}>
                        <div className="empty-state-icon">🛒</div>
                        <h3 className="empty-state-title">Your bag is empty</h3>
                        <p className="empty-state-text">Looks like you haven't added anything to your bag yet. Start shopping!</p>
                        <Link to="/shop" className="btn-primary" style={{ marginTop: '16px' }}>Continue Shopping</Link>
                    </div>
                ) : (
                    <div className="cart-layout">
                        {/* Cart Items */}
                        <div className="cart-items-section">
                            <div style={{ fontSize: '14px', fontWeight: 600, color: '#535766', marginBottom: '8px' }}>
                                {itemCount} item{itemCount > 1 ? 's' : ''} in your bag
                            </div>

                            {items.map((item, idx) => {
                                const itemId = item.variant_id || item.variantId || idx;
                                const imgUrl = item.processedImage || getFullImageUrl(item.image || item.product?.images?.[0]);
                                const itemPrice = item.final_price || item.price || 0;
                                const originalPrice = item.base_price || item.mrp || Math.round(itemPrice * 1.4);
                                const itemDiscount = originalPrice > itemPrice ? Math.round(((originalPrice - itemPrice) / originalPrice) * 100) : 0;

                                return (
                                    <div className="cart-item" key={itemId}>
                                        <div
                                            className="cart-item-image"
                                            onClick={() => navigate(`/products/${item.slug || item.product_id}`)}
                                        >
                                            <img
                                                src={!imageErrors[itemId] ? imgUrl : '/placeholder-image.png'}
                                                alt={item.product_title || item.name || 'Product'}
                                                onError={() => handleImageError(itemId)}
                                                style={{ maxWidth: '100px', maxHeight: '120px', objectFit: 'cover' }}
                                            />
                                        </div>
                                        <div className="cart-item-details">
                                            <div className="cart-item-brand">{item.brand || 'ZENWAIR'}</div>
                                            <div className="cart-item-name">{item.product_title || item.name || 'Fashion Item'}</div>

                                            <div className="cart-item-meta">
                                                {item.size && <span className="item-size">Size: {item.size}</span>}
                                                {item.color && <span className="item-color">Color: {item.color}</span>}
                                            </div>

                                            <div className="cart-item-price">
                                                <span className="current">₹{(itemPrice * (item.quantity || 1)).toFixed(2)}</span>
                                                {itemDiscount > 0 && (
                                                    <>
                                                        <span className="original">₹{(originalPrice * (item.quantity || 1)).toFixed(2)}</span>
                                                        <span className="off">({itemDiscount}% OFF)</span>
                                                    </>
                                                )}
                                            </div>

                                            <div className="quantity-controls">
                                                <button
                                                    onClick={() => updateQuantity(item.variant_id, item.quantity - 1)}
                                                    disabled={updating || item.quantity <= 1}
                                                    className="quantity-btn"
                                                >
                                                    -
                                                </button>
                                                <span className="quantity">{item.quantity}</span>
                                                <button
                                                    onClick={() => updateQuantity(item.variant_id, item.quantity + 1)}
                                                    disabled={updating}
                                                    className="quantity-btn"
                                                >
                                                    +
                                                </button>
                                            </div>

                                            <div className="cart-item-actions">
                                                <button
                                                    onClick={() => removeItem(item.variant_id)}
                                                    disabled={updating}
                                                >
                                                    ✕ Remove
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}

                            {/* Coupon Section */}
                            <div className="cart-coupon">
                                <div className="cart-coupon-header">
                                    <span>🏷️ Apply Coupon</span>
                                    <button onClick={() => setShowCoupon(!showCoupon)}>
                                        {showCoupon ? 'CLOSE' : 'APPLY'}
                                    </button>
                                </div>

                                {showCoupon && (
                                    <div className="cart-coupon-input">
                                        <input
                                            type="text"
                                            placeholder="Enter coupon code"
                                            value={couponCode}
                                            onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                                            disabled={updating}
                                        />
                                        <button
                                            onClick={applyCoupon}
                                            disabled={updating || !couponCode.trim()}
                                        >
                                            APPLY
                                        </button>
                                    </div>
                                )}

                                {cart?.coupon && (
                                    <div className="applied-coupon">
                                        <span>✅ {cart.coupon.code} applied (Saved ₹{cart.coupon.discount_amount})</span>
                                        <button
                                            onClick={removeCoupon}
                                            disabled={updating}
                                        >
                                            Remove
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Price Summary */}
                        <div className="cart-summary">
                            <h3 className="cart-summary-title">Price Details ({itemCount} Item{itemCount > 1 ? 's' : ''})</h3>

                            <div className="cart-summary-row">
                                <span>Total MRP</span>
                                <span>₹{totalMRP.toFixed(2)}</span>
                            </div>

                            {discountOnMRP > 0 && (
                                <div className="cart-summary-row discount">
                                    <span>Discount on MRP</span>
                                    <span>-₹{discountOnMRP.toFixed(2)}</span>
                                </div>
                            )}

                            {couponDiscount > 0 && (
                                <div className="cart-summary-row discount">
                                    <span>Coupon Discount</span>
                                    <span>-₹{couponDiscount.toFixed(2)}</span>
                                </div>
                            )}

                            <div className="cart-summary-row">
                                <span>Delivery Fee</span>
                                <span style={{ color: shippingCharge === 0 ? '#03a685' : '#ff3f6c', fontWeight: 600 }}>
                                    {shippingCharge === 0 ? (
                                        <>
                                            <span style={{ textDecoration: 'line-through', color: '#94969f', marginRight: '4px' }}>₹99</span>
                                            FREE
                                        </>
                                    ) : (
                                        `₹${shippingCharge.toFixed(2)}`
                                    )}
                                </span>
                            </div>

                            <div className="cart-summary-row total">
                                <span>Total Amount</span>
                                <span>₹{finalTotal.toFixed(2)}</span>
                            </div>

                            <button
                                className="btn-place-order"
                                onClick={() => navigate('/checkout')}
                                disabled={updating}
                            >
                                {updating ? 'Updating...' : 'Place Order'}
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {toast && (
                <div className={`toast show ${toast.includes('Failed') || toast.includes('Invalid') ? 'error' : 'success'}`}>
                    {toast}
                </div>
            )}
        </div>
    );
};

export default Cart;