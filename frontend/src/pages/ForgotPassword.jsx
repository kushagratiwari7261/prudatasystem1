import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import './Login.css';

const ForgotPassword = () => {
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [sent, setSent] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const res = await fetch('http://10.184.34.191:5000/api/v1/auth/forgot-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email })
            });

            if (res.ok) {
                setSent(true);
            } else {
                const data = await res.json();
                setError(data.message || 'Something went wrong');
            }
        } catch (err) {
            setError('Network error. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="auth-page">
            <div className="auth-card">
                <div className="auth-logo">
                    <span className="logo-text">Zenwair</span>
                </div>

                <h1 className="auth-title">Reset password</h1>
                <p className="auth-subtitle">
                    {sent ? 'Check your email for a reset link' : "Enter your email and we'll send you a reset link"}
                </p>

                {error && <div className="auth-error">{error}</div>}
                {sent && <div className="auth-success">If an account with that email exists, we've sent a reset link.</div>}

                {!sent && (
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
                            />
                        </div>

                        <button type="submit" className="auth-btn" disabled={loading}>
                            {loading ? 'Sending...' : 'Send Reset Link'}
                        </button>
                    </form>
                )}

                <p className="auth-footer">
                    <Link to="/login">← Back to login</Link>
                </p>
            </div>
        </div>
    );
};

export default ForgotPassword;
