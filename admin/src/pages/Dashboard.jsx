import React, { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import './Dashboard.module.css';

const API = 'http://10.184.34.191:5000/api/v1';

const Dashboard = () => {
    const [stats, setStats] = useState({ total: 0, pending: 0, revenue: 0, customers: 0 });
    const [recentOrders, setRecentOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const token = localStorage.getItem('adminToken');

    const headers = { 'Authorization': `Bearer ${token}` };

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [allRes, pendingRes, recentRes] = await Promise.all([
                    fetch(`${API}/orders/admin/all?limit=1`, { headers }),
                    fetch(`${API}/orders/admin/all?status=pending&limit=1`, { headers }),
                    fetch(`${API}/orders/admin/all?limit=5`, { headers })
                ]);

                const allData = await allRes.json();
                const pendingData = await pendingRes.json();
                const recentData = await recentRes.json();

                setStats({
                    total: allData.data?.pagination?.total || 0,
                    pending: pendingData.data?.pagination?.total || 0,
                    revenue: 0,
                    customers: 0
                });

                setRecentOrders(recentData.data?.orders || []);
            } catch (err) {
                console.error('Dashboard fetch error:', err);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    const statusColor = (s) => {
        const map = {
            pending: '#f59e0b', confirmed: '#3b82f6', processing: '#8b5cf6',
            packed: '#f97316', shipped: '#6366f1', out_for_delivery: '#14b8a6',
            delivered: '#22c55e', cancelled: '#ef4444', refunded: '#6b7280'
        };
        return map[s] || '#6b7280';
    };

    return (
        <div style={{ display: 'flex' }}>
            <Sidebar />
            <main style={{ marginLeft: 240, flex: 1, padding: '32px', minHeight: '100vh', background: '#f1f5f9' }}>
                <h1 style={{ fontSize: '24px', fontWeight: 800, color: '#0f172a', marginBottom: '8px' }}>Dashboard</h1>
                <p style={{ color: '#64748b', fontSize: '14px', marginBottom: '32px' }}>
                    Welcome back, {JSON.parse(localStorage.getItem('adminUser') || '{}').name || 'Admin'}
                </p>

                {/* Stats Cards */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px', marginBottom: '40px' }}>
                    {[
                        { label: 'Total Orders', value: stats.total, color: '#3b82f6', bg: '#eff6ff' },
                        { label: 'Pending Orders', value: stats.pending, color: '#f59e0b', bg: '#fffbeb' },
                        { label: "Today's Revenue", value: `₹${stats.revenue}`, color: '#22c55e', bg: '#f0fdf4' },
                        { label: 'Total Customers', value: stats.customers, color: '#8b5cf6', bg: '#faf5ff' }
                    ].map(card => (
                        <div key={card.label} style={{
                            background: 'white',
                            borderRadius: '14px',
                            padding: '24px',
                            boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                            border: '1px solid #e2e8f0'
                        }}>
                            <p style={{ fontSize: '13px', color: '#64748b', fontWeight: 600, marginBottom: '8px' }}>{card.label}</p>
                            <p style={{ fontSize: '28px', fontWeight: 800, color: card.color }}>{loading ? '...' : card.value}</p>
                        </div>
                    ))}
                </div>

                {/* Recent Orders */}
                <div style={{
                    background: 'white',
                    borderRadius: '14px',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                    border: '1px solid #e2e8f0',
                    overflow: 'hidden'
                }}>
                    <div style={{ padding: '20px 24px', borderBottom: '1px solid #e2e8f0' }}>
                        <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#0f172a' }}>Recent Orders</h2>
                    </div>

                    {loading ? (
                        <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>Loading...</div>
                    ) : recentOrders.length === 0 ? (
                        <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>No orders yet</div>
                    ) : (
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ background: '#f8fafc' }}>
                                    {['Order ID', 'Customer', 'Amount', 'Status', 'Payment', 'Date'].map(h => (
                                        <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {recentOrders.map(order => (
                                    <tr key={order.id} style={{ borderTop: '1px solid #f1f5f9' }}>
                                        <td style={{ padding: '14px 16px', fontSize: '13px', fontWeight: 600, color: '#0f172a' }}>
                                            {order.id?.slice(0, 8)}...
                                        </td>
                                        <td style={{ padding: '14px 16px', fontSize: '13px', color: '#64748b' }}>
                                            {order.user_name || order.user_email || '—'}
                                        </td>
                                        <td style={{ padding: '14px 16px', fontSize: '13px', fontWeight: 600 }}>
                                            ₹{order.total_amount}
                                        </td>
                                        <td style={{ padding: '14px 16px' }}>
                                            <span style={{
                                                background: `${statusColor(order.status)}18`,
                                                color: statusColor(order.status),
                                                padding: '4px 10px',
                                                borderRadius: '6px',
                                                fontSize: '11px',
                                                fontWeight: 700,
                                                textTransform: 'uppercase'
                                            }}>
                                                {order.status}
                                            </span>
                                        </td>
                                        <td style={{ padding: '14px 16px' }}>
                                            <span style={{
                                                background: order.payment_status === 'paid' ? '#22c55e18' : '#f59e0b18',
                                                color: order.payment_status === 'paid' ? '#22c55e' : '#f59e0b',
                                                padding: '4px 10px',
                                                borderRadius: '6px',
                                                fontSize: '11px',
                                                fontWeight: 700,
                                                textTransform: 'uppercase'
                                            }}>
                                                {order.payment_status}
                                            </span>
                                        </td>
                                        <td style={{ padding: '14px 16px', fontSize: '12px', color: '#94a3b8' }}>
                                            {new Date(order.created_at).toLocaleDateString()}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </main>
        </div>
    );
};

export default Dashboard;
