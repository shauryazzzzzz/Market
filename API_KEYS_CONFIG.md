# API_KEYS_CONFIG.md — Aladdin Investing (tradingview-economy)
> For rotation instructions and cross-project key map see: `../CREDENTIALS_REFERENCE.md`

## How keys are loaded

```
Priority 1: Real process.env variables (shell / CI)
Priority 2: tradingview-economy/.env  (Kite keys, PORT, PYTHON_PATH)
Priority 3: ../shared/secrets.env  (workspace-wide: WATSONX_*, GEMINI_*)
```

`shared/watsonx.js` is imported by `services/watsonx.js` which calls `loadSharedEnv()` internally.

## Required keys

| Variable | Loaded from | Purpose | Status |
|----------|------------|---------|--------|
| `PORT` | `.env` | Server port | Default: `3001` |
| `WATSONX_API_KEY` | `shared/secrets.env` | IBM AI analysis | Required for AI; dummy fallback otherwise |
| `WATSONX_PROJECT_ID` | `shared/secrets.env` | watsonx project scope | Required for AI |
| `WATSONX_TEXT_MODEL` | `shared/secrets.env` | Model ID | Default: `ibm/granite-4-h-small` |
| `GEMINI_API_KEY` | `shared/secrets.env` | Gemini fallback AI | ⚠️ Currently DEAD — regenerate |

## Optional keys (broker access)

| Variable | Loaded from | Purpose | Status |
|----------|------------|---------|--------|
| `KITE_API_KEY` | `.env` | Zerodha Kite Connect app key | Required for portfolio/holdings |
| `KITE_API_SECRET` | `.env` | Kite Connect app secret | Required for Kite |
| `KITE_ACCESS_TOKEN` | `.env` | Daily session token | ⚠️ Expires at 06:00 IST daily — must regenerate |
| `PYTHON_PATH` | `.env` | Python executable for Kite bridge | Default: personal path — must update |

## Data sources (live)

| Source | Type | Key needed? | What it provides |
|--------|------|-------------|-----------------|
| Yahoo Finance (yahoo-finance2) | Public API | ❌ None | NSE/US stocks, commodities, indices |
| NSE bhavcopy (nse-bhavcopy MCP) | Hosted MCP | ❌ None | NSE historical OHLCV, gainers/losers |
| NSE CM Market (cm-market MCP) | Hosted MCP | ❌ None | NSE live prices, market breadth |
| Screener.in CSV | Local file | ❌ None | 1,435 companies × 60 fundamentals |
| Google Sheet CSV | HTTP | ❌ None | 1,113 companies × 104 columns |
| Zerodha Kite Connect | Broker API | ✅ KITE_API_KEY | Portfolio, holdings, live quotes |
| IBM WatsonX | AI API | ✅ WATSONX_API_KEY | Stock analysis, IPO summaries, news classification |

## No dummy data — live-only fallback chain

```
Yahoo Finance (always live, no key) → returns { isLive: true }
        ↓ (if Yahoo fails)
Returns { data: [], isLive: false } — frontend shows "DummyDataBanner" clearly labelled
```

No hidden placeholder data. All fallbacks are visibly flagged with a red banner in the UI.

## Kite token rotation (daily)

```bash
# Kite access tokens expire at 06:00 IST each morning.
# To regenerate:
# 1. Open: https://kite.trade/connect/login?api_key=<KITE_API_KEY>
# 2. Login with Zerodha credentials
# 3. Copy request_token from redirect URL
# 4. Exchange: POST https://api.kite.trade/session/token
#    with api_key, request_token, checksum (sha256 of api_key+request_token+api_secret)
# 5. Update KITE_ACCESS_TOKEN in tradingview-economy/.env
```

## Input validation fix needed (from risk.md)

The `/api/kite/quote/:symbol` route passes `req.params.symbol` directly to `spawnSync()`.
Add this sanitization:
```js
const sym = req.params.symbol.replace(/[^A-Z0-9\-&]/g, '').toUpperCase();
if (!sym) return res.status(400).json({ error: 'Invalid symbol' });
```

## No premium features

- Yahoo Finance access is free (public rate-limited API)
- NSE MCP servers are free hosted endpoints
- Screener.in CSV export is free (public data)
- IBM watsonx.ai and Gemini both have free tiers
- Kite Connect has a ₹2,000/year developer account fee (or free if you're a Zerodha customer)
