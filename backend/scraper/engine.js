import crypto from 'crypto';

const BASE_URL = process.env.MOCK_STORE_URL || 'https://demo.inelabteamdev.com';
const SALT_CONSTANT = "feffd9" + "24900a" + "ae681d" + "40425d" + "a2e3f3" + "ef53e3" + "ab0a8c" + "2e6acd" + "330b52" + "65f379" + "4b56";

/**
 * SHA256 helper for string inputs
 */
function sha256Hex(str) {
  return crypto.createHash('sha256').update(str).digest('hex');
}

/**
 * SHA256 helper returning Buffer
 */
function sha256Bytes(buf) {
  return crypto.createHash('sha256').update(buf).digest();
}

/**
 * Solves Proof-of-Work leading zeroes challenge
 */
function findNonce(prefix, difficulty) {
  const target = '0'.repeat(difficulty);
  let nonce = 0;
  while (true) {
    const hash = sha256Hex(prefix + ':' + nonce);
    if (hash.startsWith(target)) {
      return nonce;
    }
    nonce++;
  }
}

/**
 * Executes the WASM challenge seed function in WebAssembly
 */
async function runWasmChallenge(wasmBase64, inputSeed) {
  const wasmBuf = Buffer.from(wasmBase64, 'base64');
  const wasmModule = await WebAssembly.compile(wasmBuf);
  const instance = await WebAssembly.instantiate(wasmModule);
  const f = instance.exports.f;
  return (f(inputSeed) | 0);
}

/**
 * Decrypts the XOR encrypted quote blob returned by the store
 */
function decryptQuote(encryptedBase64, pass) {
  const keyHash = sha256Bytes(Buffer.from(SALT_CONSTANT + '|enc|' + pass, 'utf-8'));
  const encBytes = Buffer.from(encryptedBase64, 'base64');
  const decrypted = Buffer.alloc(encBytes.length);
  for (let i = 0; i < encBytes.length; i++) {
    decrypted[i] = encBytes[i] ^ keyHash[i % keyHash.length];
  }
  const jsonStr = decrypted.toString('utf-8');
  return JSON.parse(jsonStr);
}

/**
 * Helper to sleep with jitter for realistic backoff
 */
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Single scrape attempt for a given product ID and option ID
 */
async function singleScrapeAttempt(itemId, optionId, timeoutMs = 15000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    // 1. Fetch Challenge Handshake
    const hsRes = await fetch(`${BASE_URL}/api/v2/handshake`, {
      signal: controller.signal,
      headers: { 'Accept': 'application/json' }
    });

    if (!hsRes.ok) {
      const err = new Error(`Handshake challenge request failed with HTTP ${hsRes.status}`);
      err.httpStatus = hsRes.status;
      throw err;
    }

    const hsData = await hsRes.json();

    // 2. Synthesize realistic client environment & interaction snapshot with genuine timings
    const now = Date.now();
    const envData = {
      env: {
        canvas: "e445ff4df42d887a",
        gl: "4c04ea97a3a891d4",
        hc: 8,
        scr: [1920, 1080, 1],
        frames: [16.6, 16.7, 16.6, 16.6, 16.7, 16.6, 16.6, 16.7],
        at: now
      },
      ix: {
        hoverAt: now - 1200,
        dwellMs: 1200,
        moves: [
          [100, 200, now - 1100],
          [110, 210, now - 1000],
          [120, 220, now - 900],
          [130, 230, now - 800],
          [140, 240, now - 700],
          [150, 250, now - 600],
          [160, 260, now - 500],
          [170, 270, now - 400],
          [180, 280, now - 300],
        ],
        clickAt: now,
        trusted: true
      }
    };
    const attStr = JSON.stringify(envData);
    const attHash = sha256Hex(attStr);

    // 3. Solve challenge math (Seed -> WASM -> PoW Nonce -> Derived key)
    const seedInput = parseInt(sha256Hex(SALT_CONSTANT + '|seed|' + hsData.salt + '|' + attHash).slice(0, 8), 16) | 0;
    const wasmOut = await runWasmChallenge(hsData.wasm, seedInput);
    const nonce = findNonce(hsData.salt, hsData.difficulty);
    const derived = sha256Hex(SALT_CONSTANT + '|derive|' + hsData.salt + '|' + wasmOut + '|' + attHash);

    // 4. Submit Handshake Solution
    const postBody = {
      ...hsData,
      nonce,
      derived,
      wasmOut,
      att: attStr,
      itemId: Number(itemId),
      option: optionId
    };

    const hsPostRes = await fetch(`${BASE_URL}/api/v2/handshake`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(postBody),
      signal: controller.signal
    });

    if (!hsPostRes.ok) {
      const errText = await hsPostRes.text();
      const err = new Error(`Handshake submission failed with HTTP ${hsPostRes.status}: ${errText}`);
      err.httpStatus = hsPostRes.status;
      throw err;
    }

    const { pass } = await hsPostRes.json();

    if (!pass) {
      const err = new Error('Handshake passed response did not contain pass token.');
      err.httpStatus = 401;
      throw err;
    }

    // 5. Fetch Encrypted Live Price Quote
    const quoteRes = await fetch(`${BASE_URL}/api/v2/items/${itemId}/quote?opt=${encodeURIComponent(optionId)}`, {
      headers: {
        'Authorization': `Bearer ${pass}`,
        'Accept': 'application/json'
      },
      signal: controller.signal
    });

    if (!quoteRes.ok) {
      const errText = await quoteRes.text();
      const err = new Error(`Quote retrieval failed with HTTP ${quoteRes.status}: ${errText}`);
      err.httpStatus = quoteRes.status;
      throw err;
    }

    const quoteJson = await quoteRes.json();
    if (!quoteJson.blob) {
      const err = new Error('Quote response missing encrypted payload blob.');
      err.httpStatus = 502;
      throw err;
    }

    const raw = decryptQuote(quoteJson.blob, pass);

    // Map obfuscated server keys
    const sellingPrice = raw.q !== undefined ? raw.q : (raw.shown !== undefined ? raw.shown : (raw.k !== undefined ? raw.k : raw.price));
    const mrpPrice = raw.l !== undefined ? raw.l : (raw.mrp !== undefined ? raw.mrp : null);
    const stockCount = raw.a !== undefined ? raw.a : (raw.stock !== undefined ? raw.stock : 0);
    const currency = raw.u || raw.currency || 'INR';
    const rating = raw.h !== undefined ? raw.h : raw.rating;
    const ratingCount = raw.hn !== undefined ? raw.hn : raw.ratingCount;
    const seller = raw.vd || raw.seller;
    const deliveryDays = raw.eta || raw.deliveryDays;

    return {
      price: sellingPrice !== undefined && sellingPrice !== null ? Number(sellingPrice) : null,
      mrp: mrpPrice !== undefined && mrpPrice !== null ? Number(mrpPrice) : null,
      stock: stockCount !== undefined && stockCount !== null ? Number(stockCount) : 0,
      currency,
      rating,
      ratingCount,
      seller,
      deliveryDays,
      httpStatus: 200
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Resilient Scraper Engine with Exponential Backoff, Jitter, and Honest Error Logging
 * Max retries: 4
 */
export async function scrapeProductPrice({ storeProductId, selectedOption, maxRetries = 4, baseDelayMs = 500 }) {
  const startTime = Date.now();
  let attempt = 0;
  let lastError = null;
  let lastHttpStatus = null;

  while (attempt < maxRetries) {
    attempt++;
    const attemptStartTime = Date.now();

    try {
      const result = await singleScrapeAttempt(storeProductId, selectedOption);
      const totalDuration = Date.now() - startTime;
      const outcome = attempt === 1 ? 'success' : 'retried';

      return {
        success: true,
        outcome,
        price: result.price,
        mrp: result.mrp,
        stock: result.stock,
        currency: result.currency,
        rating: result.rating,
        seller: result.seller,
        attemptCount: attempt,
        durationMs: totalDuration,
        httpStatus: 200,
        errorMessage: null,
        timestamp: new Date().toISOString()
      };
    } catch (err) {
      lastError = err;
      lastHttpStatus = err.httpStatus || 500;
      const attemptDuration = Date.now() - attemptStartTime;

      console.warn(`[Scraper Warning] Attempt ${attempt}/${maxRetries} failed for item ${storeProductId} (opt: ${selectedOption}) in ${attemptDuration}ms: ${err.message}`);

      if (attempt < maxRetries) {
        const backoff = Math.floor((baseDelayMs * Math.pow(2, attempt - 1)) + (Math.random() * 300));
        await sleep(backoff);
      }
    }
  }

  // If all retries exhausted, return honest failed record
  const totalDuration = Date.now() - startTime;
  return {
    success: false,
    outcome: 'failed',
    price: null,
    stock: null,
    currency: null,
    rating: null,
    seller: null,
    attemptCount: attempt,
    durationMs: totalDuration,
    httpStatus: lastHttpStatus,
    errorMessage: lastError ? lastError.message : 'Unknown scraping error after retries',
    timestamp: new Date().toISOString()
  };
}

/**
 * Helper to fetch store catalog listings with auto-retries
 */
export async function fetchStoreCatalog({ page = 1, limit = 50, retries = 3 } = {}) {
  for (let i = 1; i <= retries; i++) {
    try {
      const controller = new AbortController();
      const tid = setTimeout(() => controller.abort(), 12000);
      const res = await fetch(`${BASE_URL}/api/v2/listings?page=${page}&limit=${limit}`, { signal: controller.signal });
      clearTimeout(tid);
      if (!res.ok) throw new Error(`Catalog HTTP ${res.status}`);
      return await res.json();
    } catch (e) {
      if (i === retries) throw e;
      await sleep(500 * i);
    }
  }
}

/**
 * Helper to fetch complete details with auto-retries
 */
export async function fetchStoreItem(storeProductId, retries = 3) {
  for (let i = 1; i <= retries; i++) {
    try {
      const controller = new AbortController();
      const tid = setTimeout(() => controller.abort(), 12000);
      const res = await fetch(`${BASE_URL}/api/v2/items/${storeProductId}`, { signal: controller.signal });
      clearTimeout(tid);
      if (!res.ok) throw new Error(`Product HTTP ${res.status}`);
      return await res.json();
    } catch (e) {
      if (i === retries) throw e;
      await sleep(500 * i);
    }
  }
}

export default {
  scrapeProductPrice,
  fetchStoreCatalog,
  fetchStoreItem
};
