import React, { useState } from 'react';
import { RefreshCw, Trash2, LineChart, ExternalLink, ShieldAlert, CheckCircle2 } from 'lucide-react';
import api from '../services/api';

export default function TrackedProductCard({
  product,
  isSelected,
  onSelect,
  onUntrack,
  onScrapeComplete
}) {
  const [isScraping, setIsScraping] = useState(false);

  const handleManualScrape = async (e) => {
    e.stopPropagation();
    setIsScraping(true);
    try {
      const res = await api.scrapeSingleProduct(product.id);
      if (res.success) {
        onScrapeComplete(product.id);
      }
    } catch (err) {
      console.error('Manual scrape failed:', err);
    } finally {
      setIsScraping(false);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'success':
        return <span className="badge badge-success"><CheckCircle2 size={12} /> Success</span>;
      case 'retried':
        return <span className="badge badge-retried">Retried (Recovered)</span>;
      case 'failed':
        return <span className="badge badge-failed"><ShieldAlert size={12} /> Failed</span>;
      default:
        return <span className="badge badge-pending">Pending</span>;
    }
  };

  const formatPrice = (p) => {
    if (p === null || p === undefined) return '—';
    return `₹${Number(p).toLocaleString()}`;
  };

  const timeAgo = (isoString) => {
    if (!isoString) return 'Never';
    const diffMs = Date.now() - new Date(isoString).getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    return new Date(isoString).toLocaleDateString();
  };

  return (
    <div
      className={`product-card ${isSelected ? 'selected-card' : ''}`}
      style={{
        borderColor: isSelected ? 'var(--accent-primary)' : 'var(--border-color)',
        boxShadow: isSelected ? '0 0 25px rgba(99, 102, 241, 0.25)' : 'none'
      }}
      onClick={() => onSelect(product)}
    >
      <div>
        <div className="product-card-top">
          <span className="product-category-badge">{product.category || 'General'}</span>
          {getStatusBadge(product.last_status)}
        </div>

        <h3 className="product-name" title={product.product_name}>
          {product.product_name}
        </h3>

        <div className="product-meta">
          <span>ID: {product.store_product_id}</span>
          <span>•</span>
          <span>SKU: {product.sku || 'N/A'}</span>
        </div>

        <div className="option-badge">
          Option: {product.selected_option_label || product.selected_option}
        </div>

        <div className="price-row">
          <span className="current-price">{formatPrice(product.last_price)}</span>
          {product.last_price && (
            <span className="mrp-price">
              {formatPrice(Math.round(Number(product.last_price) * 1.15))}
            </span>
          )}
        </div>

        <div className="stock-indicator">
          <span
            className={`stock-pill ${
              product.last_stock > 0 ? 'stock-pill-in' : 'stock-pill-out'
            }`}
          >
            {product.last_stock > 0
              ? `${product.last_stock} units in stock`
              : 'Out of stock'}
          </span>
        </div>
      </div>

      <div className="product-card-footer">
        <div>Scraped {timeAgo(product.last_scraped_at)}</div>

        <div className="card-actions" onClick={(e) => e.stopPropagation()}>
          <a
            href={product.target_url || `https://demo.inelabteamdev.com/item/${product.store_product_id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-outline btn-sm"
            title="Open product on Mock Storefront"
          >
            <ExternalLink size={14} />
          </a>

          <button
            onClick={() => onSelect(product)}
            className={`btn ${isSelected ? 'btn-primary' : 'btn-secondary'} btn-sm`}
            title="View Price & Stock History Chart"
          >
            <LineChart size={14} />
          </button>

          <button
            onClick={handleManualScrape}
            disabled={isScraping}
            className="btn btn-secondary btn-sm"
            title="Scrape price & stock now"
          >
            <RefreshCw size={14} className={isScraping ? 'animate-spin' : ''} />
          </button>

          <button
            onClick={() => onUntrack(product.id)}
            className="btn btn-danger btn-sm"
            title="Stop tracking this product"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
