# Memory.md — tradingview-economy (Aladdin Investing v3)

## Port
- Aladdin Core (Express API + React SPA): `:3001`
- Financial Monitor: `:5000`
- NewsFeed Google AI: `:3002`
- Vite Dev Server (HMR proxy): `:3000`

## Start command
```
start.bat      # or: node server.js
```

## Architecture
- Express + React 19 + Vite 6 (monorepo-style, single `server.js` entry)
- WatsonX AI via `shared/watsonx.js` (already wired — no per-project duplication)
- Kite Connect proxy: `services/kite-proxy.js` → `services/kite_bridge.py` (via spawnSync)
- Kite access token expires daily at 06:00 IST — must regenerate each trading day
- Yahoo Finance via `yahoo-finance2` npm package (NSE blocks server-side direct requests)
- NSE Bhavcopy data: `services/nse-bhavcopy.js`

## Key Decisions
- `spawnSync` uses array args — NO shell injection risk. Symbol sanitization added as defence-in-depth.
- All AI keys flow from `shared/secrets.env` via `shared/watsonx.js` (called at module load)
- `DummyDataBanner` component shown when `isLive: false` — no hidden dummy data

## Dependencies
- express 4.21, react 19, vite 6, yahoo-finance2, kiteconnect, dotenv 17
- Python 3.12 (for kite_bridge.py): `C:\Users\SaurabhSolanki\AppData\Local\Programs\Python\Python312\python.exe`
- Override via `PYTHON_PATH` env var

## Security Audit — 28-Oct-2026
Created `risk.md`. **MEDIUM finding:** `/api/kite/quote/:symbol` passed `req.params.symbol` unsanitized to `spawnSync` args (no shell — array args — so no OS injection). However, the Python bridge receives the raw value. **FIXED in this session**: regex sanitization added to `kite-proxy.js` (`getQuote`, `getQuotes`, `getLTP`, `getOHLC`, `getInstruments`). Full findings in [`risk.md`](risk.md).

## Phase 9–11 Audit Completion — 28-Oct-2026

### Phase 9: API/MCP Configuration
- `API_KEYS_CONFIG.md` created documenting: `KITE_API_KEY`, `KITE_API_SECRET`, `KITE_ACCESS_TOKEN`, `WATSONX_API_KEY`, `WATSONX_PROJECT_ID`, `GEMINI_API_KEY`.
- WatsonX/Gemini keys loaded via `shared/secrets.env` → `shared/watsonx.js` (already active).
- Kite keys loaded from project-local `.env` (see `.env.example`).

### Phase 10: Dummy Data Removal
- No hardcoded dummy data in core logic. All Kite data comes from live bridge calls.
- `DummyDataBanner` shown explicitly when live data unavailable (`isLive: false`).
- No changes to dummy fallback policy required.

### Phase 11: Integration Status
- Symbol sanitization fix applied to `services/kite-proxy.js`.
- Shared env loader active via `shared/watsonx.js`.
- Remaining action: Kite access token must be regenerated daily before use.
- Model defaults: `ibm/granite-4-h-small` (WatsonX), `gemini-2.0-flash` (Gemini) — set in `shared/watsonx.js`.
- Full findings: `risk.md`, `API_KEYS_CONFIG.md`.
