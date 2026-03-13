import React, { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import '../pages/Dashboard.module.css';

const API = 'http://localhost:5000/api/v1';

const Inventory = () => {
    const [lowStock, setLowStock] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    
    const [adjustModal, setAdjustModal] = useState({ open: false, variant: null, qty: 0 });

    const token = localStorage.getItem('adminToken');
    const headers = { 
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
    };

    const fetchInventory = async () => {
        try {
            setLoading(true);
            const res = await fetch(`${API}/inventory/low-stock?threshold=20`, { headers });
            const data = await res.json();
            
            if (data.success) {
                setLowStock(data.data.low_stock || []);
            } else {
                setError(data.message || 'Failed to fetch inventory');
            }
        } catch (err) {
            setError('Network error fetching inventory');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchInventory();
    }, []);

    const handleAdjustStock = async (e) => {
        e.preventDefault();
        try {
            const res = await fetch(`${API}/inventory/variant/${adjustModal.variant.variant_id}`, {
                method: 'PUT',
                headers,
                // Passing exact quantity to explicitly override it
                body: JSON.stringify({ adjust_by: Number(adjustModal.qty) - adjustModal.variant.stock_quantity })
            });

            const data = await res.json();

            if (res.ok && data.success) {
                alert('Stock adjusted successfully!');
                setAdjustModal({ open: false, variant: null, qty: 0 });
                fetchInventory(); // Refresh list to get updated stock numbers
            } else {
                alert(`Error: ${data.message || 'Failed to adjust stock'}`);
            }
        } catch (err) {
            alert('Network error while adjusting stock.');
        }
    };

    return (
        <div style={{ display: 'flex' }}>
            <Sidebar />
            <main style={{ marginLeft: 240, flex: 1, padding: '32px', minHeight: '100vh', background: 'var(--bg-main)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                    <div>
                        <h1 style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '8px' }}>Inventory Management</h1>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Monitor low stock products and manually adjust quantities.</p>
                    </div>
                </div>

                {/* Adjust Modal (Simulated inline) */}
                {adjustModal.open && (
                    <div style={{ background: 'var(--bg-card)', padding: '24px', borderRadius: '14px', marginBottom: '24px', border: '1px solid var(--accent-blue)', boxShadow: 'var(--shadow-md)' }}>
                        <h2 style={{ fontSize: '18px', marginBottom: '20px', color: 'var(--accent-blue)' }}>
                            Adjust Stock: {adjustModal.variant.name} (Size: {adjustModal.variant.size})
                        </h2>
                        <form onSubmit={handleAdjustStock} style={{ display: 'flex', gap: '16px', alignItems: 'end' }}>
                            <div>
                                <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>New Exact Quantity</label>
                                <input 
                                    type="number"
                                    min="0"
                                    value={adjustModal.qty}
                                    onChange={(e) => setAdjustModal(prev => ({ ...prev, qty: e.target.value }))}
                                    required 
                                    style={{ width: '200px', padding: '10px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--input-bg)', color: 'var(--text-primary)', fontSize: '16px', fontWeight: 'bold' }} 
                                />
                            </div>
                            <button type="submit" style={{ background: 'var(--accent-blue)', color: 'white', padding: '10px 24px', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', height: '42px' }}>
                                Confirm Update
                            </button>
                            <button type="button" onClick={() => setAdjustModal({ open: false, variant: null, qty: 0 })} style={{ background: 'var(--bg-secondary)', color: 'var(--text-secondary)', padding: '10px 24px', border: '1px solid var(--border-color)', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', height: '42px' }}>
                                Cancel
                            </button>
                        </form>
                    </div>
                )}


                {/* Low Stock Watchlist */}
                <div style={{
                    background: 'var(--bg-card)',
                    borderRadius: '14px',
                    boxShadow: 'var(--shadow-sm)',
                    border: '1px solid var(--border-color)',
                    overflowX: 'auto',
                    marginBottom: '40px'
                }}>
                    <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-color)', background: 'var(--bg-hover)' }}>
                        <h2 style={{ fontSize: '16px', fontWeight: 800, color: '#f59e0b', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            ⚠️ Low Stock Alerts (Below 20 units)
                        </h2>
                    </div>

                    {loading ? (
                        <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>Scanning warehouse...</div>
                    ) : error ? (
                        <div style={{ padding: '40px', textAlign: 'center', color: 'var(--accent-red)' }}>{error}</div>
                    ) : lowStock.length === 0 ? (
                        <div style={{ padding: '40px', textAlign: 'center', color: 'var(--accent-green)', fontWeight: 'bold' }}>All stock levels are optimal! No immediate action required.</div>
                    ) : (
                        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '800px' }}>
                            <thead>
                                <tr style={{ background: 'var(--bg-hover)', borderBottom: '1px solid var(--border-color)' }}>
                                    {['Product Info', 'SKU', 'Variant Details', 'Current Stock', 'Status', 'Action'].map(h => (
                                        <th key={h} style={{ padding: '16px', textAlign: 'left', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {lowStock.map(item => (
                                    <tr key={item.variant_id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                        <td style={{ padding: '16px', fontSize: '14px', fontWeight: 800, color: 'var(--text-primary)' }}>
                                            {item.name}
                                        </td>
                                        <td style={{ padding: '16px', fontSize: '13px', color: 'var(--text-secondary)' }}>
                                            {item.sku}
                                        </td>
                                        <td style={{ padding: '16px', fontSize: '14px', color: 'var(--accent-blue)', fontWeight: 700 }}>
                                            {item.color} — Size: {item.size}
                                        </td>
                                        <td style={{ padding: '16px', fontSize: '20px', fontWeight: 900, color: item.stock_quantity <= 5 ? 'var(--accent-red)' : '#f59e0b' }}>
                                            {item.stock_quantity}
                                        </td>
                                        <td style={{ padding: '16px', fontSize: '13px' }}>
                                            <span style={{
                                                background: item.stock_quantity === 0 ? 'rgba(239, 68, 68, 0.1)' : 'rgba(245, 158, 11, 0.1)',
                                                color: item.stock_quantity === 0 ? 'var(--accent-red)' : '#d97706',
                                                padding: '4px 10px', borderRadius: '6px', fontWeight: 700, textTransform: 'uppercase'
                                            }}>
                                                {item.stock_quantity === 0 ? 'Out of Stock' : 'Low Stock'}
                                            </span>
                                        </td>
                                        <td style={{ padding: '16px' }}>
                                            <button 
                                                onClick={() => setAdjustModal({ open: true, variant: item, qty: item.stock_quantity })}
                                                style={{ padding: '8px 16px', background: 'var(--text-primary)', color: 'var(--bg-main)', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px' }}
                                            >
                                                Adjust Quantity
                                            </button>
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

export default Inventory;
