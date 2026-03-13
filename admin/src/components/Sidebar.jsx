import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';
import './Sidebar.css';

const Sidebar = () => {
    const navigate = useNavigate();
    const { theme, toggleTheme } = useTheme();
    const user = JSON.parse(localStorage.getItem('adminUser') || '{}');

    const handleLogout = () => {
        const token = localStorage.getItem('adminToken');
        // Call logout API (fire and forget)
        fetch('http://localhost:5000/api/v1/adminConfig/logout', {
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
        { to: '/reviews', label: 'Reviews', icon: '⭐' },
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
                
                <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
                    <button 
                        className="theme-toggle" 
                        onClick={toggleTheme}
                        title={`Switch to ${theme === 'light' ? 'Dark' : 'Light'} Mode`}
                        style={{ flex: 1, padding: '8px', borderRadius: '6px', background: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s' }}
                    >
                        {theme === 'light' ? '🌙 Dark Mode' : '☀️ Light Mode'}
                    </button>
                    <button className="sidebar-logout" style={{ flex: 1 }} onClick={handleLogout}>
                        Logout
                    </button>
                </div>
            </div>
        </aside>
    );
};

export default Sidebar;
