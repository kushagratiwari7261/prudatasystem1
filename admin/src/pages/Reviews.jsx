import React, { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import { toast } from 'react-toastify';

const API = 'http://localhost:5000/api/v1';

const Reviews = () => {
    const [reviews, setReviews] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('');
    const token = localStorage.getItem('adminToken');

    const headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
    };

    const fetchReviews = async () => {
        try {
            const res = await fetch(`${API}/reviews/admin/all${filter ? `?status=${filter}` : ''}`, { headers });
            const data = await res.json();
            if (data.success) {
                setReviews(data.data);
            }
        } catch (error) {
            console.error('Error fetching reviews:', error);
            toast.error('Failed to fetch reviews');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchReviews();
    }, [filter]);

    const handleUpdateStatus = async (id, status) => {
        try {
            const res = await fetch(`${API}/reviews/admin/status/${id}`, {
                method: 'PUT',
                headers,
                body: JSON.stringify({ status })
            });
            const data = await res.json();
            if (data.success) {
                toast.success(data.message);
                fetchReviews();
            } else {
                toast.error(data.message);
            }
        } catch (error) {
            console.error('Update status error:', error);
            toast.error('Failed to update status');
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Are you sure you want to delete this review?')) return;
        try {
            const res = await fetch(`${API}/reviews/${id}`, {
                method: 'DELETE',
                headers
            });
            const data = await res.json();
            if (data.success) {
                toast.success('Review deleted');
                fetchReviews();
            }
        } catch (error) {
            console.error('Delete error:', error);
            toast.error('Failed to delete review');
        }
    };

    return (
        <div style={{ display: 'flex' }}>
            <Sidebar />
            <main style={{ marginLeft: 240, flex: 1, padding: '32px', minHeight: '100vh', background: 'var(--bg-main)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
                    <div>
                        <h1 style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text-primary)' }}>Review Moderation</h1>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Manage and moderate customer product reviews</p>
                    </div>
                    
                    <select 
                        value={filter} 
                        onChange={(e) => setFilter(e.target.value)}
                        style={{ padding: '10px 16px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-card)', color: 'var(--text-primary)', outline: 'none', cursor: 'pointer' }}
                    >
                        <option value="">All Statuses</option>
                        <option value="pending">Pending</option>
                        <option value="approved">Approved</option>
                        <option value="rejected">Rejected</option>
                    </select>
                </div>

                <div style={{ background: 'var(--bg-card)', borderRadius: '14px', boxShadow: 'var(--shadow-sm)', border: '1px solid var(--border-color)', overflow: 'hidden' }}>
                    {loading ? (
                        <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>Loading reviews...</div>
                    ) : reviews.length === 0 ? (
                        <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>No reviews found</div>
                    ) : (
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ background: 'var(--bg-hover)' }}>
                                    {['Customer', 'Product', 'Rating', 'Comment', 'Status', 'Actions'].map(h => (
                                        <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {reviews.map(review => (
                                    <tr key={review.id} style={{ borderTop: '1px solid var(--border-color)' }}>
                                        <td style={{ padding: '14px 16px' }}>
                                            <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>{review.user_name}</div>
                                            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{review.user_email}</div>
                                        </td>
                                        <td style={{ padding: '14px 16px', fontSize: '13px', color: 'var(--text-secondary)' }}>
                                            {review.product_title}
                                        </td>
                                        <td style={{ padding: '14px 16px', color: '#f59e0b', fontSize: '14px' }}>
                                            {Array(5).fill(0).map((_, i) => (
                                                <span key={i} style={{ color: i < review.rating ? '#f59e0b' : '#d1d5db' }}>★</span>
                                            ))}
                                        </td>
                                        <td style={{ padding: '14px 16px', fontSize: '13px', color: 'var(--text-secondary)', maxWidth: '300px' }}>
                                            {review.comment || <em style={{ color: 'var(--text-muted)' }}>No comment</em>}
                                        </td>
                                        <td style={{ padding: '14px 16px' }}>
                                            <span style={{
                                                background: review.status === 'approved' ? '#22c55e18' : (review.status === 'pending' ? '#f59e0b18' : '#ef444418'),
                                                color: review.status === 'approved' ? '#22c55e' : (review.status === 'pending' ? '#f59e0b' : '#ef4444'),
                                                padding: '4px 10px',
                                                borderRadius: '6px',
                                                fontSize: '11px',
                                                fontWeight: 700,
                                                textTransform: 'uppercase'
                                            }}>
                                                {review.status}
                                            </span>
                                        </td>
                                        <td style={{ padding: '14px 16px' }}>
                                            <div style={{ display: 'flex', gap: '8px' }}>
                                                {review.status !== 'approved' && (
                                                    <button onClick={() => handleUpdateStatus(review.id, 'approved')} title="Approve" style={{ background: 'none', border: '1px solid #22c55e', color: '#22c55e', padding: '4px 8px', borderRadius: '4px', fontSize: '12px', cursor: 'pointer' }}>Approve</button>
                                                )}
                                                {review.status !== 'rejected' && (
                                                    <button onClick={() => handleUpdateStatus(review.id, 'rejected')} title="Reject" style={{ background: 'none', border: '1px solid #ef4444', color: '#ef4444', padding: '4px 8px', borderRadius: '4px', fontSize: '12px', cursor: 'pointer' }}>Reject</button>
                                                )}
                                                <button onClick={() => handleDelete(review.id)} title="Delete" style={{ background: 'none', border: '1px solid #6b7280', color: '#6b7280', padding: '4px 8px', borderRadius: '4px', fontSize: '12px', cursor: 'pointer' }}>Delete</button>
                                            </div>
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

export default Reviews;
