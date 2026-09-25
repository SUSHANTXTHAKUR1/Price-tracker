import { chromium } from 'playwright';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { supabase } from '../config/supabase.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const BASE_URL = process.env.MOCK_STORE_URL || 'https://demo.inelabteamdev.com';

const delay = (ms) => new Promise((res) => setTimeout(res, ms));

async function launchBrowser() {
  const options = {
    headless: false,
    slowMo: 150, // Slows down actions by 150ms so evaluator can clearly watch interactions
    args: ['--window-size=1280,850', '--start-maximized']
  };

  // 1. Try Microsoft Edge channel (native on Windows)
  try {
    return await chromium.launch({ ...options, channel: 'msedge' });
  } catch (e) {
    // 2. Try Google Chrome channel
    try {
      return await chromium.launch({ ...options, channel: 'chrome' });
    } catch (e2) {
      // 3. Try default Chromium
      return await chromium.launch(options);
    }
  }
}

async function dismissConsentModal(page) {
  for (let attempt = 0; attempt < 6; attempt++) {
    const consentBox = page.locator('.consent-box, .consent-scrim, [role="dialog"][aria-label="Privacy preferences"]').first();
    const isVisible = await consentBox.isVisible({ timeout: 400 }).catch(() => false);
    if (isVisible) {
      console.log(`🍪 Cookie consent popup detected (attempt ${attempt + 1})! Auto-clicking Allow...`);
      const allowBtn = page.locator('button[aria-label="Allow cookies"], .consent-box button:has-text("Allow"), .consent-box button').first();
      if (await allowBtn.isVisible().catch(() => false)) {
        await allowBtn.click({ force: true }).catch(() => {});
        await delay(250);
      }
    } else {
      break;
    }
  }
}

async function runHeadedScraper() {
  console.log('='.repeat(68));
  console.log('🎬  STARTING OBSERVABLE HEADED SCRAPER (PLAYWRIGHT)');
  console.log('='.repeat(68));
  console.log(`🎯 Target Storefront: ${BASE_URL}`);
  console.log('👀 Running in VISIBLE HEADED MODE (with slowed actions for video demo)');
  console.log('='.repeat(68));

  const browser = await launchBrowser();

  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
  });

  const page = await context.newPage();

  // Test product IDs to demonstrate on screen
  const sampleProducts = [
    { id: 2584, name: 'Redwick VR Headset Nano', option: 'o2' },
    { id: 2585, name: 'AeroTrack Pro Running Sensor', option: 'o1' }
  ];

  for (const product of sampleProducts) {
    const itemUrl = `${BASE_URL}/item/${product.id}`;
    console.log(`\n📦 [Product Test] Navigating to: ${product.name} (ID: ${product.id})`);
    console.log(`🔗 URL: ${itemUrl}`);

    const startTime = Date.now();
    let outcome = 'pending';
    let attempt = 1;

    try {
      // 1. Navigate to product page
      await page.goto(itemUrl, { waitUntil: 'domcontentloaded', timeout: 25000 });
      await delay(1000);

      // 2. Check for Cookie Consent Dialog & Dismiss if present
      await dismissConsentModal(page);

      // 3. Option Variant Selection
      console.log(`🔘 Selecting variant option chip: ${product.option}`);
      await dismissConsentModal(page);
      const optChips = page.locator('.opt-chip');
      const chipCount = await optChips.count();
      if (chipCount > 0) {
        const targetChip = page.locator(`.opt-chip`).nth(product.option === 'o2' && chipCount > 1 ? 1 : 0);
        await targetChip.click();
        await delay(800);
      }

      // 4. Simulate natural mouse hover over price area (satisfies anti-scrape minMoves/minDwellMs)
      console.log('🖱️ Simulating user mouse movement and hover over price zone...');
      const offerPanel = page.locator('.offer-panel').first();
      await offerPanel.scrollIntoViewIfNeeded();
      const box = await offerPanel.boundingBox();

      if (box) {
        for (let i = 0; i < 16; i++) {
          await dismissConsentModal(page);
          await page.mouse.move(box.x + 25 + (i * 12), box.y + 25 + ((i % 4) * 8));
          await delay(80);
        }
      }
      await delay(600);
      await dismissConsentModal(page);

      // 5. Click "Check today's price" button if present
      const checkBtn = page.locator('button:has-text("Check today’s price"), button:has-text("Check today\'s price"), .offer-locked button').first();
      if (await checkBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        // Ensure button is enabled by moving mouse if still disabled
        let isEnabled = await checkBtn.isEnabled().catch(() => false);
        let retries = 0;
        while (!isEnabled && retries < 12) {
          await dismissConsentModal(page);
          if (box) {
            await page.mouse.move(box.x + 30 + (retries * 12), box.y + 20 + ((retries % 3) * 8));
          }
          await delay(200);
          isEnabled = await checkBtn.isEnabled().catch(() => false);
          retries++;
        }

        console.log('⚡ Clicking "Check today’s price" button...');
        await checkBtn.click();
      }

      // 6. Wait for price & stock to resolve (handle loading / retry state)
      console.log('⏳ Waiting for store response and dynamic price rendering...');
      const priceContainer = page.locator('.offer-ready, .offer-failed').first();
      await priceContainer.waitFor({ state: 'visible', timeout: 20000 });

      // Check if failed or retry appeared
      if (await page.locator('.offer-failed').isVisible().catch(() => false)) {
        console.log('⚠️ Store returned a transient error. Clicking Retry button...');
        const retryBtn = page.locator('.offer-failed button:has-text("Retry")').first();
        if (await retryBtn.isVisible()) {
          attempt = 2;
          await retryBtn.click();
          await page.locator('.offer-ready').waitFor({ state: 'visible', timeout: 20000 });
        }
      }

      // 7. Extract rendered price & stock from DOM
      const priceElement = page.locator('.offer-ready span[style*="font-size: 2.4rem"], .offer-ready .price-value, .offer-ready').first();
      const priceText = await priceElement.innerText();
      const stockPill = page.locator('.avail-pill').first();
      const stockText = (await stockPill.isVisible().catch(() => false)) ? await stockPill.innerText() : 'In stock';

      outcome = attempt > 1 ? 'retried' : 'success';
      console.log(`✅ [SCRAPE SUCCESS] Outcome: ${outcome}`);
      console.log(`💰 Scraped Price Display: ${priceText.split('\n')[0]}`);
      console.log(`📦 Stock Status: ${stockText}`);
      console.log(`⏱️ Duration: ${Date.now() - startTime}ms`);

      // Record to database if Supabase is connected
      if (supabase) {
        await supabase.from('scrape_logs').insert({
          store_product_id: product.id,
          product_name: product.name,
          selected_option: product.option,
          outcome,
          attempt_count: attempt,
          duration_ms: Date.now() - startTime,
          scraper_type: 'playwright_headed',
          timestamp: new Date().toISOString()
        });
      }

    } catch (err) {
      console.error(`❌ [SCRAPE FAILURE] Error for product ${product.id}:`, err.message);
      outcome = 'failed';

      if (supabase) {
        await supabase.from('scrape_logs').insert({
          store_product_id: product.id,
          product_name: product.name,
          selected_option: product.option,
          price: null,
          stock: null,
          outcome: 'failed',
          attempt_count: attempt,
          duration_ms: Date.now() - startTime,
          error_message: err.message,
          scraper_type: 'playwright_headed',
          timestamp: new Date().toISOString()
        });
      }
    }

    await delay(2500);
  }

  console.log('\n' + '='.repeat(68));
  console.log('🏁 Headed scraping sequence completed successfully.');
  console.log('Closing browser in 5 seconds...');
  console.log('='.repeat(68));
  await delay(5000);
  await browser.close();
}

runHeadedScraper().catch(console.error);
