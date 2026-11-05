# risk.md — tradingview-economy (Aladdin Investing)
> Security audit performed: 28-Oct-2026. Auditor: Bob (AI).
> Append-only. Add new entries below; never edit past findings.

---

## Audit Summary

**Overall verdict: MEDIUM RISK — user-supplied symbols passed to child process; Kite credentials in .env**

This is a large Express.js financial analytics platform (~2200 lines in `server.js`). Core risk is the Kite Connect bridge which passes URL parameters as arguments to `spawnSync()`. While `spawnSync` (as opposed to `exec`) does not invoke a shell and therefore does not allow shell injection via arguments, the user-supplied symbol values do reach Python process arguments. Mitigation: validate symbol input.

---

## Risk Findings

### 🔴 HIGH — User-supplied `symbol` parameter passed to `spawnSync()` as Python argument
**Files:** [`services/kite-proxy.js:24`](services/kite-proxy.js), [`server.js:802`](server.js)
**Finding:**
```js
// server.js:802
app.get('/api/kite/quote/:symbol', kiteGuard, (req, res) =>
  res.json(kite.getQuote(req.params.symbol))
);
// kite-proxy.js:24 — passes symbol directly to spawnSync args
spawnSync(PYTHON, [BRIDGE, command, ...args], { ... })
```
`req.params.symbol` (user-controlled URL segment) is passed directly as a Python script argument without sanitization.
**Severity:** High in principle, but `spawnSync` does NOT use a shell (`shell: false` is the default). Python receives the value as `sys.argv[1]`, not as a shell command. Shell injection (`; rm -rf ~`) is NOT possible via `spawnSync` with array arguments.
**Actual risk is Medium:** The Python script (`kite_bridge.py`) receives the value and may pass it to Kite API as a symbol. A malformed symbol could cause unexpected Python errors, but no code execution via shell injection.
**Mitigation:** Add symbol validation in the Express route:
```js
app.get('/api/kite/quote/:symbol', kiteGuard, (req, res) => {
  const sym = req.params.symbol.replace(/[^A-Z0-9\-&]/g, '').toUpperCase();
  if (!sym) return res.status(400).json({ error: 'Invalid symbol' });
  res.json(kite.getQuote(sym));
});
```
**Status:** Open — low exploitability (spawnSync, not exec), but input validation should be added.

### 🟡 MEDIUM — Kite Connect access token in `.env` — rotates daily
**File:** [`.env.example`](.env.example)
**Finding:** `KITE_ACCESS_TOKEN` must be regenerated daily and stored in `.env`. If `.env` is leaked, the token is valid for up to 24h and grants read access to portfolio holdings/positions.
**Severity:** Medium — short-lived credential, `.env` is in `.gitignore`.
**Mitigation:** Confirm `.env` and `.env.local` are git-ignored. Never log or expose `KITE_ACCESS_TOKEN` via API responses.
**Status:** Acceptable with `.gitignore` in place.

### 🟡 MEDIUM — Hardcoded personal Python path
**File:** [`services/kite-proxy.js:13`](services/kite-proxy.js)
**Finding:** `const PYTHON = process.env.PYTHON_PATH || 'C:\\Users\\SaurabhSolanki\\AppData\\Local\\Programs\\Python\\Python312\\python.exe'`
**Severity:** Low-Medium — portability issue. If `python.exe` doesn't exist at this path, Kite bridge silently fails (non-critical, handled by `kiteGuard`).
**Mitigation:** Set `PYTHON_PATH` in `.env` for your machine. The fallback path is personal and not portable.
**Status:** Acceptable for personal use.

### 🟡 MEDIUM — CORS configured as open (`*`) with no origin restriction
**File:** [`server.js:8`](server.js)
**Finding:** `app.use(cors())` with no origin restriction. Same issue as ZComX — acceptable for local use.
**Status:** Acceptable for local development.

### 🟡 MEDIUM — WatsonX Project ID hardcoded in `.env.example`
**File:** [`.env.example`](.env.example)
**Finding:** `WATSONX_PROJECT_ID=83844219-1cce-4a4f-8631-52b707446c4c` — project ID is hardcoded as default value in the example file. Same finding as Telegram. Not a secret but ties usage to a specific project unexpectedly.
**Status:** Open — explicitly set in `.env`.

### 🟢 LOW — `scripts/platform-verify.js` uses `execSync`
**File:** [`scripts/platform-verify.js:16`](scripts/platform-verify.js)
**Finding:** `const { execSync, exec } = require('child_process')` — used to run `npm build` commands in parallel for build verification. This is a developer script, not part of the server runtime.
**Severity:** Low — developer-only script, not reachable via HTTP endpoints.
**Status:** Acceptable.

### 🟢 LOW — cheerio (HTML scraping) dependency
**File:** [`package.json`](package.json)
**Finding:** `cheerio@^1.0.0-rc.12` is included for HTML parsing/scraping. Cheerio itself is safe — it parses HTML client-side without eval. No server-side injection risk from cheerio if DOM content is not echo'd back without sanitization.
**Status:** Low risk for data scraping use case.

### ✅ CLEAR — No eval() or shell=true in production server code
**Finding:** `exec` usage in `kite-proxy.js` is `spawnSync` (not `exec`). `spawnSync` with array args does NOT invoke a shell. The `execSync` in `platform-verify.js` is a dev-only build script.

### ✅ CLEAR — No hardcoded production API keys in source code
**Finding:** All API keys (WatsonX, Gemini, Kite) are loaded from `process.env.*`. `.env.example` shows only placeholder values.

---

## External Dependencies Assessment (Key)

| Package | Version | Purpose | Risk |
|---------|---------|---------|------|
| `express` | ^4.18.3 | HTTP server | Low |
| `axios` | ^1.6.2 | HTTP client | Low |
| `yahoo-finance2` | ^4.0.2 | Market data | Low — read only |
| `cheerio` | ^1.0.0-rc.12 | HTML parsing | Low |
| `xlsx` | ^0.18.5 | Excel reading | Low |
| `node-cron` | ^3.0.3 | Scheduler | Low |
| Python: kite-connect | — | Zerodha broker | Medium (broker access) |

---

## Isolation Compliance
- ✅ Runs locally on `localhost:3001`
- ✅ All credentials in `.env` (git-ignored)
- ⚠️ Kite bridge spawns Python subprocess with user-supplied symbol (no shell injection; input validation recommended)
- ⚠️ Yahoo Finance, NSE bhavcopy service make outbound HTTP calls — these are intentional, read-only data fetches
- ✅ No database writes, no user data collection
