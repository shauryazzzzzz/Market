/**
 * services/market-quotes.js — tradingview-economy
 * Real-time market quotes via Yahoo Finance (yahoo-finance2)
 * Falls back gracefully; never silently returns dummy values.
 * Returns { data, isLive: bool, source: string }
 */
'use strict';
require('dotenv').config();

let yf = null;
try {
  const mod = require('yahoo-finance2');
  // v4: mod.default is the YahooFinance class — must use `new` to get an instance
  const YF = mod.YahooFinance || mod.default || mod;
  yf = new YF({ suppressNotices: ['yahooSurvey'] });
} catch { yf = null; }

const https = require('https');

// ── Symbol maps ────────────────────────────────────────────────────────────────
const INDIA_SYMBOLS = [
  'RELIANCE.NS','TCS.NS','HDFCBANK.NS','INFY.NS','ICICIBANK.NS',
  'HINDUNILVR.NS','SBIN.NS','TATAMOTORS.NS','TITAN.NS','SUNPHARMA.NS',
  'MARUTI.NS','LTIM.NS','LT.NS','AXISBANK.NS','KOTAKBANK.NS',
  'ITC.NS','NESTLEIND.NS','BAJFINANCE.NS','ULTRACEMCO.NS','ADANIPORTS.NS',
  'WIPRO.NS','TATASTEEL.NS','COALINDIA.NS','ONGC.NS','NTPC.NS',
  'VEDL.NS','ASIANPAINT.NS','COLPAL.NS','PIDILITIND.NS','TRENT.NS',
  'DIXON.NS',
];

const US_SYMBOLS = ['AAPL','MSFT','GOOGL','NVDA','JPM','JNJ'];
const CRYPTO_SYMBOLS = ['BTC-USD','ETH-USD'];
const COMMODITY_SYMBOLS = ['GC=F','CL=F','SI=F']; // Gold, Crude, Silver futures

// ── Helpers ────────────────────────────────────────────────────────────────────
function nse(sym) { return sym.replace('.NS', ''); }

function fetchNSEIndex(indexName) {
  return new Promise((resolve) => {
    const req = https.get(
      'https://www.nseindia.com/api/allIndices',
      { headers: { 'User-Agent': 'AladdinInvesting/2.0', 'Accept': 'application/json' }, timeout: 8000 },
      (res) => {
        let d = '';
        res.on('data', c => d += c);
        res.on('end', () => {
          try {
            const json = JSON.parse(d);
            const found = (json.data || []).find(i => i.index === indexName);
            resolve(found || null);
          } catch { resolve(null); }
        });
      }
    );
    req.on('error', () => resolve(null));
    req.on('timeout', () => { req.destroy(); resolve(null); });
  });
}

// ── Quote fetcher ──────────────────────────────────────────────────────────────
async function fetchQuotes(symbols) {
  if (!yf) return { data: [], isLive: false, source: 'none' };
  try {
    const raw = await Promise.allSettled(
      symbols.map(sym =>
        yf.quote(sym, {}, { validateResult: false })
          .then(q => q)
          .catch(() => null)
      )
    );
    const data = raw
      .filter(r => r.status === 'fulfilled' && r.value)
      .map(r => r.value);
    if (!data.length) return { data: [], isLive: false, source: 'yahoo' };
    return { data, isLive: true, source: 'yahoo' };
  } catch (e) {
    return { data: [], isLive: false, source: 'yahoo', error: e.message };
  }
}

// ── Map yahoo quote to our stock schema ────────────────────────────────────────
function mapToStock(q) {
  const sym = (q.symbol || '').replace('.NS', '');
  return {
    symbol:  sym,
    name:    q.shortName || q.longName || sym,
    price:   q.regularMarketPrice || 0,
    change:  q.regularMarketChangePercent || 0,
    mktcap:  q.marketCap ? Math.round(q.marketCap / 1e7) : null, // convert to Cr
    pe:      q.trailingPE || null,
    pb:      q.priceToBook || null,
    roe:     null, // not in quote, available in quoteSummary
    div:     q.dividendYield ? q.dividendYield * 100 : 0,
    sector:  q.sector || 'Unknown',
    cap:     q.marketCap >= 200e9 ? 'Large Cap' : q.marketCap >= 50e9 ? 'Mid Cap' : 'Small Cap',
    currency: q.currency || (sym.endsWith('.NS') ? 'INR' : 'USD'),
    isLive:  true,
    _raw:    q,
  };
}

// ── Public API ─────────────────────────────────────────────────────────────────

/** Fetch NSE India stocks (live) */
async function getIndiaStocks() {
  const r = await fetchQuotes(INDIA_SYMBOLS);
  if (!r.isLive) return { stocks: [], isLive: false, source: r.source };
  return { stocks: r.data.map(mapToStock), isLive: true, source: 'yahoo' };
}

/** Fetch US stocks (live) */
async function getUSStocks() {
  const r = await fetchQuotes(US_SYMBOLS);
  if (!r.isLive) return { stocks: [], isLive: false, source: r.source };
  return { stocks: r.data.map(mapToStock), isLive: true, source: 'yahoo' };
}

/** Fetch ticker strip data (live) */
async function getTickerData() {
  const stripSymbols = ['^NSEI', '^BSESN', '^CNXBANK', 'NIFTYIT.NS', 'GC=F', 'INR=X', 'CL=F', '^VIX'];
  const labels      = ['NIFTY 50', 'SENSEX', 'BANK NIFTY', 'NIFTY IT', 'GOLD', 'USD/INR', 'CRUDE', 'VIX'];

  if (!yf) return { tickers: [], isLive: false };

  try {
    const results = await Promise.allSettled(
      stripSymbols.map(s => yf.quote(s, {}, { validateResult: false }).catch(() => null))
    );

    const tickers = results.map((r, i) => {
      const q = r.status === 'fulfilled' ? r.value : null;
      if (!q) return null;
      const price  = q.regularMarketPrice;
      const chgPct = q.regularMarketChangePercent || 0;
      const prefix = labels[i] === 'GOLD' ? '$' : labels[i] === 'USD/INR' ? '' : labels[i] === 'CRUDE' ? '$' : '';
      return {
        name:   labels[i],
        value:  price != null ? `${prefix}${price.toLocaleString('en-IN', { maximumFractionDigits: 2 })}` : null,
        change: chgPct >= 0 ? `+${chgPct.toFixed(2)}%` : `${chgPct.toFixed(2)}%`,
        pos:    chgPct >= 0,
        isLive: true,
      };
    }).filter(Boolean);

    return { tickers, isLive: tickers.length > 0 };
  } catch {
    return { tickers: [], isLive: false };
  }
}

/** Fetch IPO data from NSE (live) */
async function getIPOData() {
  return new Promise((resolve) => {
    const req = https.get(
      'https://www.nseindia.com/api/ipo-current-allotment',
      { headers: { 'User-Agent': 'AladdinInvesting/2.0', 'Accept': 'application/json' }, timeout: 10000 },
      (res) => {
        let d = '';
        res.on('data', c => d += c);
        res.on('end', () => {
          try {
            const json = JSON.parse(d);
            resolve({ data: json, isLive: true, source: 'nse' });
          } catch { resolve({ data: [], isLive: false, source: 'nse' }); }
        });
      }
    );
    req.on('error', () => resolve({ data: [], isLive: false, source: 'nse-error' }));
    req.on('timeout', () => { req.destroy(); resolve({ data: [], isLive: false, source: 'nse-timeout' }); });
  });
}

/** Health check — can we reach Yahoo Finance? */
async function healthCheck() {
  if (!yf) return { ok: false, reason: 'yahoo-finance2 not installed' };
  try {
    const q = await yf.quote('^NSEI', {}, { validateResult: false });
    return { ok: !!(q && q.regularMarketPrice), source: 'yahoo', nifty: q?.regularMarketPrice };
  } catch (e) {
    return { ok: false, source: 'yahoo', error: e.message };
  }
}

module.exports = { getIndiaStocks, getUSStocks, getTickerData, getIPOData, healthCheck, mapToStock, fetchQuotes, fetchNSEIndex };
