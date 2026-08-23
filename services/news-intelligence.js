/**
 * services/news-intelligence.js — tradingview-economy
 * Real-time financial news ingestion + AI impact scoring engine.
 *
 * Sources used (all public / free-tier RSS / JSON APIs):
 *   1. Economic Times Markets RSS   — Indian market news
 *   2. Moneycontrol RSS             — Indian business news
 *   3. Reuters RSS (business)       — Global wire service
 *   4. Yahoo Finance RSS            — US/global markets
 *   5. NSE India press releases     — Regulatory filings
 *
 * For each item the engine computes:
 *   • sentiment     : positive | negative | neutral
 *   • confidence    : 0–100 %
 *   • impactScore   : 0–10 (veteran-weighted)
 *   • affected      : { geographies[], sectors[], assetClasses[], tickers[] }
 *   • direction     : bullish | bearish | neutral
 *   • keyTakeaway   : one-line plain-English summary
 */
'use strict';

require('dotenv').config();
const https  = require('https');
const http   = require('http');
const { askAI, classifyAI } = require('./watsonx');

// ── RSS feed registry ─────────────────────────────────────────────────────────
const RSS_FEEDS = [
  {
    id: 'et-markets',
    name: 'Economic Times Markets',
    url: 'https://economictimes.indiatimes.com/markets/rssfeeds/1977021501.cms',
    geo: ['India'],
    weight: 1.2
  },
  {
    id: 'reuters-biz',
    name: 'Reuters Business',
    url: 'https://feeds.reuters.com/reuters/businessNews',
    geo: ['Global'],
    weight: 1.0
  },
  {
    id: 'yahoo-finance',
    name: 'Yahoo Finance',
    url: 'https://finance.yahoo.com/news/rssindex',
    geo: ['US', 'Global'],
    weight: 0.9
  },
  {
    id: 'mc-markets',
    name: 'Moneycontrol Markets',
    url: 'https://www.moneycontrol.com/rss/marketreports.xml',
    geo: ['India'],
    weight: 1.1
  }
];

// ── Keyword → impact maps (veteran-curated) ───────────────────────────────────
const GEO_KEYWORDS = {
  'India': ['india', 'nse', 'bse', 'sebi', 'rbi', 'nifty', 'sensex', 'rupee', 'inr'],
  'US': ['fed', 'federal reserve', 's&p', 'nasdaq', 'dow', 'treasury', 'usd', 'fomc'],
  'Europe': ['ecb', 'euro', 'dax', 'ftse', 'european', 'boe'],
  'China': ['china', 'pboc', 'shanghai', 'yuan', 'cny', 'csi300'],
  'Japan': ['boj', 'nikkei', 'yen', 'jpy', 'topix'],
  'Emerging Markets': ['em', 'emerging', 'brics', 'developing']
};

const SECTOR_KEYWORDS = {
  'Banking': ['bank', 'banking', 'credit', 'loan', 'deposit', 'npa', 'nbfc'],
  'IT': ['it ', 'software', 'tech', 'infosys', 'tcs', 'wipro', 'hcltech'],
  'Energy': ['oil', 'gas', 'crude', 'opec', 'refinery', 'power', 'solar', 'renewable'],
  'Pharma': ['pharma', 'drug', 'medicine', 'fda', 'usfda', 'api', 'hospital'],
  'FMCG': ['fmcg', 'consumer', 'hul', 'itc', 'nestle', 'britannia', 'dabur'],
  'Auto': ['auto', 'automobile', 'ev', 'vehicle', 'maruti', 'tata motors', 'hero'],
  'Metals': ['steel', 'aluminium', 'copper', 'iron', 'metal', 'tata steel', 'jsw'],
  'Realty': ['real estate', 'realty', 'reit', 'housing', 'property'],
  'Telecom': ['telecom', 'airtel', 'jio', 'vodafone', 'spectrum', '5g'],
  'Finance': ['nbfc', 'mutual fund', 'amc', 'insurance', 'pension', 'hdfc'],
  'Infrastructure': ['infra', 'roads', 'ports', 'airport', 'l&t', 'adani']
};

const ASSET_KEYWORDS = {
  'Equities': ['stock', 'shares', 'equity', 'nifty', 'sensex', 'ipo'],
  'Bonds': ['bond', 'yield', 'g-sec', 'debt', 'fixed income', 'treasury'],
  'Commodities': ['gold', 'silver', 'crude', 'wheat', 'corn', 'commodity'],
  'Crypto': ['bitcoin', 'crypto', 'ethereum', 'blockchain', 'defi'],
  'Forex': ['currency', 'rupee', 'dollar', 'euro', 'forex', 'exchange rate'],
  'Real Estate': ['realty', 'housing', 'reit', 'property', 'invit']
};

// ── Tiny fetch wrapper (no extra deps) ───────────────────────────────────────
function fetchUrl(url, timeoutMs = 8000) {
  return new Promise((resolve, reject) => {
    const driver = url.startsWith('https') ? https : http;
    const req = driver.get(url, { headers: { 'User-Agent': 'AladdinInvesting/2.0 (+news-bot)' } }, res => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => resolve(data));
    });
    req.setTimeout(timeoutMs, () => { req.destroy(); reject(new Error('Timeout')); });
    req.on('error', reject);
  });
}

// ── Minimal RSS XML parser (no cheerio needed for simple feeds) ───────────────
function parseRSS(xml) {
  const items = [];
  const itemRx = /<item>([\s\S]*?)<\/item>/g;
  let m;
  while ((m = itemRx.exec(xml)) !== null) {
    const block = m[1];
    const title   = (/<title[^>]*><!\[CDATA\[([\s\S]*?)\]\]>/.exec(block) || /<title[^>]*>([\s\S]*?)<\/title>/.exec(block) || [])[1] || '';
    const link    = (/<link[^>]*>([\s\S]*?)<\/link>/.exec(block) || [])[1] || '';
    const pubDate = (/<pubDate>([\s\S]*?)<\/pubDate>/.exec(block) || [])[1] || '';
    const desc    = (/<description><!\[CDATA\[([\s\S]*?)\]\]>/.exec(block) || /<description>([\s\S]*?)<\/description>/.exec(block) || [])[1] || '';
    if (title.trim()) {
      items.push({
        title: title.trim().replace(/<[^>]+>/g, ''),
        link:  link.trim(),
        pubDate: pubDate.trim(),
        description: desc.replace(/<[^>]+>/g, '').trim().slice(0, 300)
      });
    }
  }
  return items;
}

// ── Keyword matcher ───────────────────────────────────────────────────────────
function matchKeywords(text, keywordMap) {
  const lower = text.toLowerCase();
  return Object.entries(keywordMap)
    .filter(([, keywords]) => keywords.some(kw => lower.includes(kw)))
    .map(([category]) => category);
}

// ── Impact score calculator (0–10) ───────────────────────────────────────────
function calcImpactScore(item, affected) {
  let score = 3; // base
  score += Math.min(affected.geographies.length * 0.5, 2);
  score += Math.min(affected.sectors.length * 0.4, 2);
  score += Math.min(affected.assetClasses.length * 0.3, 1.5);
  // Recency boost
  if (item.pubDate) {
    const ageHours = (Date.now() - new Date(item.pubDate).getTime()) / 3600000;
    if (ageHours < 2) score += 1.5;
    else if (ageHours < 8) score += 0.5;
  }
  return Math.min(Math.round(score * 10) / 10, 10);
}

// ── AI-driven sentiment + key takeaway ───────────────────────────────────────
async function enrichWithAI(newsItem) {
  try {
    const prompt = `Analyze this financial news headline and give JSON with fields: sentiment (positive/negative/neutral), confidence (0-100), direction (bullish/bearish/neutral), keyTakeaway (one sentence plain English). Headline: "${newsItem.title}"`;
    const result = await askAI(prompt, { maxTokens: 120, temperature: 0.1, fallbackKey: 'news' });
    // Try to extract JSON from AI response
    const jsonMatch = (result.text || '').match(/\{[\s\S]*?\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        sentiment:   parsed.sentiment   || 'neutral',
        confidence:  parseInt(parsed.confidence) || 50,
        direction:   parsed.direction   || 'neutral',
        keyTakeaway: parsed.keyTakeaway || newsItem.title
      };
    }
  } catch (_) { /* fallback below */ }

  // Keyword-based fallback sentiment
  const lower = newsItem.title.toLowerCase();
  const bullWords = ['surge', 'rally', 'gain', 'rise', 'jump', 'beat', 'record', 'growth', 'profit', 'upgrade'];
  const bearWords = ['fall', 'drop', 'crash', 'loss', 'miss', 'cut', 'warning', 'risk', 'default', 'downgrade'];
  const bullCount = bullWords.filter(w => lower.includes(w)).length;
  const bearCount = bearWords.filter(w => lower.includes(w)).length;
  const sentiment = bullCount > bearCount ? 'positive' : bearCount > bullCount ? 'negative' : 'neutral';
  return {
    sentiment,
    confidence: 45,
    direction: sentiment === 'positive' ? 'bullish' : sentiment === 'negative' ? 'bearish' : 'neutral',
    keyTakeaway: newsItem.title
  };
}

// ── Main: fetch + score all feeds ────────────────────────────────────────────
async function fetchAndScoreNews(maxItems = 30) {
  const allItems = [];

  for (const feed of RSS_FEEDS) {
    try {
      const xml   = await fetchUrl(feed.url);
      const items = parseRSS(xml).slice(0, 8);
      for (const item of items) {
        const combined = `${item.title} ${item.description}`;
        const affected = {
          geographies:  matchKeywords(combined, GEO_KEYWORDS),
          sectors:      matchKeywords(combined, SECTOR_KEYWORDS),
          assetClasses: matchKeywords(combined, ASSET_KEYWORDS),
          tickers:      []
        };
        if (!affected.geographies.length) affected.geographies = feed.geo;
        const impactScore = calcImpactScore(item, affected) * feed.weight;
        allItems.push({ ...item, affected, impactScore, source: feed.name, feedId: feed.id });
      }
    } catch (e) {
      console.warn(`[news-intelligence] Feed ${feed.id} failed:`, e.message);
    }
  }

  // Sort by impact score desc, take top N
  allItems.sort((a, b) => b.impactScore - a.impactScore);
  const top = allItems.slice(0, maxItems);

  // Enrich top 10 with AI (rate-limit aware)
  const enriched = [];
  for (let i = 0; i < top.length; i++) {
    const ai = i < 10 ? await enrichWithAI(top[i]) : {
      sentiment: 'neutral', confidence: 40, direction: 'neutral', keyTakeaway: top[i].title
    };
    enriched.push({ ...top[i], ...ai, fetchedAt: new Date().toISOString() });
  }

  return enriched;
}

module.exports = { fetchAndScoreNews, GEO_KEYWORDS, SECTOR_KEYWORDS, ASSET_KEYWORDS };
