import React from 'react';
import { Link } from 'react-router-dom';

const NotFound = () => (
    <div className="empty-state" style={{ minHeight: '70vh' }}>
        <div style={{ fontSize: '120px', fontWeight: 900, color: '#ff3f6c', lineHeight: 1, marginBottom: '8px' }}>404</div>
        <h2 className="empty-state-title">Page Not Found</h2>
        <p className="empty-state-text">
            The page you're looking for doesn't exist or has been moved. Let's get you back on track.
        </p>
        <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
            <Link to="/" className="btn-primary">Go Home</Link>
            <Link to="/shop" className="btn-secondary">Browse Shop</Link>
        </div>
    </div>
);

export default NotFound;
