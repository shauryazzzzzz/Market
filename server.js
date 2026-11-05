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
  // Serve static assets (JS, CSS, images) directly — with cache
  app.use(express.static(REACT_BUILD, { index: false }));
  // SPA catch-all — ONLY for HTML navigation routes, never for assets
  // Excludes: /api/*, /assets/*, and any path with a file extension
  app.get(/^(?!\/(api|assets)\/)(?!.*\.\w{2,5}$).*$/, (req, res) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
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
        _yf_commodities.quote(c.symbol, {}, { validateResult: false })
          .then(q => ({ meta: c, q }))
          .catch(() => null)
      )
    );
    const commodities = results
      .filter(r => r.status === 'fulfilled' && r.value != null && r.value.q != null)
      .map(r => {
        const { meta, q } = r.value;
        return {
          symbol:         meta.symbol,
          name:           meta.name,
          unit:           meta.unit,
          currencySymbol: meta.currencySymbol,
          currency:       (q && q.currency) ? q.currency : 'USD',
          price:          q ? q.regularMarketPrice : null,
          changePct:      q ? q.regularMarketChangePercent : null,
          change:         q ? q.regularMarketChange : null,
          dayHigh:        q ? q.regularMarketDayHigh : null,
          dayLow:         q ? q.regularMarketDayLow : null,
          week52High:     q ? q.fiftyTwoWeekHigh : null,
          week52Low:      q ? q.fiftyTwoWeekLow : null,
          volume:         q ? q.regularMarketVolume : null,
          isLive:         true,
        };
      })
      .filter(c => c.price != null);
    res.json({ commodities, isLive: commodities.length > 0, count: commodities.length, source: 'yahoo' });
  } catch (e) {
    res.json({ commodities: [], isLive: false, error: e.message });
  }
});
let _yf_commodities = null;


// ── NSE + Sectoral indices ────────────────────────────────────────────────────
app.get('/api/quotes/indices', async (req, res) => {
  const INDICES = [
    { symbol: '^NSEI',       name: 'Nifty 50'        },
    { symbol: '^BSESN',      name: 'Sensex'          },
    { symbol: '^NSMIDCP100', name: 'Nifty Midcap 100'},
    { symbol: '^NSMIDCP',    name: 'Nifty Midcap 50' },
    { symbol: '^CNXAUTO',    name: 'Nifty Auto'      },
    { symbol: '^CNXPHARMA',  name: 'Nifty Pharma'    },
    { symbol: '^CNXFMCG',    name: 'Nifty FMCG'      },
    { symbol: '^CNXMETAL',   name: 'Nifty Metal'     },
    { symbol: '^CNXREALTY',  name: 'Nifty Realty'    },
    { symbol: '^CNXENERGY',  name: 'Nifty Energy'    },
    { symbol: '^CNXINFRA',   name: 'Nifty Infra'     },
    { symbol: '^CNXPSUBANK', name: 'Nifty PSU Bank'  },
    { symbol: '^NSPRVBNK',   name: 'Nifty Pvt Bank'  },
    { symbol: 'NIFTYIT.NS',  name: 'Nifty IT'        },
    { symbol: '^CNXBANK',    name: 'Nifty Bank'      },
  ];
  if (!_yf) return res.json({ indices: [], isLive: false });
  try {
    const results = await Promise.allSettled(
      INDICES.map(idx =>
        _yf.quote(idx.symbol, {}, { validateResult: false })
          .then(q => ({ meta: idx, q }))
          .catch(() => null)
      )
    );
    const indices = results
      .filter(r => r.status === 'fulfilled' && r.value && r.value.q && r.value.q.regularMarketPrice != null)
      .map(r => {
        const { meta, q } = r.value;
        return {
          symbol:    meta.symbol,
          name:      meta.name,
          price:     q.regularMarketPrice,
          change:    q.regularMarketChange,
          changePct: q.regularMarketChangePercent,
          dayHigh:   q.regularMarketDayHigh,
          dayLow:    q.regularMarketDayLow,
          prevClose: q.regularMarketPreviousClose,
          isLive:    true,
        };
      });
    res.json({ indices, isLive: indices.length > 0, count: indices.length });
  } catch (e) {
    res.json({ indices: [], isLive: false, error: e.message });
  }
});

// ── Global indices ────────────────────────────────────────────────────────────
app.get('/api/quotes/global', async (req, res) => {
  const GLOBALS = [
    { symbol: '^GSPC',     name: 'S&P 500'    },
    { symbol: '^IXIC',     name: 'Nasdaq'     },
    { symbol: '^DJI',      name: 'Dow Jones'  },
    { symbol: '^FTSE',     name: 'FTSE 100'   },
    { symbol: '^GDAXI',    name: 'DAX'        },
    { symbol: '^N225',     name: 'Nikkei 225' },
    { symbol: '^HSI',      name: 'Hang Seng'  },
    { symbol: '000001.SS', name: 'Shanghai'   },
  ];
  if (!_yf) return res.json({ indices: [], isLive: false });
  try {
    const results = await Promise.allSettled(
      GLOBALS.map(idx =>
        _yf.quote(idx.symbol, {}, { validateResult: false })
          .then(q => ({ meta: idx, q }))
          .catch(() => null)
      )
    );
    const indices = results
      .filter(r => r.status === 'fulfilled' && r.value && r.value.q && r.value.q.regularMarketPrice != null)
      .map(r => {
        const { meta, q } = r.value;
        return {
          symbol:    meta.symbol,
          name:      meta.name,
          price:     q.regularMarketPrice,
          change:    q.regularMarketChange,
          changePct: q.regularMarketChangePercent,
          currency:  q.currency,
          isLive:    true,
        };
      });
    res.json({ indices, isLive: indices.length > 0, count: indices.length });
  } catch (e) {
    res.json({ indices: [], isLive: false, error: e.message });
  }
});

// ── Forex / Currency ──────────────────────────────────────────────────────────
app.get('/api/quotes/forex', async (req, res) => {
  const FOREX = [
    { symbol: 'INR=X',    name: 'USD/INR' },
    { symbol: 'EURINR=X', name: 'EUR/INR' },
    { symbol: 'GBPINR=X', name: 'GBP/INR' },
    { symbol: 'JPYINR=X', name: 'JPY/INR' },
    { symbol: 'DX-Y.NYB', name: 'DXY'    },
  ];
  if (!_yf) return res.json({ forex: [], isLive: false });
  try {
    const results = await Promise.allSettled(
      FOREX.map(f =>
        _yf.quote(f.symbol, {}, { validateResult: false })
          .then(q => ({ meta: f, q }))
          .catch(() => null)
      )
    );
    const forex = results
      .filter(r => r.status === 'fulfilled' && r.value && r.value.q && r.value.q.regularMarketPrice != null)
      .map(r => {
        const { meta, q } = r.value;
        return {
          symbol:    meta.symbol,
          name:      meta.name,
          price:     q.regularMarketPrice,
          change:    q.regularMarketChange,
          changePct: q.regularMarketChangePercent,
          isLive:    true,
        };
      });
    res.json({ forex, isLive: forex.length > 0, count: forex.length });
  } catch (e) {
    res.json({ forex: [], isLive: false, error: e.message });
  }
});

// ── Derivatives snapshot — Nifty + BankNifty spot (futures symbols may 404) ──
app.get('/api/quotes/derivatives', async (req, res) => {
  const SPOTS = [
    { symbol: '^NSEI',    name: 'Nifty 50'   },
    { symbol: '^CNXBANK', name: 'Bank Nifty' },
  ];
  const FUTS = [
    { symbol: 'NIFTYFUT.NS',    name: 'Nifty Futures'     },
    { symbol: 'BANKNIFTYFUT.NS', name: 'BankNifty Futures' },
  ];
  if (!_yf) return res.json({ derivatives: [], isLive: false });
  try {
    const allSyms = [...SPOTS, ...FUTS];
    const results = await Promise.allSettled(
      allSyms.map(d =>
        _yf.quote(d.symbol, {}, { validateResult: false })
          .then(q => ({ sym: d.symbol, q }))
          .catch(() => null)
      )
    );
    const q = {};
    results.forEach(r => {
      if (r.status === 'fulfilled' && r.value) q[r.value.sym] = r.value.q;
    });
    const niftySpot = q['^NSEI']?.regularMarketPrice;
    const bnkSpot   = q['^CNXBANK']?.regularMarketPrice;
    const niftyFut  = q['NIFTYFUT.NS']?.regularMarketPrice;
    const bnkFut    = q['BANKNIFTYFUT.NS']?.regularMarketPrice;
    const derivatives = [
      {
        name:       'Nifty 50',
        spot:       niftySpot,
        futures:    niftyFut || null,
        premium:    niftyFut && niftySpot ? parseFloat((niftyFut - niftySpot).toFixed(2)) : null,
        premiumPct: niftyFut && niftySpot ? parseFloat(((niftyFut - niftySpot) / niftySpot * 100).toFixed(3)) : null,
        changePct:  q['^NSEI']?.regularMarketChangePercent,
        change:     q['^NSEI']?.regularMarketChange,
      },
      {
        name:       'Bank Nifty',
        spot:       bnkSpot,
        futures:    bnkFut || null,
        premium:    bnkFut && bnkSpot ? parseFloat((bnkFut - bnkSpot).toFixed(2)) : null,
        premiumPct: bnkFut && bnkSpot ? parseFloat(((bnkFut - bnkSpot) / bnkSpot * 100).toFixed(3)) : null,
        changePct:  q['^CNXBANK']?.regularMarketChangePercent,
        change:     q['^CNXBANK']?.regularMarketChange,
      },
    ];
    res.json({ derivatives, isLive: !!(niftySpot || bnkSpot) });
  } catch (e) {
    res.json({ derivatives: [], isLive: false, error: e.message });
  }
});


// ── Per-country equity markets (CN, JP, DE, BR, KR) via Yahoo Finance ─────────
app.get('/api/quotes/country', async (req, res) => {
  if (!_yf) return res.json({ stocks: [], isLive: false, error: 'yahoo-finance2 unavailable' });
  const COUNTRY_SYMBOLS = {
    CN: [
      { symbol: 'BABA', name: 'Alibaba', sector: 'Technology', cap: 'Large Cap' },
      { symbol: 'JD',   name: 'JD.com',  sector: 'Consumer',   cap: 'Large Cap' },
      { symbol: 'PDD',  name: 'Temu/Pinduoduo', sector: 'Consumer', cap: 'Large Cap' },
      { symbol: 'BIDU', name: 'Baidu',   sector: 'Technology', cap: 'Large Cap' },
      { symbol: 'NIO',  name: 'NIO',     sector: 'Auto',        cap: 'Mid Cap'   },
      { symbol: 'XPEV', name: 'XPeng',   sector: 'Auto',        cap: 'Mid Cap'   },
      { symbol: 'LI',   name: 'Li Auto', sector: 'Auto',        cap: 'Mid Cap'   },
      { symbol: 'BEKE', name: 'KE Holdings', sector: 'Real Estate', cap: 'Mid Cap' },
      { symbol: '0700.HK', name: 'Tencent', sector: 'Technology', cap: 'Large Cap' },
      { symbol: '2318.HK', name: 'Ping An', sector: 'Financial', cap: 'Large Cap' },
    ],
    JP: [
      { symbol: '7203.T', name: 'Toyota',      sector: 'Auto',       cap: 'Large Cap' },
      { symbol: '6758.T', name: 'Sony',         sector: 'Technology', cap: 'Large Cap' },
      { symbol: '9984.T', name: 'SoftBank',     sector: 'Technology', cap: 'Large Cap' },
      { symbol: '6861.T', name: 'Keyence',      sector: 'Technology', cap: 'Large Cap' },
      { symbol: '8306.T', name: 'MUFG Bank',    sector: 'Financial',  cap: 'Large Cap' },
      { symbol: '9432.T', name: 'NTT',          sector: 'Telecom',    cap: 'Large Cap' },
      { symbol: '4063.T', name: 'Shin-Etsu Chem', sector: 'Industrials', cap: 'Large Cap' },
      { symbol: '6367.T', name: 'Daikin',       sector: 'Industrials', cap: 'Large Cap' },
      { symbol: '7974.T', name: 'Nintendo',     sector: 'Technology', cap: 'Large Cap' },
      { symbol: '4568.T', name: 'Daiichi Sankyo', sector: 'Healthcare', cap: 'Large Cap' },
    ],
    DE: [
      { symbol: 'SAP',  name: 'SAP',           sector: 'Technology', cap: 'Large Cap' },
      { symbol: 'SIEGY',name: 'Siemens',        sector: 'Industrials', cap: 'Large Cap' },
      { symbol: 'BAYRY',name: 'Bayer',          sector: 'Healthcare', cap: 'Large Cap' },
      { symbol: 'BMWYY',name: 'BMW',            sector: 'Auto',       cap: 'Large Cap' },
      { symbol: 'VWAGY',name: 'Volkswagen',     sector: 'Auto',       cap: 'Large Cap' },
      { symbol: 'DBOEY',name: 'Deutsche Börse', sector: 'Financial',  cap: 'Large Cap' },
      { symbol: 'DTEGY',name: 'Deutsche Telekom', sector: 'Telecom',  cap: 'Large Cap' },
      { symbol: 'BASFY',name: 'BASF',           sector: 'Industrials', cap: 'Large Cap' },
      { symbol: 'ADDYY',name: 'Adidas',         sector: 'Consumer',   cap: 'Large Cap' },
      { symbol: 'ALIZY',name: 'Allianz',        sector: 'Financial',  cap: 'Large Cap' },
    ],
    BR: [
      { symbol: 'VALE', name: 'Vale',           sector: 'Metals',     cap: 'Large Cap' },
      { symbol: 'PBR',  name: 'Petrobras',      sector: 'Energy',     cap: 'Large Cap' },
      { symbol: 'ITUB', name: 'Itaú Unibanco',  sector: 'Financial',  cap: 'Large Cap' },
      { symbol: 'ABEV', name: 'Ambev',          sector: 'Consumer',   cap: 'Large Cap' },
      { symbol: 'BBD',  name: 'Bradesco',       sector: 'Financial',  cap: 'Large Cap' },
      { symbol: 'SID',  name: 'CSN Steel',      sector: 'Metals',     cap: 'Mid Cap'   },
      { symbol: 'CIG',  name: 'CEMIG',          sector: 'Energy',     cap: 'Mid Cap'   },
      { symbol: 'ELP',  name: 'Eletrobras',     sector: 'Energy',     cap: 'Mid Cap'   },
    ],
    KR: [
      { symbol: '005930.KS', name: 'Samsung Elec', sector: 'Technology', cap: 'Large Cap' },
      { symbol: '000660.KS', name: 'SK Hynix',     sector: 'Technology', cap: 'Large Cap' },
      { symbol: '035420.KS', name: 'NAVER',         sector: 'Technology', cap: 'Large Cap' },
      { symbol: '051910.KS', name: 'LG Chem',       sector: 'Industrials', cap: 'Large Cap' },
      { symbol: '207940.KS', name: 'Samsung Biologics', sector: 'Healthcare', cap: 'Large Cap' },
      { symbol: '005380.KS', name: 'Hyundai Motor', sector: 'Auto',      cap: 'Large Cap' },
      { symbol: '006400.KS', name: 'Samsung SDI',   sector: 'Industrials', cap: 'Large Cap' },
      { symbol: '028260.KS', name: 'Samsung C&T',   sector: 'Financial',  cap: 'Large Cap' },
    ],
  };

  const code = (req.query.code || '').toUpperCase();
  const list = COUNTRY_SYMBOLS[code];
  if (!list) return res.json({ stocks: [], isLive: false, error: `Unknown country code: ${code}` });

  try {
    const results = await Promise.allSettled(
      list.map(s =>
        _yf.quote(s.symbol, {}, { validateResult: false })
          .then(q => ({ meta: s, q }))
          .catch(() => null)
      )
    );
    const stocks = results
      .filter(r => r.status === 'fulfilled' && r.value && r.value.q && r.value.q.regularMarketPrice != null)
      .map(r => {
        const { meta, q } = r.value;
        return {
          symbol:   meta.symbol,
          name:     meta.name,
          sector:   meta.sector,
          cap:      meta.cap,
          price:    q.regularMarketPrice,
          change:   q.regularMarketChangePercent,
          mktcap:   q.marketCap ? q.marketCap / 1e7 : null,  // in Cr-equivalent
          pe:       q.trailingPE,
          pb:       q.priceToBook,
          div:      q.trailingAnnualDividendYield ? q.trailingAnnualDividendYield * 100 : null,
          currency: q.currency,
          week52High: q.fiftyTwoWeekHigh,
          week52Low:  q.fiftyTwoWeekLow,
        };
      });
    res.json({ stocks, isLive: stocks.length > 0 });
  } catch (e) {
    res.json({ stocks: [], isLive: false, error: e.message });
  }
});

// ── Asset class instruments — Gold ETFs, Bonds, Govt Bonds, Real Estate ────────
app.get('/api/quotes/asset-class', async (req, res) => {
  if (!_yf) return res.json({ instruments: [], isLive: false, error: 'yahoo-finance2 unavailable' });

  const ASSET_CLASS_SYMBOLS = {
    Gold: [
      { symbol: 'GC=F',     name: 'Gold Futures',         subtype: 'Futures',  region: 'Global', currency: '$', unit: 'oz' },
      { symbol: 'GLD',      name: 'SPDR Gold ETF',         subtype: 'ETF',      region: 'US',     currency: '$' },
      { symbol: 'IAU',      name: 'iShares Gold ETF',      subtype: 'ETF',      region: 'US',     currency: '$' },
      { symbol: 'GOLDBEES.NS', name: 'Nippon India Gold ETF', subtype: 'ETF',  region: 'India',  currency: '₹' },
      { symbol: 'MCXGOLD.MCX', name: 'MCX Gold',          subtype: 'MCX',      region: 'India',  currency: '₹' },
    ],
    Bonds: [
      { symbol: 'AGG',      name: 'iShares US Agg Bond',   subtype: 'ETF',  region: 'US',    currency: '$' },
      { symbol: 'BND',      name: 'Vanguard Total Bond',    subtype: 'ETF',  region: 'US',    currency: '$' },
      { symbol: 'LQD',      name: 'iShares IG Corporate',   subtype: 'ETF',  region: 'US',    currency: '$' },
      { symbol: 'HYG',      name: 'iShares High Yield Corp',subtype: 'ETF',  region: 'US',    currency: '$' },
      { symbol: 'CGLDBND.NS', name: 'India Corp Bond ETF',  subtype: 'ETF',  region: 'India', currency: '₹' },
    ],
    'Govt Bonds': [
      { symbol: 'TLT',      name: 'iShares 20+Y T-Bond',   subtype: 'ETF',  region: 'US',    currency: '$' },
      { symbol: 'IEF',      name: 'iShares 7-10Y T-Bond',  subtype: 'ETF',  region: 'US',    currency: '$' },
      { symbol: 'SHY',      name: 'iShares 1-3Y T-Bond',   subtype: 'ETF',  region: 'US',    currency: '$' },
      { symbol: '^TNX',     name: 'US 10Y Yield',           subtype: 'Yield',region: 'US',    currency: '%' },
      { symbol: '^TYX',     name: 'US 30Y Yield',           subtype: 'Yield',region: 'US',    currency: '%' },
      { symbol: 'ICICINIFTY.NS', name: 'ICICI Nifty G-Sec ETF', subtype: 'ETF', region: 'India', currency: '₹' },
    ],
    'Real Estate': [
      { symbol: 'VNQ',      name: 'Vanguard REIT ETF',      subtype: 'ETF',  region: 'US',    currency: '$' },
      { symbol: 'IYR',      name: 'iShares US Real Estate', subtype: 'ETF',  region: 'US',    currency: '$' },
      { symbol: 'SCHH',     name: 'Schwab US REIT ETF',     subtype: 'ETF',  region: 'US',    currency: '$' },
      { symbol: 'NIFTYREIT.NS', name: 'Nifty Realty Index', subtype: 'Index', region: 'India', currency: '₹' },
    ],
    ETF: [
      { symbol: 'SPY',      name: 'SPDR S&P 500 ETF',       subtype: 'US Equity', region: 'US', currency: '$' },
      { symbol: 'QQQ',      name: 'Invesco Nasdaq-100',      subtype: 'US Equity', region: 'US', currency: '$' },
      { symbol: 'EEM',      name: 'iShares MSCI EM',         subtype: 'EM Equity', region: 'EM', currency: '$' },
      { symbol: 'VEA',      name: 'Vanguard Dev Mkt',        subtype: 'Int\'l Eq', region: 'Global', currency: '$' },
      { symbol: 'INDA',     name: 'iShares MSCI India',      subtype: 'India Eq', region: 'India', currency: '$' },
      { symbol: 'NIFTYBEES.NS', name: 'Nippon Nifty BeES',  subtype: 'India Eq', region: 'India', currency: '₹' },
    ],
    MF: [
      // Use large Indian MF AMC stocks as proxies (actual MF NAVs unavailable via Yahoo)
      { symbol: 'HDFCAMC.NS', name: 'HDFC AMC',            subtype: 'AMC Stock', region: 'India', currency: '₹' },
      { symbol: 'NIPPINDIA.NS', name: 'Nippon India AMC',  subtype: 'AMC Stock', region: 'India', currency: '₹' },
      { symbol: 'UTIAMC.NS',  name: 'UTI AMC',             subtype: 'AMC Stock', region: 'India', currency: '₹' },
      { symbol: 'ABCAPITAL.NS', name: 'Aditya Birla Cap',  subtype: 'AMC Stock', region: 'India', currency: '₹' },
    ],
  };

  const assetClass = req.query.class || 'Gold';
  const list = ASSET_CLASS_SYMBOLS[assetClass];
  if (!list) return res.json({ instruments: [], isLive: false, error: `Unknown asset class: ${assetClass}` });

  try {
    const results = await Promise.allSettled(
      list.map(s =>
        _yf.quote(s.symbol, {}, { validateResult: false })
          .then(q => ({ meta: s, q }))
          .catch(() => null)
      )
    );
    const instruments = results
      .filter(r => r.status === 'fulfilled' && r.value && r.value.q && r.value.q.regularMarketPrice != null)
      .map(r => {
        const { meta, q } = r.value;
        return {
          symbol:   meta.symbol,
          name:     meta.name,
          subtype:  meta.subtype,
          region:   meta.region,
          currency: meta.currency,
          unit:     meta.unit || null,
          price:    q.regularMarketPrice,
          change:   q.regularMarketChangePercent,
          dayHigh:  q.regularMarketDayHigh,
          dayLow:   q.regularMarketDayLow,
          week52High: q.fiftyTwoWeekHigh,
          week52Low:  q.fiftyTwoWeekLow,
          mktcap:   q.marketCap ? q.marketCap / 1e7 : null,
          pe:       q.trailingPE,
          volume:   q.regularMarketVolume,
        };
      });
    res.json({ instruments, isLive: instruments.length > 0 });
  } catch (e) {
    res.json({ instruments: [], isLive: false, error: e.message });
  }
});

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
    // Try to fetch real FII/DII data from NSE directly
    const https = require('https');
    const realData = await new Promise((resolve) => {
      // NSE publishes FII/DII activity at this endpoint (requires session cookie)
      const req2 = https.get(
        'https://www.nseindia.com/api/fiidiiTradeReact',
        {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'application/json',
            'Referer': 'https://www.nseindia.com/',
          },
          timeout: 8000,
        },
        (r) => {
          let d = '';
          r.on('data', c => d += c);
          r.on('end', () => {
            try { resolve(JSON.parse(d)); }
            catch { resolve(null); }
          });
        }
      );
      req2.on('error', () => resolve(null));
      req2.on('timeout', () => { req2.destroy(); resolve(null); });
    });

    // Fetch Nifty data in parallel for display context
    const [nsei, bank] = await Promise.allSettled([
      _yf.quote('^NSEI',    {}, { validateResult: false }),
      _yf.quote('^CNXBANK', {}, { validateResult: false }),
    ]);
    const nifty = nsei.status === 'fulfilled' ? nsei.value : null;
    const bnk   = bank.status === 'fulfilled' ? bank.value : null;
    const chg   = nifty?.regularMarketChangePercent || 0;

    // If we got real NSE data, use it
    if (Array.isArray(realData) && realData.length > 0) {
      const rows = realData.map(r => ({
        date:      r.date || new Date().toISOString().split('T')[0],
        category:  r.category,
        buyValue:  parseFloat(r.buyValue)  || 0,
        sellValue: parseFloat(r.sellValue) || 0,
        netValue:  parseFloat(r.netValue)  || 0,
        nifty:     nifty?.regularMarketPrice,
        niftyChg:  chg,
        bankNifty: bnk?.regularMarketPrice,
        isProxy:   false,
      }));
      return res.json({ success: true, data: rows });
    }

    // Fallback: Nifty-movement proxy (clearly flagged)
    const fiiNet = parseFloat((chg * 500).toFixed(0));
    res.json({
      success: true,
      data: [{
        date:      new Date().toISOString().split('T')[0],
        buyValue:  Math.max(fiiNet, 0),
        sellValue: Math.max(-fiiNet, 0),
        netValue:  fiiNet,
        category:  'FII',
        nifty:     nifty?.regularMarketPrice,
        niftyChg:  chg,
        bankNifty: bnk?.regularMarketPrice,
        isProxy:   true,   // flag consumed by frontend to show/hide the note
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
    '1w': { period1: new Date(Date.now() - 7  * 86400000), interval: '1d' },
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

    // Helper: parse string numbers like "12,345" or "275.86L" (lakh crore) → number in ₹ Cr
    const pn = (v) => {
      if (v == null || v === '') return null;
      const s = v.toString().trim();
      // "275.86L" → 275.86 × 100,000 = 27,586,000 Cr
      const lakhMatch = s.match(/^([\d,.]+)L$/i);
      if (lakhMatch) {
        const n = parseFloat(lakhMatch[1].replace(/,/g, ''));
        return isNaN(n) ? null : Math.round(n * 100000);
      }
      const n = parseFloat(s.replace(/[,₹%\s]/g, ''));
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
// SECTION 9 — NSE Raw Data Explorer  (/api/nse-data)
//
//  GET /api/nse-data/sheets              → sheet index (41 sheets, hasAiHeader, mergeGroup)
//  GET /api/nse-data/sheet?name=X        → single sheet, AI headers, metadata rows suppressed
//  GET /api/nse-data/merged              → all merge groups: NSE_SYMBOL, ISIN, STANDALONE
//  GET /api/nse-data/infer-headers?name=X → on-demand AI header inference
//
// Pipeline per sheet:
//   1. Parse raw rows from XLSX
//   2. Suppress metadata rows (disclaimers, titles, date descriptions)
//   3. Detect/inject AI-inferred headers for headerless sheets (IBM Mistral → Gemini)
//   4. Detect primary key column (SYMBOL / ISIN / none)
//   5. Merge all sheets sharing the same primary key into unified wide tables
// ─────────────────────────────────────────────────────────────────────────────
(function () {
  const https_   = require('https');
  let _xlsxLib    = null;
  const NSE_EXCEL = path.join(__dirname, 'data', 'Combined_Raw_Data.xlsx');

  function getXlsx() {
    if (!_xlsxLib) _xlsxLib = require('xlsx');
    return _xlsxLib;
  }

  // ── Workbook cache ─────────────────────────────────────────────────────────
  let _wb = null;
  function loadWorkbook() {
    if (_wb) return _wb;
    const XLSX = getXlsx();
    _wb = XLSX.readFile(NSE_EXCEL, { cellDates: true, raw: false });
    return _wb;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 1 — METADATA ROW SUPPRESSION
  // Programmatically detect and strip non-data rows from the top of each sheet.
  // A row is metadata if:
  //  (a) it spans fewer columns than the sheet width AND the first cell is a
  //      long sentence (>40 chars) with no numeric tokens — disclaimer/title
  //  (b) it matches a known NSE metadata pattern (date description, section label)
  //  (c) the entire row is blank / whitespace
  // ═══════════════════════════════════════════════════════════════════════════

  // Known leading-metadata sheets and how many rows to skip before the real header
  // value = number of raw rows to drop from the top BEFORE finding the header row
  const METADATA_SKIP = {
    'CM_52_wk_High_low_25082026': 2,  // row0=disclaimer, row1=date — row2 is real header
    'CM_Latency_stats24082026':   1,  // row0=date description — row1 is real header
    'AUB_2026159_25082026':       2,  // row0=title sentence, row1=blank — row2 is real header
    'PR_an25082026':              0,  // all rows are announcement text — standalone, no merge
    'PR_bm25082026':              0,  // all rows are board meeting text — standalone, no merge
    'PR_readme':                  0,  // entire sheet is narrative — standalone
  };

  /**
   * Detect if a row is a metadata/non-data row using heuristics.
   * Returns true if the row should be suppressed.
   */
  function isMetadataRow(row, colCount) {
    if (!row || row.length === 0) return true;
    const nonEmpty = row.filter(c => c != null && String(c).trim() !== '');
    if (nonEmpty.length === 0) return true;

    // If only 1 non-empty cell and it's a long sentence (>40 chars, no commas separating short tokens)
    if (nonEmpty.length === 1) {
      const val = String(nonEmpty[0]).trim();
      if (val.length > 40 && !/^\d/.test(val)) return true;    // long non-numeric sentence
      if (/disclaimer|effective for|capital market information|national stock exchange/i.test(val)) return true;
    }

    // Nifty-index section header rows in PR_gl (e.g. " ,Nifty 50 Sec., , , ")
    const firstNonEmpty = String(nonEmpty[0]).trim();
    if (/^nifty\s/i.test(firstNonEmpty) || firstNonEmpty === '') {
      const hasNumeric = row.some(c => /^\d/.test(String(c || '').trim()));
      if (!hasNumeric) return true;
    }

    return false;
  }

  /**
   * For sheets with known leading metadata, strip those rows before header detection.
   * For all others, apply isMetadataRow dynamically on data rows after the header.
   */
  function suppressMetadataRows(raw, sheetName) {
    let suppressed = 0;
    let rows = raw.filter(r => r.some(c => c != null && String(c).trim() !== ''));

    // Known fixed skips
    if (METADATA_SKIP[sheetName] != null && METADATA_SKIP[sheetName] > 0) {
      const skip = METADATA_SKIP[sheetName];
      const dropped = rows.slice(0, skip);
      rows = rows.slice(skip);
      suppressed += dropped.length;
      console.log(`[NSE-META] "${sheetName}": skipped ${suppressed} known metadata row(s): ${JSON.stringify(dropped[0]?.slice(0, 60))}`);
    }

    // Dynamic detection: check first row for metadata pattern (before it becomes header)
    // Only for sheets NOT in METADATA_SKIP
    if (METADATA_SKIP[sheetName] === undefined && rows.length > 1) {
      let dynamicSuppressed = 0;
      while (rows.length > 1 && isMetadataRow(rows[0], rows[0].length)) {
        console.log(`[NSE-META] "${sheetName}": dynamic-suppressed row: ${JSON.stringify(rows[0].slice(0, 4))}`);
        rows.shift();
        dynamicSuppressed++;
      }
      suppressed += dynamicSuppressed;
    }

    return { rows, suppressed };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 2 — AI HEADER INFERENCE  (IBM watsonx Mistral → Gemini → Col_N)
  // ═══════════════════════════════════════════════════════════════════════════

  const HEADERLESS = {
    'APPSEC_COLLVAL_25082026': {
      cols: 5,
      desc: 'NSE Applicable Securities Collateral Value — serial_no, symbol, ISIN, price, haircut_percentage',
      sampleFn: (raw) => raw.slice(0, 3).map(r => r.join(',')).join('\n'),
    },
    'CSQR_M2026159_25082026': {
      cols: 5,
      desc: 'NSE Closing Squared-off Report — symbol, series, market_type, auction_session_no, settlement_price',
      sampleFn: (raw) => raw.slice(0, 3).map(r => r.join(',')).join('\n'),
    },
    'circuit_25082026': {
      cols: 6,
      desc: 'NSE circuit breaker stats — trade_date, next_trade_date, total_turnover_crores, total_trades, total_quantity, total_securities',
      sampleFn: (raw) => raw.slice(0, 2).map(r => r.join(',')).join('\n'),
    },
  };
  // NOTE: AUB, CM_Latency, PR_bm now handled by METADATA_SKIP (their real header is row after skip)

  const _headerCache = {};

  let _iamToken = null, _iamExpiry = 0;
  async function getIAMToken() {
    if (_iamToken && Date.now() < _iamExpiry) return _iamToken;
    const key = process.env.WATSONX_API_KEY || '';
    if (!key) throw new Error('WATSONX_API_KEY not set');
    const body = Buffer.from(`grant_type=urn:ibm:params:oauth:grant-type:apikey&apikey=${encodeURIComponent(key)}`);
    return new Promise((resolve, reject) => {
      const req = https_.request({ hostname: 'iam.cloud.ibm.com', path: '/identity/token', method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': body.length }},
        (res) => { let d = ''; res.on('data', c => d += c); res.on('end', () => {
          try {
            const p = JSON.parse(d);
            if (!p.access_token) return reject(new Error('IAM: ' + d.slice(0, 80)));
            _iamToken = p.access_token;
            _iamExpiry = Date.now() + (p.expires_in - 120) * 1000;
            resolve(_iamToken);
          } catch(e) { reject(e); }
        }); });
      req.on('error', reject);
      req.setTimeout(15000, () => req.destroy(new Error('IAM timeout')));
      req.write(body); req.end();
    });
  }

  async function askWatsonx(prompt) {
    const token  = await getIAMToken();
    const proj   = process.env.WATSONX_PROJECT_ID || '83844219-1cce-4a4f-8631-52b707446c4c';
    const region = process.env.WATSONX_REGION || 'us-south';
    const body   = JSON.stringify({
      model_id: 'mistralai/mistral-small-3-1-24b-instruct-2503',
      input: `<s>[INST]${prompt}[/INST]`,
      parameters: { max_new_tokens: 200, temperature: 0 },
      project_id: proj,
    });
    return new Promise((resolve, reject) => {
      const req = https_.request({ hostname: `${region}.ml.cloud.ibm.com`,
        path: '/ml/v1/text/generation?version=2023-05-29', method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}`, 'Content-Length': Buffer.byteLength(body) }},
        (res) => { let d = ''; res.on('data', c => d += c); res.on('end', () => {
          const j = JSON.parse(d);
          if (j.errors) return reject(new Error('watsonx: ' + j.errors[0].message));
          const text = j.results?.[0]?.generated_text?.trim() || '';
          if (!text) return reject(new Error('watsonx: empty response'));
          resolve({ text, provider: 'watsonx', model: 'mistral-small-3-1-24b' });
        }); });
      req.on('error', reject);
      req.setTimeout(30000, () => req.destroy(new Error('watsonx timeout')));
      req.write(body); req.end();
    });
  }

  async function askGemini(prompt) {
    const key  = process.env.GEMINI_API_KEY || '';
    if (!key) throw new Error('GEMINI_API_KEY not set');
    const body = JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { maxOutputTokens: 300, temperature: 0 },
    });
    return new Promise((resolve, reject) => {
      const req = https_.request({ hostname: 'generativelanguage.googleapis.com',
        path: `/v1/models/gemini-2.5-flash:generateContent?key=${key}`, method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }},
        (res) => { let d = ''; res.on('data', c => d += c); res.on('end', () => {
          const j = JSON.parse(d);
          if (j.error) return reject(new Error('Gemini: ' + j.error.message));
          const text = j.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
          if (!text) return reject(new Error('Gemini: empty response'));
          resolve({ text, provider: 'gemini', model: 'gemini-2.5-flash' });
        }); });
      req.on('error', reject);
      req.setTimeout(30000, () => req.destroy(new Error('Gemini timeout')));
      req.write(body); req.end();
    });
  }

  async function inferHeaders(sheetName, dataRaw) {
    if (_headerCache[sheetName]) return _headerCache[sheetName];
    const meta   = HEADERLESS[sheetName];
    const sample = meta.sampleFn ? meta.sampleFn(dataRaw) : dataRaw.slice(0, 3).map(r => r.join(',')).join('\n');
    const prompt =
      `You are an expert in NSE India market data file formats.\n` +
      `File: "${sheetName}"\nContext: ${meta.desc}\n` +
      `Sample rows (NO header row exists):\n${sample}\n\n` +
      `Return ONLY a valid JSON array of exactly ${meta.cols} short snake_case column names.\n` +
      `No explanation, no markdown. Example: ["col1","col2","col3"]`;
    let result;
    try {
      result = await askWatsonx(prompt);
      console.log(`[NSE-AI] ✅ watsonx/${result.model} → "${sheetName}"`);
    } catch (e) {
      console.warn(`[NSE-AI] watsonx failed: ${e.message} → Gemini`);
      try {
        result = await askGemini(prompt);
        console.log(`[NSE-AI] ✅ gemini/${result.model} → "${sheetName}"`);
      } catch (e2) {
        console.warn(`[NSE-AI] Gemini failed: ${e2.message} — Col_N fallback`);
        result = { text: JSON.stringify(Array.from({ length: meta.cols }, (_, i) => `Col_${i + 1}`)), provider: 'fallback', model: 'fallback' };
      }
    }
    const match = result.text.match(/\[[\s\S]*?\]/);
    let headers = null;
    if (match) { try { headers = JSON.parse(match[0]); } catch {} }
    if (!Array.isArray(headers) || headers.length === 0) headers = Array.from({ length: meta.cols }, (_, i) => `Col_${i + 1}`);
    while (headers.length < meta.cols) headers.push(`Col_${headers.length + 1}`);
    headers = headers.slice(0, meta.cols);
    _headerCache[sheetName] = { headers, provider: result.provider, model: result.model || '' };
    return _headerCache[sheetName];
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 3 — PRIMARY KEY DETECTION
  // Identifies which column in a sheet is the joinable entity key.
  // Priority: SYMBOL exact match → common NSE symbol patterns → ISIN → none
  // ═══════════════════════════════════════════════════════════════════════════

  // Canonical column-name → key type mappings (case-insensitive)
  const SYMBOL_COL_NAMES = new Set([
    'symbol', 'nse code', 'nsecode', 'nse_code', 'tckrsymb', 'ticker',
    'symbol name', 'scrip', 'security symbol', 'symbol_name',
  ]);
  const ISIN_COL_NAMES = new Set(['isin', 'isin_code', 'isin code']);

  function detectPrimaryKey(columns) {
    const lower = columns.map(c => c.toLowerCase().trim());
    // Check for NSE symbol column
    for (let i = 0; i < lower.length; i++) {
      if (SYMBOL_COL_NAMES.has(lower[i])) return { keyType: 'NSE_SYMBOL', keyCol: columns[i], keyIdx: i };
    }
    // Check for ISIN column
    for (let i = 0; i < lower.length; i++) {
      if (ISIN_COL_NAMES.has(lower[i])) return { keyType: 'ISIN', keyCol: columns[i], keyIdx: i };
    }
    return { keyType: null, keyCol: null, keyIdx: -1 };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 4 — FULL SHEET PARSE PIPELINE
  // Runs: suppress metadata → detect/inject headers → build rows object
  // Returns: { columns, rows, aiHeaders, aiProvider, aiModel, primaryKey, suppressed }
  // ═══════════════════════════════════════════════════════════════════════════

  async function parseSheet(ws, sheetName) {
    const XLSX = getXlsx();
    const rawAll = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', raw: false, blankrows: true });
    if (!rawAll || rawAll.length === 0) {
      return { columns: [], rows: [], aiHeaders: false, aiProvider: null, aiModel: null, primaryKey: null, suppressed: 0 };
    }

    // Step 1: suppress metadata
    const { rows: cleanRaw, suppressed } = suppressMetadataRows(rawAll, sheetName);
    if (cleanRaw.length === 0) {
      return { columns: [], rows: [], aiHeaders: false, aiProvider: null, aiModel: null, primaryKey: null, suppressed };
    }

    let columns, dataRows, aiHeaders = false, aiProvider = null, aiModel = null;

    if (HEADERLESS[sheetName]) {
      // Step 2a: AI header inference — no header row exists
      const inferred = await inferHeaders(sheetName, cleanRaw);
      columns    = inferred.headers;
      dataRows   = cleanRaw;
      aiHeaders  = true;
      aiProvider = inferred.provider;
      aiModel    = inferred.model;
    } else {
      // Step 2b: Normal sheets — first row is already the header after metadata suppression
      const headerRow = cleanRaw[0];
      const rawCols = headerRow.map((h, i) => (h == null || String(h).trim() === '') ? `Col_${i + 1}` : String(h).trim());
      // Deduplicate column names: if two columns share the same name (case-insensitive), suffix _2, _3 etc.
      const seenColLower = {};
      columns = rawCols.map(col => {
        const key = col.toLowerCase();
        if (!seenColLower[key]) { seenColLower[key] = 1; return col; }
        seenColLower[key]++;
        return `${col}_${seenColLower[key]}`;
      });
      dataRows = cleanRaw.slice(1).filter(r => r.some(c => c !== '' && c != null));

      // Per-sheet data-row suppression: strip leading non-data rows after the header
      // e.g. PR_gl has "Nifty 50 Sec." section divider rows, PR_pd/PR_pr have index rows
      if (['PR_gl25082026', 'PR_pd25082026', 'PR_pr25082026'].includes(sheetName)) {
        const before = dataRows.length;
        dataRows = dataRows.filter(r => {
          const first = String(r[0] || '').trim();
          // Keep rows where at least one cell is a plausible equity symbol (uppercase 1-20 chars, no spaces)
          // OR a numeric value — filters out section labels like "Nifty 50 Sec."
          return r.some(c => /^[A-Z0-9&]{1,20}$/.test(String(c || '').trim()) && String(c).trim().length >= 2)
              || r.some(c => /^\d/.test(String(c || '').trim()));
        });
        const after = dataRows.length;
        if (before !== after) console.log(`[NSE-META] "${sheetName}": suppressed ${before - after} section-label rows`);
      }
    }

    const rows = dataRows.map(r => {
      const obj = {};
      columns.forEach((col, i) => { obj[col] = r[i] == null ? '' : String(r[i]).trim(); });
      return obj;
    });

    // Step 3: detect primary key
    const primaryKey = detectPrimaryKey(columns);

    return { columns, rows, aiHeaders, aiProvider, aiModel, primaryKey, suppressed };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 5 — MERGE PIPELINE
  // Groups parsed sheets by primary key type and left-joins them into wide tables.
  // Each merged table has: { keyType, keyCol, sourceSheets[], columns[], rows[], stats }
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Merge an array of { sheetName, columns, rows, primaryKey } objects
   * into one wide table using a left-join on the shared key column.
   * Columns from later sheets are prefixed with sheetName to avoid clashes.
   */
  function mergeSheetGroup(sheetDataList, keyType) {
    if (sheetDataList.length === 0) return null;

    // Normalise key values: uppercase, trimmed
    const normaliseKey = (v) => String(v || '').trim().toUpperCase();

    // Build a map from keyValue → merged row, starting with the first sheet
    const [first, ...rest] = sheetDataList;
    const keyCol = first.primaryKey.keyCol;

    // Map: normalised key → merged row object
    const merged = new Map();
    for (const row of first.rows) {
      const k = normaliseKey(row[keyCol]);
      if (!k) continue;
      merged.set(k, { ...row, _sources: [first.sheetName] });
    }

    // Track all columns in order
    const allColumns = [...first.columns];
    const usedCols   = new Set(first.columns.map(c => c.toLowerCase()));

    for (const sheet of rest) {
      const sKeyCol = sheet.primaryKey.keyCol;
      // Prefix sheet columns that clash with already-seen column names
      const colMap = {}; // original col → final col name in merged table
      for (const col of sheet.columns) {
        if (col.toLowerCase() === sKeyCol.toLowerCase()) {
          colMap[col] = col; // key column never prefixed
        } else {
          const safe = usedCols.has(col.toLowerCase())
            ? `${sheet.sheetName}__${col}` : col;
          colMap[col] = safe;
          if (!usedCols.has(safe.toLowerCase())) {
            allColumns.push(safe);
            usedCols.add(safe.toLowerCase());
          }
        }
      }

      // Left-join: augment existing rows; add new rows for keys not yet seen
      for (const row of sheet.rows) {
        const k = normaliseKey(row[sKeyCol]);
        if (!k) continue;
        if (merged.has(k)) {
          const existing = merged.get(k);
          for (const [orig, mapped] of Object.entries(colMap)) {
            if (mapped !== sKeyCol && orig !== sKeyCol) {
              if (existing[mapped] == null || existing[mapped] === '') {
                existing[mapped] = row[orig] || '';
              }
            }
          }
          existing._sources.push(sheet.sheetName);
        } else {
          // Key not in first sheet — add as new row with this sheet's data
          const newRow = { _sources: [sheet.sheetName] };
          for (const [orig, mapped] of Object.entries(colMap)) {
            newRow[mapped] = row[orig] || '';
          }
          merged.set(k, newRow);
        }
      }
    }

    const rows = [...merged.values()].map(r => {
      const { _sources, ...rest2 } = r;
      return rest2;
    });

    return {
      keyType,
      keyCol,
      sourceSheets: sheetDataList.map(s => s.sheetName),
      columns: allColumns,
      rows,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // MERGED RESULT CACHE
  // ═══════════════════════════════════════════════════════════════════════════
  let _mergedCache = null;

  async function buildMergedTables() {
    if (_mergedCache) return _mergedCache;

    const wb = loadWorkbook();
    const parsed = {}; // sheetName → parseSheet result
    let totalSuppressed = 0;

    // Parse all sheets sequentially (AI inference is async)
    for (const name of wb.SheetNames) {
      const ws = wb.Sheets[name];
      try {
        const result = await parseSheet(ws, name);
        parsed[name] = { sheetName: name, ...result };
        totalSuppressed += result.suppressed || 0;
      } catch (e) {
        console.warn(`[NSE-MERGE] Failed to parse "${name}": ${e.message}`);
        parsed[name] = { sheetName: name, columns: [], rows: [], primaryKey: { keyType: null }, suppressed: 0 };
      }
    }

    // Group by keyType
    const byKey = { NSE_SYMBOL: [], ISIN: [], STANDALONE: [] };
    for (const [name, d] of Object.entries(parsed)) {
      const kt = d.primaryKey?.keyType;
      if (kt === 'NSE_SYMBOL') byKey.NSE_SYMBOL.push(d);
      else if (kt === 'ISIN')  byKey.ISIN.push(d);
      else                     byKey.STANDALONE.push(d);
    }

    // Merge each group
    const nseSymbolMerged = mergeSheetGroup(byKey.NSE_SYMBOL, 'NSE_SYMBOL');
    const isinMerged      = mergeSheetGroup(byKey.ISIN, 'ISIN');

    // Standalone: each sheet is its own "table"
    const standalone = byKey.STANDALONE.map(d => ({
      keyType:      'STANDALONE',
      keyCol:       null,
      sourceSheets: [d.sheetName],
      columns:      d.columns,
      rows:         d.rows,
      aiHeaders:    d.aiHeaders,
      aiProvider:   d.aiProvider,
      aiModel:      d.aiModel,
    }));

    // Build console summary
    const nseRows = nseSymbolMerged?.rows?.length || 0;
    const nseShts = nseSymbolMerged?.sourceSheets?.length || 0;
    const isinRows = isinMerged?.rows?.length || 0;
    const isinShts = isinMerged?.sourceSheets?.length || 0;
    console.log('\n' + '═'.repeat(70));
    console.log('[NSE-MERGE] Merge pipeline complete:');
    console.log(`  NSE_SYMBOL group : ${nseShts} source sheets merged → ${nseRows.toLocaleString()} rows`);
    console.log(`  ISIN group       : ${isinShts} source sheets merged → ${isinRows.toLocaleString()} rows`);
    console.log(`  STANDALONE group : ${standalone.length} individual sheets (no shared key)`);
    console.log(`  Metadata rows suppressed across all sheets: ${totalSuppressed}`);
    console.log('  NSE_SYMBOL source sheets: ' + (nseSymbolMerged?.sourceSheets || []).join(', '));
    console.log('  ISIN source sheets: ' + (isinMerged?.sourceSheets || []).join(', '));
    console.log('═'.repeat(70) + '\n');

    _mergedCache = {
      NSE_SYMBOL: nseSymbolMerged,
      ISIN:       isinMerged,
      STANDALONE: standalone,
      totalSuppressed,
      parsedSheets: parsed,
    };
    return _mergedCache;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // API ENDPOINTS
  // ═══════════════════════════════════════════════════════════════════════════

  // GET /api/nse-data/sheets — fast index (no AI, no parse)
  app.get('/api/nse-data/sheets', (req, res) => {
    try {
      const wb   = loadWorkbook();
      const XLSX = getXlsx();
      const sheets = wb.SheetNames.map(name => {
        const ws    = wb.Sheets[name];
        const range = ws['!ref'] ? XLSX.utils.decode_range(ws['!ref']) : null;
        // Determine merge group (static lookup — no parse needed here)
        const mergeGroup = METADATA_SKIP[name] === 0 ? 'STANDALONE'
          : Object.keys(HEADERLESS).includes(name) ? 'AI_HEADER'
          : 'PENDING';
        return {
          name,
          rowCount:    range ? range.e.r - range.s.r : 0,
          colCount:    range ? range.e.c - range.s.c + 1 : 0,
          hasAiHeader: !!HEADERLESS[name],
          hasMetadataSkip: (METADATA_SKIP[name] || 0) > 0,
        };
      });
      res.json({ success: true, count: sheets.length, sheets });
    } catch (e) {
      res.json({ success: false, error: e.message });
    }
  });

  // GET /api/nse-data/sheet?name=X — single parsed sheet
  app.get('/api/nse-data/sheet', async (req, res) => {
    try {
      const sheetName = (req.query.name || '').trim();
      if (!sheetName) return res.status(400).json({ success: false, error: 'name param required' });
      const wb = loadWorkbook();
      const ws = wb.Sheets[sheetName];
      if (!ws) return res.status(404).json({ success: false, error: `Sheet "${sheetName}" not found` });
      const result = await parseSheet(ws, sheetName);
      res.json({
        success: true, name: sheetName,
        columnCount: result.columns.length, rowCount: result.rows.length,
        columns: result.columns, rows: result.rows,
        aiHeaders: result.aiHeaders, aiProvider: result.aiProvider || null, aiModel: result.aiModel || null,
        primaryKey: result.primaryKey, suppressed: result.suppressed,
      });
    } catch (e) {
      res.json({ success: false, error: e.message });
    }
  });

  // GET /api/nse-data/merged — all merge groups
  // Query params:
  //   group=NSE_SYMBOL|ISIN|STANDALONE (default: return all groups as summary)
  //   sheet=<name>  (for STANDALONE group, return that standalone sheet's data)
  app.get('/api/nse-data/merged', async (req, res) => {
    try {
      const mc = await buildMergedTables();
      const group = (req.query.group || '').toUpperCase();
      const standaloneSheet = (req.query.sheet || '').trim();

      if (group === 'NSE_SYMBOL') {
        const g = mc.NSE_SYMBOL;
        if (!g) return res.json({ success: true, group: 'NSE_SYMBOL', rows: [], columns: [], sourceSheets: [] });
        return res.json({ success: true, group: 'NSE_SYMBOL', keyCol: g.keyCol,
          sourceSheets: g.sourceSheets, columnCount: g.columns.length, rowCount: g.rows.length,
          columns: g.columns, rows: g.rows });
      }

      if (group === 'ISIN') {
        const g = mc.ISIN;
        if (!g) return res.json({ success: true, group: 'ISIN', rows: [], columns: [], sourceSheets: [] });
        return res.json({ success: true, group: 'ISIN', keyCol: g.keyCol,
          sourceSheets: g.sourceSheets, columnCount: g.columns.length, rowCount: g.rows.length,
          columns: g.columns, rows: g.rows });
      }

      if (group === 'STANDALONE') {
        if (standaloneSheet) {
          const found = mc.STANDALONE.find(s => s.sourceSheets[0] === standaloneSheet);
          if (!found) return res.status(404).json({ success: false, error: `Standalone sheet "${standaloneSheet}" not found` });
          return res.json({ success: true, group: 'STANDALONE', sourceSheets: found.sourceSheets,
            keyCol: null, columnCount: found.columns.length, rowCount: found.rows.length,
            columns: found.columns, rows: found.rows,
            aiHeaders: found.aiHeaders, aiProvider: found.aiProvider || null, aiModel: found.aiModel || null });
        }
        // Return index of all standalone sheets
        return res.json({ success: true, group: 'STANDALONE',
          sheets: mc.STANDALONE.map(s => ({ name: s.sourceSheets[0], rowCount: s.rows.length, colCount: s.columns.length, aiHeaders: s.aiHeaders || false })) });
      }

      // Default: return summary of all groups
      res.json({
        success: true,
        totalSuppressed: mc.totalSuppressed,
        groups: {
          NSE_SYMBOL: {
            keyCol:       mc.NSE_SYMBOL?.keyCol || null,
            sourceSheets: mc.NSE_SYMBOL?.sourceSheets || [],
            rowCount:     mc.NSE_SYMBOL?.rows?.length || 0,
            columnCount:  mc.NSE_SYMBOL?.columns?.length || 0,
          },
          ISIN: {
            keyCol:       mc.ISIN?.keyCol || null,
            sourceSheets: mc.ISIN?.sourceSheets || [],
            rowCount:     mc.ISIN?.rows?.length || 0,
            columnCount:  mc.ISIN?.columns?.length || 0,
          },
          STANDALONE: {
            sheetCount: mc.STANDALONE?.length || 0,
            sheets: mc.STANDALONE?.map(s => ({ name: s.sourceSheets[0], rowCount: s.rows.length })) || [],
          },
        },
      });
    } catch (e) {
      console.error('[NSE-MERGE] /api/nse-data/merged error:', e.message);
      res.json({ success: false, error: e.message });
    }
  });

  // GET /api/nse-data/infer-headers?name=X — on-demand (preserved for compatibility)
  app.get('/api/nse-data/infer-headers', async (req, res) => {
    try {
      const sheetName = (req.query.name || '').trim();
      if (!sheetName) return res.status(400).json({ success: false, error: 'name param required' });
      if (!HEADERLESS[sheetName]) return res.json({ success: true, aiHeaders: false, message: 'Sheet already has headers' });
      const wb = loadWorkbook();
      const ws = wb.Sheets[sheetName];
      if (!ws) return res.status(404).json({ success: false, error: `Sheet "${sheetName}" not found` });
      const XLSX = getXlsx();
      const raw  = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', raw: false })
        .filter(r => r.some(c => c !== '' && c != null));
      if (req.query.refresh === '1') delete _headerCache[sheetName];
      const inferred = await inferHeaders(sheetName, raw);
      res.json({ success: true, name: sheetName, aiHeaders: true,
        headers: inferred.headers, provider: inferred.provider, model: inferred.model });
    } catch (e) {
      res.json({ success: false, error: e.message });
    }
  });

  console.log('[NSE] Section 9 loaded — pipeline: metadata-suppress → AI-headers → PK-detect → merge');
})();

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 10 — NSE Bhavcopy Integration
// ─────────────────────────────────────────────────────────────────────────────
const bhav = require('./services/nse-bhavcopy');

/**
 * GET /api/bhavcopy/summary
 * Market-level summary: total turnover, advances, declines, unchanged, trade date.
 */
app.get('/api/bhavcopy/summary', async (req, res) => {
  try {
    const d = await bhav.getBhavData();
    if (!d.success) return res.status(503).json(d);
    res.json({
      success: true,
      tradeDate:      d.tradeDate,
      totalSymbols:   d.totalSymbols,
      advances:       d.advances,
      declines:       d.declines,
      unchanged:      d.unchanged,
      totalTurnoverCr:d.totalTurnoverCr,
      adRatio:        d.declines > 0 ? +(d.advances / d.declines).toFixed(2) : null,
      source:         d.source,
    });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

/**
 * GET /api/bhavcopy/gainers?limit=20
 * Top gainers by % change (EQ series, min ₹1 Cr turnover, price > ₹10).
 */
app.get('/api/bhavcopy/gainers', async (req, res) => {
  try {
    const d = await bhav.getBhavData();
    if (!d.success) return res.status(503).json(d);
    const limit = Math.min(parseInt(req.query.limit) || 20, 50);
    res.json({ success: true, tradeDate: d.tradeDate, data: d.gainers.slice(0, limit) });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

/**
 * GET /api/bhavcopy/losers?limit=20
 * Top losers by % change.
 */
app.get('/api/bhavcopy/losers', async (req, res) => {
  try {
    const d = await bhav.getBhavData();
    if (!d.success) return res.status(503).json(d);
    const limit = Math.min(parseInt(req.query.limit) || 20, 50);
    res.json({ success: true, tradeDate: d.tradeDate, data: d.losers.slice(0, limit) });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

/**
 * GET /api/bhavcopy/active?by=value&limit=20
 * Most active stocks by traded value (by=value) or volume (by=volume).
 */
app.get('/api/bhavcopy/active', async (req, res) => {
  try {
    const d = await bhav.getBhavData();
    if (!d.success) return res.status(503).json(d);
    const by    = req.query.by === 'volume' ? 'byVolume' : 'byValue';
    const limit = Math.min(parseInt(req.query.limit) || 20, 50);
    res.json({ success: true, tradeDate: d.tradeDate, by, data: d[by].slice(0, limit) });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

/**
 * GET /api/bhavcopy/delivery?limit=20
 * High delivery percentage stocks (only when MTO data available).
 */
app.get('/api/bhavcopy/delivery', async (req, res) => {
  try {
    const d = await bhav.getBhavData();
    if (!d.success) return res.status(503).json(d);
    const limit = Math.min(parseInt(req.query.limit) || 20, 50);
    // Sort by delivery %, filter rows that have delivery data
    const withDeliv = d.rows
      .filter(r => r.series === 'EQ' && r.delivPct != null && r.delivPct > 0 && r.turnoverCr >= 1)
      .sort((a, b) => b.delivPct - a.delivPct)
      .slice(0, limit);
    res.json({ success: true, tradeDate: d.tradeDate, data: withDeliv });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

/**
 * GET /api/bhavcopy/sectors
 * Sector aggregates: count, advances, declines, total turnover, avg % change.
 */
app.get('/api/bhavcopy/sectors', async (req, res) => {
  try {
    const d = await bhav.getBhavData();
    if (!d.success) return res.status(503).json(d);
    res.json({ success: true, tradeDate: d.tradeDate, data: d.sectors });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

/**
 * GET /api/bhavcopy/all?limit=500
 * Full normalised rows (paginated). Use for custom client-side processing.
 */
app.get('/api/bhavcopy/all', async (req, res) => {
  try {
    const d = await bhav.getBhavData();
    if (!d.success) return res.status(503).json(d);
    const page  = Math.max(1, parseInt(req.query.page)  || 1);
    const limit = Math.min(Math.max(1, parseInt(req.query.limit) || 200), 500);
    const series = (req.query.series || '').toUpperCase();
    let rows = d.rows;
    if (series) rows = rows.filter(r => r.series === series);
    const total = rows.length;
    const start = (page - 1) * limit;
    res.json({
      success: true, tradeDate: d.tradeDate, total, page, limit,
      pages: Math.ceil(total / limit),
      data: rows.slice(start, start + limit),
    });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

/**
 * POST /api/bhavcopy/refresh
 * Force-invalidates the Bhavcopy cache and re-fetches from NSE.
 */
app.post('/api/bhavcopy/refresh', async (req, res) => {
  try {
    bhav.invalidateCache();
    const d = await bhav.getBhavData();
    res.json({ success: d.success, tradeDate: d.tradeDate, totalSymbols: d.totalSymbols, error: d.error });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

console.log('[BHAVCOPY] Section 10 loaded — /api/bhavcopy/*');

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
  console.log(`📋 Google Sheet: /api/gs/top  /api/gs/screener  /api/gs/jumps  /api/gs/all-green`);
  console.log(`📥 NSE Bhavcopy: /api/bhavcopy/summary  /api/bhavcopy/gainers  /api/bhavcopy/losers\n`);
});
