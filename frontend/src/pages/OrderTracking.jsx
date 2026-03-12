import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';

const API = 'http://localhost:5000/api/v1';

// Image helper function
const getFullImageUrl = (imagePath) => {
    if (!imagePath) return '/placeholder-image.png';
    if (imagePath.startsWith('http')) return imagePath;
    if (imagePath.startsWith('/uploads')) return `http://localhost:5000${imagePath}`;
    return `http://localhost:5000/uploads/products/${imagePath}`;
};

const statusOrder = ['pending', 'confirmed', 'processing', 'shipped', 'out_for_delivery', 'delivered'];
const statusLabels = {
    pending: 'Order Placed',
    confirmed: 'Order Confirmed',
    processing: 'Processing',
    shipped: 'Shipped',
    out_for_delivery: 'Out for Delivery',
    delivered: 'Delivered',
    cancelled: 'Cancelled'
};

const OrderTracking = () => {
    const { id } = useParams();
    const [order, setOrder] = useState(null);
    const [loading, setLoading] = useState(true);
    const token = localStorage.getItem('accessToken');

    useEffect(() => {
        fetch(`${API}/orders/${id}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        })
            .then(r => r.json())
            .then(d => {
                setOrder(d.data || d);
                setLoading(false);
            })
            .catch(() => setLoading(false));
    }, [id]);

    if (loading) return <div className="spinner-container"><div className="spinner" /></div>;

    if (!order) {
        return (
            <div className="empty-state" style={{ minHeight: '60vh' }}>
                <div className="empty-state-icon">📦</div>
                <h3 className="empty-state-title">Order Not Found</h3>
                <Link to="/orders" className="btn-primary" style={{ marginTop: '16px' }}>View All Orders</Link>
            </div>
        );
    }

    const items = order.items || order.orderItems || [];
    const status = (order.status || 'pending').toLowerCase();
    const currentStep = statusOrder.indexOf(status);
    const isCancelled = status === 'cancelled';
    const orderDate = order.createdAt ? new Date(order.createdAt).toLocaleDateString('en-IN', {
        day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
    }) : '';

    return (
        <div className="container tracking-page">
            <div className="pdp-breadcrumb" style={{ paddingTop: '16px' }}>
                <Link to="/">Home</Link> <span>/</span>
                <Link to="/orders">Orders</Link> <span>/</span>
                <span style={{ color: '#282c3f', fontWeight: 600 }}>#{(order.id || '').slice(0, 8).toUpperCase()}</span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: '32px', marginTop: '16px' }}>
                {/* Timeline */}
                <div>
                    <h1 style={{ fontSize: '22px', fontWeight: 800, marginBottom: '8px' }}>
                        Order #{(order.id || '').slice(0, 8).toUpperCase()}
                    </h1>
                    <p style={{ fontSize: '14px', color: '#94969f', marginBottom: '32px' }}>
                        Placed on {orderDate}
                    </p>

                    {isCancelled ? (
                        <div style={{
                            background: '#fce4ec',
                            padding: '20px',
                            borderRadius: '8px',
                            textAlign: 'center',
                            marginBottom: '24px'
                        }}>
                            <div style={{ fontSize: '36px', marginBottom: '8px' }}>❌</div>
                            <div style={{ fontSize: '16px', fontWeight: 700, color: '#ff3f6c' }}>Order Cancelled</div>
                            <p style={{ fontSize: '13px', color: '#535766', marginTop: '4px' }}>
                                This order has been cancelled. Refund will be processed within 5-7 business days.
                            </p>
                        </div>
                    ) : (
                        <div className="tracking-timeline">
                            {statusOrder.map((s, idx) => {
                                const isActive = idx <= currentStep;
                                const isCurrent = idx === currentStep;
                                return (
                                    <div key={s} className={`tracking-step ${isActive ? 'active' : ''} ${isCurrent ? 'current' : ''}`}>
                                        <div className="tracking-step-dot" />
                                        <div className="tracking-step-title">{statusLabels[s]}</div>
                                        <div className="tracking-step-date">
                                            {isActive
                                                ? (isCurrent ? 'Current Status' : '✓ Completed')
                                                : 'Upcoming'}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {/* Items */}
                    <h3 style={{ fontSize: '16px', fontWeight: 700, textTransform: 'uppercase', marginBottom: '16px', marginTop: '24px' }}>
                        Order Items
                    </h3>
                    {items.map((item, idx) => {
                        const imgUrl = getFullImageUrl(item.image_url || item.image || item.product?.images?.[0]?.url);
                        return (
                            <div key={idx} style={{
                                display: 'flex',
                                gap: '16px',
                                padding: '16px',
                                border: '1px solid #eaeaec',
                                borderRadius: '8px',
                                marginBottom: '12px'
                            }}>
                                <div style={{ width: '80px', height: '106px', borderRadius: '4px', overflow: 'hidden', background: '#f5f5f6', flexShrink: 0 }}>
                                    <img src={imgUrl} alt={item.product_name || item.name || 'Product'} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                </div>
                                <div>
                                    <div style={{ fontWeight: 700, marginBottom: '2px' }}>{item.brand || item.product?.brand?.name || 'ZENWAIR'}</div>
                                    <div style={{ fontSize: '14px', color: '#7e818c', marginBottom: '4px' }}>{item.product_name || item.name || item.product?.name || 'Fashion Item'}</div>
                                    <div style={{ fontSize: '13px', color: '#94969f' }}>
                                        {item.size && `Size: ${item.size}`} {item.quantity && `• Qty: ${item.quantity}`}
                                    </div>
                                    <div style={{ fontWeight: 700, marginTop: '6px' }}>₹{item.price || item.total || 0}</div>
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Order Summary */}
                <div>
                    <div className="cart-summary">
                        <h3 className="cart-summary-title">Order Summary</h3>
                        <div className="cart-summary-row">
                            <span>Items Total</span>
                            <span>₹{order.items_total || order.total || order.totalAmount || items.reduce((s, i) => s + (i.price || 999) * (i.quantity || 1), 0)}</span>
                        </div>
                        
                        {(order.discount_amount > 0 || order.coupon_code) && (
                            <div className="cart-summary-row discount">
                                <span>{order.coupon_code ? `Coupon (${order.coupon_code})` : 'Discount'}</span>
                                <span>-₹{order.discount_amount}</span>
                            </div>
                        )}
                        
                        <div className="cart-summary-row">
                            <span>Delivery Fee</span>
                            <span style={{ color: order.shipping_charge === '0.00' || order.shipping_charge === 0 ? '#03a685' : '#ff3f6c', fontWeight: 600 }}>
                                {order.shipping_charge === '0.00' || order.shipping_charge === 0 ? 'FREE' : `₹${order.shipping_charge}`}
                            </span>
                        </div>
                        
                        <div className="cart-summary-row total">
                            <span>Total Paid</span>
                            <span>₹{order.total_amount || order.total || order.totalAmount || 0}</span>
                        </div>
                        <div className="cart-summary-row" style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px dashed #eaeaec' }}>
                            <span>Payment Method</span>
                            <span style={{ textTransform: 'uppercase', fontWeight: 600 }}>{order.paymentMethod || order.payment_method || 'N/A'}</span>
                        </div>
                        <div className="cart-summary-row">
                            <span>Payment Status</span>
                            <span style={{
                                color: ['paid', 'success'].includes((order.paymentStatus || order.payment_status || '').toLowerCase()) ? '#03a685' : '#ff3f6c',
                                fontWeight: 700,
                                textTransform: 'uppercase'
                            }}>
                                {order.paymentStatus || order.payment_status || 'pending'}
                            </span>
                        </div>
                    </div>

                    {/* Delivery Address */}
                    {order.address && (
                        <div className="cart-summary" style={{ marginTop: '16px' }}>
                            <h3 className="cart-summary-title">Delivery Address</h3>
                            <div style={{ fontSize: '14px', fontWeight: 600 }}>{order.address.name}</div>
                            <div style={{ fontSize: '13px', color: '#535766', lineHeight: 1.6 }}>
                                {order.address.addressLine1}<br />
                                {order.address.addressLine2 && <>{order.address.addressLine2}<br /></>}
                                {order.address.city}, {order.address.state} — {order.address.pincode}
                            </div>
                            {order.address.phone && (
                                <div style={{ fontSize: '13px', color: '#535766', marginTop: '8px' }}>
                                    📞 {order.address.phone}
                                </div>
                            )}
                        </div>
                    )}

                    <Link to="/orders" className="btn-secondary" style={{ width: '100%', textAlign: 'center', display: 'block', marginTop: '16px' }}>
                        ← Back to Orders
                    </Link>
                </div>
            </div>
        </div>
    );
};

export default OrderTracking;
