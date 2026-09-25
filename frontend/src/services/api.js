const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

export const api = {
  // Store Catalog
  searchStore: async (query = '', page = 1) => {
    const res = await fetch(`${API_BASE}/store/search?q=${encodeURIComponent(query)}&page=${page}`);
    return res.json();
  },

  getItemDetails: async (storeProductId) => {
    const res = await fetch(`${API_BASE}/store/items/${storeProductId}`);
    return res.json();
  },

  // Tracked Products
  getTrackedProducts: async () => {
    const res = await fetch(`${API_BASE}/products`);
    return res.json();
  },

  trackProduct: async ({ storeProductId, selectedOption, selectedOptionLabel }) => {
    const res = await fetch(`${API_BASE}/products/track`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ storeProductId, selectedOption, selectedOptionLabel })
    });
    return res.json();
  },

  untrackProduct: async (id) => {
    const res = await fetch(`${API_BASE}/products/${id}`, {
      method: 'DELETE'
    });
    return res.json();
  },

  // Product History & Logs
  getProductHistory: async (id) => {
    const res = await fetch(`${API_BASE}/products/${id}/history`);
    return res.json();
  },

  getProductLogs: async (id = 'all') => {
    const res = await fetch(`${API_BASE}/products/${id}/logs`);
    return res.json();
  },

  // Scrape Actions
  scrapeSingleProduct: async (id) => {
    const res = await fetch(`${API_BASE}/products/${id}/scrape`, {
      method: 'POST'
    });
    return res.json();
  },

  triggerCronScrapeAll: async () => {
    const res = await fetch(`${API_BASE}/cron/scrape`, {
      method: 'POST'
    });
    return res.json();
  },

  // CSV Export URL
  getExportCsvUrl: () => `${API_BASE}/export/csv`
};

export default api;
