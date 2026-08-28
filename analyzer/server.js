'use strict';
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const path = require('path');
const fs = require('fs');
// yahoo-finance2 v4 — must be instantiated via `new`
const YahooFinanceClass = require('yahoo-finance2').default;
const yahooFinance = new YahooFinanceClass({ suppressNotices: ['yahooSurvey'] });
// IBM LLM Router: watsonx first, Gemini only as last resort
const { chat: llmChat } = require('../llm-router');
// Two-tier cache: quarterly (disk) + daily (in-memory)
const cache = require('../shared/cacheManager');

const app = express();
const PORT = process.env.BACKEND_PORT || 5002;

// ── Key validation on startup ─────────────────────────────────────────────────
if (!process.env.WATSONX_API_KEY) console.warn('[ANALYZER] WARNING: WATSONX_API_KEY not set — will attempt Gemini fallback');
if (!process.env.GEMINI_API_KEY)  console.warn('[ANALYZER] WARNING: GEMINI_API_KEY not set — LLM will fail if watsonx also unavailable');

// ── Rate limiting ─────────────────────────────────────────────────────────────
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  message: { error: 'Too many requests, please wait a minute' }
});

// ── Middleware ─────────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use(morgan('combined'));
app.use('/api/analyzer', apiLimiter);

// ── Technical indicator calculators ───────────────────────────────────────────
function calcSMA(values, period) {
  if (values.length < period) return null;
  const slice = values.slice(-period);
  return slice.reduce((a, b) => a + b, 0) / period;
}

function calcEMA(values, period) {
  if (values.length < period) return null;
  const k = 2 / (period + 1);
  let ema = values.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = period; i < values.length; i++) {
    ema = values[i] * k + ema * (1 - k);
  }
  return ema;
}

function calcRSI(closes, period = 14) {
  if (closes.length < period + 1) return null;
  let gains = 0, losses = 0;
  for (let i = 1; i <= period; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff >= 0) gains += diff; else losses -= diff;
  }
  let avgGain = gains / period;
  let avgLoss = losses / period;
  for (let i = period + 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    const gain = diff >= 0 ? diff : 0;
    const loss = diff < 0 ? -diff : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
  }
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return parseFloat((100 - 100 / (1 + rs)).toFixed(2));
}

function calcMACD(closes) {
  if (closes.length < 26) return null;
  const ema12 = calcEMA(closes, 12);
  const ema26 = calcEMA(closes, 26);
  if (ema12 === null || ema26 === null) return null;
  const macdLine = ema12 - ema26;
  return { macdLine: parseFloat(macdLine.toFixed(4)), ema12: parseFloat(ema12.toFixed(4)), ema26: parseFloat(ema26.toFixed(4)) };
}

function calcBollingerBands(closes, period = 20, stdDevMultiplier = 2) {
  if (closes.length < period) return null;
  const slice = closes.slice(-period);
  const mean = slice.reduce((a, b) => a + b, 0) / period;
  const variance = slice.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / period;
  const stdDev = Math.sqrt(variance);
  return {
    upper: parseFloat((mean + stdDevMultiplier * stdDev).toFixed(4)),
    middle: parseFloat(mean.toFixed(4)),
    lower: parseFloat((mean - stdDevMultiplier * stdDev).toFixed(4))
  };
}

function calcATR(highs, lows, closes, period = 14) {
  if (closes.length < period + 1) return null;
  const trs = [];
  for (let i = 1; i < closes.length; i++) {
    const tr = Math.max(
      highs[i] - lows[i],
      Math.abs(highs[i] - closes[i - 1]),
      Math.abs(lows[i] - closes[i - 1])
    );
    trs.push(tr);
  }
  return parseFloat((trs.slice(-period).reduce((a, b) => a + b, 0) / period).toFixed(4));
}

function getStartDate(period) {
  const d = new Date();
  if (period === '1mo') d.setMonth(d.getMonth() - 1);
  else if (period === '3mo') d.setMonth(d.getMonth() - 3);
  else if (period === '6mo') d.setMonth(d.getMonth() - 6);
  else if (period === '1y') d.setFullYear(d.getFullYear() - 1);
  else if (period === '2y') d.setFullYear(d.getFullYear() - 2);
  else d.setMonth(d.getMonth() - 6);
  return d;
}

/**
 * Fetch OHLCV rows using yahooFinance.chart() with historical() fallback.
 * Returns a plain array of { date, open, high, low, close, volume }.
 */
async function fetchOHLCVRows(symbol, period, interval = '1d') {
  try {
    const result = await yahooFinance.chart(symbol, { period1: getStartDate(period), interval });
    const rows = (result?.quotes || []).filter(d => d.close != null);
    return rows.map(d => ({
      date:   (d.date instanceof Date ? d.date : new Date(d.date)).toISOString().split('T')[0],
      open:   d.open, high: d.high, low: d.low, close: d.close, volume: d.volume
    }));
  } catch (_) {
    // v2 fallback
    const history = await yahooFinance.historical(symbol, { period1: getStartDate(period), interval }) || [];
    return history.map(d => ({
      date:   (d.date instanceof Date ? d.date : new Date(d.date)).toISOString().split('T')[0],
      open:   d.open, high: d.high, low: d.low, close: d.close, volume: d.volume
    }));
  }
}

// ── LLM helper (IBM watsonx first, Gemini fallback) ───────────────────────────
async function callLLM(prompt) {
  const result = await llmChat([{ role: 'user', content: prompt }], { maxTokens: 2048 });
  return result.text;
}

// ── Strip _cache metadata before sending to client ───────────────────────────
// The _cache key is internal — never expose it in API responses.
function omitCacheMeta(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  const { _cache, ...rest } = obj;
  return rest;
}

// ── Routes ─────────────────────────────────────────────────────────────────────

// Health
app.get('/api/analyzer/health', async (req, res) => {
  let yahooStatus = 'unknown';
  try {
    const q = await yahooFinance.quote('MSFT');
    yahooStatus = q && q.regularMarketPrice ? 'ok' : 'degraded';
  } catch (e) {
    yahooStatus = `error: ${e.message}`;
  }
  res.json({
    status: 'ok',
    app: 'ANALYZER',
    port: PORT,
    llmBackend: process.env.WATSONX_API_KEY ? 'IBM watsonx.ai' : (process.env.GEMINI_API_KEY ? 'Google Gemini (fallback)' : 'None configured'),
    watsonxConfigured: !!process.env.WATSONX_API_KEY,
    icaConfigured: !!process.env.WXO_API_KEY,
    geminiConfigured: !!process.env.GEMINI_API_KEY,
    primaryModel: 'meta-llama/llama-4-maverick-17b-128e-instruct-fp8 (watsonx)',
    yahooFinance: yahooStatus,
    timestamp: new Date().toISOString()
  });
});

// ── Cache status endpoint ─────────────────────────────────────────────────────
app.get('/api/analyzer/cache-status', (req, res) => {
  res.json(cache.status());
});

// ── Invalidate cache for a ticker ─────────────────────────────────────────────
// POST /api/analyzer/cache-invalidate { ticker, tier }
app.post('/api/analyzer/cache-invalidate', (req, res) => {
  const { ticker, tier } = req.body;
  if (!ticker) return res.status(400).json({ error: 'ticker required' });
  if (tier === 'quarterly' || !tier) cache.invalidateQuarterly(ticker);
  if (tier === 'daily'     || !tier) cache.invalidateDaily(ticker);
  res.json({ ok: true, ticker: ticker.toUpperCase(), invalidated: tier || 'both' });
});

// ── Set result announcement date for quarterly cache ──────────────────────────
// POST /api/analyzer/cache-result-date { ticker, resultAnnouncementDate }
app.post('/api/analyzer/cache-result-date', (req, res) => {
  const { ticker, resultAnnouncementDate } = req.body;
  if (!ticker || !resultAnnouncementDate) {
    return res.status(400).json({ error: 'ticker and resultAnnouncementDate required' });
  }
  try {
    cache.setResultDate(ticker, resultAnnouncementDate);
    res.json({ ok: true, ticker: ticker.toUpperCase(), resultAnnouncementDate });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// ── Live quote — DAILY tier ──────────────────────────────────────────────────
// Price, P/E, RSI, volume — all price-derived, re-fetched each trading day.
app.get('/api/analyzer/quote/:symbol', async (req, res) => {
  const symbol = req.params.symbol.toUpperCase().trim();
  if (!symbol) return res.status(400).json({ error: 'Symbol required' });
  try {
    const result = await cache.get('daily', symbol, async () => {
      const quote = await yahooFinance.quote(symbol);
      if (!quote) throw new Error(`No data returned for ${symbol}`);
      return {
        symbol,
        price:           quote.regularMarketPrice,
        change:          quote.regularMarketChange,
        changePercent:   quote.regularMarketChangePercent,
        open:            quote.regularMarketOpen,
        high:            quote.regularMarketDayHigh,
        low:             quote.regularMarketDayLow,
        previousClose:   quote.regularMarketPreviousClose,
        volume:          quote.regularMarketVolume,
        marketCap:       quote.marketCap,
        // P/E is price-derived — daily tier
        pe:              quote.trailingPE,
        eps:             quote.epsTrailingTwelveMonths,
        fiftyTwoWeekHigh: quote.fiftyTwoWeekHigh,
        fiftyTwoWeekLow:  quote.fiftyTwoWeekLow,
        name:            quote.longName || quote.shortName,
        currency:        quote.currency,
        exchange:        quote.fullExchangeName,
      };
    });
    res.json({ ...omitCacheMeta(result), fetchedAt: result._cache?.fetchedAt || new Date().toISOString() });
  } catch (err) {
    res.status(502).json({ error: `Yahoo Finance error: ${err.message}`, symbol });
  }
});

// ── Historical OHLCV — DAILY tier ───────────────────────────────────────────
// Full OHLCV series: cached once per trading day per (symbol+period+interval).
app.get('/api/analyzer/history/:symbol', async (req, res) => {
  const symbol   = req.params.symbol.toUpperCase().trim();
  const period   = req.query.period   || '6mo';
  const interval = req.query.interval || '1d';
  if (!symbol) return res.status(400).json({ error: 'Symbol required' });
  // Cache key includes period+interval so different ranges get independent entries
  const cacheSymbol = `${symbol}__HISTORY__${period}__${interval}`;
  try {
    const result = await cache.get('daily', cacheSymbol, async () => {
      const rows = await fetchOHLCVRows(symbol, period, interval);
      if (!rows.length) throw new Error(`No historical data for ${symbol}`);
      return { symbol, period, interval, count: rows.length, data: rows };
    });
    res.json({ ...omitCacheMeta(result), fetchedAt: result._cache?.fetchedAt || new Date().toISOString() });
  } catch (err) {
    if (err.message.startsWith('No historical')) return res.status(404).json({ error: err.message });
    res.status(502).json({ error: `Yahoo Finance error: ${err.message}`, symbol });
  }
});

// ── Technical indicators — DAILY tier ────────────────────────────────────────
// RSI, EMA, SMA, MACD, Bollinger, ATR — all derived from daily price series.
app.get('/api/analyzer/technicals/:symbol', async (req, res) => {
  const symbol = req.params.symbol.toUpperCase().trim();
  const cacheSymbol = `${symbol}__TECHNICALS`;
  try {
    const result = await cache.get('daily', cacheSymbol, async () => {
      const rows = await fetchOHLCVRows(symbol, '1y', '1d');
      if (rows.length < 20) throw new Error(`Insufficient data for ${symbol} — need at least 20 days`);
      const closes = rows.map(d => d.close);
      const highs   = rows.map(d => d.high);
      const lows    = rows.map(d => d.low);
      return {
        symbol,
        dataPoints:      closes.length,
        rsi14:           calcRSI(closes, 14),
        ema20:           calcEMA(closes, 20),
        ema50:           calcEMA(closes, 50),
        ema200:          calcEMA(closes, 200),
        sma20:           calcSMA(closes, 20),
        macd:            calcMACD(closes),
        bollingerBands:  calcBollingerBands(closes, 20),
        atr14:           calcATR(highs, lows, closes, 14),
        currentPrice:    closes[closes.length - 1],
      };
    });
    res.json({ ...omitCacheMeta(result), fetchedAt: result._cache?.fetchedAt || new Date().toISOString() });
  } catch (err) {
    if (err.message.startsWith('Insufficient')) return res.status(422).json({ error: err.message });
    res.status(502).json({ error: `Error computing technicals: ${err.message}`, symbol });
  }
});

// ── Quarterly fundamentals endpoint ──────────────────────────────────────────
// Returns fundamental ratios sourced from Yahoo Finance's financialData/defaultKeyStatistics.
// Cached for 90 days from the last result announcement date.
app.get('/api/analyzer/fundamentals/:symbol', async (req, res) => {
  const symbol = req.params.symbol.toUpperCase().trim();
  if (!symbol) return res.status(400).json({ error: 'Symbol required' });
  try {
    const result = await cache.get('quarterly', symbol, async () => {
      // Fetch quote (for P/B live snapshot) + quoteSummary for fundamental ratios
      const [quoteData, summaryData] = await Promise.allSettled([
        yahooFinance.quote(symbol),
        yahooFinance.quoteSummary(symbol, {
          modules: ['financialData', 'defaultKeyStatistics', 'incomeStatementHistory', 'balanceSheetHistory']
        }).catch(() => null)
      ]);
      const q   = quoteData.status  === 'fulfilled' ? quoteData.value   : null;
      const sum = summaryData.status === 'fulfilled' ? summaryData.value : null;

      const fd   = sum?.financialData        || {};
      const ks   = sum?.defaultKeyStatistics || {};

      return {
        symbol,
        // ── Quarterly-static ratios ──────────────────────────────────────
        revenueGrowthYoY:     fd.revenueGrowth         ?? null,   // YoY Revenue Growth
        earningsGrowthYoY:    fd.earningsGrowth         ?? null,   // YoY Earnings/Profit Growth
        operatingMarginPct:   fd.operatingMargins       ?? null,   // OPM
        profitMarginPct:      fd.profitMargins          ?? null,   // NPM
        returnOnEquity:       fd.returnOnEquity         ?? null,   // ROE
        returnOnAssets:       fd.returnOnAssets         ?? null,   // ROA
        debtToEquity:         fd.debtToEquity           ?? null,   // D/E
        currentRatio:         fd.currentRatio           ?? null,
        grossMarginPct:       fd.grossMargins           ?? null,
        // EV/EBITDA — from key statistics
        evToEbitda:           ks.enterpriseToEbitda     ?? null,
        evToRevenue:          ks.enterpriseToRevenue    ?? null,
        // P/B — static from key statistics (also served as daily P/B snapshot via quote)
        priceToBook:          ks.priceToBook            ?? null,   // P/B
        // PEG ratio
        pegRatio:             ks.pegRatio               ?? null,
        // Beta
        beta:                 ks.beta                   ?? null,
        // EPS TTM
        trailingEps:          ks.trailingEps            ?? null,
        // Forward P/E
        forwardPE:            ks.forwardPE              ?? null,
        // Enterprise value
        enterpriseValue:      ks.enterpriseValue        ?? null,
        // Shares outstanding
        sharesOutstanding:    ks.sharesOutstanding      ?? null,
        // P/E TTM (from quote as daily snapshot)
        trailingPE:           q?.trailingPE             ?? null,
        // Company name
        name:                 q?.longName || q?.shortName || symbol,
        currency:             q?.currency || 'USD',
      };
    });
    res.json({ ...omitCacheMeta(result), fetchedAt: result._cache?.fetchedAt, expiryDate: result._cache?.expiryDate });
  } catch (err) {
    res.status(502).json({ error: `Yahoo Finance error: ${err.message}`, symbol });
  }
});

// ── LLM Analysis — uses daily quote + daily technicals from cache ──────────
app.post('/api/analyzer/analyze', async (req, res) => {
  const { ticker, analysisType = 'comprehensive' } = req.body;
  if (!ticker) return res.status(400).json({ error: 'ticker is required in request body' });

  const symbol = ticker.toUpperCase().trim();
  try {
    // Fetch live quote + 3-month OHLCV concurrently via daily cache
    const [quoteResult, histResult] = await Promise.allSettled([
      cache.get('daily', symbol, async () => {
        const q = await yahooFinance.quote(symbol);
        if (!q) throw new Error(`No data for ${symbol}`);
        return {
          symbol,
          price: q.regularMarketPrice, change: q.regularMarketChange,
          changePercent: q.regularMarketChangePercent,
          marketCap: q.marketCap, pe: q.trailingPE,
          fiftyTwoWeekHigh: q.fiftyTwoWeekHigh, fiftyTwoWeekLow: q.fiftyTwoWeekLow,
          volume: q.regularMarketVolume, currency: q.currency,
        };
      }),
      cache.get('daily', `${symbol}__HISTORY__3mo__1d`, async () => {
        const rows = await fetchOHLCVRows(symbol, '3mo', '1d');
        return { symbol, period: '3mo', interval: '1d', count: rows.length, data: rows };
      })
    ]);

    const quoteData = quoteResult.status === 'fulfilled' ? quoteResult.value : null;
    const histData  = histResult.status  === 'fulfilled' ? histResult.value  : { data: [] };

    if (!quoteData) {
      return res.status(502).json({ error: `Could not fetch live data for ${symbol}. Cannot perform analysis without real data.` });
    }

    const closes = (histData.data || []).map(d => d.close);
    const technicals = closes.length >= 20 ? {
      rsi:   calcRSI(closes, 14),
      ema20: calcEMA(closes, 20),
      ema50: calcEMA(closes, 50),
      bb:    calcBollingerBands(closes, 20)
    } : null;

    const prompt = `You are a professional financial analyst. Analyze ${symbol} based ONLY on the following real market data. Do NOT make up any numbers.

LIVE QUOTE (fetched ${quoteData._cache?.fetchedAt || new Date().toISOString()}):
- Price: ${quoteData.price} ${quoteData.currency}
- Change: ${quoteData.change?.toFixed(2)} (${quoteData.changePercent?.toFixed(2)}%)
- Market Cap: ${quoteData.marketCap ? (quoteData.marketCap / 1e9).toFixed(2) + 'B' : 'N/A'}
- P/E Ratio: ${quoteData.pe?.toFixed(2) || 'N/A'}
- 52-Week High: ${quoteData.fiftyTwoWeekHigh}
- 52-Week Low: ${quoteData.fiftyTwoWeekLow}
- Volume: ${quoteData.volume?.toLocaleString()}

TECHNICAL INDICATORS (from last 90 days of daily data):
${technicals ? `- RSI(14): ${technicals.rsi}
- EMA(20): ${technicals.ema20?.toFixed(2)}
- EMA(50): ${technicals.ema50?.toFixed(2)}
- Bollinger Upper: ${technicals.bb?.upper}, Middle: ${technicals.bb?.middle}, Lower: ${technicals.bb?.lower}` : '- Insufficient historical data for technicals'}

ANALYSIS TYPE: ${analysisType}

Provide a structured ${analysisType} analysis covering:
1. Current Price Action & Momentum
2. Valuation Assessment (based on the P/E and price data above)
3. Technical Setup (based on the indicators above)
4. Risk Factors
5. Overall Outlook (Bullish/Bearish/Neutral) with reasoning

Be concise, factual, and ground every statement in the data above.`;

    const analysis = await callLLM(prompt);

    res.json({
      symbol,
      analysisType,
      liveQuote: omitCacheMeta(quoteData),
      technicals,
      analysis,
      dataSource: 'Yahoo Finance + IBM watsonx.ai (llama-4-maverick → llama3.3-70b → ICA → Gemini)',
      cacheInfo: { quoteTier: 'daily', techTier: 'daily', tradingDate: cache.tradingDateKey() },
      analyzedAt: new Date().toISOString()
    });
  } catch (err) {
    res.status(502).json({ error: err.message, symbol });
  }
});

// ── Comparative analysis — daily tier ────────────────────────────────────────
app.post('/api/analyzer/compare', async (req, res) => {
  const { tickers } = req.body;
  if (!Array.isArray(tickers) || tickers.length < 2) {
    return res.status(400).json({ error: 'Provide at least 2 tickers in array' });
  }
  const symbols = tickers.slice(0, 5).map(t => t.toUpperCase().trim());

  try {
    const quoteResults = await Promise.allSettled(
      symbols.map(s =>
        cache.get('daily', s, async () => {
          const q = await yahooFinance.quote(s);
          if (!q) throw new Error(`No data for ${s}`);
          return {
            symbol: s,
            price: q.regularMarketPrice, currency: q.currency,
            pe: q.trailingPE, marketCap: q.marketCap,
            fiftyTwoWeekHigh: q.fiftyTwoWeekHigh, fiftyTwoWeekLow: q.fiftyTwoWeekLow,
          };
        })
      )
    );

    const valid = quoteResults
      .filter(r => r.status === 'fulfilled')
      .map(r => r.value);

    if (valid.length < 2) {
      return res.status(502).json({ error: 'Could not fetch data for at least 2 tickers' });
    }

    const tableRows = valid.map(v =>
      `${v.symbol}: Price=${v.price} ${v.currency}, PE=${v.pe?.toFixed(2)||'N/A'}, MarketCap=${v.marketCap?(v.marketCap/1e9).toFixed(2)+'B':'N/A'}, 52wHigh=${v.fiftyTwoWeekHigh}, 52wLow=${v.fiftyTwoWeekLow}`
    ).join('\n');

    const prompt = `You are a financial analyst comparing stocks. Analyze ONLY the following real data:

${tableRows}

Data fetched: ${new Date().toISOString()}

Compare these stocks objectively on:
1. Valuation (P/E ratios, market caps)
2. Price momentum (distance from 52-week highs/lows)
3. Relative strength
4. Which appears most attractive and why
5. Risks for each

Ground every comparison in the numbers above. Do not fabricate any additional data.`;

    const analysis = await callLLM(prompt);
    res.json({
      tickers: symbols,
      quotes: valid.map(omitCacheMeta),
      analysis,
      cacheInfo: { tier: 'daily', tradingDate: cache.tradingDateKey() },
      analyzedAt: new Date().toISOString()
    });
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

// Serve frontend build
const frontendBuild = path.join(__dirname, 'frontend', 'dist');
if (fs.existsSync(frontendBuild)) {
  app.use(express.static(frontendBuild, { index: false }));
  app.get(/^(?!\/(api)\/).*$/, (req, res) => {
    res.sendFile(path.join(frontendBuild, 'index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`[ANALYZER] Backend running on http://localhost:${PORT}`);
  console.log(`[ANALYZER] LLM: IBM watsonx.ai (primary) | ICA (tier-2) | Gemini (last resort)`);
  console.log(`[ANALYZER] watsonx key: ${process.env.WATSONX_API_KEY ? '✓ set' : '✗ MISSING'}`);
  console.log(`[ANALYZER] ICA key:     ${process.env.WXO_API_KEY     ? '✓ set' : '✗ MISSING'}`);
  console.log(`[ANALYZER] Cache: quarterly (disk) + daily (in-memory) — tier-2 cache active`);
});
