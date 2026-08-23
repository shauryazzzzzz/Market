# Rules.md — Aladdin Investing (tradingview-economy)
> **Project:** `tradingview-economy/` inside `AI side project`
> **Global infrastructure rules:** See [`../.bob/GLOBAL_RULES.md`](../.bob/GLOBAL_RULES.md) — read that file first.
> This file contains ONLY rules specific to this project.

---

## Status: Active — React + Vite frontend, Node.js Express backend

This project has been fully migrated to a **React + Vite** frontend with a Node.js Express backend. All vanilla HTML pages are preserved as fallback but the primary UI is the React SPA.

## Architecture

- **Frontend**: `frontend/` — React 19 + Vite 8, served from `public-react/` after build
- **Backend**: `server.js` — Express on port 3001, serves React build + REST API
- **Dev mode**: `cd frontend && npm run dev` (port 3000, proxies `/api` to 3001)
- **Production**: `start.bat` builds React and starts Express on 3001

## Project-Specific Rules

- **Frontend**: React + Vite in `frontend/`. No TypeScript — plain JSX only.
- **Backend**: Vanilla Node.js Express in `server.js`. No TypeScript needed.
- **API keys**: Go in `.env` (copy from `.env.example`). Never commit `.env`.
- **Kite Connect**: Python bridge at `services/kite_bridge.py`. Requires `KITE_ACCESS_TOKEN` set daily.
- **AI**: Use `services/watsonx.js` — never duplicate the watsonx→Gemini→dummy fallback chain.
- **CSV data**: Screener.in export at `data/screener 16 Aug.csv` — parsed by `services/fundamentals-csv.js`.
- **News**: `services/news-intelligence.js` fetches RSS feeds and scores impact. Cache TTL = 5 min.
- **Technical**: `services/technical-analysis.js` — pure JS, no external TA library needed.
- **Legacy HTML**: `index.html`, `markets.html` etc. are kept as fallback. Do not delete them.
- **Build**: Run `cd frontend && npm run build` to regenerate `public-react/` after frontend changes.

## New API Endpoints (added 2025-08)

| Route | Description |
|-------|-------------|
| `GET /api/news/feed` | AI-scored news feed from 4 RSS sources |
| `GET /api/news/heatmap` | Geo × sector impact heatmap data |
| `GET /api/fundamentals/list` | Paginated company list from CSV |
| `GET /api/fundamentals/search?q=` | Search by NSE/company name |
| `GET /api/fundamentals/analyse?q=` | Full fundamental analysis |
| `GET /api/fundamentals/top?metric=` | Top N companies by metric |
| `GET /api/fundamentals/earnings-surprise` | Beat/miss/in-line report |
| `GET /api/fundamentals/industry?industry=` | Industry comparison |
| `POST /api/technical/analyse` | Technical analysis from OHLCV candles |
| `GET /api/kite/quote/:symbol` | Live Kite quote |
| `GET /api/kite/holdings` | Portfolio holdings via Kite |
| `GET /api/kite/positions` | Open positions via Kite |
| `GET /api/macro/fii-dii` | FII/DII flow from NSE |
| `GET /api/macro/india-vix` | India VIX |
| `GET /api/macro/pcr` | Nifty put-call ratio |

---
*Last updated: 2025-08 | Project: tradingview-economy | Owner: Saurabh Solanki (IBM)*
