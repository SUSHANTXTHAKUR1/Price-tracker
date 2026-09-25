import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import MetricCards from './components/MetricCards';
import TrackedProductCard from './components/TrackedProductCard';
import PriceStockChart from './components/PriceStockChart';
import ScrapeAuditLog from './components/ScrapeAuditLog';
import ProductSearchModal from './components/ProductSearchModal';
import api from './services/api';
import { Layers, Plus, Loader2, Sparkles } from 'lucide-react';

export default function App() {
  const [products, setProducts] = useState([]);
  const [logs, setLogs] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [productHistory, setProductHistory] = useState([]);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isScrapingAll, setIsScrapingAll] = useState(false);

  // Load tracked products and global logs
  const refreshData = async () => {
    try {
      const [prodRes, logRes] = await Promise.all([
        api.getTrackedProducts(),
        api.getProductLogs('all')
      ]);

      if (prodRes.success) {
        setProducts(prodRes.products || []);

        // Pre-select first product if none selected
        if (!selectedProduct && prodRes.products?.length > 0) {
          setSelectedProduct(prodRes.products[0]);
        }
      }

      if (logRes.success) {
        setLogs(logRes.logs || []);
      }
    } catch (err) {
      console.error('Failed to load tracker dashboard data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    refreshData();
    // Auto-refresh stats every 30 seconds
    const interval = setInterval(refreshData, 30000);
    return () => clearInterval(interval);
  }, []);

  // Fetch price history whenever the selected product changes
  useEffect(() => {
    if (!selectedProduct) return;
    const loadHistory = async () => {
      try {
        const res = await api.getProductHistory(selectedProduct.id);
        if (res.success) {
          setProductHistory(res.history || []);
        }
      } catch (err) {
        console.error('Failed to load product history:', err);
      }
    };
    loadHistory();
  }, [selectedProduct]);

  // Seed default 3 products if workspace has 0 tracked products
  useEffect(() => {
    const seedDefaults = async () => {
      if (!isLoading && products.length === 0) {
        console.log('Seeding initial 3 products for testing & demonstration...');
        const initialItems = [
          { storeProductId: 2584, selectedOption: 'o1', selectedOptionLabel: 'Standard' },
          { storeProductId: 2650, selectedOption: 'o1', selectedOptionLabel: 'Duo Pack' },
          { storeProductId: 2784, selectedOption: 'o1', selectedOptionLabel: 'Aero Kit' }
        ];

        for (const item of initialItems) {
          try {
            await api.trackProduct(item);
          } catch (e) {
            console.warn('Seed product tracking skipped:', e.message);
          }
        }
        refreshData();
      }
    };
    seedDefaults();
  }, [isLoading, products.length]);

  const handleUntrack = async (productId) => {
    if (!window.confirm('Are you sure you want to stop tracking this product?')) return;
    try {
      const res = await api.untrackProduct(productId);
      if (res.success) {
        if (selectedProduct?.id === productId) {
          setSelectedProduct(null);
        }
        refreshData();
      }
    } catch (err) {
      alert(`Untrack failed: ${err.message}`);
    }
  };

  const handleTriggerScrapeAll = async () => {
    setIsScrapingAll(true);
    try {
      const res = await api.triggerCronScrapeAll();
      if (res.success) {
        await refreshData();
        if (selectedProduct) {
          const histRes = await api.getProductHistory(selectedProduct.id);
          if (histRes.success) setProductHistory(histRes.history || []);
        }
      }
    } catch (err) {
      alert(`Scrape All trigger failed: ${err.message}`);
    } finally {
      setIsScrapingAll(false);
    }
  };

  const handleScrapeComplete = async (productId) => {
    await refreshData();
    if (selectedProduct?.id === productId) {
      const histRes = await api.getProductHistory(productId);
      if (histRes.success) setProductHistory(histRes.history || []);
    }
  };

  return (
    <div className="app-container">
      {/* Top Header */}
      <Header
        onOpenSearch={() => setIsSearchOpen(true)}
        onTriggerScrapeAll={handleTriggerScrapeAll}
        isScrapingAll={isScrapingAll}
      />

      {/* Overview Metrics Bar */}
      <MetricCards products={products} logs={logs} />

      {/* Main Tracked Products Section */}
      <div className="section-header">
        <div>
          <h2 className="section-title">
            <Layers size={20} color="var(--accent-primary)" />
            Active Tracked Products
            <span className="section-count">{products.length}</span>
          </h2>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            Each product and variant is automatically polled every 2 hours with exponential backoff
          </p>
        </div>

        <button
          onClick={() => setIsSearchOpen(true)}
          className="btn btn-secondary btn-sm"
        >
          <Plus size={15} /> Add Tracker
        </button>
      </div>

      {isLoading ? (
        <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-secondary)' }}>
          <Loader2 size={32} className="animate-spin" style={{ margin: '0 auto 12px' }} />
          <p>Connecting to store tracker service...</p>
        </div>
      ) : products.length === 0 ? (
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-xl)', padding: '50px', textAlign: 'center', marginBottom: '40px' }}>
          <Sparkles size={36} color="var(--accent-primary)" style={{ margin: '0 auto 12px' }} />
          <h3 style={{ fontSize: '1.2rem', marginBottom: '8px' }}>No Tracked Products Yet</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', marginBottom: '20px' }}>
            Search the hosted mock store and pick products to track their price & stock history over time.
          </p>
          <button onClick={() => setIsSearchOpen(true)} className="btn btn-primary">
            <Plus size={16} /> Track Your First Product
          </button>
        </div>
      ) : (
        <div className="products-grid">
          {products.map((product) => (
            <TrackedProductCard
              key={product.id}
              product={product}
              isSelected={selectedProduct?.id === product.id}
              onSelect={(p) => setSelectedProduct(p)}
              onUntrack={handleUntrack}
              onScrapeComplete={handleScrapeComplete}
            />
          ))}
        </div>
      )}

      {/* Selected Product Price & Stock Chart */}
      {selectedProduct && (
        <PriceStockChart
          product={selectedProduct}
          history={productHistory}
        />
      )}

      {/* Full Scrape Execution & Audit Log Table */}
      <ScrapeAuditLog logs={logs} />

      {/* Product Search & Variant Selection Modal */}
      <ProductSearchModal
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        onProductTracked={(newProduct) => {
          setSelectedProduct(newProduct);
          refreshData();
        }}
      />
    </div>
  );
}
