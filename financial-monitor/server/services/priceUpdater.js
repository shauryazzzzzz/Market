/**
 * priceUpdater.js — financial-monitor
 * Fetches live prices from Yahoo Finance and updates the SQLite DB.
 * Called by GET /api/stocks/refresh-prices
 */
const { query, execute } = require('../config/database');

let yf = null;
try {
  const mod = require('yahoo-finance2');
  const YF = mod.YahooFinance || mod.default || mod;
  yf = new YF({ suppressNotices: ['yahooSurvey'] });
} catch { /* not installed */ }

/**
 * Fetch tickers from DB, query Yahoo Finance, update current_price.
 * Batches 10 tickers at a time to avoid rate limits.
 */
async function refreshPrices() {
  if (!yf) throw new Error('yahoo-finance2 not installed in financial-monitor');

  // Get all tickers that have an NSE suffix format (e.g. RELIANCE → RELIANCE.NS)
  const rows = await query('SELECT ticker, company_name FROM stocks ORDER BY nse_rank ASC LIMIT 100');
  if (!rows.length) return { updated: 0, skipped: 0, message: 'No stocks in DB' };

  let updated = 0;
  let skipped = 0;
  const BATCH = 10;

  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    const symbols = batch.map(r => r.ticker.includes('.') ? r.ticker : `${r.ticker}.NS`);

    try {
      const quotes = await yf.quote(symbols);
      const quoteArr = Array.isArray(quotes) ? quotes : [quotes];

      for (const q of quoteArr) {
        if (!q || !q.regularMarketPrice) { skipped++; continue; }
        // Strip .NS suffix to match DB ticker
        const dbTicker = (q.symbol || '').replace(/\.NS$/, '').replace(/\.BO$/, '');
        const price = parseFloat(q.regularMarketPrice);
        if (!dbTicker || isNaN(price)) { skipped++; continue; }
        try {
          await execute(
            'UPDATE stocks SET current_price = ?, updated_at = CURRENT_TIMESTAMP WHERE ticker = ?',
            [price, dbTicker]
          );
          updated++;
        } catch { skipped++; }
      }
    } catch (batchErr) {
      console.warn('[priceUpdater] batch error:', batchErr.message);
      skipped += batch.length;
    }

    // Polite delay between batches
    if (i + BATCH < rows.length) {
      await new Promise(r => setTimeout(r, 400));
    }
  }

  return {
    updated,
    skipped,
    total: rows.length,
    message: `Updated ${updated} / ${rows.length} prices from Yahoo Finance`,
    ts: new Date().toISOString()
  };
}

/**
 * Get a single live quote without touching the DB.
 */
async function getLiveQuote(ticker) {
  if (!yf) throw new Error('yahoo-finance2 not installed');
  const symbol = ticker.includes('.') ? ticker : `${ticker}.NS`;
  const q = await yf.quote(symbol);
  return {
    ticker,
    symbol,
    price: q.regularMarketPrice,
    change: q.regularMarketChange,
    changePct: q.regularMarketChangePercent,
    high52w: q.fiftyTwoWeekHigh,
    low52w: q.fiftyTwoWeekLow,
    volume: q.regularMarketVolume,
    ts: new Date().toISOString()
  };
}

module.exports = { refreshPrices, getLiveQuote };
