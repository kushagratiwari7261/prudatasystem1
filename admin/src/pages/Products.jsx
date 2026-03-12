import React, { useState, useEffect, useCallback } from 'react';
import Sidebar from '../components/Sidebar';

const API = 'http://localhost:5000/api/v1';

const SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL', '2XL', '3XL'];
const COLORS = [
    { name: 'Black', hex: '#000000' },
    { name: 'White', hex: '#FFFFFF' },
    { name: 'Navy', hex: '#1B2A4A' },
    { name: 'Red', hex: '#DC2626' },
    { name: 'Blue', hex: '#2563EB' },
    { name: 'Green', hex: '#16A34A' },
    { name: 'Grey', hex: '#6B7280' },
    { name: 'Olive', hex: '#4D7C0F' },
    { name: 'Maroon', hex: '#7F1D1D' },
    { name: 'Beige', hex: '#D4A574' },
];

// Image helper function
const getFullImageUrl = (imagePath) => {
    if (!imagePath) return '/placeholder-image.png';

    if (imagePath.startsWith('http')) {
        return imagePath;
    }

    if (imagePath.startsWith('/uploads')) {
        return `http://localhost:5000${imagePath}`;
    }

    return `http://localhost:5000/uploads/products/${imagePath}`;
};

const Products = () => {
    const [products, setProducts] = useState([]);
    const [categories, setCategories] = useState([]);
    const [brands, setBrands] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingProduct, setEditingProduct] = useState(null);
    const [showVariantModal, setShowVariantModal] = useState(false);
    const [showReviewModal, setShowReviewModal] = useState(false);
    const [selectedProduct, setSelectedProduct] = useState(null);
    const [variants, setVariants] = useState([]);
    const [reviews, setReviews] = useState([]);
    const [notification, setNotification] = useState(null);

    const token = localStorage.getItem('adminToken');
    const headers = { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };

    const showNotification = (message, type = 'success') => {
        setNotification({ message, type });
        setTimeout(() => setNotification(null), 3000);
    };

    const fetchProducts = useCallback(async () => {
        try {
            const res = await fetch(`${API}/products?limit=100`, { headers });
            const data = await res.json();
            setProducts(data.data?.products || []);
        } catch (err) {
            console.error('Failed to fetch products:', err);
        }
        setLoading(false);
    }, []);

    const fetchMeta = async () => {
        try {
            const [catRes, brandRes] = await Promise.all([
                fetch(`${API}/categories`, { headers }),
                fetch(`${API}/brands`, { headers })
            ]);
            const catData = await catRes.json();
            const brandData = await brandRes.json();
            setCategories(catData.data?.categories || catData.data || []);
            setBrands(brandData.data?.brands || brandData.data || []);
        } catch (err) {
            console.error('Failed to fetch categories/brands:', err);
        }
    };

    useEffect(() => { fetchProducts(); fetchMeta(); }, []);

    const handleDelete = async (id) => {
        if (!window.confirm('Are you sure you want to delete this product?')) return;
        try {
            await fetch(`${API}/products/${id}`, { method: 'DELETE', headers });
            showNotification('Product deleted');
            fetchProducts();
        } catch (err) {
            showNotification('Failed to delete', 'error');
        }
    };

    const openVariants = async (product) => {
        setSelectedProduct(product);
        setShowVariantModal(true);
        try {
            const res = await fetch(`${API}/variants/product/${product.id}`, { headers });
            const data = await res.json();
            setVariants(data.data?.variants || []);
        } catch (err) {
            console.error('Failed to fetch variants:', err);
        }
    };

    const openReviews = async (product) => {
        setSelectedProduct(product);
        setShowReviewModal(true);
        try {
            const res = await fetch(`${API}/reviews/admin/product/${product.id}`, { headers });
            const data = await res.json();
            setReviews(data.data || []);
        } catch (err) {
            console.error('Failed to fetch reviews:', err);
        }
    };

    return (
        <div style={{ display: 'flex' }}>
            <Sidebar />
            <main style={{ marginLeft: 240, flex: 1, padding: '32px', minHeight: '100vh', background: '#f1f5f9' }}>
                {/* Notification */}
                {notification && (
                    <div style={{
                        position: 'fixed', top: 20, right: 20, zIndex: 9999,
                        padding: '14px 24px', borderRadius: '10px',
                        background: notification.type === 'error' ? '#fee2e2' : '#dcfce7',
                        color: notification.type === 'error' ? '#dc2626' : '#16a34a',
                        fontWeight: 600, fontSize: '14px',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                        animation: 'fadeIn 0.3s ease'
                    }}>
                        {notification.message}
                    </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
                    <div>
                        <h1 style={{ fontSize: '24px', fontWeight: 800, color: '#0f172a', marginBottom: '4px' }}>Products</h1>
                        <p style={{ color: '#64748b', fontSize: '14px' }}>Manage your product catalog</p>
                    </div>
                    <button onClick={() => { setEditingProduct(null); setShowModal(true); }} style={{
                        padding: '12px 24px', background: 'linear-gradient(135deg, #3b82f6, #2563eb)',
                        color: 'white', border: 'none', borderRadius: '10px', fontSize: '14px',
                        fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px',
                        boxShadow: '0 4px 12px rgba(59,130,246,0.3)'
                    }}>
                        ➕ Add Product
                    </button>
                </div>

                {/* Product Cards Grid */}
                {loading ? (
                    <div style={{ textAlign: 'center', padding: '60px 0', color: '#94a3b8' }}>Loading...</div>
                ) : products.length === 0 ? (
                    <div style={{
                        textAlign: 'center', padding: '80px 40px',
                        background: 'white', borderRadius: '16px', border: '1px solid #e2e8f0'
                    }}>
                        <div style={{ fontSize: '48px', marginBottom: '16px' }}>📦</div>
                        <h3 style={{ color: '#0f172a', fontWeight: 700, marginBottom: '8px' }}>No products yet</h3>
                        <p style={{ color: '#64748b', fontSize: '14px' }}>Add your first product to get started</p>
                    </div>
                ) : (
                    <div style={{
                        display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px'
                    }}>
                        {products.map(product => (
                            <ProductCard
                                key={product.id}
                                product={product}
                                onEdit={() => { setEditingProduct(product); setShowModal(true); }}
                                onDelete={() => handleDelete(product.id)}
                                onVariants={() => openVariants(product)}
                                onReviews={() => openReviews(product)}
                            />
                        ))}
                    </div>
                )}

                {/* Product Modal */}
                {showModal && (
                    <ProductModal
                        product={editingProduct}
                        categories={categories}
                        brands={brands}
                        token={token}
                        onClose={() => { setShowModal(false); setEditingProduct(null); }}
                        onSaved={() => { setShowModal(false); setEditingProduct(null); fetchProducts(); showNotification(editingProduct ? 'Product updated' : 'Product created'); }}
                    />
                )}

                {/* Variant Modal */}
                {showVariantModal && selectedProduct && (
                    <VariantModal
                        product={selectedProduct}
                        variants={variants}
                        token={token}
                        onClose={() => { setShowVariantModal(false); setSelectedProduct(null); setVariants([]); }}
                        onRefresh={async () => {
                            const res = await fetch(`${API}/variants/product/${selectedProduct.id}`, { headers });
                            const data = await res.json();
                            setVariants(data.data?.variants || []);
                        }}
                        showNotification={showNotification}
                    />
                )}

                {/* Review Modal */}
                {showReviewModal && selectedProduct && (
                    <ReviewModal
                        product={selectedProduct}
                        reviews={reviews}
                        token={token}
                        onClose={() => { setShowReviewModal(false); setSelectedProduct(null); setReviews([]); }}
                        onRefresh={async () => {
                            const res = await fetch(`${API}/reviews/admin/product/${selectedProduct.id}`, { headers });
                            const data = await res.json();
                            setReviews(data.data || []);
                        }}
                        showNotification={showNotification}
                    />
                )}
            </main>
        </div>
    );
};

/* ===================== PRODUCT CARD ===================== */
const ProductCard = ({ product, onEdit, onDelete, onVariants }) => {
    const images = product.images || [];
    let imgUrl = '/placeholder-image.png';
    if (images.length > 0) {
        const img = images[0];
        if (typeof img === 'string') {
            imgUrl = getFullImageUrl(img);
        } else if (img?.url) {
            imgUrl = getFullImageUrl(img.url);
        }
    }

    return (
        <div style={{
            background: 'white', borderRadius: '14px', overflow: 'hidden',
            border: '1px solid #e2e8f0', transition: 'all 0.2s',
            boxShadow: '0 1px 3px rgba(0,0,0,0.06)'
        }}>
            <div style={{ position: 'relative', height: '200px', background: '#f8fafc', overflow: 'hidden' }}>
                <img src={imgUrl} alt={product.title} style={{
                    width: '100%', height: '100%', objectFit: 'cover'
                }} />
                <div style={{
                    position: 'absolute', top: '10px', right: '10px',
                    display: 'flex', gap: '6px'
                }}>
                    {product.is_featured && (
                        <span style={{
                            background: '#fbbf24', color: '#78350f', padding: '3px 10px',
                            borderRadius: '6px', fontSize: '11px', fontWeight: 700
                        }}>⭐ Featured</span>
                    )}
                    <span style={{
                        background: product.is_active !== false ? '#dcfce7' : '#fee2e2',
                        color: product.is_active !== false ? '#16a34a' : '#dc2626',
                        padding: '3px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: 700
                    }}>
                        {product.is_active !== false ? 'Active' : 'Inactive'}
                    </span>
                </div>
            </div>
            <div style={{ padding: '16px' }}>
                <div style={{ fontSize: '11px', color: '#3b82f6', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>
                    {product.category_name || 'Uncategorized'} • {product.brand_name || 'No Brand'}
                </div>
                <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#0f172a', marginBottom: '8px' }}>{product.title}</h3>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                    <span style={{ fontSize: '18px', fontWeight: 800, color: '#0f172a' }}>
                        ₹{product.discount_price || product.base_price}
                    </span>
                    {product.discount_price && product.base_price > product.discount_price && (
                        <>
                            <span style={{ fontSize: '13px', color: '#94a3b8', textDecoration: 'line-through' }}>₹{product.base_price}</span>
                            <span style={{ fontSize: '12px', color: '#16a34a', fontWeight: 700 }}>
                                {Math.round(((product.base_price - product.discount_price) / product.base_price) * 100)}% OFF
                            </span>
                        </>
                    )}
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                    <button onClick={onVariants} style={{
                        flex: 1, padding: '8px', background: '#f1f5f9', border: '1px solid #e2e8f0',
                        borderRadius: '8px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', color: '#3b82f6'
                    }}>📐 Sizes</button>
                    <button onClick={onReviews} style={{
                        flex: 1, padding: '8px', background: '#fef3c7', border: '1px solid #fde68a',
                        borderRadius: '8px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', color: '#d97706'
                    }}>⭐ Reviews</button>
                    <button onClick={onEdit} style={{
                        flex: 1, padding: '8px', background: '#eff6ff', border: '1px solid #bfdbfe',
                        borderRadius: '8px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', color: '#2563eb'
                    }}>✏️ Edit</button>
                    <button onClick={onDelete} style={{
                        padding: '8px 12px', background: '#fef2f2', border: '1px solid #fecaca',
                        borderRadius: '8px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', color: '#dc2626'
                    }}>🗑️</button>
                </div>
            </div>
        </div>
    );
};

/* ===================== PRODUCT MODAL ===================== */
const ProductModal = ({ product, categories, brands, token, onClose, onSaved }) => {
    const [form, setForm] = useState({
        title: '',
        slug: '',
        description: '',
        category_id: '',
        brand_id: '',
        base_price: '',
        discount_price: '',
        is_featured: false,
        images: [],
        tags: ''
    });
    const [uploading, setUploading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [imageErrors, setImageErrors] = useState({});

    // Initialize form with product data when editing
    useEffect(() => {
        if (product) {
            console.log('Editing product:', product); // Debug log
            setForm({
                title: product.title || '',
                slug: product.slug || '',
                description: product.description || '',
                category_id: product.category_id || '',
                brand_id: product.brand_id || '',
                base_price: product.base_price || '',
                discount_price: product.discount_price || '',
                is_featured: product.is_featured || false,
                images: product.images || [],
                tags: product.tags ? (Array.isArray(product.tags) ? product.tags.join(', ') : product.tags) : ''
            });
        } else {
            // Reset form for new product
            setForm({
                title: '',
                slug: '',
                description: '',
                category_id: '',
                brand_id: '',
                base_price: '',
                discount_price: '',
                is_featured: false,
                images: [],
                tags: ''
            });
        }
    }, [product]);

    const handleChange = (field, value) => {
        setForm(prev => {
            const updated = { ...prev, [field]: value };
            // Auto-generate slug from title for new products
            if (field === 'title' && !product && !prev.slug) {
                updated.slug = value.toLowerCase()
                    .replace(/[^a-z0-9]+/g, '-')
                    .replace(/(^-|-$)/g, '');
            } else if (field === 'slug') {
                // Also sanitize manually entered slugs
                updated.slug = value.toLowerCase()
                    .replace(/[^a-z0-9]+/g, '-')
                    .replace(/(^-|-$)/g, '');
            }
            return updated;
        });
    };

    const handleImageUpload = async (e) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;
        setUploading(true);
        try {
            const formData = new FormData();
            for (let i = 0; i < files.length; i++) {
                formData.append('images', files[i]);
            }
            const res = await fetch(`${API}/upload`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` },
                body: formData
            });
            const data = await res.json();
            if (data.data?.images) {
                const urls = data.data.images.map(img => img.url);
                setForm(prev => ({ ...prev, images: [...prev.images, ...urls] }));
            }
        } catch (err) {
            console.error('Upload failed:', err);
            alert('Failed to upload images');
        }
        setUploading(false);
    };

    const removeImage = (index) => {
        setForm(prev => ({
            ...prev,
            images: prev.images.filter((_, i) => i !== index)
        }));
    };

    const handleImageError = (index) => {
        setImageErrors(prev => ({ ...prev, [index]: true }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            // Validate required fields
            if (!form.title || !form.slug || !form.category_id || !form.base_price) {
                alert('Please fill in all required fields');
                setSaving(false);
                return;
            }

            const body = {
                title: form.title,
                slug: form.slug,
                description: form.description || '',
                category_id: form.category_id,
                brand_id: form.brand_id || null,
                base_price: parseFloat(form.base_price),
                discount_price: form.discount_price ? parseFloat(form.discount_price) : null,
                is_featured: form.is_featured,
                images: form.images || [],
                tags: form.tags ? form.tags.split(',').map(t => t.trim()).filter(Boolean) : []
            };

            console.log('Saving product with data:', body); // Debug log

            const url = product ? `${API}/products/${product.id}` : `${API}/products`;
            const method = product ? 'PUT' : 'POST';

            const res = await fetch(url, {
                method,
                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });

            const data = await res.json();
            console.log('Save response:', data); // Debug log

            if (res.ok && data.success) {
                onSaved();
            } else {
                alert(data.message || 'Failed to save product');
            }
        } catch (err) {
            console.error('Save error:', err);
            alert('Failed to save product');
        }
        setSaving(false);
    };

    const inputStyle = {
        width: '100%', padding: '10px 14px', border: '1px solid #e2e8f0',
        borderRadius: '8px', fontSize: '14px', outline: 'none',
        transition: 'border-color 0.2s'
    };

    const labelStyle = {
        fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '4px', display: 'block'
    };

    return (
        <div style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
            display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
            padding: '40px 20px', zIndex: 1000, overflowY: 'auto'
        }}>
            <div style={{
                background: 'white', borderRadius: '16px', width: '100%', maxWidth: '680px',
                boxShadow: '0 20px 60px rgba(0,0,0,0.2)'
            }}>
                <div style={{
                    padding: '24px 28px', borderBottom: '1px solid #e2e8f0',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                }}>
                    <h2 style={{ fontSize: '20px', fontWeight: 800, color: '#0f172a' }}>
                        {product ? 'Edit Product' : 'Add New Product'}
                    </h2>
                    <button onClick={onClose} style={{
                        width: '36px', height: '36px', borderRadius: '10px',
                        background: '#f1f5f9', border: 'none', fontSize: '18px', cursor: 'pointer'
                    }}>✕</button>
                </div>

                <form onSubmit={handleSubmit} style={{ padding: '24px 28px' }}>
                    {/* Title & Slug */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                        <div>
                            <label style={labelStyle}>Product Title *</label>
                            <input style={inputStyle} value={form.title} placeholder="e.g. Classic Cotton T-Shirt"
                                onChange={(e) => handleChange('title', e.target.value)} required />
                        </div>
                        <div>
                            <label style={labelStyle}>Slug *</label>
                            <input style={inputStyle} value={form.slug} placeholder="auto-generated"
                                onChange={(e) => handleChange('slug', e.target.value)} required />
                        </div>
                    </div>

                    {/* Description */}
                    <div style={{ marginBottom: '16px' }}>
                        <label style={labelStyle}>Description</label>
                        <textarea style={{ ...inputStyle, height: '80px', resize: 'vertical' }}
                            value={form.description} placeholder="Product description..."
                            onChange={(e) => handleChange('description', e.target.value)} />
                    </div>

                    {/* Category & Brand */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                        <div>
                            <label style={labelStyle}>Category *</label>
                            <select style={inputStyle} value={form.category_id}
                                onChange={(e) => handleChange('category_id', e.target.value)} required>
                                <option value="">Select category</option>
                                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label style={labelStyle}>Brand</label>
                            <select style={inputStyle} value={form.brand_id}
                                onChange={(e) => handleChange('brand_id', e.target.value)}>
                                <option value="">Select brand</option>
                                {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                            </select>
                        </div>
                    </div>

                    {/* Prices */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                        <div>
                            <label style={labelStyle}>Base Price (MRP) *</label>
                            <input type="number" style={inputStyle} value={form.base_price}
                                placeholder="₹1999" onChange={(e) => handleChange('base_price', e.target.value)} required />
                        </div>
                        <div>
                            <label style={labelStyle}>Discount Price</label>
                            <input type="number" style={inputStyle} value={form.discount_price}
                                placeholder="₹1499" onChange={(e) => handleChange('discount_price', e.target.value)} />
                        </div>
                        <div>
                            <label style={labelStyle}>Tags</label>
                            <input style={inputStyle} value={form.tags}
                                placeholder="casual, summer" onChange={(e) => handleChange('tags', e.target.value)} />
                        </div>
                    </div>

                    {/* Featured Toggle */}
                    <div style={{ marginBottom: '16px' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
                            <input type="checkbox" checked={form.is_featured}
                                onChange={(e) => handleChange('is_featured', e.target.checked)}
                                style={{ width: '18px', height: '18px', accentColor: '#3b82f6' }} />
                            <span style={{ fontSize: '14px', fontWeight: 600, color: '#374151' }}>⭐ Featured Product</span>
                        </label>
                    </div>

                    {/* Image Upload */}
                    <div style={{ marginBottom: '24px' }}>
                        <label style={labelStyle}>Product Images</label>
                        <div style={{
                            border: '2px dashed #d1d5db', borderRadius: '12px', padding: '24px',
                            textAlign: 'center', background: '#fafbfc', cursor: 'pointer', position: 'relative'
                        }}>
                            <input type="file" multiple accept="image/*" onChange={handleImageUpload}
                                style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer' }} />
                            <div style={{ fontSize: '32px', marginBottom: '8px' }}>📸</div>
                            <p style={{ fontSize: '14px', color: '#6b7280', fontWeight: 500 }}>
                                {uploading ? 'Uploading...' : 'Click or drag images here'}
                            </p>
                            <p style={{ fontSize: '12px', color: '#9ca3af', marginTop: '4px' }}>PNG, JPG up to 5MB each</p>
                        </div>

                        {/* Image Previews */}
                        {form.images.length > 0 && (
                            <div style={{ display: 'flex', gap: '10px', marginTop: '12px', flexWrap: 'wrap' }}>
                                {form.images.map((img, idx) => {
                                    const url = typeof img === 'string'
                                        ? getFullImageUrl(img)
                                        : img?.url ? getFullImageUrl(img.url) : '';
                                    return (
                                        <div key={idx} style={{ position: 'relative', width: '80px', height: '80px', borderRadius: '8px', overflow: 'hidden', border: '1px solid #e2e8f0' }}>
                                            <img
                                                src={!imageErrors[idx] ? url : '/placeholder-image.png'}
                                                alt=""
                                                onError={() => handleImageError(idx)}
                                                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                            />
                                            <button type="button" onClick={() => removeImage(idx)} style={{
                                                position: 'absolute', top: '2px', right: '2px', width: '20px', height: '20px',
                                                background: '#ef4444', color: 'white', border: 'none', borderRadius: '50%',
                                                fontSize: '10px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center'
                                            }}>✕</button>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* Submit */}
                    <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                        <button type="button" onClick={onClose} style={{
                            padding: '12px 24px', background: '#f1f5f9', border: '1px solid #e2e8f0',
                            borderRadius: '10px', fontSize: '14px', fontWeight: 600, cursor: 'pointer', color: '#475569'
                        }}>Cancel</button>
                        <button type="submit" disabled={saving} style={{
                            padding: '12px 32px', background: saving ? '#94a3b8' : 'linear-gradient(135deg, #3b82f6, #2563eb)',
                            color: 'white', border: 'none', borderRadius: '10px', fontSize: '14px',
                            fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer',
                            boxShadow: '0 4px 12px rgba(59,130,246,0.3)'
                        }}>
                            {saving ? 'Saving...' : (product ? 'Update Product' : 'Create Product')}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

/* ===================== VARIANT MODAL ===================== */
const VariantModal = ({ product, variants, token, onClose, onRefresh, showNotification }) => {
    const [newVariant, setNewVariant] = useState({
        size: 'M', color: 'Black', quantity: 50, price_adjustment: 0
    });
    const [saving, setSaving] = useState(false);

    const addVariant = async () => {
        setSaving(true);
        try {
            const sku = `${product.slug?.toUpperCase().slice(0, 6) || 'ZW'}-${newVariant.size}-${newVariant.color.toUpperCase().slice(0, 3)}-${Date.now().toString().slice(-4)}`;
            const colorObj = COLORS.find(c => c.name === newVariant.color);
            const res = await fetch(`${API}/variants`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    product_id: product.id,
                    sku,
                    size: newVariant.size,
                    color: newVariant.color,
                    color_hex: colorObj?.hex || '#000000',
                    price_adjustment: parseFloat(newVariant.price_adjustment) || 0,
                    quantity: parseInt(newVariant.quantity) || 0
                })
            });
            const data = await res.json();
            if (res.ok) {
                showNotification('Variant added');
                onRefresh();
            } else {
                showNotification(data.message || 'Failed to add variant', 'error');
            }
        } catch (err) {
            showNotification('Failed to add variant', 'error');
        }
        setSaving(false);
    };

    const updateStock = async (variantId, quantity) => {
        try {
            await fetch(`${API}/variants/${variantId}`, {
                method: 'PUT',
                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ quantity: parseInt(quantity) })
            });
            onRefresh();
        } catch (err) {
            console.error('Failed to update stock:', err);
        }
    };

    const deleteVariant = async (variantId) => {
        if (!window.confirm('Delete this variant?')) return;
        try {
            await fetch(`${API}/variants/${variantId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            showNotification('Variant deleted');
            onRefresh();
        } catch (err) {
            showNotification('Failed to delete variant', 'error');
        }
    };

    return (
        <div style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
            display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
            padding: '40px 20px', zIndex: 1000, overflowY: 'auto'
        }}>
            <div style={{
                background: 'white', borderRadius: '16px', width: '100%', maxWidth: '700px',
                boxShadow: '0 20px 60px rgba(0,0,0,0.2)'
            }}>
                <div style={{
                    padding: '24px 28px', borderBottom: '1px solid #e2e8f0',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                }}>
                    <div>
                        <h2 style={{ fontSize: '20px', fontWeight: 800, color: '#0f172a' }}>Sizes & Stock</h2>
                        <p style={{ color: '#64748b', fontSize: '13px', marginTop: '2px' }}>{product.title}</p>
                    </div>
                    <button onClick={onClose} style={{
                        width: '36px', height: '36px', borderRadius: '10px',
                        background: '#f1f5f9', border: 'none', fontSize: '18px', cursor: 'pointer'
                    }}>✕</button>
                </div>

                <div style={{ padding: '24px 28px' }}>
                    {/* Add new variant */}
                    <div style={{
                        background: '#f8fafc', borderRadius: '12px', padding: '20px',
                        border: '1px solid #e2e8f0', marginBottom: '24px'
                    }}>
                        <h3 style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a', marginBottom: '12px' }}>Add Variant</h3>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '12px', alignItems: 'end' }}>
                            <div>
                                <label style={{ fontSize: '12px', fontWeight: 600, color: '#64748b', display: 'block', marginBottom: '4px' }}>Size</label>
                                <select value={newVariant.size} onChange={(e) => setNewVariant(p => ({ ...p, size: e.target.value }))}
                                    style={{ width: '100%', padding: '8px 10px', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '13px' }}>
                                    {SIZES.map(s => <option key={s} value={s}>{s}</option>)}
                                </select>
                            </div>
                            <div>
                                <label style={{ fontSize: '12px', fontWeight: 600, color: '#64748b', display: 'block', marginBottom: '4px' }}>Color</label>
                                <select value={newVariant.color} onChange={(e) => setNewVariant(p => ({ ...p, color: e.target.value }))}
                                    style={{ width: '100%', padding: '8px 10px', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '13px' }}>
                                    {COLORS.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
                                </select>
                            </div>
                            <div>
                                <label style={{ fontSize: '12px', fontWeight: 600, color: '#64748b', display: 'block', marginBottom: '4px' }}>Stock Qty</label>
                                <input type="number" value={newVariant.quantity}
                                    onChange={(e) => setNewVariant(p => ({ ...p, quantity: e.target.value }))}
                                    style={{ width: '100%', padding: '8px 10px', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '13px' }} />
                            </div>
                            <button onClick={addVariant} disabled={saving} style={{
                                padding: '8px 16px', background: '#3b82f6', color: 'white',
                                border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: 600,
                                cursor: 'pointer', whiteSpace: 'nowrap'
                            }}>
                                {saving ? '...' : '+ Add'}
                            </button>
                        </div>
                    </div>

                    {/* Existing Variants */}
                    {variants.length === 0 ? (
                        <p style={{ textAlign: 'center', color: '#94a3b8', padding: '20px', fontSize: '14px' }}>
                            No variants yet. Add sizes and stock above.
                        </p>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            {variants.map(v => (
                                <div key={v.id} style={{
                                    display: 'flex', alignItems: 'center', gap: '14px',
                                    padding: '14px 16px', background: '#fafbfc', borderRadius: '10px',
                                    border: '1px solid #e2e8f0'
                                }}>
                                    {v.color_hex && (
                                        <div style={{
                                            width: '24px', height: '24px', borderRadius: '50%',
                                            background: v.color_hex, border: '2px solid #e2e8f0'
                                        }} />
                                    )}
                                    <div style={{ flex: 1 }}>
                                        <span style={{ fontWeight: 700, fontSize: '14px', color: '#0f172a' }}>{v.size}</span>
                                        <span style={{ color: '#64748b', fontSize: '12px', marginLeft: '8px' }}>{v.color}</span>
                                        <span style={{ color: '#94a3b8', fontSize: '11px', marginLeft: '8px' }}>SKU: {v.sku}</span>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <span style={{ fontSize: '12px', color: '#64748b' }}>Stock:</span>
                                        <input type="number" defaultValue={v.quantity || 0} min={0}
                                            style={{
                                                width: '70px', padding: '6px 8px', border: '1px solid #e2e8f0',
                                                borderRadius: '6px', fontSize: '13px', textAlign: 'center'
                                            }}
                                            onBlur={(e) => updateStock(v.id, e.target.value)} />
                                    </div>
                                    <span style={{
                                        fontSize: '11px', fontWeight: 600, padding: '3px 8px', borderRadius: '6px',
                                        background: (v.available || v.quantity || 0) > 10 ? '#dcfce7' : (v.available || v.quantity || 0) > 0 ? '#fef3c7' : '#fee2e2',
                                        color: (v.available || v.quantity || 0) > 10 ? '#16a34a' : (v.available || v.quantity || 0) > 0 ? '#d97706' : '#dc2626'
                                    }}>
                                        {(v.available || v.quantity || 0) > 0 ? `${v.available || v.quantity} avail` : 'Out of stock'}
                                    </span>
                                    <button onClick={() => deleteVariant(v.id)} style={{
                                        padding: '6px 10px', background: '#fef2f2', border: '1px solid #fecaca',
                                        borderRadius: '6px', fontSize: '11px', cursor: 'pointer', color: '#dc2626'
                                    }}>🗑️</button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

/* ===================== REVIEW MODAL ===================== */
const ReviewModal = ({ product, reviews, token, onClose, onRefresh, showNotification }) => {
    
    const deleteReview = async (reviewId) => {
        if (!window.confirm('Are you sure you want to delete this customer review?')) return;
        try {
            const res = await fetch(`${API}/reviews/${reviewId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                showNotification('Review deleted');
                onRefresh();
            } else {
                showNotification('Failed to delete review', 'error');
            }
        } catch (err) {
            showNotification('Failed to delete review', 'error');
        }
    };

    return (
        <div style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
            display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
            padding: '40px 20px', zIndex: 1000, overflowY: 'auto'
        }}>
            <div style={{
                background: 'white', borderRadius: '16px', width: '100%', maxWidth: '600px',
                boxShadow: '0 20px 60px rgba(0,0,0,0.2)'
            }}>
                <div style={{
                    padding: '24px 28px', borderBottom: '1px solid #e2e8f0',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                }}>
                    <div>
                        <h2 style={{ fontSize: '20px', fontWeight: 800, color: '#0f172a' }}>Customer Reviews</h2>
                        <p style={{ color: '#64748b', fontSize: '13px', marginTop: '2px' }}>{product.title}</p>
                    </div>
                    <button onClick={onClose} style={{
                        width: '36px', height: '36px', borderRadius: '10px',
                        background: '#f1f5f9', border: 'none', fontSize: '18px', cursor: 'pointer'
                    }}>✕</button>
                </div>

                <div style={{ padding: '24px 28px', maxHeight: '60vh', overflowY: 'auto' }}>
                    {reviews.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '40px 0', color: '#94a3b8' }}>
                            <div style={{ fontSize: '40px', marginBottom: '12px' }}>⭐</div>
                            <p>No reviews yet for this product.</p>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            {reviews.map(review => (
                                <div key={review.id} style={{
                                    border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px',
                                    background: '#fafbfc', position: 'relative'
                                }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <div style={{
                                                background: review.rating >= 4 ? '#16a34a' : review.rating === 3 ? '#fbbf24' : '#dc2626',
                                                color: 'white', padding: '2px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 700
                                            }}>
                                                {review.rating} ★
                                            </div>
                                            <span style={{ fontWeight: 600, fontSize: '14px', color: '#0f172a' }}>{review.user_name}</span>
                                        </div>
                                        <span style={{ fontSize: '12px', color: '#64748b' }}>
                                            {new Date(review.created_at).toLocaleDateString()}
                                        </span>
                                    </div>
                                    
                                    {review.comment && (
                                        <p style={{ fontSize: '14px', color: '#334155', lineHeight: 1.5, marginBottom: '0' }}>
                                            {review.comment}
                                        </p>
                                    )}

                                    <button 
                                        onClick={() => deleteReview(review.id)}
                                        style={{
                                            position: 'absolute', top: '16px', right: '16px',
                                            background: '#fee2e2', border: 'none', color: '#dc2626',
                                            width: '24px', height: '24px', borderRadius: '4px',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            cursor: 'pointer', fontSize: '12px'
                                        }}
                                        title="Delete Review"
                                    >
                                        ✕
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Products;