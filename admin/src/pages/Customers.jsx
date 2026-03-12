import React, { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import '../pages/Dashboard.module.css'; // Inheriting dashboard layout styles

const API = 'http://10.184.34.191:5000/api/v1';

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
            <main style={{ marginLeft: 240, flex: 1, padding: '32px', minHeight: '100vh', background: '#f1f5f9' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                    <div>
                        <h1 style={{ fontSize: '24px', fontWeight: 800, color: '#0f172a', marginBottom: '8px' }}>Customers</h1>
                        <p style={{ color: '#64748b', fontSize: '14px' }}>View all registered users on your platform.</p>
                    </div>
                </div>

                <div style={{
                    background: 'white',
                    borderRadius: '14px',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                    border: '1px solid #e2e8f0',
                    overflowX: 'auto'
                }}>
                    {loading ? (
                        <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>Loading customer data...</div>
                    ) : error ? (
                        <div style={{ padding: '40px', textAlign: 'center', color: '#ef4444' }}>{error}</div>
                    ) : customers.length === 0 ? (
                        <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>No customers found</div>
                    ) : (
                        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '800px' }}>
                            <thead>
                                <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                                    {['Name', 'Email', 'Phone', 'Gender', 'Role', 'Status', 'Joined Date'].map(h => (
                                        <th key={h} style={{ padding: '16px', textAlign: 'left', fontSize: '12px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {customers.map(customer => (
                                    <tr key={customer.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                        <td style={{ padding: '16px', fontSize: '14px', fontWeight: 600, color: '#0f172a' }}>
                                            {customer.name}
                                        </td>
                                        <td style={{ padding: '16px', fontSize: '14px', color: '#475569' }}>
                                            {customer.email}
                                        </td>
                                        <td style={{ padding: '16px', fontSize: '14px', color: '#475569' }}>
                                            {customer.phone || '—'}
                                        </td>
                                        <td style={{ padding: '16px', fontSize: '14px', color: '#475569' }}>
                                            {customer.gender || '—'}
                                        </td>
                                        <td style={{ padding: '16px' }}>
                                            <span style={{
                                                background: customer.role === 'admin' ? '#fecdd3' : '#e0e7ff',
                                                color: customer.role === 'admin' ? '#be123c' : '#4338ca',
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
                                                background: customer.is_active ? '#dcfce7' : '#fee2e2',
                                                color: customer.is_active ? '#15803d' : '#b91c1c',
                                                padding: '4px 10px',
                                                borderRadius: '6px',
                                                fontSize: '11px',
                                                fontWeight: 700,
                                                textTransform: 'uppercase'
                                            }}>
                                                {customer.is_active ? 'Active' : 'Inactive'}
                                            </span>
                                        </td>
                                        <td style={{ padding: '16px', fontSize: '13px', color: '#64748b' }}>
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
