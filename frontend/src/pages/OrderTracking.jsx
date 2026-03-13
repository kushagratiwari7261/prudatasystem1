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
    const [reviewModalOpen, setReviewModalOpen] = useState(false);
    const [reviewProduct, setReviewProduct] = useState(null);
    const [reviewData, setReviewData] = useState({ rating: 5, comment: '' });
    const [submittingReview, setSubmittingReview] = useState(false);
    
    const token = localStorage.getItem('accessToken');

    const fetchOrder = async () => {
        try {
            const res = await fetch(`${API}/orders/${id}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const d = await res.json();
            setOrder(d.data || d);
            setLoading(false);
        } catch (err) {
            console.error('Fetch order error:', err);
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchOrder();
    }, [id, token]);

    const handleOpenReview = (item) => {
        setReviewProduct(item);
        if (item.user_review) {
            setReviewData({
                rating: item.user_review.rating,
                comment: item.user_review.comment || ''
            });
        } else {
            setReviewData({ rating: 5, comment: '' });
        }
        setReviewModalOpen(true);
    };

    const handleSubmitReview = async (e) => {
        e.preventDefault();
        if (!reviewData.rating) return alert('Please provide a star rating.');
        
        setSubmittingReview(true);
        try {
            const res = await fetch(`${API}/reviews`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    product_id: reviewProduct.product_id || reviewProduct.product?.id,
                    rating: reviewData.rating,
                    comment: reviewData.comment
                })
            });
            const data = await res.json();
            if (data.success) {
                toast?.success ? toast.success('Review updated!') : alert('Thank you for your review!');
                setReviewModalOpen(false);
                fetchOrder(); // Refresh to show new review content
            } else {
                alert(data.message || 'Failed to submit review');
            }
        } catch (error) {
            alert('Failed to submit review. Server error.');
            console.error(error);
        } finally {
            setSubmittingReview(false);
        }
    };

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
                                
                                // Group any history logs belonging to this status step
                                const historyLogs = (order.status_history || []).filter(h => h.status === s);

                                return (
                                    <div key={s} className={`tracking-step ${isActive ? 'active' : ''} ${isCurrent ? 'current' : ''}`}>
                                        <div className="tracking-step-dot" />
                                        <div className="tracking-step-title">{statusLabels[s]}</div>
                                        
                                        {/* Render history logs if any exist for this status, else show default state */}
                                        {historyLogs.length > 0 ? (
                                            <div className="tracking-step-logs" style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                                {historyLogs.map((log, i) => (
                                                    <div key={i} style={{ fontSize: '12px', background: '#f8fafc', padding: '8px', borderRadius: '4px', border: '1px solid #e2e8f0' }}>
                                                        <div style={{ color: '#64748b', fontWeight: 600, marginBottom: '2px' }}>
                                                            {new Date(log.created_at).toLocaleString('en-IN', {
                                                                day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
                                                            })}
                                                        </div>
                                                        {log.location && <div style={{ fontWeight: 600, color: '#0f172a' }}>📍 {log.location}</div>}
                                                        {log.note && <div style={{ color: '#334155', marginTop: '2px' }}>{log.note}</div>}
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <div className="tracking-step-date">
                                                {isActive
                                                    ? (isCurrent ? 'Current Status' : '✓ Completed')
                                                    : 'Upcoming'}
                                            </div>
                                        )}
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
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: '6px' }}>
                                        <div>
                                            <div style={{ fontWeight: 700 }}>₹{item.price || item.total || 0}</div>
                                            {item.user_review && (
                                                <div style={{ marginTop: '8px', fontSize: '12px', background: '#f8fafc', padding: '8px', borderRadius: '4px', border: '1px solid #e2e8f0' }}>
                                                    <div style={{ color: '#ff9900', fontWeight: 700, marginBottom: '2px' }}>
                                                        {'★'.repeat(item.user_review.rating)}{'☆'.repeat(5 - item.user_review.rating)}
                                                    </div>
                                                    {item.user_review.comment && <div style={{ color: '#535766', fontStyle: 'italic' }}>"{item.user_review.comment}"</div>}
                                                </div>
                                            )}
                                        </div>
                                        {status === 'delivered' && (
                                            <button 
                                                className="btn-secondary" 
                                                style={{ padding: '6px 12px', fontSize: '12px', border: '1px solid #ff3f6c', color: '#ff3f6c' }}
                                                onClick={() => handleOpenReview(item)}
                                            >
                                                {item.user_review ? '✎ Edit Review' : '★ Rate & Review'}
                                            </button>
                                        )}
                                    </div>
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

            {/* Review Modal */}
            {reviewModalOpen && reviewProduct && (
                <div className="modal-overlay">
                    <div className="modal" style={{ maxWidth: '400px', width: '90%' }}>
                        <div className="modal-header">
                            <h3 className="modal-title">{reviewProduct.user_review ? 'Edit Your Review' : 'Rate Product'}</h3>
                            <button className="modal-close" onClick={() => setReviewModalOpen(false)}>×</button>
                        </div>
                        <form onSubmit={handleSubmitReview} className="modal-body">
                            <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', alignItems: 'center' }}>
                                <img 
                                    src={getFullImageUrl(reviewProduct.image_url || reviewProduct.image || reviewProduct.product?.images?.[0]?.url)} 
                                    alt="Product" 
                                    style={{ width: '60px', height: '80px', objectFit: 'cover', borderRadius: '4px' }}
                                />
                                <div>
                                    <div style={{ fontSize: '13px', fontWeight: 700 }}>{reviewProduct.brand || reviewProduct.product?.brand?.name}</div>
                                    <div style={{ fontSize: '14px', color: '#535766', lineHeight: 1.4 }}>{reviewProduct.product_name || reviewProduct.name || reviewProduct.product?.name}</div>
                                </div>
                            </div>

                            <div className="form-group" style={{ textAlign: 'center' }}>
                                <label className="form-label">How would you rate this?</label>
                                <div style={{ display: 'flex', justifyContent: 'center', gap: '10px', fontSize: '32px', margin: '16px 0', cursor: 'pointer' }}>
                                    {[1, 2, 3, 4, 5].map(star => (
                                        <span 
                                            key={star} 
                                            onClick={() => setReviewData(prev => ({ ...prev, rating: star }))}
                                            style={{ color: star <= reviewData.rating ? '#ff9900' : '#d4d5d9' }}
                                        >
                                            ★
                                        </span>
                                    ))}
                                </div>
                            </div>

                            <div className="form-group">
                                <label className="form-label">Write your review (Optional)</label>
                                <textarea
                                    className="form-input"
                                    rows="4"
                                    placeholder="What did you like or dislike about the product?"
                                    value={reviewData.comment}
                                    onChange={(e) => setReviewData(prev => ({ ...prev, comment: e.target.value }))}
                                />
                            </div>

                            <button type="submit" className="btn-primary" style={{ width: '100%', marginTop: '16px' }} disabled={submittingReview}>
                                {submittingReview ? 'Submitting...' : 'Submit Review'}
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default OrderTracking;
