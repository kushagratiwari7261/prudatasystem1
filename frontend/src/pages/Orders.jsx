import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

const API = 'http://localhost:5000/api/v1';

const statusStyles = {
    delivered: 'delivered',
    processing: 'processing',
    shipped: 'shipped',
    cancelled: 'cancelled',
    pending: 'pending',
    confirmed: 'processing',
    'out_for_delivery': 'shipped',
};

// Image helper function
const getFullImageUrl = (imagePath) => {
    if (!imagePath) return '/placeholder-image.png';
    if (imagePath.startsWith('http')) return imagePath;
    if (imagePath.startsWith('/uploads')) return `http://localhost:5000${imagePath}`;
    return `http://localhost:5000/uploads/products/${imagePath}`;
};

const Orders = () => {
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('all');
    const token = localStorage.getItem('accessToken');

    useEffect(() => {
        fetch(`${API}/orders`, {
            headers: { 'Authorization': `Bearer ${token}` }
        })
            .then(r => {
                if (r.status === 401) {
                    localStorage.removeItem('accessToken');
                    localStorage.removeItem('refreshToken');
                    localStorage.removeItem('user');
                    window.location.href = '/login';
                    return { data: [] };
                }
                return r.json();
            })
            .then(d => {
                setOrders(d.data?.orders || d.data || []);
                setLoading(false);
            })
            .catch(() => setLoading(false));
    }, []);

    const filteredOrders = filter === 'all'
        ? orders
        : orders.filter(o => (o.status || '').toLowerCase() === filter);

    const handleCancel = async (orderId) => {
        if (!window.confirm('Are you sure you want to cancel this order?')) return;
        try {
            const res = await fetch(`${API}/orders/${orderId}/cancel`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: 'cancelled' } : o));
            }
        } catch { }
    };

    if (loading) return <div className="spinner-container"><div className="spinner" /></div>;

    return (
        <div className="container orders-page">
            <div className="orders-header">
                <h1 className="orders-title">My Orders</h1>
                <div className="orders-filter">
                    <select value={filter} onChange={(e) => setFilter(e.target.value)}>
                        <option value="all">All Orders</option>
                        <option value="pending">Pending</option>
                        <option value="processing">Processing</option>
                        <option value="shipped">Shipped</option>
                        <option value="delivered">Delivered</option>
                        <option value="cancelled">Cancelled</option>
                    </select>
                </div>
            </div>

            {filteredOrders.length === 0 ? (
                <div className="empty-state" style={{ minHeight: '40vh' }}>
                    <div className="empty-state-icon">📦</div>
                    <h3 className="empty-state-title">No orders yet</h3>
                    <p className="empty-state-text">
                        {filter === 'all'
                            ? "You haven't placed any orders yet. Start shopping!"
                            : `No ${filter} orders found.`}
                    </p>
                    <Link to="/shop" className="btn-primary" style={{ marginTop: '16px' }}>Shop Now</Link>
                </div>
            ) : (
                filteredOrders.map(order => {
                    const items = order.items || order.orderItems || [];
                    const status = (order.status || 'pending').toLowerCase();
                    const statusClass = statusStyles[status] || 'pending';
                    const orderDate = order.createdAt ? new Date(order.createdAt).toLocaleDateString('en-IN', {
                        day: 'numeric', month: 'short', year: 'numeric'
                    }) : '';

                    return (
                        <div className="order-card" key={order.id}>
                            <div className="order-card-header">
                                <div>
                                    <div className="order-id">Order #{(order.id || '').slice(0, 8).toUpperCase()}</div>
                                    <div className="order-date">Placed on {orderDate} | Payment: {(order.paymentStatus || order.payment_status || 'pending').toUpperCase()}</div>
                                </div>
                                <span className={`order-status ${statusClass}`}>
                                    {status === 'delivered' && '✓ '}
                                    {status.replace(/_/g, ' ').charAt(0).toUpperCase() + status.replace(/_/g, ' ').slice(1)}
                                </span>
                            </div>

                            <div className="order-items">
                                {items.slice(0, 3).map((item, idx) => {
                                    const imgUrl = getFullImageUrl(item.image_url || item.image || item.product?.images?.[0]?.url);
                                    return (
                                        <div className="order-item" key={idx}>
                                            <div className="order-item-image">
                                                <img src={imgUrl} alt={item.product_name || item.name || item.product?.name || 'Product'} />
                                            </div>
                                            <div className="order-item-info">
                                                <div className="order-item-brand">{item.brand || item.product?.brand?.name || 'ZENWAIR'}</div>
                                                <div className="order-item-name">{item.product_name || item.name || item.product?.name || 'Fashion Item'}</div>
                                                <div style={{ fontSize: '13px', color: '#7e818c' }}>
                                                    {item.size && `Size: ${item.size}`} {item.quantity && `× ${item.quantity}`}
                                                </div>
                                                <div className="order-item-price">₹{item.price || item.total || 0}</div>
                                            </div>
                                        </div>
                                    );
                                })}
                                {items.length > 3 && (
                                    <div style={{ fontSize: '13px', color: '#535766', alignSelf: 'center' }}>
                                        +{items.length - 3} more item{items.length - 3 > 1 ? 's' : ''}
                                    </div>
                                )}
                            </div>

                            <div className="order-card-footer">
                                <div className="order-total">
                                    Total: ₹{order.total_amount || order.totalAmount || order.total || 0}
                                </div>
                                <div style={{ display: 'flex', gap: '8px' }}>
                                    {['pending', 'processing', 'confirmed'].includes(status) && (
                                        <button
                                            className="btn-secondary"
                                            style={{ padding: '8px 16px', fontSize: '12px' }}
                                            onClick={() => handleCancel(order.id)}
                                        >
                                            Cancel
                                        </button>
                                    )}
                                    <Link to={`/orders/${order.id}`} className="order-track-btn">
                                        {status === 'delivered' ? 'View Details' : 'Track Order'}
                                    </Link>
                                </div>
                            </div>
                        </div>
                    );
                })
            )}
        </div>
    );
};

export default Orders;
