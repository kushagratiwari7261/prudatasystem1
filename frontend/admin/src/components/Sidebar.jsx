import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import './Sidebar.css';

const Sidebar = () => {
    const navigate = useNavigate();
    const user = JSON.parse(localStorage.getItem('adminUser') || '{}');

    const handleLogout = () => {
        const token = localStorage.getItem('adminToken');
        // Call logout API (fire and forget)
        fetch('http://10.184.34.191:5000/api/v1/adminConfig/logout', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
        }).catch(() => { });

        localStorage.removeItem('adminToken');
        localStorage.removeItem('adminRefreshToken');
        localStorage.removeItem('adminUser');
        navigate('/login');
    };

    const links = [
        { to: '/dashboard', label: 'Dashboard', icon: '📊' },
        { to: '/orders', label: 'Orders', icon: '📦' },
        { to: '/products', label: 'Products', icon: '👕' },
        { to: '/inventory', label: 'Inventory', icon: '📋' },
        { to: '/customers', label: 'Customers', icon: '👥' },
        { to: '/coupons', label: 'Coupons', icon: '🎫' },
    ];

    return (
        <aside className="sidebar">
            <div className="sidebar-logo">
                <span className="sidebar-brand">Zenwair</span>
                <span className="sidebar-tag">Admin</span>
            </div>

            <nav className="sidebar-nav">
                {links.map(link => (
                    <NavLink
                        key={link.to}
                        to={link.to}
                        className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
                    >
                        <span className="sidebar-icon">{link.icon}</span>
                        {link.label}
                    </NavLink>
                ))}
            </nav>

            <div className="sidebar-footer">
                <div className="sidebar-user">
                    <div className="sidebar-user-name">{user.name || 'Admin'}</div>
                    <div className="sidebar-user-email">{user.email || ''}</div>
                </div>
                <button className="sidebar-logout" onClick={handleLogout}>
                    Logout
                </button>
            </div>
        </aside>
    );
};

export default Sidebar;
