/**
 * server.js — tradingview-economy
 * Express server: static pages + AI + News + Fundamentals + Technical + Kite
 */
require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const path    = require('path');

const app  = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// ── Serve React build (primary) — falls back to legacy vanilla HTML ───────────
const REACT_BUILD = path.join(__dirname, 'public-react');
const fs = require('fs');
if (fs.existsSync(REACT_BUILD)) {
  app.use(express.static(REACT_BUILD));
  // SPA catch-all — serve index.html for all non-API routes
  app.get(/^(?!\/api).*$/, (req, res) => {
    res.sendFile(path.join(REACT_BUILD, 'index.html'));
  });
  console.log('Serving React build from public-react/');
} else {
  // Legacy vanilla HTML fallback
  app.use(express.static(__dirname));
  app.get('/',            (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
  app.get('/markets',     (req, res) => res.sendFile(path.join(__dirname, 'markets.html')));
  app.get('/ipo',         (req, res) => res.sendFile(path.join(__dirname, 'ipo-calendar.html')));
  app.get('/screener',    (req, res) => res.sendFile(path.join(__dirname, 'screener.html')));
  app.get('/strategies',  (req, res) => res.sendFile(path.join(__dirname, 'strategies.html')));
  console.log('React build not found — serving legacy vanilla HTML. Run: cd frontend && npm run build');
}

// ── Legacy data API routes (mounted at /api/legacy to avoid swallowing /api/*)
try { app.use('/api/legacy', require('./api/server')); } catch { console.warn('API server module not found, skipping'); }

// ── Real-time market quote routes ─────────────────────────────────────────────
const mq = require('./services/market-quotes');

app.get('/api/quotes/india', async (req, res) => {
  const result = await mq.getIndiaStocks();
  res.json(result);
});

app.get('/api/quotes/us', async (req, res) => {
  const result = await mq.getUSStocks();
  res.json(result);
});

app.get('/api/quotes/ticker', async (req, res) => {
  const result = await mq.getTickerData();
  res.json(result);
});

app.get('/api/quotes/ipo', async (req, res) => {
  const result = await mq.getIPOData();
  res.json(result);
});

app.get('/api/quotes/health', async (req, res) => {
  const result = await mq.healthCheck();
  res.json(result);
});

// ── Commodity prices — Gold, Silver, Crude Oil, Natural Gas, Copper, Palladium ──
app.get('/api/quotes/commodities', async (req, res) => {
  if (!_yf_commodities) {
    let mod, YF;
    try {
      mod = require('yahoo-finance2');
      YF  = mod.YahooFinance || mod.default || mod;
      _yf_commodities = new YF({ suppressNotices: ['yahooSurvey'] });
    } catch { return res.json({ commodities: [], isLive: false, error: 'yahoo-finance2 unavailable' }); }
  }
  const COMMODITY_SYMBOLS = [
    { symbol: 'GC=F',  name: 'Gold',          currencySymbol: '$', unit: 'oz' },
    { symbol: 'SI=F',  name: 'Silver',         currencySymbol: '$', unit: 'oz' },
    { symbol: 'CL=F',  name: 'Crude Oil (WTI)',currencySymbol: '$', unit: 'bbl'},
    { symbol: 'NG=F',  name: 'Natural Gas',    currencySymbol: '$', unit: 'MMBtu'},
    { symbol: 'HG=F',  name: 'Copper',         currencySymbol: '$', unit: 'lb' },
    { symbol: 'PA=F',  name: 'Palladium',      currencySymbol: '$', unit: 'oz' },
    { symbol: 'PL=F',  name: 'Platinum',       currencySymbol: '$', unit: 'oz' },
    { symbol: 'ZC=F',  name: 'Corn',           currencySymbol: '$', unit: 'bu' },
    { symbol: 'ZW=F',  name: 'Wheat',          currencySymbol: '$', unit: 'bu' },
    { symbol: 'ZS=F',  name: 'Soybeans',       currencySymbol: '$', unit: 'bu' },
    { symbol: 'MCXGOLD.MCX', name: 'MCX Gold', currencySymbol: '₹', unit: '10g'},
    { symbol: 'BZ=F',  name: 'Brent Crude',    currencySymbol: '$', unit: 'bbl'},
  ];
  try {
    const results = await Promise.allSettled(
      COMMODITY_SYMBOLS.map(c =>
        _yf_commodities.quote(c.symbol, {}, { validateResult: false }).then(q => ({ meta: c, q })).catch(() => null)
      )
    );
    const commodities = results
      .filter(r => r.status === 'fulfilled' && r.value)
      .map(r => {
        const { meta, q } = r.value;
        return {
          symbol:       meta.symbol,
          name:         meta.name,
          unit:         meta.unit,
          currencySymbol: meta.currencySymbol,
          currency:     q.currency || 'USD',
          price:        q.regularMarketPrice,
          changePct:    q.regularMarketChangePercent,
          change:       q.regularMarketChange,
          dayHigh:      q.regularMarketDayHigh,
          dayLow:       q.regularMarketDayLow,
          week52High:   q.fiftyTwoWeekHigh,
          week52Low:    q.fiftyTwoWeekLow,
          volume:       q.regularMarketVolume,
          isLive:       true,
        };
      })
      .filter(c => c.price != null);
    res.json({ commodities, isLive: commodities.length > 0, count: commodities.length, source: 'yahoo' });
  } catch (e) {
    res.json({ commodities: [], isLive: false, error: e.message });
  }
});
let _yf_commodities = null;

// ── AI endpoints (watsonx → Gemini → dummy) ───────────────────────────────────
const { analyzeStockData, summarizeIPO, classifyNewsImpact, commentOnIndicator, healthCheck } = require('./services/watsonx');

app.post('/api/ai/analyze-stock', async (req, res) => {
  try {
    const result = await analyzeStockData(req.body);
    res.json({ success: true, ...result });
  } catch (e) {
    res.json({ success: false, text: '[AI unavailable]', provider: 'error' });
  }
});

app.post('/api/ai/summarize-ipo', async (req, res) => {
  try {
    const result = await summarizeIPO(req.body);
    res.json({ success: true, ...result });
  } catch (e) {
    res.json({ success: false, text: '[AI unavailable]', provider: 'error' });
  }
});

app.post('/api/ai/classify-news', async (req, res) => {
  try {
    const result = await classifyNewsImpact(req.body.headline || '');
    res.json({ success: true, ...result });
  } catch (e) {
    res.json({ success: false, category: 'Market-wide', provider: 'error' });
  }
});

app.get('/api/ai/health', async (req, res) => {
  res.json(await healthCheck());
});

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 1 — News Intelligence
// ─────────────────────────────────────────────────────────────────────────────
const newsIntel = require('./services/news-intelligence');
let _newsCache = null;
let _newsCacheTime = 0;

app.get('/api/news/feed', async (req, res) => {
  try {
    const max = parseInt(req.query.max) || 20;
    // Cache for 5 min
    if (_newsCache && (Date.now() - _newsCacheTime) < 5 * 60 * 1000) {
      return res.json({ success: true, count: _newsCache.length, data: _newsCache.slice(0, max), cached: true });
    }
    const news = await newsIntel.fetchAndScoreNews(max);
    _newsCache = news;
    _newsCacheTime = Date.now();
    res.json({ success: true, count: news.length, data: news });
  } catch (e) {
    res.json({ success: false, error: e.message, data: [] });
  }
});

app.get('/api/news/heatmap', async (req, res) => {
  try {
    const news = _newsCache || await newsIntel.fetchAndScoreNews(30);
    // Build geo × sector impact grid
    const geos    = Object.keys(newsIntel.GEO_KEYWORDS);
    const sectors = Object.keys(newsIntel.SECTOR_KEYWORDS);
    const grid = {};
    geos.forEach(g => { grid[g] = {}; sectors.forEach(s => { grid[g][s] = { count: 0, avgImpact: 0, sentiment: 0 }; }); });
    news.forEach(item => {
      (item.affected.geographies || []).forEach(g => {
        (item.affected.sectors || []).forEach(s => {
          if (grid[g] && grid[g][s]) {
            grid[g][s].count++;
            grid[g][s].avgImpact += item.impactScore || 0;
            grid[g][s].sentiment += item.sentiment === 'positive' ? 1 : item.sentiment === 'negative' ? -1 : 0;
          }
        });
      });
    });
    // Normalise
    geos.forEach(g => sectors.forEach(s => {
      const cell = grid[g][s];
      if (cell.count > 0) {
        cell.avgImpact = parseFloat((cell.avgImpact / cell.count).toFixed(2));
        cell.sentiment = parseFloat((cell.sentiment / cell.count).toFixed(2));
      }
    }));
    res.json({ success: true, geos, sectors, grid });
  } catch (e) {
    res.json({ success: false, error: e.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 2 — Fundamental Analysis (CSV)
// ─────────────────────────────────────────────────────────────────────────────
const fundsvc = require('./services/fundamentals-csv');

// ── All companies (paginated + industry filter) ────────────────────────────────
app.get('/api/fundamentals/list', (req, res) => {
  try {
    const page     = parseInt(req.query.page)  || 1;
    const pageSize = parseInt(req.query.size)  || 50;
    const industry = req.query.industry || '';
    let all = fundsvc.getAllCompanies();
    if (industry) all = all.filter(c => c.industry.toLowerCase().includes(industry.toLowerCase()));
    const start = (page - 1) * pageSize;
    res.json({ success: true, total: all.length, page, pageSize, data: all.slice(start, start + pageSize) });
  } catch (e) { res.json({ success: false, error: e.message }); }
});

// ── Search by NSE/BSE code or name ────────────────────────────────────────────
app.get('/api/fundamentals/search', (req, res) => {
  try {
    const q = req.query.q || '';
    if (q.length < 2) return res.json({ success: false, error: 'Query too short' });
    const results = fundsvc.searchCompany(q).slice(0, 20);
    res.json({ success: true, count: results.length, data: results });
  } catch (e) { res.json({ success: false, error: e.message }); }
});

// ── Full analysis (all 60 ratios + AI summary + grade) ───────────────────────
app.get('/api/fundamentals/analyse', async (req, res) => {
  try {
    const q = req.query.q || '';
    const withAI = req.query.ai !== 'false';
    const result = await fundsvc.analyseCompany(q, withAI);
    if (!result) return res.status(404).json({ success: false, error: 'Company not found' });
    res.json({ success: true, data: result });
  } catch (e) { res.json({ success: false, error: e.message }); }
});

// ── Top N by any sortable metric ──────────────────────────────────────────────
app.get('/api/fundamentals/top', (req, res) => {
  try {
    const metric = req.query.metric || 'roe';
    const n      = parseInt(req.query.n)      || 20;
    const minCap = parseFloat(req.query.minCap) || 500;
    const results = fundsvc.topByMetric(metric, n, minCap);
    res.json({ success: true, metric, count: results.length, data: results });
  } catch (e) { res.json({ success: false, error: e.message }); }
});

// ── Earnings surprise (beat / miss / in-line) with latest Q data ──────────────
app.get('/api/fundamentals/earnings-surprise', (req, res) => {
  try {
    const type  = req.query.type || 'all';
    const limit = parseInt(req.query.limit) || 50;
    let results = fundsvc.earningsSurpriseReport();
    if (type !== 'all') results = results.filter(r => r.surprise === type);
    res.json({ success: true, count: results.length, data: results.slice(0, limit) });
  } catch (e) { res.json({ success: false, error: e.message }); }
});

// ── Industry comparison (all averages for a given industry) ───────────────────
app.get('/api/fundamentals/industry', (req, res) => {
  try {
    const industry = req.query.industry || '';
    if (!industry) return res.json({ success: false, error: 'industry param required' });
    const result = fundsvc.industryComparison(industry);
    if (!result) return res.status(404).json({ success: false, error: 'No data for this industry' });
    res.json({ success: true, data: result });
  } catch (e) { res.json({ success: false, error: e.message }); }
});

// ── List all industries ───────────────────────────────────────────────────────
app.get('/api/fundamentals/industry-list', (req, res) => {
  try {
    const list = fundsvc.getIndustryList();
    res.json({ success: true, count: list.length, data: list });
  } catch (e) { res.json({ success: false, error: e.message }); }
});

// ── Deep multi-factor screener (all 60 fields as filter params) ───────────────
// Query params map 1:1 to deepScreener() filters:
//   minROE, maxPE, minProfitGrowth, minSalesGrowth, maxDebtToEquity,
//   minOPM, minPiotroski, minPromoterHolding, minMarketCap, maxMarketCap,
//   minDividendYield, maxPegRatio, industry, minReturn1yr, maxReturn1yr,
//   minCashFromOps, minPatQ, maxEvEbitda, minPB, maxPB, minYoyQProfitGrowth,
//   belowGraham (true/false), sortBy, n
app.get('/api/fundamentals/screener', (req, res) => {
  try {
    const q = req.query;
    const toNum = (k, def) => q[k] !== undefined ? parseFloat(q[k]) : def;
    const filters = {
      minROE:               toNum('minROE',            -Infinity),
      maxPE:                toNum('maxPE',              Infinity),
      minProfitGrowth:      toNum('minProfitGrowth',   -Infinity),
      minSalesGrowth:       toNum('minSalesGrowth',    -Infinity),
      maxDebtToEquity:      toNum('maxDebtToEquity',    Infinity),
      minOPM:               toNum('minOPM',            -Infinity),
      minPiotroski:         toNum('minPiotroski',       0),
      minPromoterHolding:   toNum('minPromoterHolding',-Infinity),
      minMarketCap:         toNum('minMarketCap',       0),
      maxMarketCap:         toNum('maxMarketCap',       Infinity),
      minDividendYield:     toNum('minDividendYield',  -Infinity),
      maxPegRatio:          toNum('maxPegRatio',        Infinity),
      industry:             q.industry || '',
      minReturn1yr:         toNum('minReturn1yr',      -Infinity),
      maxReturn1yr:         toNum('maxReturn1yr',       Infinity),
      minCashFromOps:       toNum('minCashFromOps',    -Infinity),
      minPatQ:              toNum('minPatQ',           -Infinity),
      maxEvEbitda:          toNum('maxEvEbitda',        Infinity),
      minPB:                toNum('minPB',             -Infinity),
      maxPB:                toNum('maxPB',              Infinity),
      minYoyQProfitGrowth:  toNum('minYoyQProfitGrowth',-Infinity),
      belowGraham:          q.belowGraham === 'true',
    };
    const sortBy = q.sortBy || 'piotroskiScore';
    const n      = parseInt(q.n) || 50;
    const results = fundsvc.deepScreener(filters, sortBy, n);
    res.json({ success: true, count: results.length, sortBy, data: results });
  } catch (e) { res.json({ success: false, error: e.message }); }
});

// ── Compare multiple stocks side by side ──────────────────────────────────────
// ?symbols=TCS,INFY,WIPRO  (comma-separated NSE codes)
app.get('/api/fundamentals/compare', (req, res) => {
  try {
    const syms = (req.query.symbols || '').split(',').map(s => s.trim()).filter(Boolean);
    if (!syms.length) return res.json({ success: false, error: 'symbols param required' });
    const results = fundsvc.compareStocks(syms);
    res.json({ success: true, count: results.length, data: results });
  } catch (e) { res.json({ success: false, error: e.message }); }
});

// ── Industry leaderboard — top N per industry for a given metric ───────────────
app.get('/api/fundamentals/industry-leaderboard', (req, res) => {
  try {
    const metric    = req.query.metric || 'roe';
    const topN      = parseInt(req.query.topN) || 3;
    const minMarCap = parseFloat(req.query.minMarketCap) || 100;
    const result    = fundsvc.industryLeaderboard(metric, topN, minMarCap);
    res.json({ success: true, metric, data: result });
  } catch (e) { res.json({ success: false, error: e.message }); }
});

// ── Curated screens ───────────────────────────────────────────────────────────
app.get('/api/fundamentals/value-stocks', (req, res) => {
  try {
    const n      = parseInt(req.query.n) || 20;
    const minCap = parseFloat(req.query.minMarketCap) || 500;
    res.json({ success: true, data: fundsvc.valueStocks(n, minCap) });
  } catch (e) { res.json({ success: false, error: e.message }); }
});

app.get('/api/fundamentals/dividend-stocks', (req, res) => {
  try {
    const n        = parseInt(req.query.n) || 20;
    const minYield = parseFloat(req.query.minYield) || 1.5;
    const minCap   = parseFloat(req.query.minMarketCap) || 500;
    res.json({ success: true, data: fundsvc.dividendStocks(n, minYield, minCap) });
  } catch (e) { res.json({ success: false, error: e.message }); }
});

app.get('/api/fundamentals/quality-growth', (req, res) => {
  try {
    const n      = parseInt(req.query.n) || 20;
    const minCap = parseFloat(req.query.minMarketCap) || 500;
    res.json({ success: true, data: fundsvc.qualityGrowthStocks(n, minCap) });
  } catch (e) { res.json({ success: false, error: e.message }); }
});

// ── Available sortable metric keys ────────────────────────────────────────────
app.get('/api/fundamentals/metrics', (req, res) => {
  res.json({ success: true, metrics: fundsvc.SORTABLE_METRICS });
});

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 3 — Technical Analysis
// ─────────────────────────────────────────────────────────────────────────────
const ta = require('./services/technical-analysis');

// Analyse a stock given OHLCV candles in request body
app.post('/api/technical/analyse', (req, res) => {
  try {
    const { candles, symbol } = req.body;
    if (!candles || !Array.isArray(candles) || candles.length < 5) {
      return res.status(400).json({ success: false, error: 'candles array (min 5) required in body' });
    }
    const result = ta.analyse(candles, symbol || '');
    res.json({ success: true, data: result });
  } catch (e) {
    res.json({ success: false, error: e.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 5 — Kite Connect proxy
// ─────────────────────────────────────────────────────────────────────────────
let kite;
try { kite = require('./services/kite-proxy'); } catch { kite = null; }

function kiteGuard(req, res, next) {
  if (!kite) return res.json({ success: false, error: 'Kite service unavailable' });
  next();
}

app.get('/api/kite/quote/:symbol',   kiteGuard, (req, res) => res.json(kite.getQuote(req.params.symbol)));
app.get('/api/kite/quotes',          kiteGuard, (req, res) => {
  const syms = (req.query.symbols || '').split(',').filter(Boolean);
  res.json(kite.getQuotes(syms));
});
app.get('/api/kite/holdings',        kiteGuard, (req, res) => res.json(kite.getHoldings()));
app.get('/api/kite/positions',       kiteGuard, (req, res) => res.json(kite.getPositions()));
app.get('/api/kite/ltp',             kiteGuard, (req, res) => {
  const syms = (req.query.symbols || '').split(',').filter(Boolean);
  res.json(kite.getLTP(syms));
});
app.get('/api/kite/ohlc',            kiteGuard, (req, res) => {
  const syms = (req.query.symbols || '').split(',').filter(Boolean);
  res.json(kite.getOHLC(syms));
});

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 6 — Macro enrichment (public data)
// ─────────────────────────────────────────────────────────────────────────────
// ── Macro enrichment — Yahoo Finance (NSE blocks server-side requests) ────────
let _yf = null;
try {
  const mod = require('yahoo-finance2');
  const YF = mod.YahooFinance || mod.default || mod;
  _yf = new YF({ suppressNotices: ['yahooSurvey'] });
} catch { _yf = null; }

// India VIX — Yahoo symbol: ^INDIAVIX
app.get('/api/macro/india-vix', async (req, res) => {
  if (!_yf) return res.json({ success: false, error: 'yahoo-finance2 unavailable', data: null });
  try {
    const q = await _yf.quote('^INDIAVIX', {}, { validateResult: false });
    if (!q || q.regularMarketPrice == null) throw new Error('No data');
    res.json({
      success: true,
      data: {
        index:         'INDIA VIX',
        last:          q.regularMarketPrice,
        change:        q.regularMarketChange,
        percentChange: q.regularMarketChangePercent,
        high:          q.regularMarketDayHigh,
        low:           q.regularMarketDayLow,
        source:        'yahoo'
      }
    });
  } catch (e) {
    res.json({ success: false, error: e.message, data: null });
  }
});

// PCR approximation — use VIX level as sentiment proxy when NSE options chain is unavailable
app.get('/api/macro/pcr', async (req, res) => {
  if (!_yf) return res.json({ success: false, error: 'yahoo-finance2 unavailable', data: null });
  try {
    const q = await _yf.quote('^INDIAVIX', {}, { validateResult: false });
    const vix = q?.regularMarketPrice || 15;
    // Approximate PCR: low VIX → bullish (high PCR), high VIX → bearish (low PCR)
    const pcr = parseFloat((1.4 - (vix - 10) * 0.02).toFixed(3));
    const signal = pcr > 1.2 ? 'bullish' : pcr < 0.8 ? 'bearish' : 'neutral';
    res.json({
      success: true,
      data: { pcr, totalCE: null, totalPE: null, signal, vix, note: 'VIX-derived estimate — NSE options chain blocked' }
    });
  } catch (e) {
    res.json({ success: false, error: e.message, data: null });
  }
});

// FII/DII — use Nifty 50 index change as proxy (NSE FII API requires Akamai bypass)
app.get('/api/macro/fii-dii', async (req, res) => {
  if (!_yf) return res.json({ success: false, error: 'yahoo-finance2 unavailable', data: null });
  try {
    const [nsei, bank] = await Promise.allSettled([
      _yf.quote('^NSEI',    {}, { validateResult: false }),
      _yf.quote('^CNXBANK', {}, { validateResult: false }),
    ]);
    const nifty = nsei.status  === 'fulfilled' ? nsei.value  : null;
    const bnk   = bank.status  === 'fulfilled' ? bank.value  : null;
    const chg   = nifty?.regularMarketChangePercent || 0;
    // Sign-based FII/DII proxy: positive Nifty day → net FII buy, else sell
    const fiiNet  = parseFloat((chg * 500).toFixed(0));   // ₹ Cr approximation
    const diiNet  = parseFloat((-chg * 200).toFixed(0));
    res.json({
      success: true,
      data: [{
        date:       new Date().toISOString().split('T')[0],
        buyValue:   Math.max(fiiNet, 0),
        sellValue:  Math.max(-fiiNet, 0),
        netValue:   fiiNet,
        category:   'FII',
        nifty:      nifty?.regularMarketPrice,
        niftyChg:   chg,
        bankNifty:  bnk?.regularMarketPrice,
        note:       'Index-movement proxy — NSE FII API requires browser session'
      }]
    });
  } catch (e) {
    res.json({ success: false, error: e.message, data: null });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 7 — Stock Deep-Dive, Price History, Search Suggest
// ─────────────────────────────────────────────────────────────────────────────

// ── Search-suggest autocomplete (fast, no AI) ─────────────────────────────────
// GET /api/stock/search-suggest?q=tcs
app.get('/api/stock/search-suggest', (req, res) => {
  try {
    const q = (req.query.q || '').trim();
    if (q.length < 1) return res.json({ success: true, data: [] });
    const results = fundsvc.searchCompany(q).slice(0, 10).map(c => ({
      name:     c.name,
      nseCode:  c.nseCode,
      bseCode:  c.bseCode,
      industry: c.industry,
    }));
    res.json({ success: true, data: results });
  } catch (e) { res.json({ success: false, error: e.message, data: [] }); }
});

// ── Price history via Yahoo Finance ───────────────────────────────────────────
// GET /api/stock/price-history?symbol=TCS.NS&period=1y
app.get('/api/stock/price-history', async (req, res) => {
  if (!_yf) return res.json({ success: false, error: 'yahoo-finance2 unavailable', data: [] });
  const symbol = (req.query.symbol || '').trim();
  const period = req.query.period || '1y';
  if (!symbol) return res.json({ success: false, error: 'symbol param required', data: [] });

  const periodMap = {
    '1m': { period1: new Date(Date.now() - 30  * 86400000), interval: '1d' },
    '3m': { period1: new Date(Date.now() - 90  * 86400000), interval: '1d' },
    '6m': { period1: new Date(Date.now() - 180 * 86400000), interval: '1d' },
    '1y': { period1: new Date(Date.now() - 365 * 86400000), interval: '1d' },
    '3y': { period1: new Date(Date.now() - 3 * 365 * 86400000), interval: '1wk' },
    '5y': { period1: new Date(Date.now() - 5 * 365 * 86400000), interval: '1wk' },
  };
  const cfg = periodMap[period] || periodMap['1y'];

  try {
    const chart = await _yf.historical(symbol, {
      period1:  cfg.period1,
      period2:  new Date(),
      interval: cfg.interval,
    }, { validateResult: false });

    const data = (chart || []).map(c => ({
      date:   c.date ? new Date(c.date).toISOString().split('T')[0] : null,
      open:   c.open,
      high:   c.high,
      low:    c.low,
      close:  c.close,
      volume: c.volume,
    })).filter(c => c.date && c.close != null);

    res.json({ success: true, symbol, period, count: data.length, data });
  } catch (e) {
    res.json({ success: false, error: e.message, data: [] });
  }
});

// ── Deep-dive — aggregates CSV data + Yahoo live price + peers ────────────────
// GET /api/stock/deep-dive?q=TCS
app.get('/api/stock/deep-dive', async (req, res) => {
  try {
    const q = (req.query.q || '').trim();
    if (!q) return res.json({ success: false, error: 'q param required' });

    // 1. Find company in CSV
    const matches = fundsvc.searchCompany(q);
    if (!matches || matches.length === 0) return res.status(404).json({ success: false, error: 'Company not found' });
    const company = matches[0];

    // 2. Grade
    const grade = fundsvc.gradeCompany ? fundsvc.gradeCompany(company) : null;

    // 3. Peers — top 5 same-industry by ROE (excluding self)
    let peers = [];
    try {
      const allIndustry = fundsvc.deepScreener({ industry: company.industry }, 'roe', 20);
      peers = allIndustry.filter(p => p.nseCode !== company.nseCode).slice(0, 5);
    } catch (_) {}

    // 4. Industry average
    let industryAvg = null;
    try {
      industryAvg = fundsvc.industryComparison ? fundsvc.industryComparison(company.industry) : null;
    } catch (_) {}

    // 5. Revenue / profit trend — synthesise from CSV growth rates
    const revenueTrend = [
      { period: 'Sales (Q)',     value: company.salesQ          ?? null, type: 'quarterly' },
      { period: 'Sales Gr 1Y',  value: company.salesGrowth      ?? null, type: 'annual' },
      { period: 'Sales Gr 3Y',  value: company.salesGrowth3yr   ?? null, type: '3yr' },
      { period: 'Sales Gr 5Y',  value: company.salesGrowth5yr   ?? null, type: '5yr' },
    ];
    const profitTrend = [
      { period: 'PAT (Q)',       value: company.patQ             ?? null, type: 'quarterly' },
      { period: 'PAT Gr 1Y',    value: company.profitGrowth     ?? null, type: 'annual' },
      { period: 'PAT Gr 3Y',    value: company.profitGrowth3yr  ?? null, type: '3yr' },
      { period: 'PAT Gr 5Y',    value: company.profitGrowth5yr  ?? null, type: '5yr' },
    ];
    const marginTrend = [
      { period: 'OPM Annual',  value: company.opm               ?? null },
      { period: 'OPM Q',       value: company.opmQ              ?? null },
      { period: 'NPM Annual',  value: company.npm               ?? null },
      { period: 'NPM Q',       value: company.npmQ              ?? null },
    ];

    // 6. Live price from Yahoo Finance
    let livePriceData = null;
    let sparkline = [];
    if (_yf && company.nseCode) {
      const yfSymbol = company.nseCode + '.NS';
      try {
        const [quote, hist] = await Promise.allSettled([
          _yf.quote(yfSymbol, {}, { validateResult: false }),
          _yf.historical(yfSymbol, {
            period1:  new Date(Date.now() - 30 * 86400000),
            period2:  new Date(),
            interval: '1d',
          }, { validateResult: false }),
        ]);

        if (quote.status === 'fulfilled' && quote.value) {
          const q2 = quote.value;
          livePriceData = {
            symbol:          yfSymbol,
            price:           q2.regularMarketPrice,
            change:          q2.regularMarketChange,
            changePct:       q2.regularMarketChangePercent,
            open:            q2.regularMarketOpen,
            high:            q2.regularMarketDayHigh,
            low:             q2.regularMarketDayLow,
            volume:          q2.regularMarketVolume,
            week52High:      q2.fiftyTwoWeekHigh,
            week52Low:       q2.fiftyTwoWeekLow,
            marketCap:       q2.marketCap,
            avgVolume:       q2.averageDailyVolume3Month,
            currency:        q2.currency,
            exchangeName:    q2.fullExchangeName,
          };
        }
        if (hist.status === 'fulfilled' && Array.isArray(hist.value)) {
          sparkline = hist.value.slice(-30).map(c => ({
            date:  c.date ? new Date(c.date).toISOString().split('T')[0] : null,
            close: c.close,
          })).filter(c => c.date && c.close != null);
        }
      } catch (_) {}
    }

    res.json({
      success: true,
      data: {
        company,
        grade,
        revenueTrend,
        profitTrend,
        marginTrend,
        peers,
        industryAvg,
        livePriceData,
        sparkline,
      }
    });
  } catch (e) {
    res.json({ success: false, error: e.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 8 — Google Sheet Advanced Data (/api/gs/*)
// ─────────────────────────────────────────────────────────────────────────────
const gs = require('./services/gs-sheet');

// GET /api/gs/top?n=50&industry=Banking
app.get('/api/gs/top', async (req, res) => {
  try {
    const n        = parseInt(req.query.n) || 50;
    const industry = req.query.industry || '';
    const data     = await gs.topByComposite(n, industry);
    res.json({ success: true, count: data.length, data });
  } catch (e) { res.json({ success: false, error: e.message }); }
});

// GET /api/gs/company?q=TCS
app.get('/api/gs/company', async (req, res) => {
  try {
    const q = (req.query.q || '').trim();
    if (!q) return res.json({ success: false, error: 'q param required' });
    const data = await gs.getCompanyGS(q);
    if (!data) return res.status(404).json({ success: false, error: 'Not found' });
    res.json({ success: true, data });
  } catch (e) { res.json({ success: false, error: e.message }); }
});

// GET /api/gs/search?q=infosys
app.get('/api/gs/search', async (req, res) => {
  try {
    const q = (req.query.q || '').trim();
    if (!q) return res.json({ success: false, error: 'q param required' });
    const data = await gs.searchGS(q);
    res.json({ success: true, count: data.length, data });
  } catch (e) { res.json({ success: false, error: e.message }); }
});

// GET /api/gs/jumps?type=profit&n=30   type = profit | sales | roe
app.get('/api/gs/jumps', async (req, res) => {
  try {
    const type = req.query.type || 'profit';
    const n    = parseInt(req.query.n) || 30;
    const data = await gs.jumpSignals(type, n);
    res.json({ success: true, type, count: data.length, data });
  } catch (e) { res.json({ success: false, error: e.message }); }
});

// GET /api/gs/all-green?n=30
app.get('/api/gs/all-green', async (req, res) => {
  try {
    const n    = parseInt(req.query.n) || 30;
    const data = await gs.allGreenSignals(n);
    res.json({ success: true, count: data.length, data });
  } catch (e) { res.json({ success: false, error: e.message }); }
});

// GET /api/gs/industry-leaders
app.get('/api/gs/industry-leaders', async (req, res) => {
  try {
    const data = await gs.industryLeaders();
    res.json({ success: true, count: data.length, data });
  } catch (e) { res.json({ success: false, error: e.message }); }
});

// GET /api/gs/roe-consistency?n=50
app.get('/api/gs/roe-consistency', async (req, res) => {
  try {
    const n    = parseInt(req.query.n) || 50;
    const data = await gs.roeConsistency(n);
    res.json({ success: true, count: data.length, data });
  } catch (e) { res.json({ success: false, error: e.message }); }
});

// GET /api/gs/industries
app.get('/api/gs/industries', async (req, res) => {
  try {
    const data = await gs.getIndustries();
    res.json({ success: true, count: data.length, data });
  } catch (e) { res.json({ success: false, error: e.message }); }
});

// POST /api/gs/screener  — body: { filters, sortField, n }
// filters: { industry, minComposite, minROE, maxPE, minProfitGr, minSalesGr, maxDE,
//            minOPM, minPiotroski, minPromoter, minReturn1y, minGrowthScore,
//            minSalesScore, minRoeScore, allGreen }
app.post('/api/gs/screener', async (req, res) => {
  try {
    const { filters = {}, sortField = 'compositeScore', n = 100 } = req.body;
    const data = await gs.advancedScreener(filters, sortField, n);
    res.json({ success: true, count: data.length, sortField, data });
  } catch (e) { res.json({ success: false, error: e.message }); }
});

// GET /api/gs/screener — same but via query params
app.get('/api/gs/screener', async (req, res) => {
  try {
    const q = req.query;
    const toNum = (k) => q[k] !== undefined ? parseFloat(q[k]) : undefined;
    const filters = {
      industry:        q.industry   || '',
      minComposite:    toNum('minComposite'),
      minROE:          toNum('minROE'),
      maxPE:           toNum('maxPE'),
      minProfitGr:     toNum('minProfitGr'),
      minSalesGr:      toNum('minSalesGr'),
      maxDE:           toNum('maxDE'),
      minOPM:          toNum('minOPM'),
      minPiotroski:    toNum('minPiotroski'),
      minPromoter:     toNum('minPromoter'),
      minReturn1y:     toNum('minReturn1y'),
      minGrowthScore:  toNum('minGrowthScore'),
      minSalesScore:   toNum('minSalesScore'),
      minRoeScore:     toNum('minRoeScore'),
      allGreen:        q.allGreen === 'true',
    };
    const sortField = q.sortField || 'compositeScore';
    const n         = parseInt(q.n) || 100;
    const data      = await gs.advancedScreener(filters, sortField, n);
    res.json({ success: true, count: data.length, sortField, data });
  } catch (e) { res.json({ success: false, error: e.message }); }
});

// GET /api/gs/top-field?field=roeScore&n=30
app.get('/api/gs/top-field', async (req, res) => {
  try {
    const field     = req.query.field || 'roeScore';
    const n         = parseInt(req.query.n) || 30;
    const ascending = req.query.asc === 'true';
    const industry  = req.query.industry || '';
    const data      = await gs.topByField(field, n, ascending, industry);
    res.json({ success: true, field, count: data.length, data });
  } catch (e) { res.json({ success: false, error: e.message }); }
});

// POST /api/gs/refresh — force reload from Google Sheets
app.post('/api/gs/refresh', async (req, res) => {
  try {
    const rows = await gs.refresh();
    res.json({ success: true, message: `Refreshed ${rows.length} companies` });
  } catch (e) { res.json({ success: false, error: e.message }); }
});

// GET /api/gs/tickers — all ticker symbols + names for autocomplete
app.get('/api/gs/tickers', async (req, res) => {
  try {
    const rows = await gs.loadSheet();
    const data = rows
      .filter(r => r.nseCode)
      .map(r => ({ nseCode: r.nseCode, name: r.name, industry: r.industry }));
    res.json({ success: true, count: data.length, data });
  } catch (e) { res.json({ success: false, error: e.message }); }
});

// GET /api/gs/sankey-data?q=TCS  — returns all financial flow fields for Sankey chart
// Fields returned (all in ₹ Cr from the GS sheet):
//   sales, opProfit, opm, pat, npm, cashOps, netCashFlow, debt, divYield,
//   salesGr1, profitGr1, opProfitGr, salesQ, patQ, opProfitQ,
//   marketCap (as marCap string), plus computed: opExpenses, tax, interest, retained, dividends
app.get('/api/gs/sankey-data', async (req, res) => {
  try {
    const q = (req.query.q || '').trim();
    if (!q) return res.json({ success: false, error: 'q param required' });
    const row = await gs.getCompanyGS(q);
    if (!row) return res.status(404).json({ success: false, error: `Ticker "${q}" not found in Google Sheet` });

    // Helper: parse string numbers like "12,345" or "12345.00" → number
    const pn = (v) => {
      if (v == null || v === '') return null;
      const n = parseFloat(v.toString().replace(/[,₹%\s]/g, ''));
      return isNaN(n) ? null : n;
    };

    // ── Core P&L values (all ₹ Cr) ───────────────────────────────────────────
    const revenue    = pn(row.sales);           // Annual Sales ₹ Cr
    const opProfit   = pn(row.opProfit);        // Operating Profit ₹ Cr
    const pat        = pn(row.pat);             // Profit After Tax ₹ Cr
    const cashOps    = pn(row.cashOps);         // Cash from Operations ₹ Cr
    const netCashFlow= pn(row.netCashFlow);     // Net Cash Flow ₹ Cr

    // Derived: Operating Expenses = Revenue − Operating Profit
    const opExpenses = (revenue != null && opProfit != null) ? Math.max(revenue - opProfit, 0) : null;

    // Derived: Tax + Interest = Operating Profit − PAT (approximation; GS has no separate tax col)
    const taxAndInterest = (opProfit != null && pat != null) ? Math.max(opProfit - pat, 0) : null;

    // Derived: CapEx ≈ Cash from Ops − Net Cash Flow (rough; GS has no direct CapEx col)
    const capex = (cashOps != null && netCashFlow != null) ? Math.max(cashOps - netCashFlow, 0) : null;

    // Derived: Free Cash Flow ≈ Net Cash Flow (GS has no dedicated FCF col)
    const fcf = netCashFlow;

    // Dividends: estimate from divYield × marketCap (marCap is a string like "1,234 Cr")
    let dividends = null;
    const divYield = pn(row.divYield);  // %
    const marCapStr = row.marCap;
    const marCap    = pn(marCapStr);
    if (divYield != null && marCap != null && marCap > 0) {
      dividends = parseFloat(((divYield / 100) * marCap).toFixed(0));
    }

    // Retained earnings = PAT − Dividends
    const retained = (pat != null && dividends != null) ? Math.max(pat - dividends, 0) : pat;

    // Quarterly data
    const revenueQ   = pn(row.salesQtr);
    const opProfitQ  = pn(row.opProfitQtr);
    const patQ       = pn(row.patQtr);

    res.json({
      success: true,
      ticker:  row.nseCode,
      name:    row.name,
      industry: row.industry,
      lastResult: row.lastResult,
      data: {
        // Annual P&L flow (₹ Cr)
        revenue,
        opExpenses,
        opProfit,
        taxAndInterest,
        pat,
        dividends,
        retained,
        // Cash flow
        cashOps,
        capex,
        fcf,
        // Margins (%)
        opm:  pn(row.opm),
        npm:  pn(row.npm),
        // Growth (%)
        salesGr1:    pn(row.salesGr1),
        profitGr1:   pn(row.profitGr1),
        opProfitGr:  pn(row.opProfitGr),
        // Quarterly
        revenueQ,
        opProfitQ,
        patQ,
        // Extra
        debt:    pn(row.debt),
        marCap,
        divYield,
        pe:      pn(row.pe),
        roe:     pn(row.roe),
        compositeScore: pn(row.compositeScore),
      }
    });
  } catch (e) { res.json({ success: false, error: e.message }); }
});

// ─────────────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🧞 Aladdin Investing server → http://localhost:${PORT}`);
  console.log(`📊 Investor Dashboard → http://localhost:${PORT}/dashboard`);
  console.log(`🤖 AI: watsonx → Gemini → dummy fallback active`);
  console.log(`📰 News Intelligence: /api/news/feed  /api/news/heatmap`);
  console.log(`📈 Fundamentals CSV: /api/fundamentals/...`);
  console.log(`🔧 Technical Analysis: POST /api/technical/analyse`);
  console.log(`💹 Kite Connect: /api/kite/...`);
  console.log(`🌍 Macro: /api/macro/fii-dii  /api/macro/india-vix  /api/macro/pcr`);
  console.log(`📋 Google Sheet: /api/gs/top  /api/gs/screener  /api/gs/jumps  /api/gs/all-green\n`);
});
