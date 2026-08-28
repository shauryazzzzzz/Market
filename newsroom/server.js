'use strict';
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const path = require('path');
const fs = require('fs');
const fetch = require('node-fetch');
const { chat: llmChat } = require('../llm-router');
// Two-tier cache: quarterly (disk, 90 days) + daily (in-memory, per trading session)
const cache = require('../shared/cacheManager');

const app = express();
const PORT = process.env.BACKEND_PORT || 5003;

// ── Key validation ────────────────────────────────────────────────────────────
const NEWS_API_KEY = process.env.NEWS_API_KEY;
const FINNHUB_KEY  = process.env.FINNHUB_API_KEY;

if (!process.env.WATSONX_API_KEY) console.warn('[NEWSROOM] WARNING: WATSONX_API_KEY not set — will attempt Gemini fallback');
if (!NEWS_API_KEY && !FINNHUB_KEY) console.warn('[NEWSROOM] WARNING: Neither NEWS_API_KEY nor FINNHUB_API_KEY set — will attempt Finnhub public endpoint');

// ── Rate limiting ─────────────────────────────────────────────────────────────
const apiLimiter = rateLimit({ windowMs: 60 * 1000, max: 40 });

// ── Middleware ─────────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use(morgan('combined'));
app.use('/api/news', apiLimiter);

// ─────────────────────────────────────────────────────────────────────────────
// NEWS TIER DEFINITIONS
// Each news category is tagged with its refresh tier so callers can understand
// how fresh the data is and when it will next be re-fetched.
// ─────────────────────────────────────────────────────────────────────────────
const NEWS_TIERS = {
  // ── Quarterly (valid 90 days, from last result announcement date) ──────────
  management_commentary:   'quarterly',  // Earnings call / result press conference quotes
  // ── Daily (invalidated at start of each new trading session) ─────────────
  global_market:           'daily',      // General financial news
  sector:                  'daily',      // Sector-level market news
  ticker:                  'daily',      // Company-specific news
  trending:                'daily',      // Trending financial keywords
  broker_reports:          'daily',      // Broker / investment house research reports
  block_deals:             'daily',      // Block deals and bulk deals
  india_policy:            'daily',      // Indian government policy news
  us_policy:               'daily',      // US tariff / trade / war policy news
};

// ── 5-minute intraday cache (layer on top of daily tier) ─────────────────────
// Prevents hammering external APIs within the same trading day.
const INTRADAY_TTL_MS = 5 * 60 * 1000; // 5 minutes
const _intradayCache = new Map(); // key → { data, ts }

function getIntraday(key) {
  const entry = _intradayCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.ts > INTRADAY_TTL_MS) { _intradayCache.delete(key); return null; }
  return entry.data;
}

function setIntraday(key, data) {
  _intradayCache.set(key, { data, ts: Date.now() });
  return data;
}

// ── News fetchers ──────────────────────────────────────────────────────────────
async function fetchFromNewsAPI(query) {
  if (!NEWS_API_KEY) throw new Error('NEWS_API_KEY not configured');
  const q = query || 'stock market finance economy';
  const url = `https://newsapi.org/v2/everything?q=${encodeURIComponent(q)}&language=en&sortBy=publishedAt&pageSize=30&apiKey=${NEWS_API_KEY}`;
  const resp = await fetch(url, { timeout: 8000 });
  if (!resp.ok) {
    const body = await resp.text();
    throw new Error(`NewsAPI error ${resp.status}: ${body.slice(0, 200)}`);
  }
  const data = await resp.json();
  if (data.status !== 'ok') throw new Error(`NewsAPI: ${data.message}`);
  return (data.articles || []).map(a => ({
    id: a.url,
    source: a.source?.name || 'Unknown',
    headline: a.title,
    summary: a.description,
    url: a.url,
    publishedAt: a.publishedAt,
    imageUrl: a.urlToImage
  }));
}

async function fetchFromFinnhub(symbol) {
  const token = FINNHUB_KEY || 'sandbox_c6r1t0aad3ia7i0b08eg';
  const from = Math.floor((Date.now() - 7 * 24 * 3600 * 1000) / 1000);
  const to = Math.floor(Date.now() / 1000);
  const url = symbol
    ? `https://finnhub.io/api/v1/company-news?symbol=${symbol}&from=${new Date(from*1000).toISOString().split('T')[0]}&to=${new Date(to*1000).toISOString().split('T')[0]}&token=${token}`
    : `https://finnhub.io/api/v1/news?category=general&token=${token}`;
  const resp = await fetch(url, { timeout: 8000 });
  if (!resp.ok) throw new Error(`Finnhub error ${resp.status}`);
  const data = await resp.json();
  if (!Array.isArray(data)) throw new Error('Finnhub returned unexpected format');
  return data.slice(0, 30).map(a => ({
    id: String(a.id),
    source: a.source || 'Finnhub',
    headline: a.headline,
    summary: a.summary,
    url: a.url,
    publishedAt: new Date(a.datetime * 1000).toISOString(),
    imageUrl: a.image || null,
    related: a.related || null
  }));
}

async function fetchNews(query, symbol) {
  const errors = [];
  if (NEWS_API_KEY) {
    try { return await fetchFromNewsAPI(query); } catch (e) { errors.push(`NewsAPI: ${e.message}`); }
  }
  try { return await fetchFromFinnhub(symbol); } catch (e) { errors.push(`Finnhub: ${e.message}`); }
  throw new Error(`All news sources failed: ${errors.join('; ')}`);
}

/**
 * Tag articles with their news tier.
 * @param {object[]} articles
 * @param {string} tier — 'quarterly' | 'daily'
 * @param {string} category — sub-category label
 */
function tagArticles(articles, tier, category) {
  return articles.map(a => ({ ...a, _tier: tier, _category: category }));
}

/**
 * Fetch news with dual-layer caching:
 * 1. Intraday (5-min) in-memory TTL — stops hammering APIs within the session
 * 2. Daily tier cache for session-boundary invalidation
 * @param {string} query
 * @param {string|null} symbol
 * @param {string} cacheKey — unique key for this query
 * @param {'quarterly'|'daily'} tier
 * @param {string} category
 */
async function fetchNewsTiered(query, symbol, cacheKey, tier, category) {
  // Layer 1: intraday 5-min cache (fastest)
  const intraday = getIntraday(cacheKey);
  if (intraday) return intraday;

  if (tier === 'daily') {
    // Layer 2: daily tier — invalid when the trading date changes
    const result = await cache.get('daily', `news:${cacheKey}`, async () => {
      const articles = await fetchNews(query, symbol);
      return { articles: tagArticles(articles, tier, category) };
    });
    const tagged = result.articles || [];
    setIntraday(cacheKey, tagged);
    return tagged;
  }

  if (tier === 'quarterly') {
    // Layer 2: quarterly tier — 90-day persistent cache on disk
    const result = await cache.get('quarterly', `news:${cacheKey}`, async () => {
      const articles = await fetchNews(query, symbol);
      return { articles: tagArticles(articles, tier, category) };
    });
    const tagged = result.articles || [];
    setIntraday(cacheKey, tagged);
    return tagged;
  }

  // Fallback: direct fetch
  const articles = await fetchNews(query, symbol);
  return tagArticles(articles, tier, category);
}

// ── LLM helper ─────────────────────────────────────────────────────────────────
async function callGemini(prompt) {
  const result = await llmChat([{ role: 'user', content: prompt }], { maxTokens: 2048 });
  return result.text;
}

// ── Strip internal tier/category tags from articles before sending to client ──
// _tier and _category are used internally for cache logic only.
function stripInternalTags(articles) {
  return articles.map(({ _tier, _category, ...rest }) => rest);
}

// ── Routes ─────────────────────────────────────────────────────────────────────

// Health
app.get('/api/news/health', async (req, res) => {
  res.json({
    status: 'ok',
    app: 'NEWSROOM',
    port: PORT,
    apiKeys: {
      newsApi:  !!NEWS_API_KEY,
      finnhub:  !!FINNHUB_KEY,
      gemini:   !!process.env.GEMINI_API_KEY,
      watsonx:  !!process.env.WATSONX_API_KEY,
    },
    newsTiers: NEWS_TIERS,
    timestamp: new Date().toISOString()
  });
});

// ── Cache status endpoint ────────────────────────────────────────────────────
app.get('/api/news/cache-status', (req, res) => {
  const base = cache.status();
  // Augment with intraday cache metrics
  res.json({
    ...base,
    intradayCacheEntries: _intradayCache.size,
    intradayTtlMs:        INTRADAY_TTL_MS,
    newsTierDefinitions:  NEWS_TIERS,
  });
});

// ── Invalidate news cache for a category ────────────────────────────────────
// POST /api/news/cache-invalidate { category }
app.post('/api/news/cache-invalidate', (req, res) => {
  const { category, tier } = req.body;
  if (!category) return res.status(400).json({ error: 'category required' });
  // Clear intraday entry
  _intradayCache.delete(category);
  // Clear tier-based entry
  const resolvedTier = tier || NEWS_TIERS[category] || 'daily';
  if (resolvedTier === 'quarterly') cache.invalidateQuarterly(`news:${category}`);
  else cache.invalidateDaily(`news:${category}`);
  res.json({ ok: true, invalidated: category, tier: resolvedTier });
});

// ── Global financial news — DAILY tier ──────────────────────────────────────
app.get('/api/news/global', async (req, res) => {
  try {
    const articles = await fetchNewsTiered(
      'stock market finance economy investing', null,
      'global', NEWS_TIERS.global_market, 'global_market'
    );
    res.json({
      count: articles.length,
      articles: stripInternalTags(articles),
      tier: NEWS_TIERS.global_market,
      fetchedAt: new Date().toISOString(),
    });
  } catch (err) {
    res.status(502).json({ error: err.message, articles: [] });
  }
});

// ── Sector news — DAILY tier ─────────────────────────────────────────────────
app.get('/api/news/sector/:sector', async (req, res) => {
  const sector = req.params.sector;
  if (!sector) return res.status(400).json({ error: 'Sector required' });
  try {
    const cacheKey = `sector:${sector.toLowerCase()}`;
    const articles = await fetchNewsTiered(
      `${sector} sector stock market`, null,
      cacheKey, NEWS_TIERS.sector, 'sector'
    );
    res.json({
      sector,
      count: articles.length,
      articles: stripInternalTags(articles),
      tier: NEWS_TIERS.sector,
      fetchedAt: new Date().toISOString(),
    });
  } catch (err) {
    res.status(502).json({ error: err.message, sector, articles: [] });
  }
});

// ── Ticker news — DAILY tier ─────────────────────────────────────────────────
app.get('/api/news/ticker/:symbol', async (req, res) => {
  const symbol = req.params.symbol.toUpperCase().trim();
  try {
    const cacheKey = `ticker:${symbol}`;
    let articles;
    try {
      // Prefer Finnhub company-specific news (most recent), bypass tier cache
      const raw = await fetchFromFinnhub(symbol);
      articles = tagArticles(raw, NEWS_TIERS.ticker, 'ticker');
      setIntraday(cacheKey, articles);
    } catch (_e) {
      articles = await fetchNewsTiered(symbol, symbol, cacheKey, NEWS_TIERS.ticker, 'ticker');
    }
    res.json({
      symbol,
      count: articles.length,
      articles: stripInternalTags(articles),
      tier: NEWS_TIERS.ticker,
      fetchedAt: new Date().toISOString(),
    });
  } catch (err) {
    res.status(502).json({ error: err.message, symbol, articles: [] });
  }
});

// ── Trending topics — DAILY tier ─────────────────────────────────────────────
app.get('/api/news/trending', async (req, res) => {
  try {
    const articles = await fetchNewsTiered(
      'trending financial markets today', null,
      'trending', NEWS_TIERS.trending, 'trending'
    );
    const stopWords = new Set(['the','a','an','in','of','to','and','is','for','on','at','by','with','as','from','that','this','be','are','was','were','has','have','been','not','but','or','it','its','their','they','he','she','we','you','i','all','about','will','can','up','down','after','before','over','more','also','just','new','year','says','said','would','could','should']);
    const freq = {};
    for (const a of articles) {
      const words = (a.headline || '').toLowerCase().replace(/[^a-z\s]/g, '').split(/\s+/);
      for (const w of words) {
        if (w.length > 3 && !stopWords.has(w)) freq[w] = (freq[w] || 0) + 1;
      }
    }
    const trending = Object.entries(freq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([topic, count]) => ({ topic, count }));
    res.json({
      trending,
      articleCount: articles.length,
      tier: NEWS_TIERS.trending,
      fetchedAt: new Date().toISOString(),
    });
  } catch (err) {
    res.status(502).json({ error: err.message, trending: [] });
  }
});

// ── Broker research reports — DAILY tier ────────────────────────────────────
app.get('/api/news/broker-reports', async (req, res) => {
  const sector = (req.query.sector || '').trim();
  const query  = sector
    ? `${sector} broker research report buy sell rating analyst`
    : 'broker research report buy sell rating stock analyst';
  const cacheKey = `broker:${sector || 'all'}`;
  try {
    const articles = await fetchNewsTiered(query, null, cacheKey, NEWS_TIERS.broker_reports, 'broker_reports');
    res.json({
      count: articles.length,
      articles: stripInternalTags(articles),
      tier: NEWS_TIERS.broker_reports,
      fetchedAt: new Date().toISOString(),
    });
  } catch (err) {
    res.status(502).json({ error: err.message, articles: [] });
  }
});

// ── Block deals / bulk deals — DAILY tier ────────────────────────────────────
app.get('/api/news/block-deals', async (req, res) => {
  try {
    const articles = await fetchNewsTiered(
      'NSE BSE block deal bulk deal large trade institutional',
      null, 'block_deals', NEWS_TIERS.block_deals, 'block_deals'
    );
    res.json({
      count: articles.length,
      articles: stripInternalTags(articles),
      tier: NEWS_TIERS.block_deals,
      fetchedAt: new Date().toISOString(),
    });
  } catch (err) {
    res.status(502).json({ error: err.message, articles: [] });
  }
});

// ── India government policy news — DAILY tier ────────────────────────────────
app.get('/api/news/india-policy', async (req, res) => {
  try {
    const articles = await fetchNewsTiered(
      'India government policy RBI SEBI budget tax regulation economy',
      null, 'india_policy', NEWS_TIERS.india_policy, 'india_policy'
    );
    res.json({
      count: articles.length,
      articles: stripInternalTags(articles),
      tier: NEWS_TIERS.india_policy,
      fetchedAt: new Date().toISOString(),
    });
  } catch (err) {
    res.status(502).json({ error: err.message, articles: [] });
  }
});

// ── US government policy, tariffs, trade war — DAILY tier ───────────────────
app.get('/api/news/us-policy', async (req, res) => {
  try {
    const articles = await fetchNewsTiered(
      'US government policy tariff trade war Federal Reserve Fed rate inflation',
      null, 'us_policy', NEWS_TIERS.us_policy, 'us_policy'
    );
    res.json({
      count: articles.length,
      articles: stripInternalTags(articles),
      tier: NEWS_TIERS.us_policy,
      fetchedAt: new Date().toISOString(),
    });
  } catch (err) {
    res.status(502).json({ error: err.message, articles: [] });
  }
});

// ── Management commentary — QUARTERLY tier ───────────────────────────────────
// Valid for 90 days from the last result announcement date of the ticker.
app.get('/api/news/management-commentary/:symbol', async (req, res) => {
  const symbol = req.params.symbol.toUpperCase().trim();
  const cacheKey = `mgmt_commentary:${symbol}`;
  try {
    const articles = await fetchNewsTiered(
      `${symbol} earnings call management commentary quarterly results guidance`,
      symbol, cacheKey, NEWS_TIERS.management_commentary, 'management_commentary'
    );
    res.json({
      symbol,
      count: articles.length,
      articles: stripInternalTags(articles),
      tier: NEWS_TIERS.management_commentary,
      fetchedAt: new Date().toISOString(),
    });
  } catch (err) {
    res.status(502).json({ error: err.message, symbol, articles: [] });
  }
});

// ── Impact analysis ───────────────────────────────────────────────────────────
app.post('/api/news/impact', async (req, res) => {
  const { headline, body } = req.body;
  if (!headline) return res.status(400).json({ error: 'headline is required' });

  try {
    const articleText = body ? `${headline}\n\n${body}` : headline;
    const prompt = `You are a financial market impact analyst. Analyze the following real news article and provide structured market impact assessment.

NEWS ARTICLE:
${articleText}

Respond ONLY in valid JSON with this exact structure:
{
  "affectedTickers": [{"symbol": "...", "direction": "bullish|bearish|neutral", "reason": "..."}],
  "affectedSectors": [{"sector": "...", "direction": "bullish|bearish|neutral", "reason": "..."}],
  "affectedIndices": [{"index": "...", "direction": "bullish|bearish|neutral", "reason": "..."}],
  "commodityImpact": [{"commodity": "...", "direction": "bullish|bearish|neutral", "reason": "..."}],
  "currencyImpact": [{"currency": "...", "direction": "bullish|bearish|neutral", "reason": "..."}],
  "overallSignal": "bullish|bearish|neutral",
  "confidenceLevel": "high|medium|low",
  "reasoning": "2-3 sentence explanation",
  "timeframe": "immediate|short-term|medium-term|long-term"
}

Base your analysis strictly on the article content. Do not fabricate data.`;

    const raw = await callGemini(prompt);
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('LLM did not return valid JSON');
    const impact = JSON.parse(jsonMatch[0]);

    res.json({
      headline,
      impact,
      model: 'watsonx/gemini',
      analyzedAt: new Date().toISOString()
    });
  } catch (err) {
    res.status(502).json({ error: err.message, headline });
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
  console.log(`[NEWSROOM] Backend running on http://localhost:${PORT}`);
  console.log(`[NEWSROOM] LLM: IBM watsonx (primary) | ICA (tier-2) | Gemini (last resort)`);
  console.log(`[NEWSROOM] watsonx=${!!process.env.WATSONX_API_KEY} ica=${!!process.env.WXO_API_KEY}`);
  console.log(`[NEWSROOM] Cache: quarterly (90-day, management commentary) + daily (all market news) + 5-min intraday`);
});
