import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

const API = 'http://localhost:5000/api/v1';

const Account = () => {
    const navigate = useNavigate();
    const location = useLocation();
    
    // Derive activeTab directly from the URL.
    const activeTab = location.pathname.includes('/addresses') ? 'addresses' : 'profile';
    
    const [user, setUser] = useState(JSON.parse(localStorage.getItem('user') || '{}'));
    const [addresses, setAddresses] = useState([]);
    const [loading, setLoading] = useState(false);
    const [toast, setToast] = useState('');
    const [showAddForm, setShowAddForm] = useState(false);
    const [cityOptions, setCityOptions] = useState([]);
    const [newAddress, setNewAddress] = useState({
        full_name: user?.name || '', phone: '', line1: '', line2: '',
        landmark: '', city: '', state: '', pincode: '',
        label: 'Home', is_default: false
    });
    const [editProfile, setEditProfile] = useState({ 
        name: user.name || '', 
        email: user.email || '', 
        phone: user.phone || '',
        gender: user.gender || ''
    });
    const token = localStorage.getItem('accessToken');

    useEffect(() => {
        if (!token) {
            navigate('/login');
            return;
        }

        if (activeTab === 'addresses') {
            setLoading(true);
            fetch(`${API}/addresses`, { headers: { 'Authorization': `Bearer ${token}` } })
                .then(r => {
                    if (r.status === 401) {
                        localStorage.removeItem('accessToken');
                        localStorage.removeItem('refreshToken');
                        localStorage.removeItem('user');
                        window.location.href = '/login';
                        return { data: [] }; // Prevent crash in next .then
                    }
                    return r.json();
                })
                .then(d => { 
                    // Safely extract the addresses array whether it's nested or direct
                    let addrArray = d.data?.addresses || d.data || [];
                    addrArray = Array.isArray(addrArray) ? addrArray : [];

                    setAddresses(addrArray); 
                    setLoading(false); 
                })
                .catch(() => setLoading(false));
        }
    }, [activeTab, token, navigate]); // Added token and navigate to dependencies

    const showToastMsg = (msg, isError = false) => { setToast({ msg, isError }); setTimeout(() => setToast(''), 3000); };

    const handleProfileUpdate = async (e) => {
        e.preventDefault();
        try {
            const res = await fetch(`${API}/auth/profile`, {
                method: 'PUT',
                headers: { 
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    name: editProfile.name,
                    phone: editProfile.phone,
                    gender: editProfile.gender
                })
            });
            const data = await res.json();
            
            if (res.ok && data.success) {
                // Update local storage and state
                const updatedUser = { ...user, ...data.data.user };
                localStorage.setItem('user', JSON.stringify(updatedUser));
                setUser(updatedUser);
                showToastMsg('Profile updated successfully!');
            } else {
                showToastMsg(data.message || 'Failed to update profile', true);
            }
        } catch (error) {
            console.error(error);
            showToastMsg('Failed to update profile', true);
        }
    };

    const handleLogout = () => {
        localStorage.clear(); // This will also clear activeAccountTab, which is desired on logout
        navigate('/');
    };

    const setDefaultAddress = async (id) => {
        try {
            await fetch(`${API}/addresses/${id}/default`, {
                method: 'PUT',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            setAddresses(prev => prev.map(a => ({ ...a, is_default: a.id === id }))); // Changed isDefault to is_default
            showToastMsg('Default address updated');
        } catch { }
    };

    const handleAddAddress = async (e) => {
        e.preventDefault();

        // Validate phone number (10 digits starting with 6-9)
        if (!/^[6-9]\d{9}$/.test(newAddress.phone)) {
            showToastMsg('Please enter a valid 10-digit Indian mobile number', true);
            return;
        }

        // Validate pincode (6 digits)
        if (!/^\d{6}$/.test(newAddress.pincode)) {
            showToastMsg('Please enter a valid 6-digit pincode', true);
            return;
        }

        try {
            const res = await fetch(`${API}/addresses`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(newAddress)
            });

            const data = await res.json();

            if (res.ok && data.success) {
                const addr = data.data.address || data.data;
                setAddresses(prev => {
                    const newAddresses = Array.isArray(prev) ? [...prev, addr] : [addr];
                    return newAddresses;
                });
                setShowAddForm(false);
                setNewAddress({
                    full_name: user?.name || '', phone: '', line1: '', line2: '',
                    landmark: '', city: '', state: '', pincode: '',
                    label: 'Home', is_default: false
                });
                showToastMsg('Address added successfully!');
            } else {
                showToastMsg(data.message || 'Failed to add address', true);
            }
        } catch (error) {
            showToastMsg('Failed to add address', true);
        }
    };

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setNewAddress(prev => ({ ...prev, [name]: value }));
    };

    const handleUseCurrentLocation = () => {
        if (!navigator.geolocation) {
            showToastMsg('Geolocation is not supported by your browser', true);
            return;
        }

        showToastMsg('Fetching your location...');
        
        navigator.geolocation.getCurrentPosition(async (position) => {
            try {
                const { latitude, longitude } = position.coords;
                const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`);
                const data = await response.json();
                
                if (data && data.address) {
                    const { road, suburb, neighbourhood, county, state_district, city_district, city, town, state, postcode } = data.address;
                    
                    const extractedCity = city || town || city_district || state_district || county || '';
                    if (extractedCity) setCityOptions([extractedCity]);

                    setNewAddress(prev => ({
                        ...prev,
                        line1: road || neighbourhood || suburb || '',
                        line2: suburb || city_district || '',
                        city: extractedCity,
                        state: state || '',
                        pincode: postcode || prev.pincode
                    }));
                    showToastMsg('Location fetched successfully!');
                }
            } catch (error) {
                console.error("Geocoding error:", error);
                showToastMsg('Failed to fetch address from location', true);
            }
        }, (error) => {
            console.error("Geolocation error:", error);
            showToastMsg('Failed to get your location. Please check browser permissions.', true);
        });
    };

    // Auto-fill city/state based on pincode API
    useEffect(() => {
        const fetchPincodeDetails = async () => {
            if (newAddress.pincode && newAddress.pincode.length === 6) {
                try {
                    const res = await fetch(`https://api.postalpincode.in/pincode/${newAddress.pincode}`);
                    const data = await res.json();
                    
                    if (data && data[0] && data[0].Status === 'Success' && data[0].PostOffice && data[0].PostOffice.length > 0) {
                        const postOffices = data[0].PostOffice;
                        const options = Array.from(new Set(postOffices.map(po => po.District || po.Block)));
                        
                        setCityOptions(options);

                        setNewAddress(prev => ({
                            ...prev,
                            city: options.includes(prev.city) ? prev.city : (options[0] || postOffices[0].District), 
                            state: prev.state || postOffices[0].State
                        }));
                    } else {
                        setCityOptions([]);
                    }
                } catch (error) {
                    console.error('Pincode fetch error:', error);
                }
            }
        };

        const timeoutId = setTimeout(fetchPincodeDetails, 500); // Debounce typing
        return () => clearTimeout(timeoutId);
    }, [newAddress.pincode]);

    const deleteAddress = async (id) => {
        if (!window.confirm('Delete this address?')) return;
        try {
            await fetch(`${API}/addresses/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            setAddresses(prev => prev.filter(a => a.id !== id));
            showToastMsg('Address deleted');
        } catch { }
    };

    const tabs = [
        { key: 'profile', label: 'Profile', icon: '👤' },
        { key: 'addresses', label: 'Addresses', icon: '📍' },
        { key: 'orders', label: 'My Orders', icon: '📦' },
    ];

    return (
        <div className="container account-page">
            <h1 style={{ fontSize: '22px', fontWeight: 800, marginBottom: '24px' }}>My Account</h1>

            <div className="account-layout">
                {/* Sidebar */}
                <aside className="account-sidebar">
                    <div style={{ textAlign: 'center', padding: '20px 0', borderBottom: '1px solid #eaeaec', marginBottom: '12px' }}>
                        <div style={{
                            width: '64px', height: '64px', borderRadius: '50%',
                            background: 'linear-gradient(135deg, #ff3f6c, #ff6f91)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            margin: '0 auto 8px', fontSize: '24px', color: 'white', fontWeight: 800
                        }}>
                            {(user.name || 'U')[0].toUpperCase()}
                        </div>
                        <div style={{ fontWeight: 700, fontSize: '15px' }}>{user.name || 'User'}</div>
                        <div style={{ fontSize: '13px', color: '#94969f' }}>{user.email || ''}</div>
                    </div>

                    <div 
                        className={`account-sidebar-item ${activeTab === 'profile' ? 'active' : ''}`}
                        onClick={() => navigate('/account')}
                    >
                        <span>👤</span> Profile Details
                    </div>
                    <div 
                        className={`account-sidebar-item ${activeTab === 'addresses' ? 'active' : ''}`}
                        onClick={() => navigate('/account/addresses')}
                    >
                        <span>📍</span> Addresses
                    </div>
                    <div 
                        className={`account-sidebar-item ${activeTab === 'orders' ? 'active' : ''}`}
                        onClick={() => navigate('/orders')}
                    >
                        <span>📦</span> My Orders
                    </div>

                    <div className="account-sidebar-item" onClick={handleLogout} style={{ color: '#ff3f6c', marginTop: '12px' }}>
                        <span>🚪</span> Logout
                    </div>
                </aside>

                {/* Content */}
                <div className="account-content">
                    {activeTab === 'profile' && (
                        <div className="account-card">
                            <h3 className="account-card-title">Edit Profile</h3>
                            <form onSubmit={handleProfileUpdate}>
                                <div className="form-row">
                                    <div className="form-group">
                                        <label className="form-label">Full Name</label>
                                        <input
                                            className="form-input"
                                            value={editProfile.name}
                                            onChange={(e) => setEditProfile(p => ({ ...p, name: e.target.value }))}
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Email</label>
                                        <input
                                            className="form-input"
                                            type="email"
                                            value={editProfile.email}
                                            disabled
                                            style={{ opacity: 0.7 }}
                                        />
                                        <small style={{ color: '#7e818c', fontSize: '12px', marginTop: '4px', display: 'block' }}>Email cannot be changed</small>
                                    </div>
                                </div>
                                <div className="form-row">
                                    <div className="form-group">
                                        <label className="form-label">Phone</label>
                                        <input
                                            className="form-input"
                                            value={editProfile.phone}
                                            onChange={(e) => setEditProfile(p => ({ ...p, phone: e.target.value }))}
                                            placeholder="Enter phone number"
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Gender</label>
                                        <select 
                                            className="form-input" 
                                            value={editProfile.gender || ''}
                                            onChange={(e) => setEditProfile(p => ({ ...p, gender: e.target.value }))}
                                        >
                                            <option value="" disabled>Select</option>
                                            <option value="Male">Male</option>
                                            <option value="Female">Female</option>
                                            <option value="Non-Binary">Non-Binary</option>
                                            <option value="Prefer not to say">Prefer not to say</option>
                                        </select>
                                    </div>
                                </div>
                                <button type="submit" className="btn-primary" style={{ marginTop: '16px' }}>
                                    Save Changes
                                </button>
                            </form>
                        </div>
                    )}

                    {activeTab === 'addresses' && (
                        <div className="account-card">
                            <h3 className="account-card-title">Saved Addresses</h3>
                            {loading ? (
                                <div className="spinner-container" style={{ minHeight: '20vh' }}><div className="spinner" /></div>
                            ) : (
                                <>
                                    {!showAddForm && addresses.length === 0 && (
                                        <div className="empty-state" style={{ minHeight: '20vh', padding: '24px 0' }}>
                                            <div className="empty-state-icon">📍</div>
                                            <h3 className="empty-state-title">No Saved Addresses</h3>
                                            <p className="empty-state-text">Add a delivery address to make checkout faster.</p>
                                        </div>
                                    )}

                                    {!showAddForm && addresses.length > 0 && addresses.map(addr => (
                                        <div key={addr.id} style={{
                                            padding: '16px',
                                            border: `1px solid ${addr.isDefault ? '#ff3f6c' : '#d4d5d9'}`,
                                            borderRadius: '8px',
                                            marginBottom: '12px',
                                            background: addr.isDefault ? '#fff0f5' : 'white'
                                        }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                                <div>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                                                        <span style={{
                                                            fontSize: '11px', fontWeight: 700, textTransform: 'uppercase',
                                                            padding: '2px 8px', background: '#f5f5f6', borderRadius: '4px', color: '#535766'
                                                        }}>
                                                            {addr.label || 'Home'}
                                                        </span>
                                                        {addr.is_default && (
                                                            <span style={{ fontSize: '11px', fontWeight: 700, color: '#ff3f6c' }}>DEFAULT</span>
                                                        )}
                                                    </div>
                                                    <div style={{ fontWeight: 700, fontSize: '14px', marginBottom: '4px' }}>
                                                        {addr.full_name} — {addr.phone}
                                                    </div>
                                                    <div style={{ fontSize: '13px', color: '#535766', lineHeight: 1.5 }}>
                                                        {addr.line1}{addr.line2 ? `, ${addr.line2}` : ''}<br />
                                                        {addr.city}, {addr.state} — {addr.pincode}
                                                    </div>
                                                </div>
                                            </div>
                                            <div style={{ display: 'flex', gap: '12px', marginTop: '12px' }}>
                                                {!addr.is_default && (
                                                    <button
                                                        onClick={() => setDefaultAddress(addr.id)}
                                                        style={{
                                                            background: 'none', border: '1px solid #d4d5d9', padding: '6px 16px',
                                                            borderRadius: '4px', fontSize: '12px', fontWeight: 700, cursor: 'pointer',
                                                            color: '#535766', textTransform: 'uppercase'
                                                        }}
                                                    >
                                                        Set Default
                                                    </button>
                                                )}
                                                <button
                                                    onClick={() => deleteAddress(addr.id)}
                                                    style={{
                                                        background: 'none', border: '1px solid #fce4ec', padding: '6px 16px',
                                                        borderRadius: '4px', fontSize: '12px', fontWeight: 700, cursor: 'pointer',
                                                        color: '#ff3f6c', textTransform: 'uppercase'
                                                    }}
                                                >
                                                    Delete
                                                </button>
                                            </div>
                                        </div>
                                    ))}

                                    {!showAddForm ? (
                                        <button
                                            className="btn-secondary"
                                            style={{ marginTop: '12px', width: '100%' }}
                                            onClick={() => setShowAddForm(true)}
                                        >
                                            + Add New Address
                                        </button>
                                    ) : (
                                        <form onSubmit={handleAddAddress} style={{ marginTop: '16px', padding: '20px', border: '1px solid #eaeaec', borderRadius: '8px' }}>
                                            <h4 style={{ marginBottom: '16px', fontSize: '16px', fontWeight: 'bold' }}>Add New Address</h4>
                                            <button
                                                type="button"
                                                className="btn-secondary"
                                                style={{ marginBottom: '16px', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                                                onClick={handleUseCurrentLocation}
                                            >
                                                📍 Use Current Location
                                            </button>
                                            <div className="form-row">
                                                <div className="form-group">
                                                    <label className="form-label">Full Name</label>
                                                    <input
                                                        className="form-input"
                                                        name="full_name"
                                                        required
                                                        value={newAddress.full_name || JSON.parse(localStorage.getItem('user') || '{}').name || ''}
                                                        onChange={handleInputChange}
                                                    />
                                                </div>
                                                <div className="form-group">
                                                    <label className="form-label">Phone</label>
                                                    <input
                                                        className="form-input"
                                                        name="phone"
                                                        required
                                                        maxLength="10"
                                                        value={newAddress.phone}
                                                        onChange={handleInputChange}
                                                        placeholder="10-digit mobile number"
                                                    />
                                                </div>
                                            </div>

                                            <div className="form-group">
                                                <label className="form-label">Address Line 1</label>
                                                <input
                                                    className="form-input"
                                                    name="line1"
                                                    required
                                                    value={newAddress.line1}
                                                    onChange={handleInputChange}
                                                />
                                            </div>

                                            <div className="form-group">
                                                <label className="form-label">Area/Locality (Optional)</label>
                                                <input
                                                    className="form-input"
                                                    name="line2"
                                                    value={newAddress.line2}
                                                    onChange={handleInputChange}
                                                />
                                            </div>

                                            <div className="form-group">
                                                <label className="form-label">Landmark (Optional)</label>
                                                <input
                                                    className="form-input"
                                                    name="landmark"
                                                    value={newAddress.landmark}
                                                    onChange={handleInputChange}
                                                />
                                            </div>

                                            <div className="form-row">
                                                <div className="form-group">
                                                    <label className="form-label">City</label>
                                                    {cityOptions.length > 0 ? (
                                                        <select
                                                            className="form-input"
                                                            name="city"
                                                            required
                                                            value={newAddress.city}
                                                            onChange={handleInputChange}
                                                        >
                                                            {cityOptions.map((opt, i) => (
                                                                <option key={i} value={opt}>{opt}</option>
                                                            ))}
                                                        </select>
                                                    ) : (
                                                        <input
                                                            className="form-input"
                                                            name="city"
                                                            required
                                                            value={newAddress.city}
                                                            onChange={handleInputChange}
                                                            placeholder="Enter Pincode to auto-fill"
                                                        />
                                                    )}
                                                </div>
                                                <div className="form-group">
                                                    <label className="form-label">State</label>
                                                    <select
                                                        className="form-input"
                                                        name="state"
                                                        required
                                                        value={newAddress.state}
                                                        onChange={handleInputChange}
                                                    >
                                                        <option value="" disabled>Select State</option>
                                                        {[
                                                            "Andaman and Nicobar Islands", "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", 
                                                            "Chandigarh", "Chhattisgarh", "Dadra and Nagar Haveli and Daman and Diu", "Delhi", 
                                                            "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jammu and Kashmir", "Jharkhand", 
                                                            "Karnataka", "Kerala", "Ladakh", "Lakshadweep", "Madhya Pradesh", "Maharashtra", 
                                                            "Manipur", "Meghalaya", "Mizoram", "Nagaland", "Odisha", "Puducherry", "Punjab", 
                                                            "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana", "Tripura", "Uttar Pradesh", 
                                                            "Uttarakhand", "West Bengal"
                                                        ].map(s => <option key={s} value={s}>{s}</option>)}
                                                    </select>
                                                </div>
                                            </div>

                                            <div className="form-row">
                                                <div className="form-group">
                                                    <label className="form-label">Pincode</label>
                                                    <input
                                                        className="form-input"
                                                        name="pincode"
                                                        required
                                                        maxLength={6}
                                                        value={newAddress.pincode}
                                                        onChange={handleInputChange}
                                                        placeholder="6-digit pincode"
                                                    />
                                                </div>
                                                <div className="form-group">
                                                    <label className="form-label">Address Label</label>
                                                    <select
                                                        className="form-input"
                                                        name="label"
                                                        value={newAddress.label}
                                                        onChange={handleInputChange}
                                                    >
                                                        <option value="Home">Home</option>
                                                        <option value="Work">Work</option>
                                                        <option value="Other">Other</option>
                                                    </select>
                                                </div>
                                            </div>

                                            <div className="form-group checkbox-group">
                                                <label>
                                                    <input
                                                        type="checkbox"
                                                        name="is_default"
                                                        checked={newAddress.is_default}
                                                        onChange={(e) => setNewAddress(prev => ({
                                                            ...prev,
                                                            is_default: e.target.checked
                                                        }))}
                                                    />
                                                    Set as default address
                                                </label>
                                            </div>

                                            <div style={{ display: 'flex', gap: '12px' }}>
                                                <button type="submit" className="btn-primary">Save Address</button>
                                                <button type="button" className="btn-secondary" onClick={() => setShowAddForm(false)}>Cancel</button>
                                            </div>
                                        </form>
                                    )}
                                </>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {toast && <div className={`toast show ${toast.isError ? 'error' : 'success'}`}>{toast.msg || toast}</div>}
        </div>
    );
};

export default Account;
