import React, { useState, useEffect, useCallback } from 'react';
import Sidebar from '../components/Sidebar';
import styles from './Orders.module.css';

const API = 'http://localhost:5000/api/v1';

const VALID_NEXT = {
    pending: ['pending', 'confirmed', 'cancelled'],
    confirmed: ['confirmed', 'processing', 'cancelled'],
    processing: ['processing', 'packed', 'cancelled'],
    packed: ['packed', 'shipped', 'cancelled'],
    shipped: ['shipped', 'out_for_delivery'],
    out_for_delivery: ['out_for_delivery', 'delivered'],
    delivered: ['delivered'],
    cancelled: ['cancelled'],
    refunded: ['refunded']
};

const STATUS_COLORS = {
    pending: '#f59e0b', confirmed: '#3b82f6', processing: '#8b5cf6',
    packed: '#f97316', shipped: '#6366f1', out_for_delivery: '#14b8a6',
    delivered: '#22c55e', cancelled: '#ef4444', refunded: '#6b7280',
    paid: '#22c55e', failed: '#ef4444'
};

const Orders = () => {
    const [orders, setOrders] = useState([]);
    const [pagination, setPagination] = useState({ total: 0, pages: 1 });
    const [loading, setLoading] = useState(true);
    const [statusFilter, setStatusFilter] = useState('all');
    const [page, setPage] = useState(1);
    const [selectedOrder, setSelectedOrder] = useState(null);
    const [updateStatus, setUpdateStatus] = useState('');
    const [updateNote, setUpdateNote] = useState('');
    const [updateLocation, setUpdateLocation] = useState('');
    const [updating, setUpdating] = useState(false);
    const [deletingOrders, setDeletingOrders] = useState({}); // Track deletion per order
    const [notification, setNotification] = useState(null);

    const token = localStorage.getItem('adminToken');
    const headers = { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };

    const showNotification = (message, type = 'success') => {
        setNotification({ message, type });
        setTimeout(() => setNotification(null), 3000);
    };

    const fetchOrders = useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams({ page, limit: 20 });
            if (statusFilter !== 'all') params.set('status', statusFilter);
            const res = await fetch(`${API}/orders/admin/all?${params}`, { headers });
            const data = await res.json();
            setOrders(data.data?.orders || []);
            setPagination(data.data?.pagination || { total: 0, pages: 1 });
        } catch (err) {
            console.error('Fetch orders error:', err);
            showNotification('Failed to fetch orders', 'error');
        } finally {
            setLoading(false);
        }
    }, [page, statusFilter, token]);

    useEffect(() => { fetchOrders(); }, [fetchOrders]);

    const handleUpdateStatus = async () => {
        if (!selectedOrder || !updateStatus) return;
        setUpdating(true);
        try {
            const res = await fetch(`${API}/orders/${selectedOrder.id}/status`, {
                method: 'PUT',
                headers,
                body: JSON.stringify({
                    status: updateStatus,
                    note: updateNote || undefined,
                    location: updateLocation || undefined
                })
            });

            const data = await res.json();

            if (res.ok && data.success) {
                showNotification('Order status updated successfully');
                setSelectedOrder(null);
                setUpdateStatus('');
                setUpdateNote('');
                setUpdateLocation('');
                fetchOrders();
            } else {
                showNotification(data.message || 'Update failed', 'error');
            }
        } catch (err) {
            console.error('Update error:', err);
            showNotification('Network error', 'error');
        } finally {
            setUpdating(false);
        }
    };

    const handleDeleteOrder = async (orderId) => {
        if (!window.confirm('Are you sure you want to delete this order? This action cannot be undone.')) {
            return;
        }

        // Mark this specific order as deleting
        setDeletingOrders(prev => ({ ...prev, [orderId]: true }));

        try {
            const res = await fetch(`${API}/orders/${orderId}`, {
                method: 'DELETE',
                headers
            });

            const data = await res.json();

            if (res.ok && data.success) {
                showNotification('Order deleted successfully');
                // Remove order from local state immediately
                setOrders(prevOrders => prevOrders.filter(order => order.id !== orderId));
                // Refresh orders to update pagination
                fetchOrders();
            } else {
                if (res.status === 404) {
                    showNotification('Order not found', 'error');
                } else if (res.status === 400 && data.message?.includes('delivered')) {
                    showNotification('Cannot delete delivered orders', 'error');
                } else {
                    showNotification(data.message || 'Failed to delete order', 'error');
                }
            }
        } catch (err) {
            console.error('Delete error:', err);
            showNotification('Network error - please check your connection', 'error');
        } finally {
            // Remove the deleting state for this order
            setDeletingOrders(prev => {
                const newState = { ...prev };
                delete newState[orderId];
                return newState;
            });
        }
    };

    const statusBadge = (status) => {
        const color = STATUS_COLORS[status] || '#6b7280';
        return (
            <span style={{
                background: `${color}18`,
                color: color,
                padding: '4px 10px',
                borderRadius: '6px',
                fontSize: '11px',
                fontWeight: 700,
                textTransform: 'uppercase',
                whiteSpace: 'nowrap'
            }}>
                {status?.replace(/_/g, ' ')}
            </span>
        );
    };

    return (
        <div style={{ display: 'flex' }}>
            <Sidebar />
            <main className={styles.main}>
                {/* Notification */}
                {notification && (
                    <div style={{
                        position: 'fixed', top: 20, right: 20, zIndex: 9999,
                        padding: '14px 24px', borderRadius: '10px',
                        background: notification.type === 'error' ? '#fee2e2' : '#dcfce7',
                        color: notification.type === 'error' ? '#dc2626' : '#16a34a',
                        fontWeight: 600, fontSize: '14px',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                        animation: 'fadeIn 0.3s ease'
                    }}>
                        {notification.message}
                    </div>
                )}

                <div className={styles.header}>
                    <h1 className={styles.title}>Orders Management</h1>
                    <div className={styles.filters}>
                        {['all', 'pending', 'confirmed', 'processing', 'packed', 'shipped', 'delivered', 'cancelled'].map(s => (
                            <button
                                key={s}
                                className={`${styles.filterBtn} ${statusFilter === s ? styles.active : ''}`}
                                onClick={() => { setStatusFilter(s); setPage(1); }}
                            >
                                {s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
                            </button>
                        ))}
                    </div>
                </div>

                <div className={styles.tableWrap}>
                    {loading ? (
                        <div className={styles.empty}>Loading orders...</div>
                    ) : orders.length === 0 ? (
                        <div className={styles.empty}>No orders found</div>
                    ) : (
                        <table className={styles.table}>
                            <thead>
                                <tr>
                                    <th>Order ID</th>
                                    <th>Customer</th>
                                    <th>Items</th>
                                    <th>Total MRP</th>
                                    <th>Discount</th>
                                    <th>Shipping</th>
                                    <th>Final Amount</th>
                                    <th>Method</th>
                                    <th>Order Status</th>
                                    <th>Payment</th>
                                    <th>Date</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {orders.map(order => {
                                    const isDeleting = deletingOrders[order.id];

                                    return (
                                        <tr key={order.id} style={{ opacity: isDeleting ? 0.6 : 1 }}>
                                            <td className={styles.mono}>{order.id?.slice(0, 8)}...</td>
                                            <td>{order.user_name || order.user_email || '—'}</td>
                                            <td>{order.item_count || '—'}</td>
                                            <td className={styles.amount}>₹{(order.items_total || order.total_amount || 0)}</td>
                                            <td className={styles.amount} style={{ color: order.discount_amount > 0 ? '#16a34a' : 'inherit' }}>
                                                {order.discount_amount > 0 ? `-₹${order.discount_amount}${order.coupon_code ? ` (${order.coupon_code})` : ''}` : '—'}
                                            </td>
                                            <td className={styles.amount} style={{ color: order.shipping_charge == 0 ? '#16a34a' : 'inherit' }}>
                                                {order.shipping_charge == 0 ? 'FREE' : `₹${order.shipping_charge}`}
                                            </td>
                                            <td className={styles.amount} style={{ fontWeight: 700 }}>₹{order.total_amount}</td>
                                            <td>{statusBadge(order.payment_method === 'cod' ? 'COD' : 'Online')}</td>
                                            <td>{statusBadge(order.status)}</td>
                                            <td>{statusBadge(order.payment_status)}</td>
                                            <td className={styles.date}>{new Date(order.created_at).toLocaleDateString()}</td>
                                            <td>
                                                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                                    {VALID_NEXT[order.status]?.length > 0 && !isDeleting && (
                                                        <button
                                                            className={styles.updateBtn}
                                                            onClick={() => {
                                                                setSelectedOrder(order);
                                                                setUpdateStatus(VALID_NEXT[order.status][0]);
                                                            }}
                                                            disabled={updating}
                                                        >
                                                            Update
                                                        </button>
                                                    )}
                                                    <button
                                                        className={styles.deleteBtn}
                                                        onClick={() => handleDeleteOrder(order.id)}
                                                        disabled={isDeleting}
                                                        style={{
                                                            padding: '6px 12px',
                                                            background: '#fee2e2',
                                                            border: '1px solid #fecaca',
                                                            borderRadius: '6px',
                                                            fontSize: '12px',
                                                            fontWeight: 600,
                                                            cursor: isDeleting ? 'not-allowed' : 'pointer',
                                                            color: '#dc2626',
                                                            opacity: isDeleting ? 0.5 : 1,
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            gap: '4px'
                                                        }}
                                                        title="Delete order"
                                                    >
                                                        {isDeleting ? '⏳' : '🗑️'}
                                                        {isDeleting ? 'Deleting...' : ''}
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    )}
                </div>

                {/* Pagination */}
                {pagination.pages > 1 && (
                    <div className={styles.pagination}>
                        <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className={styles.pageBtn}>← Prev</button>
                        <span className={styles.pageInfo}>Page {page} of {pagination.pages} ({pagination.total} total)</span>
                        <button disabled={page >= pagination.pages} onClick={() => setPage(p => p + 1)} className={styles.pageBtn}>Next →</button>
                    </div>
                )}

                {/* Update Modal */}
                {selectedOrder && (
                    <div className={styles.modalOverlay} onClick={() => setSelectedOrder(null)}>
                        <div className={styles.modal} onClick={e => e.stopPropagation()}>
                            <h2 className={styles.modalTitle}>Update Order Status</h2>
                            <p className={styles.modalSub}>Order: {selectedOrder.id?.slice(0, 8)}...</p>

                            <div className={styles.modalCurrent}>
                                Current: {statusBadge(selectedOrder.status)}
                            </div>

                            <div className={styles.modalField}>
                                <label>New Status</label>
                                <select value={updateStatus} onChange={e => setUpdateStatus(e.target.value)}>
                                    {VALID_NEXT[selectedOrder.status]?.map(s => (
                                        <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, ' ')}</option>
                                    ))}
                                </select>
                            </div>

                            <div className={styles.modalField}>
                                <label>Note (optional)</label>
                                <input type="text" value={updateNote} onChange={e => setUpdateNote(e.target.value)} placeholder="e.g. Shipped via BlueDart" />
                            </div>

                            <div className={styles.modalField}>
                                <label>Location (optional)</label>
                                <input type="text" value={updateLocation} onChange={e => setUpdateLocation(e.target.value)} placeholder="e.g. Mumbai Hub" />
                            </div>

                            <div className={styles.modalActions}>
                                <button className={styles.cancelBtn} onClick={() => setSelectedOrder(null)}>Cancel</button>
                                <button className={styles.submitBtn} onClick={handleUpdateStatus} disabled={updating}>
                                    {updating ? 'Updating...' : 'Update Status'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
};

export default Orders;