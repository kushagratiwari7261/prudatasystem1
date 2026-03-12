import React, { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import '../pages/Dashboard.module.css';

const API = 'http://localhost:5000/api/v1';

const Coupons = () => {
    const [coupons, setCoupons] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [showAddForm, setShowAddForm] = useState(false);
    
    // New coupon state
    const [newCoupon, setNewCoupon] = useState({
        code: '',
        discount_type: 'percentage',
        discount_value: '',
        min_purchase_amount: '',
        max_discount_amount: '',
        valid_until: '',
        usage_limit: '',
        applicable_product_id: '',
        is_first_purchase_only: false
    });
    const [products, setProducts] = useState([]);

    const token = localStorage.getItem('adminToken');
    const headers = { 
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
    };

    const fetchCoupons = async () => {
        try {
            setLoading(true);
            const res = await fetch(`${API}/coupons`, { headers });
            const data = await res.json();
            
            if (data.success) {
                setCoupons(Array.isArray(data.data) ? data.data : (data.data.coupons || []));
            } else {
                setError(data.message || 'Failed to fetch coupons');
            }
        } catch (err) {
            setError('Network error fetching coupons');
        } finally {
            setLoading(false);
        }
    };

    const fetchProducts = async () => {
        try {
            const res = await fetch(`${API}/products`, { headers });
            const data = await res.json();
            if (data.success) {
                setProducts(data.data.products || []);
            }
        } catch (err) {
            console.error("Failed to fetch products for coupons");
        }
    }

    useEffect(() => {
        fetchProducts();
        fetchCoupons();
    }, []);

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setNewCoupon(prev => ({ ...prev, [name]: value }));
    };

    const handleCreateCoupon = async (e) => {
        e.preventDefault();
        try {
            console.log('Sending Coupon Data:', newCoupon);
            const res = await fetch(`${API}/coupons`, {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    code: newCoupon.code.toUpperCase(),
                    type: newCoupon.discount_type === 'percentage' ? 'percent' : 'flat',
                    value: Number(newCoupon.discount_value),
                    min_order_amount: newCoupon.min_purchase_amount ? Number(newCoupon.min_purchase_amount) : 0,
                    max_uses: newCoupon.usage_limit ? Number(newCoupon.usage_limit) : null,
                    expires_at: newCoupon.valid_until ? new Date(newCoupon.valid_until).toISOString() : null,
                    applicable_product_id: newCoupon.applicable_product_id || null,
                    is_first_purchase_only: newCoupon.is_first_purchase_only
                })
            });
            const data = await res.json();

            if (res.ok && data.success) {
                alert('Coupon created successfully!');
                setShowAddForm(false);
                setNewCoupon({
                    code: '', discount_type: 'percentage', discount_value: '',
                    min_purchase_amount: '', max_discount_amount: '', valid_until: '', usage_limit: '',
                    applicable_product_id: '', is_first_purchase_only: false
                });
                fetchCoupons(); // Refresh list
            } else {
                alert(`Error: ${data.message || 'Failed to create coupon'}`);
            }
        } catch (err) {
            alert('Network error while creating coupon.');
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm("Are you sure you want to delete this coupon?")) return;
        
        try {
            const res = await fetch(`${API}/coupons/${id}`, {
                method: 'DELETE',
                headers
            });
            
            if (res.ok) {
                setCoupons(prev => prev.filter(c => c.id !== id));
            } else {
                alert("Failed to delete coupon");
            }
        } catch (err) {
            alert("Error deleting coupon");
        }
    };

    const getStatusText = (coupon) => {
        if (!coupon.is_active) return <span style={{ color: '#ef4444', fontWeight: 'bold' }}>Inactive</span>;
        if (coupon.expires_at && new Date(coupon.expires_at) < new Date()) {
            return <span style={{ color: '#ef4444', fontWeight: 'bold' }}>Expired</span>;
        }
        if (coupon.max_uses && coupon.uses_count >= coupon.max_uses) {
            return <span style={{ color: '#f59e0b', fontWeight: 'bold' }}>Limit Reached</span>;
        }
        return <span style={{ color: '#22c55e', fontWeight: 'bold' }}>Active</span>;
    };

    return (
        <div style={{ display: 'flex' }}>
            <Sidebar />
            <main style={{ marginLeft: 240, flex: 1, padding: '32px', minHeight: '100vh', background: '#f1f5f9' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                    <div>
                        <h1 style={{ fontSize: '24px', fontWeight: 800, color: '#0f172a', marginBottom: '8px' }}>Coupons & Promotions</h1>
                        <p style={{ color: '#64748b', fontSize: '14px' }}>Manage discount codes for customer checkout.</p>
                    </div>
                    <button 
                        onClick={() => setShowAddForm(!showAddForm)}
                        style={{ background: '#0f172a', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }}
                    >
                        {showAddForm ? 'Cancel' : '+ Create Coupon'}
                    </button>
                </div>

                {/* Add Coupon Form */}
                {showAddForm && (
                    <div style={{ background: 'white', padding: '24px', borderRadius: '14px', marginBottom: '24px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
                        <h2 style={{ fontSize: '18px', marginBottom: '20px' }}>Create New Coupon</h2>
                        <form onSubmit={handleCreateCoupon}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                                <div>
                                    <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: 600 }}>Coupon Code*</label>
                                    <input 
                                        name="code" value={newCoupon.code} onChange={handleInputChange} 
                                        required style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1' }} 
                                        placeholder="e.g. SUMMER50"
                                    />
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                    <div>
                                        <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: 600 }}>Type*</label>
                                        <select 
                                            name="discount_type" value={newCoupon.discount_type} onChange={handleInputChange}
                                            style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                                        >
                                            <option value="percentage">Percentage (%)</option>
                                            <option value="fixed">Fixed Amount (₹)</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: 600 }}>Discount Value*</label>
                                        <input 
                                            type="number" name="discount_value" value={newCoupon.discount_value} onChange={handleInputChange} 
                                            required style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1' }} 
                                            placeholder="e.g. 20"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: 600 }}>Min Purchase Amt (₹)</label>
                                    <input 
                                        type="number" name="min_purchase_amount" value={newCoupon.min_purchase_amount} onChange={handleInputChange} 
                                        style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1' }} 
                                        placeholder="0"
                                    />
                                </div>
                                <div>
                                    <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: 600 }}>Max Discount Amt (₹) [For %]</label>
                                    <input 
                                        type="number" name="max_discount_amount" value={newCoupon.max_discount_amount} onChange={handleInputChange} 
                                        style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1' }} 
                                        placeholder="Optional limit"
                                        disabled={newCoupon.discount_type === 'fixed'}
                                    />
                                </div>
                                <div>
                                    <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: 600 }}>Valid Until Date</label>
                                    <input 
                                        type="datetime-local" name="valid_until" value={newCoupon.valid_until} onChange={handleInputChange} 
                                        style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1' }} 
                                    />
                                </div>
                                <div>
                                    <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: 600 }}>Overall Usage Limit</label>
                                    <input 
                                        type="number" name="usage_limit" value={newCoupon.usage_limit} onChange={handleInputChange} 
                                        style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1' }} 
                                        placeholder="Total times codes can be used"
                                    />
                                </div>
                                <div>
                                    <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: 600 }}>Target Product (Optional)</label>
                                    <select 
                                        name="applicable_product_id" value={newCoupon.applicable_product_id} onChange={handleInputChange}
                                        style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                                    >
                                        <option value="">Any Product</option>
                                        {products.map(p => (
                                            <option key={p.id} value={p.id}>{p.title}</option>
                                        ))}
                                    </select>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center' }}>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}>
                                        <input 
                                            type="checkbox" 
                                            name="is_first_purchase_only" 
                                            checked={newCoupon.is_first_purchase_only} 
                                            onChange={(e) => setNewCoupon(prev => ({ ...prev, is_first_purchase_only: e.target.checked }))} 
                                            style={{ width: '18px', height: '18px' }} 
                                        />
                                        First Purchase Only
                                    </label>
                                </div>
                            </div>
                            <button type="submit" style={{ background: '#3b82f6', color: 'white', padding: '10px 24px', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>
                                Finalize & Create
                            </button>
                        </form>
                    </div>
                )}


                {/* Coupon Table */}
                <div style={{
                    background: 'white',
                    borderRadius: '14px',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                    border: '1px solid #e2e8f0',
                    overflowX: 'auto'
                }}>
                    {loading ? (
                        <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>Loading coupons...</div>
                    ) : error ? (
                        <div style={{ padding: '40px', textAlign: 'center', color: '#ef4444' }}>{error}</div>
                    ) : coupons.length === 0 ? (
                        <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>No coupons found. Create your first promotion above!</div>
                    ) : (
                        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '800px' }}>
                            <thead>
                                <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                                    {['Code', 'Constraints', 'Discount', 'Usage', 'Expiry', 'Status', 'Actions'].map(h => (
                                        <th key={h} style={{ padding: '16px', textAlign: 'left', fontSize: '12px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {coupons.map(coupon => (
                                    <tr key={coupon.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                        <td style={{ padding: '16px', fontSize: '14px', fontWeight: 800, color: '#0f172a', letterSpacing: '1px' }}>
                                            {coupon.code}
                                        </td>
                                        <td style={{ padding: '16px' }}>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                {coupon.is_first_purchase_only && <span style={{ background: '#fdf4ff', color: '#c026d3', padding: '2px 8px', borderRadius: '4px', fontSize: '10px', fontWeight: 'bold', width: 'fit-content' }}>FIRST ORDER</span>}
                                                {coupon.product_title && (
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#f1f5f9', padding: '4px 8px', borderRadius: '4px', width: 'fit-content' }}>
                                                        {coupon.product_image && <img src={`http://localhost:5000${coupon.product_image}`} alt={coupon.product_title} style={{ width: '16px', height: '16px', objectFit: 'cover', borderRadius: '2px' }} />}
                                                        <span style={{ fontSize: '11px', fontWeight: 600, color: '#475569' }}>{coupon.product_title}</span>
                                                    </div>
                                                )}
                                                {coupon.min_order_amount > 0 && <span style={{ fontSize: '11px', color: '#64748b' }}>Min: ₹{coupon.min_order_amount}</span>}
                                            </div>
                                        </td>
                                        <td style={{ padding: '16px', fontSize: '14px', color: '#3b82f6', fontWeight: 'bold' }}>
                                            {coupon.type === 'percent' ? `${coupon.value}% OFF` : `₹${coupon.value} OFF`}
                                        </td>
                                        <td style={{ padding: '16px', fontSize: '14px', color: '#475569' }}>
                                            {coupon.uses_count || 0} / {coupon.max_uses || '∞'}
                                        </td>
                                        <td style={{ padding: '16px', fontSize: '13px', color: '#64748b' }}>
                                            {coupon.expires_at ? new Date(coupon.expires_at).toLocaleDateString() : 'Never'}
                                        </td>
                                        <td style={{ padding: '16px', fontSize: '13px' }}>
                                            {getStatusText(coupon)}
                                        </td>
                                        <td style={{ padding: '16px' }}>
                                            <button 
                                                onClick={() => handleDelete(coupon.id)}
                                                style={{ padding: '6px 12px', background: '#fee2e2', color: '#ef4444', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px' }}
                                            >
                                                Delete
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

export default Coupons;
