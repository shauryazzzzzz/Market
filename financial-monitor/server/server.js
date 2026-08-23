/**
 * server/server.js — financial-monitor  (PERF OPTIMISED)
 * Express server for NSE 500 financial dashboard
 * Runs on port 5000 (proxied from tradingview-economy at /fm-api)
 *
 * Performance improvements:
 *  - compression middleware  (~70% payload reduction on JSON responses)
 *  - in-memory response cache for slow/repeated endpoints (TTL-based)
 *  - eager DB connection on startup (not lazy)
 *  - /api/ai/health cached in shared/watsonx.js (5 min TTL)
 */
require('dotenv').config();
const express  = require('express');
const cors     = require('cors');
const path     = require('path');
const zlib     = require('zlib');

const app  = express();
const PORT = process.env.PORT || 5000;

// ── Compression (gzip/deflate all JSON responses) ────────────────────────────
// Uses Node's built-in zlib — no extra dependency needed
app.use((req, res, next) => {
  const acceptEncoding = req.headers['accept-encoding'] || '';
  if (!acceptEncoding.includes('gzip')) return next();
  const _json = res.json.bind(res);
  res.json = (data) => {
    try {
      const buf = Buffer.from(JSON.stringify(data));
      zlib.gzip(buf, { level: 1 }, (err, compressed) => {   // level 1 = fast
        if (err || compressed.length >= buf.length) {
          res.setHeader('Content-Type', 'application/json');
          return _json(data);
        }
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Encoding', 'gzip');
        res.setHeader('Content-Length', compressed.length);
        res.end(compressed);
      });
    } catch { _json(data); }
  };
  next();
});

app.use(cors());
app.use(express.json());

// ── Simple in-memory TTL cache ────────────────────────────────────────────────
const _cache = new Map();   // key → { data, expiry }

function fromCache(key) {
  const entry = _cache.get(key);
  if (entry && Date.now() < entry.expiry) return entry.data;
  _cache.delete(key);
  return null;
}

function toCache(key, data, ttlMs) {
  _cache.set(key, { data, expiry: Date.now() + ttlMs });
}

// Cache invalidation: clear all entries whose key starts with prefix
function clearCache(prefix) {
  for (const k of _cache.keys()) {
    if (k.startsWith(prefix)) _cache.delete(k);
  }
}

const CACHE_TTL = {
  stocks_list:     30 * 1000,   // 30 s — stock list (prices change slowly)
  sectors_list:    10 * 60 * 1000, // 10 min — sectors never change
  markets_global:  60 * 1000,   // 1 min  — static mock data
  markets_sectoral: 2 * 60 * 1000, // 2 min  — heavy JOIN query
  shockers:        60 * 1000,   // 1 min  — shocker queries
  search:          10 * 1000,   // 10 s   — search results
};

// ── Caching middleware factory ────────────────────────────────────────────────
function cacheMiddleware(key, ttlMs) {
  return (req, res, next) => {
    // Build cache key from path + query string
    const fullKey = `${key}:${req.url}`;
    const hit = fromCache(fullKey);
    if (hit) {
      res.setHeader('X-Cache', 'HIT');
      return res.json(hit);
    }
    // Intercept res.json to save to cache
    const _json = res.json.bind(res);
    res.json = (data) => {
      if (res.statusCode < 400) toCache(fullKey, data, ttlMs);
      return _json(data);
    };
    next();
  };
}

// ── Routes (with caching wrappers) ───────────────────────────────────────────
try {
  const stocksRouter = require('./routes/stocks');
  // Wrap stock list route with cache
  app.use('/api/stocks', (req, res, next) => {
    // Only cache GET requests, not mutations
    if (req.method !== 'GET') return next();
    // Pick TTL based on route
    const isSearch  = req.path === '/search';
    const isSectors = req.path.includes('sector');
    const ttl = isSearch ? CACHE_TTL.search
              : isSectors ? CACHE_TTL.sectors_list
              : CACHE_TTL.stocks_list;
    const fullKey = `stocks:${req.url}`;
    const hit = fromCache(fullKey);
    if (hit) { res.setHeader('X-Cache', 'HIT'); return res.json(hit); }
    const _json = res.json.bind(res);
    res.json = (data) => { if (res.statusCode < 400) toCache(fullKey, data, ttl); return _json(data); };
    next();
  }, stocksRouter);
} catch(e) { console.warn('stocks route failed:', e.message); }

try {
  const marketsRouter = require('./routes/markets');
  app.use('/api/markets', (req, res, next) => {
    if (req.method !== 'GET') return next();
    const isSectoral = req.path.includes('sectoral');
    const isShocker  = req.path.includes('shocker');
    const ttl = isSectoral ? CACHE_TTL.markets_sectoral
              : isShocker  ? CACHE_TTL.shockers
              : CACHE_TTL.markets_global;
    const fullKey = `markets:${req.url}`;
    const hit = fromCache(fullKey);
    if (hit) { res.setHeader('X-Cache', 'HIT'); return res.json(hit); }
    const _json = res.json.bind(res);
    res.json = (data) => { if (res.statusCode < 400) toCache(fullKey, data, ttl); return _json(data); };
    next();
  }, marketsRouter);
} catch(e) { console.warn('markets route failed:', e.message); }

// ── Live price refresh (Yahoo Finance) ───────────────────────────────────────
let priceUpdater = null;
try { priceUpdater = require('./services/priceUpdater'); } catch { /* optional */ }

app.get('/api/stocks/refresh-prices', async (req, res) => {
  if (!priceUpdater) return res.json({ success: false, error: 'priceUpdater not available' });
  try {
    const result = await priceUpdater.refreshPrices();
    clearCache('stocks:');   // invalidate stock cache after refresh
    res.json({ success: true, ...result });
  } catch (e) {
    res.json({ success: false, error: e.message });
  }
});

// ── Auto price refresh via node-cron (every 5 min on weekdays 9:15–15:30 IST) ─
try {
  const cron = require('node-cron');
  // "*/5 9-15 * * 1-5" = every 5 min, hours 9–15, Mon–Fri
  cron.schedule('*/5 9-15 * * 1-5', async () => {
    if (!priceUpdater) return;
    try {
      await priceUpdater.refreshPrices();
      clearCache('stocks:');
      console.log(`[cron] Prices refreshed at ${new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' })} IST`);
    } catch (e) {
      console.warn('[cron] Price refresh failed:', e.message);
    }
  }, { timezone: 'Asia/Kolkata' });
  console.log('   Auto price refresh cron: every 5 min, 9:00–15:59 IST (Mon–Fri)');
} catch (e) {
  console.warn('   node-cron not available — manual refresh only via GET /api/stocks/refresh-prices');
}

// ── AI endpoint (watsonx → Gemini → dummy) ───────────────────────────────────
const { analyzeStock, getMarketSentiment, healthCheck } = require('./services/watsonx');

app.post('/api/ai/analyze-stock', async (req, res) => {
  try {
    const result = await analyzeStock(req.body);
    res.json({ success: true, ...result });
  } catch (e) {
    res.json({ success: false, text: '[AI unavailable]', provider: 'error', error: e.message });
  }
});

app.post('/api/ai/market-sentiment', async (req, res) => {
  try {
    const result = await getMarketSentiment(req.body.headlines || []);
    res.json({ success: true, ...result });
  } catch (e) {
    res.json({ success: false, text: 'neutral', provider: 'error', error: e.message });
  }
});

// /api/ai/health is already cached in shared/watsonx.js for 5 minutes
app.get('/api/ai/health', async (req, res) => {
  const status = await healthCheck();
  res.json(status);
});

// ── Health + cache stats ─────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({
    success: true, server: 'financial-monitor', port: PORT,
    cacheEntries: _cache.size, ts: new Date().toISOString()
  });
});

// ── Eager DB connection at startup (not lazy) ────────────────────────────────
const { getDatabase } = require('./config/database');

app.listen(PORT, async () => {
  console.log(`\n📊 Financial Monitor server → http://localhost:${PORT}`);
  // Warm up DB connection immediately so first request is fast
  try {
    await getDatabase();
    console.log('   DB connection warmed up');
  } catch (e) {
    console.warn('   DB warm-up failed:', e.message);
  }
  console.log(`   Stocks:  /api/stocks`);
  console.log(`   Markets: /api/markets/global  /api/markets/sectoral-indices`);
  console.log(`   Shockers:/api/markets/shockers/near-52w-high|momentum|volume`);
  console.log(`   AI:      POST /api/ai/market-sentiment`);
  console.log(`   Cache:   TTL-based in-memory cache active\n`);
});
