import React, { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import SkeletonCard from '../components/SkeletonCard';
import ProductCard from '../components/ProductCard';

const API = 'http://localhost:5000/api/v1';

const Search = () => {
    const [searchParams] = useSearchParams();
    const query = searchParams.get('q') || '';
    const [searchInput, setSearchInput] = useState(query);
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (query) {
            setLoading(true);
            setSearchInput(query);
            fetch(`${API}/products?search=${encodeURIComponent(query)}`)
                .then(r => r.json())
                .then(d => {
                    setProducts(d.data?.products || d.data || []);
                    setLoading(false);
                })
                .catch(() => setLoading(false));
        }
    }, [query]);

    const handleSearch = (e) => {
        e.preventDefault();
        if (searchInput.trim()) {
            window.location.href = `/search?q=${encodeURIComponent(searchInput.trim())}`;
        }
    };

    return (
        <div className="container search-page">
            {/* Search Hero */}
            <div className="search-hero">
                <h1 className="search-hero-title">
                    {query ? `Results for "${query}"` : 'Search Products'}
                </h1>
                <form className="search-input-wrap" onSubmit={handleSearch}>
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="11" cy="11" r="8" />
                        <path d="M21 21l-4.35-4.35" />
                    </svg>
                    <input
                        type="text"
                        placeholder="Search for products, brands and more..."
                        value={searchInput}
                        onChange={(e) => setSearchInput(e.target.value)}
                        autoFocus
                    />
                </form>
            </div>

            {/* Results */}
            {loading ? (
                <div className="product-grid">
                    {Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} />)}
                </div>
            ) : !query ? (
                <div style={{ textAlign: 'center', padding: '40px 0' }}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '12px', marginTop: '24px' }}>
                        <h3 style={{ width: '100%', fontSize: '16px', fontWeight: 700, color: '#535766', marginBottom: '8px' }}>
                            Popular Searches
                        </h3>
                        {['T-shirts', 'Jeans', 'Sneakers', 'Hoodies', 'Dresses', 'Jackets', 'Shorts', 'Accessories'].map(term => (
                            <Link
                                key={term}
                                to={`/search?q=${term}`}
                                style={{
                                    padding: '8px 20px',
                                    border: '1px solid #d4d5d9',
                                    borderRadius: '20px',
                                    fontSize: '14px',
                                    color: '#282c3f',
                                    fontWeight: 500,
                                    transition: 'all 0.2s'
                                }}
                            >
                                {term}
                            </Link>
                        ))}
                    </div>
                </div>
            ) : products.length === 0 ? (
                <div className="empty-state">
                    <div className="empty-state-icon">🔍</div>
                    <h3 className="empty-state-title">No results found</h3>
                    <p className="empty-state-text">We couldn't find any products matching "{query}". Try a different search term.</p>
                    <Link to="/shop" className="btn-primary" style={{ marginTop: '12px' }}>Browse All Products</Link>
                </div>
            ) : (
                <>
                    <div className="sort-bar" style={{ marginBottom: '20px' }}>
                        <div className="results-count">
                            Found <strong>{products.length}</strong> results for "<strong>{query}</strong>"
                        </div>
                    </div>
                    <div className="product-grid">
                        {products.map(p => (
                            <ProductCard key={p.id} product={p} />
                        ))}
                    </div>
                </>
            )}
        </div>
    );
};

export default Search;
