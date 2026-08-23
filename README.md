# Aladdin Investing — v3.0.0

<div align="center">

![Platform](https://img.shields.io/badge/Platform-Aladdin%20Investing-blue)
![Version](https://img.shields.io/badge/version-3.0.0-brightgreen)
![Node](https://img.shields.io/badge/node-%3E%3D18.0.0-green)
![React](https://img.shields.io/badge/React-19-61dafb)
![License](https://img.shields.io/badge/license-ISC-lightgrey)

**AI-Powered Unified Financial Investor Platform for Indian Markets**

</div>

---

## 🧞 Overview

Aladdin Investing is a full-stack monorepo that unifies three financial applications into a single investor-grade platform:

| Sub-app | Port | Purpose |
|---|---|---|
| **Aladdin Core** (React SPA + Express API) | `:3001` | Main platform — Dashboard, Screener, Sankey, DCF, Technical, etc. |
| **Financial Monitor** | `:5000` | Portfolio tracking, watchlists, price refresh via Yahoo Finance |
| **NewsFeed Google AI** | `:3002` | AI-curated financial news with sentiment scoring |
| **Vite Dev Server** | `:3000` | HMR development proxy (forwards to all 3 backends) |

---

## 🗂️ Project Structure

```
aladdin-investing/                    ← Monorepo root
│
├── server.js                         ← Express API (port 3001) — 30+ endpoints
├── package.json                      ← Root dependencies (Express, yahoo-finance2…)
├── start-platform.bat                ← One-click: starts all 4 services
├── .env.example                      ← Copy to .env and fill in API keys
│
├── services/                         ← Backend service layer
│   ├── fundamentals-csv.js           ← Screener.csv parser (1,435 co. · 60 cols)
│   ├── gs-sheet.js                   ← Google Sheet parser (1,113 co. · 104 cols)
│   ├── market-quotes.js              ← Yahoo Finance live quotes
│   ├── technical-analysis.js         ← Pure-JS RSI / MACD / Bollinger / EMA
│   ├── news-intelligence.js          ← RSS feed scoring + sentiment
│   ├── watsonx.js                    ← IBM watsonx / Gemini AI gateway
│   └── kite-proxy.js                 ← Zerodha Kite Connect bridge
│
├── data/                             ← Static data
│   ├── screener.csv                  ← 1,435 companies · 60 Screener.in columns
│   └── google-sheet-main.csv         ← 1,113 companies · 104-col FUNDA sheet cache
│
├── api/                              ← Legacy API server (backward compat)
├── fetchers/                         ← NSE data fetchers
├── database/                         ← SQLite schema + init
│
├── frontend/                         ← React 19 + Vite SPA
│   ├── vite.config.js                ← Proxy: /api→3001, /fm-api→5000, /nf-api→3002
│   ├── package.json
│   └── src/
│       ├── App.jsx                   ← Router + TopBar + TickerStrip
│       ├── index.css                 ← Dark-mode design system (Bloomberg-inspired)
│       ├── components/
│       │   ├── shared.jsx            ← Loading, ErrorBox, Signal, GradeBadge, fmtCr
│       │   └── DummyDataBanner.jsx   ← Red banner when live data unavailable
│       └── pages/                   ← 16 pages
│           ├── Dashboard.jsx         ← Market overview, FII/DII, VIX, PCR
│           ├── Markets.jsx           ← India / US / Commodities tabs
│           ├── Screener.jsx          ← 23-filter stock screener, CSV export
│           ├── AdvancedScreener.jsx  ← GS 104-col screener (Composite Score, Jumps)
│           ├── SankeyPage.jsx        ← SankeyMATIC P&L flow · multi-ticker compare
│           ├── StockDeepDive.jsx     ← 9-section stock deep-dive
│           ├── PeerComparison.jsx    ← Up to 5 stocks side-by-side radar
│           ├── Fundamentals.jsx      ← Industry screener + grading
│           ├── TechnicalPage.jsx     ← Live OHLCV + RSI/MACD/Bollinger
│           ├── NewsPage.jsx          ← Sector-filtered news + sentiment
│           ├── NewsMapPage.jsx       ← Geo × Sector news heatmap
│           ├── PortfolioPage.jsx     ← Holdings · live P&L · sector pie
│           ├── DCFPage.jsx           ← DCF + Graham + Lynch PEG + Reverse DCF
│           ├── IPOCalendar.jsx       ← IPO listing with live Yahoo prices
│           ├── Strategies.jsx        ← Strategy radar from CSV data
│           └── FinancialMonitorPage.jsx ← Embedded Financial Monitor
│
├── public-react/                     ← Built React (git-ignored; run npm run build)
│
├── financial-monitor/                ← Sub-app: portfolio/watchlist tracker
│   ├── server/
│   │   ├── server.js                 ← Express API (port 5000)
│   │   ├── controllers/
│   │   └── services/
│   └── client/                       ← React frontend
│
└── NewsFeed-Google-AI-/              ← Sub-app: AI news feed
    ├── server.ts                     ← Bun/Node server (port 3002)
    └── dist/server.cjs               ← Compiled output
```

---

## 🚀 Quick Start

### Prerequisites
- Node.js ≥ 18
- Git

### 1. Clone & Install

```bash
git clone https://github.com/SaurabhSolanki26/aladdin-investing.git
cd aladdin-investing

# Install root dependencies
npm install

# Install frontend dependencies
cd frontend && npm install && cd ..

# Install Financial Monitor dependencies
cd financial-monitor && npm install && cd ..
```

### 2. Configure environment

```bash
cp .env.example .env
# Edit .env and fill in your API keys (watsonx, Gemini, Kite)
```

### 3. Build the React app

```bash
npm run build
```

### 4. Start all services

```bash
# Windows — double-click or run:
start-platform.bat

# Or start individually:
node server.js                                          # :3001 — Main API
cd financial-monitor && node server/server.js           # :5000 — FM API
cd NewsFeed-Google-AI- && SET PORT=3002 && node dist/server.cjs  # :3002
cd frontend && npx vite --port 3000                    # :3000 — Dev (HMR)
```

### 5. Open

| URL | Page |
|---|---|
| http://localhost:3001 | 🧞 Full platform (production build) |
| http://localhost:3000 | ⚡ Dev server with HMR |

---

## 📄 Pages

| Route | Page | Description |
|---|---|---|
| `/` | Dashboard | Market indices, FII/DII proxy, VIX, PCR, quick links |
| `/markets` | Markets | India / US stocks + 12 commodity futures |
| `/screener` | Screener | 23 filters, 5 presets, CSV export (1,435 cos) |
| `/advanced-screener` | GS Screener | Composite Score, Jump Signals, All-Green, ROE Consistency |
| `/sankey` | SankeyMATIC | P&L waterfall · up to 4 tickers · % overlay mode |
| `/stock/:symbol` | Deep Dive | 9-section analysis + GrowthRadar + JumpSignals |
| `/compare` | Peer Compare | Up to 5 stocks, RadarChart, winner table |
| `/fundamentals` | Fundamentals | Industry leaderboard, grading system (/21) |
| `/technical` | Technical | Live OHLCV from Yahoo, RSI, MACD, Bollinger |
| `/portfolio` | Portfolio | localStorage holdings, live P&L, sector pie |
| `/dcf` | DCF Valuation | DCF + Graham + Lynch PEG + Reverse DCF |
| `/news` | News | Sector-filtered, search, High Impact tab |
| `/newsmap` | News Map | Geo × Sector sentiment heatmap |
| `/ipo` | IPO Calendar | Upcoming + recent IPOs with live prices |
| `/strategies` | Strategies | Investment strategy radar from real CSV |
| `/monitor` | FM Monitor | Financial Monitor embedded |

---

## 🔌 API Reference

### Core Market Data
```
GET /api/quotes/india          — Nifty 50 / Sensex / Bank Nifty (Yahoo)
GET /api/quotes/us             — S&P 500 / Dow / Nasdaq / VIX
GET /api/quotes/commodities    — 12 futures: Gold, Silver, Crude, NG, Copper…
GET /api/quotes/ticker         — Ticker strip data
GET /api/quotes/ipo            — IPO listing data
```

### Fundamentals (screener.csv · 1,435 companies)
```
GET /api/fundamentals/list             — All companies (paginated)
GET /api/fundamentals/search?q=TCS    — Search by name/NSE code
GET /api/fundamentals/analyse?q=TCS   — Full 60-col analysis + AI grade
GET /api/fundamentals/screener         — 23-filter deep screener
GET /api/fundamentals/top?metric=roe  — Top N by metric
GET /api/fundamentals/industry         — Industry averages
GET /api/fundamentals/compare?symbols=TCS,INFY  — Side-by-side
```

### Google Sheet (104-col FUNDA sheet · 1,113 companies)
```
GET  /api/gs/top?n=50              — Top by Composite Score
GET  /api/gs/company?q=TCS         — Single company (104 cols)
GET  /api/gs/search?q=infosys      — Autocomplete
GET  /api/gs/jumps?type=profit     — Jump signal accelerators
GET  /api/gs/all-green             — All 4 momentum signals 🟢
GET  /api/gs/industry-leaders      — Best per industry
GET  /api/gs/roe-consistency       — ROE above 3+5Y averages
GET  /api/gs/screener              — 14-filter advanced screener
GET  /api/gs/tickers               — All 1,113 tickers for autocomplete
GET  /api/gs/sankey-data?q=TCS     — Financial flow fields for Sankey
POST /api/gs/refresh               — Force reload from Google Sheets
```

### Stock Deep Dive
```
GET /api/stock/search-suggest?q=tcs     — Autocomplete (top 10)
GET /api/stock/deep-dive?q=TCS          — Full deep-dive + live price + peers
GET /api/stock/price-history?symbol=TCS.NS&period=1y  — OHLCV history
```

### Macro
```
GET /api/macro/india-vix    — India VIX from Yahoo
GET /api/macro/pcr          — Put/Call ratio proxy
GET /api/macro/fii-dii      — FII/DII proxy (index-movement based)
```

### AI
```
POST /api/ai/analyze-stock   — watsonx → Gemini → fallback
POST /api/ai/summarize-ipo
POST /api/ai/classify-news
GET  /api/ai/health
```

---

## ⚙️ Environment Variables

```env
# IBM watsonx (optional)
WATSONX_API_KEY=
WATSONX_PROJECT_ID=
WATSONX_URL=

# Google Gemini (fallback AI)
GEMINI_API_KEY=

# Zerodha Kite Connect (optional)
KITE_API_KEY=
KITE_ACCESS_TOKEN=
```

---

## 🏗️ Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19 · Vite 8 · Recharts · React Router 7 |
| Backend API | Node.js 18+ · Express 4 · yahoo-finance2 v4 |
| Data | Screener.in CSV export · Google Sheets (published CSV) |
| AI | IBM watsonx Granite · Google Gemini (fallback) |
| Charts | Recharts (RadarChart, AreaChart, BarChart, PieChart) · Pure SVG Sankey |
| Styling | CSS custom properties · Dark-mode Bloomberg-inspired palette |
| Sub-apps | Financial Monitor (React + SQLite) · NewsFeed (TypeScript/Bun) |

---

## 📝 Changelog

See [CHANGELOG.md](CHANGELOG.md) for full version history.

---

## 👤 Author

**Saurabh Solanki**  
IBM · AI Side Project  
GitHub: [@SaurabhSolanki26](https://github.com/SaurabhSolanki26)
