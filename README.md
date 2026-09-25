# 🛍️ Mock Storefront — Scheduled Price & Stock Tracker

A production-grade, resilient price tracking application built for the deliberately challenging mock storefront at [https://demo.inelabteamdev.com/](https://demo.inelabteamdev.com/).

---

## 🌐 Live Deployments & Links

| Service | Role | Live URL / Status |
| :--- | :--- | :--- |
| **Frontend** | React (Vite) Dashboard | [Deployed on Vercel](https://price-tracker-three-kappa.vercel.app/) *(or your Vercel URL)* |
| **Backend API** | Express REST Service | [https://price-tracker-backend-0l04.onrender.com](https://price-tracker-backend-0l04.onrender.com) |
| **Database** | PostgreSQL | Hosted on [Supabase](https://supabase.com/) |
| **Target Store** | Mock Storefront | [https://demo.inelabteamdev.com/](https://demo.inelabteamdev.com/) |
| **Cron Trigger** | 2-Hour Scheduled Scrapes | Active via [cron-job.org](https://cron-job.org/) |

---

## 🎯 Project Overview & Challenge Summary

The mock store was engineered with several dynamic anti-scraping defenses:
1. **Interactive Anti-Scrape Handshake**: Price quotes require solving Proof-of-Work (PoW) nonces, executing WebAssembly (WASM) functions, and generating client interaction heuristics (8 mouse vectors + 600ms dwell time).
2. **Encrypted Payload Blobs**: Quotes are XOR encrypted using SHA-256 derived keys and return minified keys (`q` for price, `l` for MRP, `a` for stock).
3. **Simulated Server Flakiness**: The store intentionally generates intermittent `HTTP 500`, `503`, and `429` errors and latency spikes.
4. **Free-Tier Sleeping Backends**: Render free-tier instances sleep after 15 minutes of inactivity.

### 💡 Our Solution: Dual-Tier Architecture
- **Production Engine (Render Cloud)**: A lightweight HTTP solver in Node.js that computes WASM seeds, PoW nonces, and keystream decryptions in **~400ms using only ~20 MB RAM** with exponential backoff retries.
- **Observable Headed Mode (Playwright)**: An interactive visual runner (`npm run scrape:headed`) simulating human mouse movements, dismissing cookie modals, and extracting rendered prices for demonstration videos.

---

## ✨ Key Features

- **🔍 Live Search & Variant Tracker**: Search catalog by partial or full name and track specific product variants (storage, kit, edition, pack size).
- **📈 Interactive Time-Series Charts**: Real-time visual tracking of price fluctuations and stock movements using Recharts.
- **📋 Honest Scrape Audit Log**: Complete per-product audit trail recording timestamps (ISO 8601 UTC), duration (ms), retry counts, HTTP status, and outcomes (`success`, `retried`, `failed`).
- **📥 PDF-Compliant CSV Export**: One-click download of full scrape history. Failed attempts are included honestly with price and stock left blank.
- **⏰ Unattended 2-Hour Cron**: Triggered externally via `cron-job.org` hitting `/api/cron/scrape`.

---

## 🔑 Environment Variables Required

### Backend (`backend/.env` & Render)
```env
PORT=5000
MOCK_STORE_URL=https://demo.inelabteamdev.com
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your_supabase_anon_key
```

### Frontend (`frontend/.env` & Vercel)
```env
VITE_API_URL=https://your-backend-app.onrender.com/api
```

---

## 🎬 How to Run Observable Headed Scraper

To run the visual browser scraper for demo recordings:
```bash
cd backend
npm run scrape:headed
```

---

## 💻 Local Quickstart

```bash
# 1. Start Backend
cd backend
npm install
npm run dev

# 2. Start Frontend (in a second terminal)
cd frontend
npm install
npm run dev
```

---

## 📄 Documentation Links
- [**Design & Reliability Note (docs/DESIGN_NOTE.md)**](docs/DESIGN_NOTE.md) — Detailed trade-offs, retry math, and AI corrections log.
- [**Database Schema (docs/SCHEMA.sql)**](docs/SCHEMA.sql) — PostgreSQL schema with RLS policies and indexes.
