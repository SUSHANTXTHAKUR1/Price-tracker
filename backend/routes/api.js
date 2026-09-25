import express from 'express';
import {
  searchStoreProducts,
  getStoreProductDetails,
  trackProduct,
  getTrackedProducts,
  untrackProduct,
  getProductPriceHistory,
  getProductScrapeLogs
} from '../controllers/productController.js';
import {
  scrapeSingleProduct,
  triggerScheduledScrapes
} from '../controllers/scrapeController.js';
import {
  exportScrapeHistoryCsv
} from '../controllers/exportController.js';

const router = express.Router();

// Store Catalog & Search Endpoints
router.get('/store/search', searchStoreProducts);
router.get('/store/items/:id', getStoreProductDetails);

// Tracked Products Management
router.get('/products', getTrackedProducts);
router.post('/products/track', trackProduct);
router.delete('/products/:id', untrackProduct);

// Product History & Audit Logs
router.get('/products/:id/history', getProductPriceHistory);
router.get('/products/:id/logs', getProductScrapeLogs);
router.get('/logs', (req, res) => getProductScrapeLogs({ params: { id: 'all' } }, res));

// On-Demand Scraper & Scheduled Cron Trigger
router.post('/products/:id/scrape', scrapeSingleProduct);
router.post('/cron/scrape', triggerScheduledScrapes);
router.get('/cron/scrape', triggerScheduledScrapes); // Supports GET for simple external pingers

// CSV Export
router.get('/export/csv', exportScrapeHistoryCsv);

export default router;
