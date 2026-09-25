import { supabase } from '../config/supabase.js';
import { scrapeProductPrice } from '../scraper/engine.js';
import { memStore } from './productController.js';
import crypto from 'crypto';

/**
 * Scrape a single tracked product on demand
 */
export async function scrapeSingleProduct(req, res) {
  try {
    const { id } = req.params;
    let product = null;

    if (supabase) {
      const { data, error } = await supabase
        .from('tracked_products')
        .select('*')
        .eq('id', id)
        .single();
      if (error) throw error;
      product = data;
    } else {
      product = memStore.tracked.find(p => p.id === id);
    }

    if (!product) {
      return res.status(404).json({ success: false, error: 'Tracked product not found.' });
    }

    const scrapeResult = await scrapeProductPrice({
      storeProductId: product.store_product_id,
      selectedOption: product.selected_option
    });

    if (supabase) {
      // Update tracked_product latest stats
      await supabase
        .from('tracked_products')
        .update({
          last_scraped_at: scrapeResult.timestamp,
          last_price: scrapeResult.price,
          last_stock: scrapeResult.stock,
          last_status: scrapeResult.outcome
        })
        .eq('id', product.id);

      // Insert price history if success
      if (scrapeResult.success) {
        await supabase.from('price_history').insert({
          tracked_product_id: product.id,
          store_product_id: product.store_product_id,
          product_name: product.product_name,
          selected_option: product.selected_option,
          price: scrapeResult.price,
          mrp: scrapeResult.mrp,
          stock: scrapeResult.stock,
          currency: scrapeResult.currency,
          rating: scrapeResult.rating,
          seller: scrapeResult.seller,
          recorded_at: scrapeResult.timestamp
        });
      }

      // Record honest scrape log
      await supabase.from('scrape_logs').insert({
        tracked_product_id: product.id,
        store_product_id: product.store_product_id,
        product_name: product.product_name,
        selected_option: product.selected_option,
        timestamp: scrapeResult.timestamp,
        price: scrapeResult.price,
        stock: scrapeResult.stock,
        outcome: scrapeResult.outcome,
        attempt_count: scrapeResult.attemptCount,
        duration_ms: scrapeResult.durationMs,
        http_status: scrapeResult.httpStatus,
        error_message: scrapeResult.errorMessage,
        scraper_type: 'http_engine'
      });

    } else {
      // Memory Store update
      product.last_scraped_at = scrapeResult.timestamp;
      product.last_price = scrapeResult.price;
      product.last_stock = scrapeResult.stock;
      product.last_status = scrapeResult.outcome;

      if (scrapeResult.success) {
        memStore.history.push({
          id: crypto.randomUUID(),
          tracked_product_id: product.id,
          store_product_id: product.store_product_id,
          product_name: product.product_name,
          selected_option: product.selected_option,
          price: scrapeResult.price,
          mrp: scrapeResult.mrp,
          stock: scrapeResult.stock,
          currency: scrapeResult.currency,
          rating: scrapeResult.rating,
          seller: scrapeResult.seller,
          recorded_at: scrapeResult.timestamp
        });
      }

      memStore.logs.push({
        id: crypto.randomUUID(),
        tracked_product_id: product.id,
        store_product_id: product.store_product_id,
        product_name: product.product_name,
        selected_option: product.selected_option,
        timestamp: scrapeResult.timestamp,
        price: scrapeResult.price,
        stock: scrapeResult.stock,
        outcome: scrapeResult.outcome,
        attempt_count: scrapeResult.attemptCount,
        duration_ms: scrapeResult.durationMs,
        http_status: scrapeResult.httpStatus,
        error_message: scrapeResult.errorMessage,
        scraper_type: 'http_engine'
      });
    }

    res.json({
      success: true,
      message: `Scrape completed for ${product.product_name}`,
      result: scrapeResult
    });

  } catch (err) {
    console.error('Error during single product scrape:', err);
    res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * Scheduled Cron Trigger - Scrapes all active tracked products
 * Endpoint: POST /api/cron/scrape or GET /api/cron/scrape (for easy cron service setup)
 */
export async function triggerScheduledScrapes(req, res) {
  const cronSecret = process.env.CRON_SECRET;
  const providedAuth = req.headers['x-cron-key'] || req.query.key || req.headers.authorization?.replace('Bearer ', '');

  // Optional Secret Validation (if CRON_SECRET is configured)
  if (cronSecret && providedAuth !== cronSecret) {
    return res.status(401).json({ success: false, error: 'Unauthorized cron request.' });
  }

  const startTime = Date.now();
  console.log(`\n⏰ [CRON TRIGGER] Starting scheduled scrape run at ${new Date().toISOString()}...`);

  try {
    let productsToScrape = [];

    if (supabase) {
      const { data, error } = await supabase
        .from('tracked_products')
        .select('*')
        .eq('is_active', true);
      if (error) throw error;
      productsToScrape = data || [];
    } else {
      productsToScrape = memStore.tracked.filter(p => p.is_active);
    }

    if (productsToScrape.length === 0) {
      return res.json({
        success: true,
        message: 'No active tracked products to scrape.',
        scrapedCount: 0,
        durationMs: Date.now() - startTime
      });
    }

    const scrapeSummaries = [];

    // Run sequentially with small pause to prevent hammering the mock storefront
    for (const product of productsToScrape) {
      console.log(`🔍 Scraping tracked item ${product.store_product_id} (${product.product_name} - opt: ${product.selected_option})...`);
      const scrapeResult = await scrapeProductPrice({
        storeProductId: product.store_product_id,
        selectedOption: product.selected_option
      });

      if (supabase) {
        await supabase
          .from('tracked_products')
          .update({
            last_scraped_at: scrapeResult.timestamp,
            last_price: scrapeResult.price,
            last_stock: scrapeResult.stock,
            last_status: scrapeResult.outcome
          })
          .eq('id', product.id);

        if (scrapeResult.success) {
          await supabase.from('price_history').insert({
            tracked_product_id: product.id,
            store_product_id: product.store_product_id,
            product_name: product.product_name,
            selected_option: product.selected_option,
            price: scrapeResult.price,
            mrp: scrapeResult.mrp,
            stock: scrapeResult.stock,
            currency: scrapeResult.currency,
            rating: scrapeResult.rating,
            seller: scrapeResult.seller,
            recorded_at: scrapeResult.timestamp
          });
        }

        await supabase.from('scrape_logs').insert({
          tracked_product_id: product.id,
          store_product_id: product.store_product_id,
          product_name: product.product_name,
          selected_option: product.selected_option,
          timestamp: scrapeResult.timestamp,
          price: scrapeResult.price,
          stock: scrapeResult.stock,
          outcome: scrapeResult.outcome,
          attempt_count: scrapeResult.attemptCount,
          duration_ms: scrapeResult.durationMs,
          http_status: scrapeResult.httpStatus,
          error_message: scrapeResult.errorMessage,
          scraper_type: 'http_engine'
        });

      } else {
        product.last_scraped_at = scrapeResult.timestamp;
        product.last_price = scrapeResult.price;
        product.last_stock = scrapeResult.stock;
        product.last_status = scrapeResult.outcome;

        if (scrapeResult.success) {
          memStore.history.push({
            id: crypto.randomUUID(),
            tracked_product_id: product.id,
            store_product_id: product.store_product_id,
            product_name: product.product_name,
            selected_option: product.selected_option,
            price: scrapeResult.price,
            mrp: scrapeResult.mrp,
            stock: scrapeResult.stock,
            currency: scrapeResult.currency,
            rating: scrapeResult.rating,
            seller: scrapeResult.seller,
            recorded_at: scrapeResult.timestamp
          });
        }

        memStore.logs.push({
          id: crypto.randomUUID(),
          tracked_product_id: product.id,
          store_product_id: product.store_product_id,
          product_name: product.product_name,
          selected_option: product.selected_option,
          timestamp: scrapeResult.timestamp,
          price: scrapeResult.price,
          stock: scrapeResult.stock,
          outcome: scrapeResult.outcome,
          attempt_count: scrapeResult.attemptCount,
          duration_ms: scrapeResult.durationMs,
          http_status: scrapeResult.httpStatus,
          error_message: scrapeResult.errorMessage,
          scraper_type: 'http_engine'
        });
      }

      scrapeSummaries.push({
        id: product.id,
        name: product.product_name,
        option: product.selected_option,
        outcome: scrapeResult.outcome,
        price: scrapeResult.price,
        stock: scrapeResult.stock
      });

      // Brief delay between products
      await new Promise(r => setTimeout(r, 400));
    }

    const totalDuration = Date.now() - startTime;
    console.log(`✅ [CRON COMPLETE] Scraped ${productsToScrape.length} products in ${totalDuration}ms.`);

    res.json({
      success: true,
      message: `Completed scheduled scrape for ${productsToScrape.length} products.`,
      scrapedCount: productsToScrape.length,
      durationMs: totalDuration,
      results: scrapeSummaries
    });

  } catch (err) {
    console.error('Error during scheduled cron scrape:', err);
    res.status(500).json({ success: false, error: err.message });
  }
}
