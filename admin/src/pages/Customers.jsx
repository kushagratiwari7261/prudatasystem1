import React, { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import '../pages/Dashboard.module.css'; // Inheriting dashboard layout styles

const API = 'http://localhost:5000/api/v1';

const Customers = () => {
    const [customers, setCustomers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchCustomers = async () => {
            try {
                const token = localStorage.getItem('adminToken');
                const res = await fetch(`${API}/auth/users`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                const data = await res.json();
                
                if (data.success) {
                    setCustomers(data.data.users || []);
                } else {
                    setError(data.message || 'Failed to fetch customers');
                }
            } catch (err) {
                setError('Network error fetching customers');
            } finally {
                setLoading(false);
            }
        };

        fetchCustomers();
    }, []);

    return (
        <div style={{ display: 'flex' }}>
            <Sidebar />
            <main style={{ marginLeft: 240, flex: 1, padding: '32px', minHeight: '100vh', background: 'var(--bg-main)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                    <div>
                        <h1 style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '8px' }}>Customers</h1>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>View all registered users on your platform.</p>
                    </div>
                </div>

                <div style={{
                    background: 'var(--bg-card)',
                    borderRadius: '14px',
                    boxShadow: 'var(--shadow-sm)',
                    border: '1px solid var(--border-color)',
                    overflowX: 'auto'
                }}>
                    {loading ? (
                        <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>Loading customer data...</div>
                    ) : error ? (
                        <div style={{ padding: '40px', textAlign: 'center', color: 'var(--accent-red)' }}>{error}</div>
                    ) : customers.length === 0 ? (
                        <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>No customers found</div>
                    ) : (
                        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '800px' }}>
                            <thead>
                                <tr style={{ background: 'var(--bg-hover)', borderBottom: '1px solid var(--border-color)' }}>
                                    {['Name', 'Email', 'Phone', 'Gender', 'Role', 'Status', 'Joined Date'].map(h => (
                                        <th key={h} style={{ padding: '16px', textAlign: 'left', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {customers.map(customer => (
                                    <tr key={customer.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                        <td style={{ padding: '16px', fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>
                                            {customer.name}
                                        </td>
                                        <td style={{ padding: '16px', fontSize: '14px', color: 'var(--text-secondary)' }}>
                                            {customer.email}
                                        </td>
                                        <td style={{ padding: '16px', fontSize: '14px', color: 'var(--text-secondary)' }}>
                                            {customer.phone || '—'}
                                        </td>
                                        <td style={{ padding: '16px', fontSize: '14px', color: 'var(--text-secondary)' }}>
                                            {customer.gender || '—'}
                                        </td>
                                        <td style={{ padding: '16px' }}>
                                            <span style={{
                                                background: customer.role === 'admin' ? 'rgba(225, 29, 72, 0.1)' : 'rgba(79, 70, 229, 0.1)',
                                                color: customer.role === 'admin' ? '#be123c' : 'rgba(79, 70, 229, 1)',
                                                padding: '4px 10px',
                                                borderRadius: '6px',
                                                fontSize: '11px',
                                                fontWeight: 700,
                                                textTransform: 'uppercase'
                                            }}>
                                                {customer.role}
                                            </span>
                                        </td>
                                        <td style={{ padding: '16px' }}>
                                            <span style={{
                                                background: customer.is_active ? 'rgba(22, 163, 74, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                                                color: customer.is_active ? 'var(--accent-green)' : 'var(--accent-red)',
                                                padding: '4px 10px',
                                                borderRadius: '6px',
                                                fontSize: '11px',
                                                fontWeight: 700,
                                                textTransform: 'uppercase'
                                            }}>
                                                {customer.is_active ? 'Active' : 'Inactive'}
                                            </span>
                                        </td>
                                        <td style={{ padding: '16px', fontSize: '13px', color: 'var(--text-muted)' }}>
                                            {new Date(customer.created_at).toLocaleDateString()}
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

export default Customers;
