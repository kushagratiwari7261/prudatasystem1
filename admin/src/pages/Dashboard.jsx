import React, { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    BarElement,
    Title,
    Tooltip,
    Legend,
    Filler
} from 'chart.js';
import { Line, Bar } from 'react-chartjs-2';

ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    BarElement,
    Title,
    Tooltip,
    Legend,
    Filler
);

const API = 'http://localhost:5000/api/v1';

const Dashboard = () => {
    const [stats, setStats] = useState({ total: 0, pending: 0, revenue: 0, customers: 0 });
    const [recentOrders, setRecentOrders] = useState([]);
    const [salesTrend, setSalesTrend] = useState([]);
    const [topProducts, setTopProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [chartsLoading, setChartsLoading] = useState(true);
    const token = localStorage.getItem('adminToken');

    const headers = { 'Authorization': `Bearer ${token}` };

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [statsRes, recentRes] = await Promise.all([
                    fetch(`${API}/orders/admin/stats`, { headers }),
                    fetch(`${API}/orders/admin/all?limit=5`, { headers })
                ]);

                const statsData = await statsRes.json();
                const recentData = await recentRes.json();

                if (statsData.success) {
                    const sb = statsData.data.stats;
                    setStats({
                        total: sb.total_orders || 0,
                        pending: sb.pending_orders || 0,
                        revenue: sb.revenue || 0,
                        customers: sb.total_customers || 0
                    });
                }

                setRecentOrders(recentData.data?.orders || []);

                // Fetch Analytics
                const [trendRes, topRes] = await Promise.all([
                    fetch(`${API}/analytics/sales-trend`, { headers }),
                    fetch(`${API}/analytics/top-products`, { headers })
                ]);
                const trendData = await trendRes.json();
                const topData = await topRes.json();

                if (trendData.success) setSalesTrend(trendData.data);
                if (topData.success) setTopProducts(topData.data);
                setChartsLoading(false);
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
            <main style={{ marginLeft: 240, flex: 1, padding: '32px', minHeight: '100vh', background: 'var(--bg-main)' }}>
                <h1 style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '8px' }}>Dashboard</h1>
                <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '32px' }}>
                    Welcome back, {JSON.parse(localStorage.getItem('adminUser') || '{}').name || 'Admin'}
                </p>

                {/* Stats Cards */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px', marginBottom: '40px' }}>
                    {[
                        { label: 'Total Orders', value: stats.total, color: 'var(--accent-blue)', bg: 'rgba(59, 130, 246, 0.1)' },
                        { label: 'Pending Orders', value: stats.pending, color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.1)' },
                        { label: 'Revenue', value: `₹${stats.revenue}`, color: 'var(--accent-green)', bg: 'rgba(16, 185, 129, 0.1)' },
                        { label: 'Total Customers', value: stats.customers, color: '#8b5cf6', bg: 'rgba(139, 92, 246, 0.1)' }
                    ].map(card => (
                        <div key={card.label} style={{
                            background: 'var(--bg-card)',
                            borderRadius: '14px',
                            padding: '24px',
                            boxShadow: 'var(--shadow-sm)',
                            border: '1px solid var(--border-color)'
                        }}>
                            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 600, marginBottom: '8px' }}>{card.label}</p>
                            <p style={{ fontSize: '28px', fontWeight: 800, color: card.color }}>{loading ? '...' : card.value}</p>
                        </div>
                    ))}
                </div>

                {/* Charts Section */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '24px', marginBottom: '40px' }}>
                    {/* Sales Trend */}
                    <div style={{
                        background: 'var(--bg-card)',
                        borderRadius: '14px',
                        padding: '24px',
                        boxShadow: 'var(--shadow-sm)',
                        border: '1px solid var(--border-color)'
                    }}>
                        <h3 style={{ fontSize: '15px', fontWeight: 700, marginBottom: '20px', color: 'var(--text-primary)' }}>Sales Trend (Last 7 Days)</h3>
                        <div style={{ height: '300px' }}>
                            {chartsLoading ? (
                                <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>Loading Trend...</div>
                            ) : (
                                <Line
                                    options={{
                                        responsive: true,
                                        maintainAspectRatio: false,
                                        plugins: { legend: { display: false } },
                                        scales: {
                                            y: { beginAtZero: true, grid: { color: 'rgba(0,0,0,0.05)' }, border: { display: false } },
                                            x: { grid: { display: false }, border: { display: false } }
                                        }
                                    }}
                                    data={{
                                        labels: salesTrend.map(d => new Date(d.date).toLocaleDateString(undefined, { weekday: 'short' })),
                                        datasets: [{
                                            label: 'Revenue',
                                            data: salesTrend.map(d => d.revenue),
                                            borderColor: '#3b82f6',
                                            backgroundColor: 'rgba(59, 130, 246, 0.1)',
                                            fill: true,
                                            tension: 0.4
                                        }]
                                    }}
                                />
                            )}
                        </div>
                    </div>

                    {/* Top Products */}
                    <div style={{
                        background: 'var(--bg-card)',
                        borderRadius: '14px',
                        padding: '24px',
                        boxShadow: 'var(--shadow-sm)',
                        border: '1px solid var(--border-color)'
                    }}>
                        <h3 style={{ fontSize: '15px', fontWeight: 700, marginBottom: '20px', color: 'var(--text-primary)' }}>Top Products by Sales</h3>
                        <div style={{ height: '300px' }}>
                            {chartsLoading ? (
                                <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>Loading Products...</div>
                            ) : (
                                <Bar
                                    options={{
                                        indexAxis: 'y',
                                        responsive: true,
                                        maintainAspectRatio: false,
                                        plugins: { legend: { display: false } },
                                        scales: {
                                            x: { beginAtZero: true, grid: { color: 'rgba(0,0,0,0.05)' }, border: { display: false } },
                                            y: { grid: { display: false }, border: { display: false } }
                                        }
                                    }}
                                    data={{
                                        labels: topProducts.map(p => p.name.length > 20 ? p.name.slice(0, 20) + '...' : p.name),
                                        datasets: [{
                                            label: 'Units Sold',
                                            data: topProducts.map(p => p.total_sold),
                                            backgroundColor: '#10b981',
                                            borderRadius: 6
                                        }]
                                    }}
                                />
                            )}
                        </div>
                    </div>
                </div>

                {/* Recent Orders */}
                <div style={{
                    background: 'var(--bg-card)',
                    borderRadius: '14px',
                    boxShadow: 'var(--shadow-sm)',
                    border: '1px solid var(--border-color)',
                    overflow: 'hidden'
                }}>
                    <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-color)' }}>
                        <h2 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>Recent Orders</h2>
                    </div>

                    {loading ? (
                        <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>Loading...</div>
                    ) : recentOrders.length === 0 ? (
                        <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>No orders yet</div>
                    ) : (
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ background: 'var(--bg-hover)' }}>
                                    {['Order ID', 'Customer', 'Amount', 'Status', 'Payment', 'Date'].map(h => (
                                        <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {recentOrders.map(order => (
                                    <tr key={order.id} style={{ borderTop: '1px solid var(--border-color)' }}>
                                        <td style={{ padding: '14px 16px', fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                                            {order.id?.slice(0, 8)}...
                                        </td>
                                        <td style={{ padding: '14px 16px', fontSize: '13px', color: 'var(--text-secondary)' }}>
                                            {order.user_name || order.user_email || '—'}
                                        </td>
                                        <td style={{ padding: '14px 16px', fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
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
                                        <td style={{ padding: '14px 16px', fontSize: '12px', color: 'var(--text-muted)' }}>
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
