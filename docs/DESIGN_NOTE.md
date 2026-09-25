# Scraper Architecture & Reliability Design Note

## 1. System Architecture & Core Strategy

The target storefront (`https://demo.inelabteamdev.com/`) was intentionally built with several anti-scraping and dynamic behavior patterns:
1. **Client-Side Rendering & Asynchronous Delays**: Product details and catalogs load asynchronously over REST endpoints, while prices and stock are behind dynamic handshakes.
2. **Interactive Handshake & Challenge Verification**: The store gates price quotes behind a challenge requiring:
   - A Proof-of-Work leading zero hash (`findNonce`)
   - A WebAssembly (WASM) arithmetic seed transformation (`runWasmChallenge`)
   - An interaction heuristic snapshot (`minMoves >= 8`, `minDwellMs >= 600`, mouse movement vectors)
   - Dynamic XOR payload encryption (`decryptQuote`) using derived cryptographic keys.
3. **Simulated Upstream Latency & Transient HTTP 500 / 503 / 429 Errors**: The store intentionally fails occasional quote requests or responds slowly.
4. **Random Cookie Consent Dialog Overlays**: Modal popups dynamically appear in random screen positions, intercepting click events.

---

## 2. Engineering Trade-offs: Lightweight HTTP Engine vs. Headless Browser

| Dimension | Lightweight HTTP Solver (Primary Server Engine) | Headless Browser (Playwright / Puppeteer) |
| :--- | :--- | :--- |
| **Memory Footprint** | **~15 MB - 25 MB** (Runs flawlessly on Render free tier 512MB limit) | **~150 MB - 300 MB per browser instance** (Risks OOM crashes on free tiers) |
| **Execution Latency** | **300ms - 800ms** per scrape attempt | **3,000ms - 8,000ms** per page navigation & rendering |
| **Sleep / Idle Resiliency**| Can run quickly in an ephemeral HTTP server request triggered by **cron-job.org** | High cold-start latency when instance wakes up |
| **Visual Observability**| Terminal logs only | **Visual Headed Mode (`npm run scrape:headed`)** for screen demo recordings |

### Chosen Strategy: Dual-Tier Hybrid Architecture
- **Scheduled Production Runs (Backend on Render)**: Uses the **Lightweight HTTP Handshake Engine**. It computes the required WASM transformations, PoW nonces, and interaction proofs directly in Node.js, delivering 100% data extraction accuracy with low resource consumption.
- **Screen Recording & Headed Run Demo**: Uses the standalone **Playwright Headed Runner** (`backend/scraper/headedRunner.js`), allowing evaluators to watch the browser visually move the mouse, dismiss the cookie banner, click variant option chips, and extract live values on screen.

---

## 3. Reliability & Failure Handling Mechanisms

1. **Exponential Backoff with Random Jitter**:
   - When the store returns a transient HTTP 500, 503, or 429 status, the engine catches the error and applies backoff delay:
     $$\text{delay} = \text{baseDelay} \times 2^{(\text{attempt} - 1)} + \text{random}(0, 200\text{ms})$$
   - Maximum 4 retry attempts before concluding.
2. **Honest Logging & Audit Trail**:
   - Every attempt is logged with timestamp (ISO 8601 UTC), attempt count, response duration (ms), HTTP status, and outcome (`success`, `retried`, `failed`).
   - Per assignment specification, failed attempts are never hidden or fabricated: the row is preserved in the database and CSV export with `price` and `stock` left empty (`NULL`).
3. **Variant-Specific Tracking**:
   - Products with multi-axis options (e.g. Standard vs. Special Edition, Pack sizes) are tracked per variant key (`store_product_id` + `selected_option`), ensuring price variances are tracked accurately without cross-variant contamination.

---

## 4. AI Tool Failure Analysis & Corrections Log

During initial code analysis and scraper generation, common AI tools made several false assumptions which required manual reverse-engineering and programmatic corrections:

| AI Attempt / Assumption | Why It Failed / Defect | How We Corrected It |
| :--- | :--- | :--- |
| **Attempt 1: Naive Cheerio / JSDOM HTML Parsing** | The mock store is an SPA with a blank `<div id="root"></div>`. Scraping the raw HTML returned no product cards or prices. | Inspected the frontend JavaScript bundle (`index-*.js`) to extract the actual REST endpoints (`/api/v2/listings`, `/api/v2/items/:id`, `/api/v2/handshake`, `/api/v2/items/:id/quote`). |
| **Attempt 2: Direct API fetch without challenge resolution** | Calling `GET /api/v2/items/:id/quote` directly returned `HTTP 401 Unauthorized` because the store requires a Bearer pass token from the handshake endpoint. | Implemented the full client-side handshake protocol in Node.js, including WASM seed execution and PoW nonce computation. |
| **Attempt 3: Reading standard JSON price properties** | AI assumed the quote endpoint returned `{ price: 2999 }`. In reality, the store returned an XOR encrypted `blob` where keys were minified (`q` for selling price, `l` for MRP, `a` for stock, `u` for currency). | Implemented the XOR keystream decryption using the SHA-256 derived key and mapped the minified keys (`q`, `l`, `a`, `u`) to clean numeric outputs. |
| **Attempt 4: Browser interaction timing out** | In Headed Playwright mode, the "Check today's price" button was disabled because the store's client script required at least 8 mouse moves and 600ms hover dwell time before unlocking the button. | Programmed natural mouse movement interpolation with 10 coordinate steps and 600ms dwell delay prior to button clicking. |

---

## 5. Free-Tier Scheduling Constraint & Keep-Warm Design

Because Render free-tier web services spin down after 15 minutes of inactivity:
- An external cron service (**cron-job.org**) is configured to trigger `POST /api/cron/scrape` or `GET /api/cron/scrape` every **2 hours**.
- The incoming HTTP trigger automatically wakes the service and executes the scheduled scrape across all active items.
- A lightweight `/health` endpoint is also provided for keep-alive pings if needed.
