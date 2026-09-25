import { supabase } from '../config/supabase.js';
import { fetchStoreCatalog, fetchStoreItem, scrapeProductPrice } from '../scraper/engine.js';
import crypto from 'crypto';

// In-Memory Fallback store if Supabase credentials are not yet supplied
const memStore = {
  tracked: [],
  history: [],
  logs: []
};

/**
 * Search the mock store catalog by query string
 */
export async function searchStoreProducts(req, res) {
  try {
    const q = (req.query.q || '').trim().toLowerCase();
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 40;

    const catalog = await fetchStoreCatalog({ page, limit });
    let results = catalog.results || [];

    if (q) {
      results = results.filter(item => 
        item.name.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q) ||
        (item.brand && item.brand.toLowerCase().includes(q)) ||
        (item.sku && item.sku.toLowerCase().includes(q))
      );
    }

    res.json({
      success: true,
      totalCount: catalog.count,
      returnedCount: results.length,
      results
    });
  } catch (err) {
    console.error('Error searching products:', err);
    res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * Fetch product options and details by store product ID
 */
export async function getStoreProductDetails(req, res) {
  try {
    const { id } = req.params;
    const item = await fetchStoreItem(id);
    res.json({ success: true, product: item });
  } catch (err) {
    console.error(`Error fetching item ${req.params.id}:`, err);
    res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * Track a new product + option variant
 */
export async function trackProduct(req, res) {
  try {
    const { storeProductId, selectedOption, selectedOptionLabel } = req.body;

    if (!storeProductId || !selectedOption) {
      return res.status(400).json({ success: false, error: 'storeProductId and selectedOption are required.' });
    }

    // Fetch product details from store to ensure valid metadata
    const item = await fetchStoreItem(storeProductId);
    const optionObj = item.options.find(o => o.id === selectedOption) || { id: selectedOption, label: selectedOptionLabel || selectedOption };
    const optionLabel = optionObj.label || selectedOption;
    const targetUrl = `https://demo.inelabteamdev.com/item/${storeProductId}`;

    // Perform immediate initial scrape
    const initialScrape = await scrapeProductPrice({ storeProductId, selectedOption });

    let trackedRecord = null;

    if (supabase) {
      // Upsert into tracked_products
      const { data, error } = await supabase
        .from('tracked_products')
        .upsert({
          store_product_id: Number(storeProductId),
          product_name: item.name,
          selected_option: selectedOption,
          selected_option_label: optionLabel,
          target_url: targetUrl,
          category: item.category,
          brand: item.brand,
          sku: item.sku,
          is_active: true,
          last_scraped_at: initialScrape.timestamp,
          last_price: initialScrape.price,
          last_stock: initialScrape.stock,
          last_status: initialScrape.outcome
        }, { onConflict: 'store_product_id,selected_option' })
        .select()
        .single();

      if (error) throw error;
      trackedRecord = data;

      // Insert price history if scrape succeeded
      if (initialScrape.success) {
        await supabase.from('price_history').insert({
          tracked_product_id: trackedRecord.id,
          store_product_id: Number(storeProductId),
          product_name: item.name,
          selected_option: selectedOption,
          price: initialScrape.price,
          mrp: initialScrape.mrp,
          stock: initialScrape.stock,
          currency: initialScrape.currency,
          rating: initialScrape.rating,
          seller: initialScrape.seller,
          recorded_at: initialScrape.timestamp
        });
      }

      // Record honest scrape log
      await supabase.from('scrape_logs').insert({
        tracked_product_id: trackedRecord.id,
        store_product_id: Number(storeProductId),
        product_name: item.name,
        selected_option: selectedOption,
        timestamp: initialScrape.timestamp,
        price: initialScrape.price,
        stock: initialScrape.stock,
        outcome: initialScrape.outcome,
        attempt_count: initialScrape.attemptCount,
        duration_ms: initialScrape.durationMs,
        http_status: initialScrape.httpStatus,
        error_message: initialScrape.errorMessage,
        scraper_type: 'http_engine'
      });

    } else {
      // Memory store fallback
      const existingIdx = memStore.tracked.findIndex(
        p => p.store_product_id === Number(storeProductId) && p.selected_option === selectedOption
      );

      trackedRecord = {
        id: crypto.randomUUID(),
        store_product_id: Number(storeProductId),
        product_name: item.name,
        selected_option: selectedOption,
        selected_option_label: optionLabel,
        target_url: targetUrl,
        category: item.category,
        brand: item.brand,
        sku: item.sku,
        is_active: true,
        last_scraped_at: initialScrape.timestamp,
        last_price: initialScrape.price,
        last_stock: initialScrape.stock,
        last_status: initialScrape.outcome,
        created_at: new Date().toISOString()
      };

      if (existingIdx >= 0) {
        memStore.tracked[existingIdx] = trackedRecord;
      } else {
        memStore.tracked.push(trackedRecord);
      }

      if (initialScrape.success) {
        memStore.history.push({
          id: crypto.randomUUID(),
          tracked_product_id: trackedRecord.id,
          store_product_id: Number(storeProductId),
          product_name: item.name,
          selected_option: selectedOption,
          price: initialScrape.price,
          mrp: initialScrape.mrp,
          stock: initialScrape.stock,
          currency: initialScrape.currency,
          rating: initialScrape.rating,
          seller: initialScrape.seller,
          recorded_at: initialScrape.timestamp
        });
      }

      memStore.logs.push({
        id: crypto.randomUUID(),
        tracked_product_id: trackedRecord.id,
        store_product_id: Number(storeProductId),
        product_name: item.name,
        selected_option: selectedOption,
        timestamp: initialScrape.timestamp,
        price: initialScrape.price,
        stock: initialScrape.stock,
        outcome: initialScrape.outcome,
        attempt_count: initialScrape.attemptCount,
        duration_ms: initialScrape.durationMs,
        http_status: initialScrape.httpStatus,
        error_message: initialScrape.errorMessage,
        scraper_type: 'http_engine'
      });
    }

    res.json({
      success: true,
      message: 'Product successfully tracked and initial scrape recorded.',
      product: trackedRecord,
      initialScrape
    });

  } catch (err) {
    console.error('Error tracking product:', err);
    res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * List all tracked products
 */
export async function getTrackedProducts(req, res) {
  try {
    if (supabase) {
      const { data, error } = await supabase
        .from('tracked_products')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return res.json({ success: true, products: data || [] });
    }

    return res.json({ success: true, products: memStore.tracked });
  } catch (err) {
    console.error('Error fetching tracked products:', err);
    res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * Untrack / Remove a tracked product
 */
export async function untrackProduct(req, res) {
  try {
    const { id } = req.params;

    if (supabase) {
      const { error } = await supabase
        .from('tracked_products')
        .delete()
        .eq('id', id);

      if (error) throw error;
      return res.json({ success: true, message: 'Product untracked.' });
    }

    memStore.tracked = memStore.tracked.filter(p => p.id !== id);
    res.json({ success: true, message: 'Product untracked.' });
  } catch (err) {
    console.error('Error untracking product:', err);
    res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * Get Price History for a tracked product
 */
export async function getProductPriceHistory(req, res) {
  try {
    const { id } = req.params;

    if (supabase) {
      const { data, error } = await supabase
        .from('price_history')
        .select('*')
        .eq('tracked_product_id', id)
        .order('recorded_at', { ascending: true });

      if (error) throw error;
      return res.json({ success: true, history: data || [] });
    }

    const history = memStore.history
      .filter(h => h.tracked_product_id === id)
      .sort((a, b) => new Date(a.recorded_at) - new Date(b.recorded_at));

    res.json({ success: true, history });
  } catch (err) {
    console.error('Error fetching price history:', err);
    res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * Get Scrape Logs for a tracked product or all logs
 */
export async function getProductScrapeLogs(req, res) {
  try {
    const { id } = req.params;

    if (supabase) {
      let query = supabase.from('scrape_logs').select('*');
      if (id && id !== 'all') {
        query = query.eq('tracked_product_id', id);
      }
      const { data, error } = await query.order('timestamp', { ascending: false }).limit(100);

      if (error) throw error;
      return res.json({ success: true, logs: data || [] });
    }

    let logs = memStore.logs;
    if (id && id !== 'all') {
      logs = logs.filter(l => l.tracked_product_id === id);
    }
    logs = logs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)).slice(0, 100);

    res.json({ success: true, logs });
  } catch (err) {
    console.error('Error fetching scrape logs:', err);
    res.status(500).json({ success: false, error: err.message });
  }
}

export { memStore };
