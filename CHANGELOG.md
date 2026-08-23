# Changelog — Aladdin Investing

All notable changes to this project are documented in this file.  
Format: [Keep a Changelog](https://keepachangelog.com/en/1.0.0/) · Versioning: [SemVer](https://semver.org/)

---

## [3.0.0] — 2025-06-XX — SankeyMATIC + Advanced GS Screener

### Added
- **SankeyMATIC Financial Flow** (`/sankey`)
  - Pure-SVG P&L waterfall: Revenue → Op. Expenses / Op. Profit → Tax & Interest / PAT → Retained / Dividends
  - Multi-ticker mode: up to 4 companies side-by-side
  - `% of Revenue` overlay mode for normalised cross-company comparison
  - Searchable ticker dropdown from all 1,113 GS companies
  - Side-by-side comparison table (14 metrics, ★ best-in-row)
  - `DummyDataBanner` when all flow values are null/zero
  - Deep-link from StockDeepDive: `📊 View Financial Flow →`
- **Advanced GS Screener** (`/advanced-screener`)
  - 5 tabs: Composite Rank · Jump Signals · All Green 🟢 · ROE Consistency · Custom Filter
  - Sortable tables with 🟢🔴 momentum signal dots
  - Custom Filter: 14 numeric sliders + industry dropdown + sort field selector
- **Google Sheet integration** — `/api/gs/*` (13 endpoints)
  - `GET /api/gs/tickers` — all 1,113 tickers for autocomplete
  - `GET /api/gs/sankey-data?q=TCS` — all financial flow fields
  - `GET /api/gs/top`, `/api/gs/jumps`, `/api/gs/all-green`, `/api/gs/roe-consistency`
  - `GET /api/gs/screener`, `POST /api/gs/screener` — 14-filter advanced screener
  - `GET /api/gs/industry-leaders`, `/api/gs/industries`, `/api/gs/top-field`
  - `POST /api/gs/refresh` — force reload from Google Sheets
- **StockDeepDive Section 9** — Google Sheet advanced panel
  - Composite Score strip (6 coloured KPI tiles)
  - `GrowthRadar` — 6-axis radar (ROE Score / Profit Gr / Sales Gr / Return Gr / Composite / vs Market)
  - `JumpSignals` — 6-tile grid (ROE/Profit/Sales short+long acceleration)
  - `MomentumRow` — 4 QoQ/YoY emoji signal dots
  - 9 additional stat rows (Expected Gr, PE/PE comparisons, ROE-PE, OPM/NPM Q-Y)
- **Commodity futures** (`/api/quotes/commodities`) — 12 instruments via Yahoo Finance

### Changed
- `package.json`: name → `aladdin-investing`, version → `3.0.0`
- `start-platform.bat`: updated menu with all new routes
- React build: 668 modules, 0 errors

---

## [2.0.0] — 2025-06-XX — Unified Platform + 5 New Pages

### Added
- **Platform integration**: `financial-monitor/` and `NewsFeed-Google-AI-/` copied inside monorepo
- **Vite proxy**: `/fm-api→:5000`, `/nf-api→:3002`
- **`start-platform.bat`**: one-click startup for all 4 services
- **5 new React pages**:
  - `StockDeepDive` (`/stock/:symbol`) — 8-section analysis
  - `PeerComparison` (`/compare`) — RadarChart, up to 5 stocks
  - `Screener` (`/screener`) — 23 filters, 5 presets, CSV export
  - `PortfolioPage` (`/portfolio`) — localStorage, live P&L, sector pie
  - `DCFPage` (`/dcf`) — DCF + Graham + Lynch PEG + Reverse DCF
- **`fundamentals-csv.js`** — all 60 columns, 21-signal grading system
- **18+ new API endpoints** in `server.js`
- **Markets Commodities tab** — 12 Yahoo Finance futures
- **`gs-sheet.js`** — 104-column Google Sheet parser with 30-min cache
- **`data/google-sheet-main.csv`** — 1,113-row local cache

### Fixed
- `yahoo-finance2` v4: must use `new YF()` instance — fixed across all services
- `fmtCr()` double-conversion bug in StockDeepDive
- `gradeCompany()` max score displayed as /12 → corrected to /21
- NSE India API Akamai-blocked → replaced with Yahoo Finance throughout

---

## [1.0.0] — Initial Release

### Added
- TradingView-style market dashboard
- India / US stock quotes via Yahoo Finance
- IPO Calendar
- Stock Screener (basic)
- Technical Analysis page
- News Intelligence (RSS + keyword scoring)
- Fundamentals page
- Strategies page
- AI integration (watsonx / Gemini)
- Kite Connect proxy (Zerodha)
