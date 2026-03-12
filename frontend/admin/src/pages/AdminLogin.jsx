import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './AdminLogin.module.css';

const AdminLogin = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const navigate = useNavigate();

    useEffect(() => {
        const token = localStorage.getItem('adminToken');
        if (token) navigate('/dashboard', { replace: true });
    }, [navigate]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const res = await fetch('http://10.184.34.191:5000/api/v1/adminConfig/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });

            const data = await res.json();

            if (!res.ok) {
                setError(data.message || 'Invalid credentials');
                return;
            }

            localStorage.setItem('adminToken', data.data.accessToken);
            localStorage.setItem('adminRefreshToken', data.data.refreshToken);
            localStorage.setItem('adminUser', JSON.stringify(data.data.admin));
            navigate('/dashboard');
        } catch (err) {
            setError('Network error. Please check your connection.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className={styles.page}>
            <div className={styles.card}>
                <div className={styles.logoWrap}>
                    <div className={styles.logo}>Zenwair</div>
                    <div className={styles.adminTag}>Admin Portal</div>
                </div>

                <h1 className={styles.title}>Admin Sign In</h1>
                <p className={styles.subtitle}>Authorized personnel only</p>

                {error && <div className={styles.error}>{error}</div>}

                <form onSubmit={handleSubmit}>
                    <div className={styles.formGroup}>
                        <label className={styles.label}>Email</label>
                        <input
                            type="email"
                            className={styles.input}
                            placeholder="admin@zenwair.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            autoComplete="email"
                        />
                    </div>

                    <div className={styles.formGroup}>
                        <label className={styles.label}>Password</label>
                        <div className={styles.pwRow}>
                            <input
                                type={showPassword ? 'text' : 'password'}
                                className={styles.input}
                                placeholder="Enter password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                autoComplete="current-password"
                            />
                            <button
                                type="button"
                                className={styles.toggle}
                                onClick={() => setShowPassword(!showPassword)}
                            >
                                {showPassword ? '🙈' : '👁️'}
                            </button>
                        </div>
                    </div>

                    <button type="submit" className={styles.btn} disabled={loading}>
                        {loading ? 'Signing in...' : 'Sign In'}
                    </button>
                </form>

                <div className={styles.footer}>© 2024 Zenwair. Internal use only.</div>
            </div>
        </div>
    );
};

export default AdminLogin;
