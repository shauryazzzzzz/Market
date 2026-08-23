# Rules.md — Financial Monitor
> **Project:** `financial-monitor/` inside `AI side project`
> **Global infrastructure rules:** See [`../.bob/GLOBAL_RULES.md`](../.bob/GLOBAL_RULES.md) — read that file first.
> This file contains ONLY rules specific to this project.

---

## AGENT STARTUP (This Project)

1. Read `../.bob/GLOBAL_RULES.md`.
2. Read this file.
3. Read `CURRENT-STATUS.md` and `PROJECT-STATUS.md` — understand what has been built and what is pending.
4. Read `docs/` folder for architecture details before touching any service.

---

## Project-Specific Rules

- **NSE stock data**: Uploaded as CSV exports from Screener.in — not fetched live. File: `Screener 21 May.csv`.
- **DB**: SQLite (`financial_monitor.db`) — gitignored. Re-create via server startup or init script.
- **Frontend status**: React UI is at an early stage — see `CURRENT-STATUS.md` for completion %.
- **Backend**: Express + Node.js in `server/` — follow existing route/service split.
- **No hard-coded tickers or thresholds** — all configurable via `data/` JSON or `.env`.
- Use `../shared/watsonx.js` for any AI features (portfolio analysis, risk scoring).
- `.bob/custom_modes.yaml` exists for this project — check before creating new modes.

---
*Last updated: 2025-07-13 | Project: financial-monitor | Owner: Saurabh Solanki (IBM)*
