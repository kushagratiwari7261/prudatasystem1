import React, { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

const AuthCallback = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();

    useEffect(() => {
        const handleCallback = async () => {
            const accessToken = searchParams.get('accessToken');
            const refreshToken = searchParams.get('refreshToken');
            const name = searchParams.get('name');
            const email = searchParams.get('email');
            const role = searchParams.get('role');
            const avatar = searchParams.get('avatar');
            const redirect = searchParams.get('redirect') || '/shop';

            if (!accessToken) {
                navigate('/login?error=google_failed', { replace: true });
                return;
            }

            // Store tokens and user data
            localStorage.setItem('accessToken', accessToken);
            localStorage.setItem('refreshToken', refreshToken);
            localStorage.setItem('user', JSON.stringify({
                name,
                email,
                role,
                avatar_url: avatar
            }));

            // Merge guest cart
            const guest = JSON.parse(localStorage.getItem('guestCart') || 'null');
            let finalRedirect = redirect;
            if (guest?.items?.length) {
                try {
                    await fetch('http://localhost:5000/api/v1/cart/merge', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${accessToken}`
                        },
                        body: JSON.stringify({ items: guest.items })
                    });
                    localStorage.removeItem('guestCart');
                    finalRedirect = '/checkout';
                } catch (e) { /* ignore */ }
            }

            navigate(finalRedirect, { replace: true });
        };

        handleCallback();
    }, [navigate, searchParams]);

    return (
        <div className="spinner-container">
            <div className="spinner"></div>
            <p style={{ color: '#64748b', fontSize: '15px', fontWeight: 500 }}>
                Signing you in...
            </p>
        </div>
    );
};

export default AuthCallback;
