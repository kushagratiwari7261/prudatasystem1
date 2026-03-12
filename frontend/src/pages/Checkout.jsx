import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const API = 'http://localhost:5000/api/v1';

// Image helper function
const getFullImageUrl = (imagePath) => {
    if (!imagePath) return '/placeholder-image.png';

    // If it's already a full URL, return as is
    if (imagePath.startsWith('http')) {
        return imagePath;
    }

    // If it's a relative path starting with /uploads
    if (imagePath.startsWith('/uploads')) {
        return `http://localhost:5000${imagePath}`;
    }

    // If it's just a filename
    return `http://localhost:5000/uploads/products/${imagePath}`;
};

const Checkout = () => {
    const [step, setStep] = useState(1); // 1=address, 2=payment
    const [paymentMethod, setPaymentMethod] = useState('razorpay');
    const [addresses, setAddresses] = useState([]);
    const [selectedAddress, setSelectedAddress] = useState(null);
    const [cart, setCart] = useState(null);
    const [loading, setLoading] = useState(true);
    const [processing, setProcessing] = useState(false);
    const [toast, setToast] = useState('');
    const [imageErrors, setImageErrors] = useState({});
    const [showAddForm, setShowAddForm] = useState(false);
    const [cityOptions, setCityOptions] = useState([]);
    const [newAddress, setNewAddress] = useState({
        full_name: '',
        phone: '',
        line1: '',
        line2: '',
        landmark: '',
        city: '',
        state: '',
        pincode: '',
        label: 'Home',
        is_default: false
    });
    const navigate = useNavigate();
    const token = localStorage.getItem('accessToken');

    // Load Razorpay script dynamically
    useEffect(() => {
        if (typeof window.Razorpay === 'undefined') {
            const script = document.createElement('script');
            script.src = 'https://checkout.razorpay.com/v1/checkout.js';
            script.async = true;
            document.body.appendChild(script);
        }
    }, []);

    useEffect(() => {
        if (!token) {
            navigate('/login?redirect=checkout');
            return;
        }

        Promise.all([
            fetch(`${API}/addresses`, { headers: { 'Authorization': `Bearer ${token}` } })
                .then(res => res.json())
                .catch(err => ({ success: false, error: err.message })),
            fetch(`${API}/cart`, { headers: { 'Authorization': `Bearer ${token}` } })
                .then(res => res.json())
                .catch(err => ({ success: false, error: err.message }))
        ]).then(([addrData, cartData]) => {
            console.log('Addresses response:', addrData);
            console.log('Cart response:', cartData);

            // Handle addresses response - ALWAYS ensure it's an array
            let addressesArray = [];
            if (addrData.success) {
                // Check if addresses are in data.addresses or directly in data
                addressesArray = addrData.data?.addresses || addrData.data || [];
                // Ensure it's an array
                addressesArray = Array.isArray(addressesArray) ? addressesArray : [];
            }
            setAddresses(addressesArray);

            // Find default address
            const defaultAddr = addressesArray.find(a => a.is_default) || addressesArray[0];
            setSelectedAddress(defaultAddr?.id || null);

            // Handle cart response - process images
            if (cartData.success) {
                const cartDataWithImages = cartData.data || { items: [], totals: {} };

                // Process images in cart items
                if (cartDataWithImages.items) {
                    cartDataWithImages.items = cartDataWithImages.items.map(item => ({
                        ...item,
                        processedImage: getFullImageUrl(item.image || item.product?.images?.[0])
                    }));
                }

                setCart(cartDataWithImages);
            } else {
                setCart({ items: [], totals: {} });
            }

            setLoading(false);
        }).catch(() => {
            setAddresses([]);
            setCart({ items: [], totals: {} });
            setLoading(false);
        });
    }, [token, navigate]);

    const showToastMsg = (msg, isError = false) => {
        setToast(msg);
        setTimeout(() => setToast(''), 3000);
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
                setSelectedAddress(addr.id);
                setShowAddForm(false);
                setNewAddress({
                    full_name: '', phone: '', line1: '', line2: '',
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

    const handlePlaceOrder = async () => {
        if (!selectedAddress) return showToastMsg('Please select a delivery address', true);

        setProcessing(true);

        try {
            // Get the selected address object
            const selectedAddressObj = addresses.find(a => a.id === selectedAddress);

            // Prepare the correct order data structure for backend
            const orderData = {
                address_id: selectedAddress,
                payment_method: paymentMethod
            };

            // Only add coupon_code if there's a coupon in cart
            if (cart?.coupon?.code) {
                orderData.coupon_code = cart.coupon.code;
            }

            console.log('Sending order data:', orderData); // Debug log

            const res = await fetch(`${API}/payments/create-order`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(orderData)
            });

            const data = await res.json();
            console.log('Order response:', data); // Debug log

            if (res.ok && data.success) {
                // Check if it's Razorpay payment
                if (data.data?.razorpay_order_id) {
                    // Make sure Razorpay is loaded
                    if (typeof window.Razorpay === 'undefined') {
                        showToastMsg('Razorpay SDK is loading. Please wait...', true);
                        // Try loading it dynamically if not present
                        const script = document.createElement('script');
                        script.src = 'https://checkout.razorpay.com/v1/checkout.js';
                        script.onload = () => {
                            // Retry after script loads
                            setTimeout(() => handlePlaceOrder(), 500);
                        };
                        document.body.appendChild(script);
                        setProcessing(false);
                        return;
                    }

                    // Configure Razorpay options
                    const options = {
                        key: data.data.key || process.env.REACT_APP_RAZORPAY_KEY_ID || 'rzp_test_SNQ4DAPNDOonss',
                        amount: data.data.amount,
                        currency: data.data.currency || 'INR',
                        name: 'Zenwair Clothing',
                        description: 'Fashion Purchase',
                        order_id: data.data.razorpay_order_id,
                        handler: async function (response) {
                            try {
                                console.log('Payment successful:', response);

                                const verifyRes = await fetch(`${API}/payments/verify`, {
                                    method: 'POST',
                                    headers: {
                                        'Content-Type': 'application/json',
                                        'Authorization': `Bearer ${token}`
                                    },
                                    body: JSON.stringify({
                                        razorpay_order_id: response.razorpay_order_id,
                                        razorpay_payment_id: response.razorpay_payment_id,
                                        razorpay_signature: response.razorpay_signature,
                                        order_id: data.data.order_id
                                    })
                                });

                                const verifyData = await verifyRes.json();
                                console.log('Verification response:', verifyData);

                                if (verifyData.success) {
                                    showToastMsg('Payment successful! Order placed.');
                                    setTimeout(() => navigate('/orders'), 1500);
                                } else {
                                    showToastMsg('Payment verification failed', true);
                                }
                            } catch (error) {
                                console.error('Verification error:', error);
                                showToastMsg('Payment verification failed', true);
                            }
                        },
                        prefill: {
                            name: selectedAddressObj?.full_name || JSON.parse(localStorage.getItem('user') || '{}').name || '',
                            email: JSON.parse(localStorage.getItem('user') || '{}').email || '',
                            contact: selectedAddressObj?.phone || ''
                        },
                        theme: {
                            color: '#ff3f6c'
                        },
                        modal: {
                            ondismiss: async function () {
                                console.log('Payment modal closed');
                                setProcessing(false);
                                
                                // Send cancellation request to backend
                                try {
                                    await fetch(`${API}/payments/cancel`, {
                                        method: 'POST',
                                        headers: {
                                            'Content-Type': 'application/json',
                                            'Authorization': `Bearer ${token}`
                                        },
                                        body: JSON.stringify({
                                            order_id: data.data.order_id
                                        })
                                    });
                                    showToastMsg('Payment failed due to closing checkout', true);
                                    setTimeout(() => navigate('/orders'), 1500); // Redirect to orders to see cancelled order
                                } catch (error) {
                                    console.error('Failed to notify backend of cancellation:', error);
                                }
                            }
                        }
                    };

                    try {
                        const razorpay = new window.Razorpay(options);
                        razorpay.open();
                    } catch (error) {
                        console.error('Razorpay open error:', error);
                        showToastMsg('Failed to open payment gateway', true);
                        setProcessing(false);
                    }
                } else if (data.data?.order_id) {
                    // COD order placed successfully
                    showToastMsg('Order placed successfully!');
                    setTimeout(() => navigate('/orders'), 1500);
                }
            } else {
                showToastMsg(data.message || 'Failed to create order', true);
                setProcessing(false);
            }
        } catch (error) {
            console.error('Order creation error:', error);
            showToastMsg('Payment failed. Please try again.', true);
            setProcessing(false);
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
                        // Only get unique Districts (Cities) per pincode
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

        const timeoutId = setTimeout(fetchPincodeDetails, 500); // Debounce
        return () => clearTimeout(timeoutId);
    }, [newAddress.pincode]);

    const handleImageError = (itemId) => {
        setImageErrors(prev => ({ ...prev, [itemId]: true }));
    };

    if (loading) return <div className="spinner-container"><div className="spinner" /></div>;

    const items = cart?.items || [];

    // Calculate total
    const totalMRP = items.reduce((s, i) => s + ((parseFloat(i.base_price) || parseFloat(i.mrp) || parseFloat(i.final_price) || parseFloat(i.price) || 0) * (i.quantity || 1)), 0);
    const itemsTotal = cart?.items_total !== undefined ? cart.items_total : items.reduce((sum, item) => sum + ((parseFloat(item.final_price) || parseFloat(item.price) || 0) * (item.quantity || 1)), 0);
    const discountOnMRP = totalMRP - itemsTotal;
    const couponDiscount = cart?.coupon?.discount_amount || 0;
    
    const shippingCharge = cart?.shipping_charge !== undefined ? cart.shipping_charge : (itemsTotal - couponDiscount >= 500 ? 0 : 99);
    const finalTotal = cart?.final_total !== undefined ? cart.final_total : (itemsTotal - couponDiscount + shippingCharge);

    return (
        <div className="checkout-page">
            <div className="container">
                {/* Progress Steps */}
                <div className="cart-steps">
                    <div className="cart-step completed">✓ BAG</div>
                    <div className="cart-step-line active" />
                    <div className={`cart-step ${step >= 1 ? 'active' : ''}`}>ADDRESS</div>
                    <div className={`cart-step-line ${step >= 2 ? 'active' : ''}`} />
                    <div className={`cart-step ${step >= 2 ? 'active' : ''}`}>PAYMENT</div>
                </div>

                <div className="checkout-layout">
                    {/* Main Content */}
                    <div>
                        {step === 1 && (
                            <div className="checkout-card">
                                <h3 className="checkout-card-title">📍 Select Delivery Address</h3>

                                {/* SAFE ADDRESS RENDERING */}
                                {Array.isArray(addresses) && addresses.length === 0 && !showAddForm ? (
                                    <div className="empty-state" style={{ minHeight: 'auto', padding: '32px 0' }}>
                                        <p className="empty-state-text">No saved addresses. Add one to proceed.</p>
                                    </div>
                                ) : null}

                                {Array.isArray(addresses) && addresses.length > 0 && (
                                    <div className="addresses-list">
                                        {addresses.map(addr => (
                                            <div
                                                key={addr.id}
                                                className={`address-card ${selectedAddress === addr.id ? 'selected' : ''}`}
                                                onClick={() => setSelectedAddress(addr.id)}
                                            >
                                                <div className="address-card-type">{addr.label || 'Home'}</div>
                                                <div className="address-card-name">{addr.full_name} — {addr.phone}</div>
                                                <div className="address-card-text">
                                                    {addr.line1}{addr.line2 ? `, ${addr.line2}` : ''}<br />
                                                    {addr.landmark && <span>{addr.landmark}<br /></span>}
                                                    {addr.city}, {addr.state} — {addr.pincode}
                                                </div>
                                                {addr.is_default && (
                                                    <span className="default-badge">Default</span>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {!showAddForm ? (
                                    <button
                                        className="btn-secondary"
                                        style={{ marginTop: '12px', width: '100%' }}
                                        onClick={() => setShowAddForm(true)}
                                    >
                                        + Add New Address
                                    </button>
                                ) : (
                                    <form onSubmit={handleAddAddress} style={{ marginTop: '16px' }}>
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

                                {selectedAddress && Array.isArray(addresses) && addresses.length > 0 && (
                                    <button
                                        className="btn-primary"
                                        style={{ width: '100%', marginTop: '20px' }}
                                        onClick={() => setStep(2)}
                                    >
                                        Deliver Here →
                                    </button>
                                )}
                            </div>
                        )}

                        {step === 2 && (
                            <div className="checkout-card">
                                <h3 className="checkout-card-title">💳 Payment</h3>
                                <p style={{ fontSize: '14px', color: '#535766', marginBottom: '24px' }}>
                                    Select your preferred payment method
                                </p>

                                <div className="payment-options" style={{ marginBottom: '24px' }}>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '16px', border: paymentMethod === 'razorpay' ? '2px solid #535766' : '1px solid #eaeaec', borderRadius: '4px', cursor: 'pointer', marginBottom: '12px' }}>
                                        <input type="radio" name="paymentMethod" value="razorpay" checked={paymentMethod === 'razorpay'} onChange={() => setPaymentMethod('razorpay')} style={{ width: '18px', height: '18px', accentColor: '#ff3f6c' }} />
                                        <div style={{ fontWeight: 600 }}>Credit/Debit Card / Net Banking (Razorpay)</div>
                                    </label>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '16px', border: paymentMethod === 'cod' ? '2px solid #535766' : '1px solid #eaeaec', borderRadius: '4px', cursor: 'pointer' }}>
                                        <input type="radio" name="paymentMethod" value="cod" checked={paymentMethod === 'cod'} onChange={() => setPaymentMethod('cod')} style={{ width: '18px', height: '18px', accentColor: '#ff3f6c' }} />
                                        <div style={{ fontWeight: 600 }}>Cash on Delivery (COD)</div>
                                    </label>
                                </div>

                                <div style={{ marginBottom: '16px' }}>
                                    {items.map((item, idx) => {
                                        const itemId = item.variant_id || item.id || idx;
                                        const imgUrl = item.processedImage || getFullImageUrl(item.image || item.product?.images?.[0]);

                                        return (
                                            <div key={itemId} style={{ display: 'flex', gap: '12px', padding: '12px 0', borderBottom: '1px solid #eaeaec' }}>
                                                <div style={{ width: '52px', height: '68px', borderRadius: '4px', overflow: 'hidden', background: '#f5f5f6', flexShrink: 0 }}>
                                                    <img
                                                        src={!imageErrors[itemId] ? imgUrl : '/placeholder-image.png'}
                                                        alt={item.product_title || 'Product'}
                                                        onError={() => handleImageError(itemId)}
                                                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                                    />
                                                </div>
                                                <div>
                                                    <div style={{ fontSize: '14px', fontWeight: 700 }}>{item.product_title || 'Product'}</div>
                                                    <div style={{ fontSize: '13px', color: '#7e818c' }}>
                                                        {item.size && `Size: ${item.size}`} {item.color && `| Color: ${item.color}`}
                                                    </div>
                                                    <div style={{ fontSize: '14px', fontWeight: 700 }}>₹{(item.final_price || 0) * (item.quantity || 1)}</div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>

                                <div style={{ display: 'flex', gap: '12px' }}>
                                    <button className="btn-secondary" onClick={() => setStep(1)}>← Back</button>
                                    <button
                                        className="btn-primary"
                                        style={{ flex: 1 }}
                                        onClick={handlePlaceOrder}
                                        disabled={processing}
                                    >
                                        {processing ? 'Processing...' : (paymentMethod === 'razorpay' ? `Pay ₹${finalTotal}` : `Place Order (COD)`)}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Summary */}
                    <div className="cart-summary">
                        <h3 className="cart-summary-title">Price Details ({items.length} Item{items.length > 1 ? 's' : ''})</h3>
                        <div className="cart-summary-row">
                            <span>Total MRP</span>
                            <span>₹{totalMRP.toFixed(2)}</span>
                        </div>
                        {discountOnMRP > 0 && (
                            <div className="cart-summary-row discount">
                                <span>Discount on MRP</span>
                                <span>-₹{discountOnMRP.toFixed(2)}</span>
                            </div>
                        )}
                        {cart?.coupon && (
                            <div className="cart-summary-row discount">
                                <span>Coupon ({cart.coupon.code})</span>
                                <span>-₹{couponDiscount.toFixed(2)}</span>
                            </div>
                        )}
                        <div className="cart-summary-row">
                            <span>Delivery Fee</span>
                            <span style={{ color: shippingCharge === 0 ? '#03a685' : '#ff3f6c', fontWeight: 600 }}>
                                {shippingCharge === 0 ? 'FREE' : `₹${shippingCharge}`}
                            </span>
                        </div>
                        <div className="cart-summary-row total">
                            <span>Total Amount</span>
                            <span>₹{finalTotal}</span>
                        </div>
                    </div>
                </div>
            </div>

            {toast && <div className={`toast show ${toast.includes('Failed') || toast.includes('failed') ? 'error' : 'success'}`}>{toast}</div>}
        </div>
    );
};

export default Checkout;