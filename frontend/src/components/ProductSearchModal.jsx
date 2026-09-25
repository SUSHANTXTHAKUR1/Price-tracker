import React, { useState, useEffect } from 'react';
import { Search, X, Plus, Loader2, Check, ExternalLink } from 'lucide-react';
import api from '../services/api';

export default function ProductSearchModal({ isOpen, onClose, onProductTracked }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedVariants, setSelectedVariants] = useState({});
  const [trackingLoading, setTrackingLoading] = useState({});
  const [productDetails, setProductDetails] = useState({});

  useEffect(() => {
    if (!isOpen) {
      setQuery('');
      setResults([]);
      return;
    }
    // Load initial catalog sample on open
    performSearch('');
  }, [isOpen]);

  const performSearch = async (searchTerm) => {
    setLoading(true);
    try {
      const data = await api.searchStore(searchTerm);
      if (data.success) {
        setResults(data.results || []);

        // Pre-fetch details for visible items to know their option axes
        data.results.slice(0, 10).forEach(async (item) => {
          if (!productDetails[item.id]) {
            try {
              const detailData = await api.getItemDetails(item.id);
              if (detailData.success && detailData.product) {
                setProductDetails(prev => ({ ...prev, [item.id]: detailData.product }));
                if (detailData.product.options && detailData.product.options.length > 0) {
                  setSelectedVariants(prev => ({
                    ...prev,
                    [item.id]: prev[item.id] || detailData.product.options[0].id
                  }));
                }
              }
            } catch (e) {
              console.warn(`Could not load options for item ${item.id}`, e);
            }
          }
        });
      }
    } catch (err) {
      console.error('Failed to search store:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    performSearch(query);
  };

  const handleTrack = async (item) => {
    const detail = productDetails[item.id];
    const options = detail?.options || [{ id: 'o1', label: 'Standard' }];
    const chosenOptionId = selectedVariants[item.id] || options[0]?.id || 'o1';
    const chosenOptionObj = options.find(o => o.id === chosenOptionId) || options[0];

    setTrackingLoading(prev => ({ ...prev, [item.id]: true }));
    try {
      const res = await api.trackProduct({
        storeProductId: item.id,
        selectedOption: chosenOptionId,
        selectedOptionLabel: chosenOptionObj?.label || chosenOptionId
      });

      if (res.success) {
        onProductTracked(res.product);
        onClose();
      } else {
        alert(`Error tracking product: ${res.error}`);
      }
    } catch (err) {
      console.error('Tracking failed:', err);
      alert(`Tracking failed: ${err.message}`);
    } finally {
      setTrackingLoading(prev => ({ ...prev, [item.id]: false }));
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 700 }}>Search Mock Storefront</h2>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              Search by partial or full name, then pick the exact option variant to track
            </p>
          </div>
          <button onClick={onClose} className="btn btn-outline btn-sm" style={{ padding: '6px' }}>
            <X size={18} />
          </button>
        </div>

        <div className="modal-body">
          <form onSubmit={handleSearchSubmit} className="search-input-wrapper">
            <Search size={18} className="search-icon" />
            <input
              type="text"
              className="search-input"
              placeholder="Search products (e.g., 'VR Headset', 'Drone', 'Camera', 'Lamp')..."
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                performSearch(e.target.value);
              }}
              autoFocus
            />
          </form>

          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '40px', color: 'var(--text-secondary)' }}>
              <Loader2 size={28} className="animate-spin" />
            </div>
          ) : (
            <div className="search-results-list">
              {results.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                  No products found matching "{query}".
                </div>
              ) : (
                results.map((item) => {
                  const detail = productDetails[item.id];
                  const options = detail?.options || [];
                  const currentOpt = selectedVariants[item.id] || (options[0] ? options[0].id : 'o1');

                  return (
                    <div key={item.id} className="search-result-item">
                      <div style={{ flex: 1, marginRight: '16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                          <span className="product-category-badge">{item.category}</span>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>SKU: {item.sku}</span>
                        </div>
                        <h4 style={{ fontSize: '0.98rem', fontWeight: 600, color: '#ffffff', marginBottom: '4px' }}>
                          {item.name}
                        </h4>
                        <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                          {item.description}
                        </p>

                        {/* Variant Selector */}
                        {options.length > 0 && (
                          <div style={{ marginTop: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                              {detail?.optionAxis || 'Option'}:
                            </span>
                            <select
                              className="option-select"
                              value={currentOpt}
                              onChange={(e) => setSelectedVariants(prev => ({ ...prev, [item.id]: e.target.value }))}
                            >
                              {options.map((opt) => (
                                <option key={opt.id} value={opt.id}>
                                  {opt.label}
                                </option>
                              ))}
                            </select>
                          </div>
                        )}
                      </div>

                      <button
                        onClick={() => handleTrack(item)}
                        disabled={trackingLoading[item.id]}
                        className="btn btn-primary btn-sm"
                      >
                        {trackingLoading[item.id] ? (
                          <Loader2 size={15} className="animate-spin" />
                        ) : (
                          <Plus size={15} />
                        )}
                        Track
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
