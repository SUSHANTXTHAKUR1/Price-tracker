# Mock Storefront — Product Search & Scheduled Price Tracker

A resilient, full-stack price and stock tracking application built for the deliberately challenging mock storefront at [https://demo.inelabteamdev.com/](https://demo.inelabteamdev.com/).

---

## 🌟 Features

- **🔍 Product Search & Variant Picker**: Search the mock store by partial or full product name and choose specific option variants (storage, kit, edition, pack size) to track.
- **⚡ Resilient Hybrid Scraper Engine**: Handles client-side encryption, WASM challenge handshakes, Proof-of-Work nonces, and transient HTTP 500/503/429 store errors with exponential backoff & jitter.
- **📈 Interactive Time-Series Charts**: Visualize live price shifts and stock level changes over time using Recharts.
- **📋 Honest Scrape Audit Log**: Complete audit trail showing every scrape attempt, duration, retry count, HTTP status, and outcome (`success`, `retried`, `failed`).
- **📥 CSV Export (PDF Spec Compliant)**: 1-click export of full scrape history (`store_product_id`, `product_name`, `selected_option`, `timestamp` in ISO 8601 UTC, `price`, `stock`, `outcome`). Failed attempts included with price & stock left blank.
- **🎬 Observable Headed Runner**: Standalone Playwright script (`npm run scrape:headed`) that runs Chromium with visual slowdowns, mouse movement simulations, and cookie popup dismissals for recording demo videos.
- **⏰ Unattended 2-Hour Scheduling**: Protected webhook endpoint configured for external cron services (such as [cron-job.org](https://cron-job.org/)) to wake and execute scrapes across free-tier sleeping backends.

---

## 🛠️ Tech Stack

- **Frontend**: React.js (Vite), Lucide Icons, Recharts, Custom Responsive CSS Design System (Deployed on **Vercel**).
- **Backend**: Node.js (Express), REST API (Deployed on **Render**).
- **Database**: **Supabase** (PostgreSQL) with tables for tracked products, price history, and honest scrape logs.
- **Scraping**: Lightweight HTTP Handshake Engine + Playwright (for headed browser demo).
- **Scheduling**: External Cron ([cron-job.org](https://cron-job.org/)) triggering `/api/cron/scrape` every 2 hours.

---

## 📁 Repository Structure

```text
├── backend/
│   ├── config/
│   │   └── supabase.js             # Supabase PostgreSQL client & in-memory fallback
│   ├── controllers/
│   │   ├── productController.js    # Store search, product tracking & history
│   │   ├── scrapeController.js     # On-demand & scheduled cron scraping
│   │   └── exportController.js     # PDF-compliant CSV export
│   ├── scraper/
│   │   ├── engine.js               # Lightweight HTTP Handshake & Retry Scraper
│   │   └── headedRunner.js         # Playwright Observable Headed visual runner
│   ├── routes/
│   │   └── api.js                  # Express API routes
│   ├── server.js                   # Express server entry point
│   ├── package.json
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Header.jsx          # Top navigation & quick actions
│   │   │   ├── MetricCards.jsx     # Overview statistics & reliability rate
│   │   │   ├── ProductSearchModal.jsx # Live product search & variant selection
│   │   │   ├── TrackedProductCard.jsx # Tracked product cards with quick scrape
│   │   │   ├── PriceStockChart.jsx # Interactive Recharts time-series chart
│   │   │   └── ScrapeAuditLog.jsx  # Honest scrape attempt table & filters
│   │   ├── services/
│   │   │   └── api.js              # Centralized API service client
│   │   ├── App.jsx
│   │   ├── index.css               # Glassmorphic responsive design system
│   │   └── main.jsx
│   ├── index.html
│   └── package.json
├── docs/
│   ├── SCHEMA.sql                  # Supabase database schema & indexes
│   └── DESIGN_NOTE.md              # Architecture trade-offs & AI corrections note
└── README.md
```

---

## 🚀 Local Setup Instructions

### Prerequisites
- Node.js (v18 or higher)
- Git

### 1. Clone the repository
```bash
git clone <your-github-repo-url>
cd Assignment
```

### 2. Configure Database (Supabase)
1. Create a free project on [Supabase](https://supabase.com/).
2. Open the **SQL Editor** in Supabase and run the SQL script found in `docs/SCHEMA.sql`.
3. Copy your **Project URL** and **Anon / Service Role Key** from `Project Settings -> API`.

### 3. Setup Backend
```bash
cd backend
npm install

# Create .env file
cp .env.example .env
```
Edit `backend/.env` with your credentials:
```env
PORT=5000
MOCK_STORE_URL=https://demo.inelabteamdev.com
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
CRON_SECRET=my_secure_cron_token_123
```

Start the backend:
```bash
npm run dev
```
Backend will start on `http://localhost:5000`.

### 4. Setup Frontend
In a new terminal:
```bash
cd frontend
npm install

# Create .env file
echo "VITE_API_URL=http://localhost:5000/api" > .env

# Start frontend development server
npm run dev
```
Frontend will be available at `http://localhost:5173`.

---

## 🎬 Running the Observable Headed Scraper (For Screen Recording)

To record the required **2 to 4-minute screen recording** showing the scraper running visually with natural mouse movements, option chip clicks, and retry handling:

```bash
cd backend
npm run scrape:headed
```
This launches a visible Chromium browser with `slowMo: 150ms` and detailed console logging.

---

## 🌐 Deployment Guide

### Deploy Database
- **Supabase**: Run `docs/SCHEMA.sql` in the Supabase SQL editor.

### Deploy Backend (Render)
1. Connect your GitHub repository to [Render.com](https://render.com/).
2. Create a new **Web Service**:
   - **Root Directory**: `backend`
   - **Build Command**: `npm install`
   - **Start Command**: `node server.js`
3. Add Environment Variables:
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `MOCK_STORE_URL` (`https://demo.inelabteamdev.com`)
   - `CRON_SECRET`

### Deploy Frontend (Vercel)
1. Import your GitHub repository to [Vercel](https://vercel.com/).
2. Set **Root Directory** to `frontend`.
3. Add Environment Variable:
   - `VITE_API_URL`: `https://<your-render-backend>.onrender.com/api`
4. Deploy!

### Setup 2-Hour Scheduled Scrapes (cron-job.org)
1. Sign up at [cron-job.org](https://cron-job.org/).
2. Create a new Cron Job:
   - **URL**: `https://<your-render-backend>.onrender.com/api/cron/scrape`
   - **Schedule**: Every 2 hours (`0 */2 * * *`)
   - **Method**: `GET` or `POST`
   - **Header** (Optional if `CRON_SECRET` is set): `x-cron-key: <your_cron_secret>`

---

## 📄 Deliverables Checklist

- [x] Hosted live site URL on Vercel & Render.
- [x] Public GitHub repository with clean structure.
- [x] Headed mode runnable script (`npm run scrape:headed`).
- [x] Setup & Environment variables guide (`README.md`).
- [x] Design note explaining scraping reliability, trade-offs, and AI corrections (`docs/DESIGN_NOTE.md`).
- [x] Pre-seeded 3 active products with real unattended scrape histories.
