import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import './Login.css';

const Login = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();

    const redirect = searchParams.get('redirect')
        ? decodeURIComponent(searchParams.get('redirect'))
        : '/shop';

    useEffect(() => {
        const token = localStorage.getItem('accessToken');
        if (token) {
            navigate(redirect, { replace: true });
        }

        if (searchParams.get('error') === 'google_failed') {
            setError('Google sign-in failed. Try again.');
        }
    }, [navigate, redirect, searchParams]);

    const mergeGuestCart = async (token) => {
        const guest = JSON.parse(localStorage.getItem('guestCart') || 'null');
        if (!guest?.items?.length) return false;
        try {
            await fetch('http://localhost:5000/api/v1/cart/merge', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ items: guest.items })
            });
            localStorage.removeItem('guestCart');
            return true;
        } catch (e) { return false; }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const res = await fetch('http://localhost:5000/api/v1/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });

            const data = await res.json();

            if (!res.ok) {
                if (res.status === 403 && data.message?.includes('admin')) {
                    setError('Admin accounts cannot login here. Use the admin portal.');
                } else {
                    setError(data.message || 'Login failed');
                }
                return;
            }

            localStorage.setItem('accessToken', data.data.accessToken);
            localStorage.setItem('refreshToken', data.data.refreshToken);
            localStorage.setItem('user', JSON.stringify(data.data.user));

            const wasMerged = await mergeGuestCart(data.data.accessToken);
            navigate(wasMerged ? '/checkout' : redirect, { replace: true });
        } catch (err) {
            setError('Network error. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const googleUrl = `http://localhost:5000/api/v1/auth/google?state=${encodeURIComponent(redirect)}`;

    return (
        <div className="auth-page">
            <div className="auth-card">
                <div className="auth-logo">
                    <span className="logo-text">Zenwair</span>
                </div>

                {searchParams.get('redirect')?.includes('/checkout') && (
                    <div className="checkout-banner">
                        Login to complete your purchase 🛍️
                    </div>
                )}

                <h1 className="auth-title">Welcome back</h1>
                <p className="auth-subtitle">Sign in to your account</p>

                {error && <div className="auth-error">{error}</div>}

                <a href={googleUrl} className="google-btn">
                    <svg width="20" height="20" viewBox="0 0 24 24">
                        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
                        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                    </svg>
                    Continue with Google
                </a>

                <div className="auth-divider">
                    <span>or</span>
                </div>

                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label className="form-label">Email</label>
                        <input
                            type="email"
                            className="form-input"
                            placeholder="your@email.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            autoComplete="email"
                        />
                    </div>

                    <div className="form-group">
                        <label className="form-label">Password</label>
                        <div className="password-row">
                            <input
                                type={showPassword ? 'text' : 'password'}
                                className="form-input"
                                placeholder="Enter your password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                autoComplete="current-password"
                            />
                            <button
                                type="button"
                                className="toggle-pw"
                                onClick={() => setShowPassword(!showPassword)}
                            >
                                {showPassword ? '🙈' : '👁️'}
                            </button>
                        </div>
                    </div>

                    <div className="forgot-link">
                        <Link to="/forgot-password">Forgot password?</Link>
                    </div>

                    <button type="submit" className="auth-btn" disabled={loading}>
                        {loading ? 'Signing in...' : 'Sign In'}
                    </button>
                </form>

                <p className="auth-footer">
                    New to Zenwair? <Link to="/register">Create account</Link>
                </p>
            </div>
        </div>
    );
};

export default Login;
