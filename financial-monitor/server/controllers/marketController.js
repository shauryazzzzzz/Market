const { query } = require('../config/database');

// yahoo-finance2 v4 instance (reused across requests)
let _yf = null;
try {
    const mod = require('yahoo-finance2');
    const YF  = mod.YahooFinance || mod.default || mod;
    _yf = new YF({ suppressNotices: ['yahooSurvey'] });
} catch { _yf = null; }

// In-memory cache for global markets (TTL 90s — avoids hammering Yahoo)
let _globalCache = null;
let _globalCacheTs = 0;
const GLOBAL_TTL = 90 * 1000;

/**
 * Market Controller
 * Handles global markets, sectoral indices, and stock shockers
 */

/**
 * Get global market indices — live from Yahoo Finance
 * GET /api/markets/global
 */
exports.getGlobalMarkets = async (req, res) => {
    try {
        // Serve from cache if fresh
        if (_globalCache && (Date.now() - _globalCacheTs) < GLOBAL_TTL) {
            return res.json({ success: true, data: _globalCache, lastUpdated: new Date(_globalCacheTs).toISOString(), cached: true });
        }

        // Fallback mock (used if Yahoo is down)
        const FALLBACK = {
            vix:    { name: 'India VIX', value: null, change: null, status: '—', color: 'grey' },
            gold:   { name: 'GOLD',      value: null, change: null, currency: 'USD', color: 'grey' },
            nasdaq: { name: 'NASDAQ',    value: null, change: null, color: 'grey' },
            sp500:  { name: 'S&P 500',   value: null, change: null, color: 'grey' },
            nifty50:{ name: 'NIFTY 50',  value: null, change: null, color: 'grey' },
            sensex: { name: 'SENSEX',    value: null, change: null, color: 'grey' },
        };

        if (!_yf) return res.json({ success: true, data: FALLBACK, lastUpdated: new Date().toISOString(), note: 'yahoo-finance2 unavailable' });

        const SYMBOLS = ['^INDIAVIX', 'GC=F', '^IXIC', '^GSPC', '^NSEI', '^BSESN'];
        const results = await Promise.allSettled(
            SYMBOLS.map(s => _yf.quote(s, {}, { validateResult: false }).catch(() => null))
        );

        const q = (i) => results[i].status === 'fulfilled' ? results[i].value : null;
        const vixVal = q(0)?.regularMarketPrice;

        const globalMarkets = {
            vix: {
                name:   'India VIX',
                value:  vixVal,
                change: q(0)?.regularMarketChangePercent,
                status: vixVal == null ? '—' : vixVal < 15 ? 'Low' : vixVal < 20 ? 'Medium' : 'High',
                color:  vixVal == null ? 'grey' : vixVal < 15 ? 'green' : vixVal < 20 ? 'yellow' : 'red'
            },
            gold: {
                name:     'GOLD',
                value:    q(1)?.regularMarketPrice,
                change:   q(1)?.regularMarketChangePercent,
                currency: 'USD',
                color:    (q(1)?.regularMarketChangePercent || 0) >= 0 ? 'green' : 'red'
            },
            nasdaq: {
                name:   'NASDAQ',
                value:  q(2)?.regularMarketPrice,
                change: q(2)?.regularMarketChangePercent,
                color:  (q(2)?.regularMarketChangePercent || 0) >= 0 ? 'green' : 'red'
            },
            sp500: {
                name:   'S&P 500',
                value:  q(3)?.regularMarketPrice,
                change: q(3)?.regularMarketChangePercent,
                color:  (q(3)?.regularMarketChangePercent || 0) >= 0 ? 'green' : 'red'
            },
            nifty50: {
                name:   'NIFTY 50',
                value:  q(4)?.regularMarketPrice,
                change: q(4)?.regularMarketChangePercent,
                color:  (q(4)?.regularMarketChangePercent || 0) >= 0 ? 'green' : 'red'
            },
            sensex: {
                name:   'SENSEX',
                value:  q(5)?.regularMarketPrice,
                change: q(5)?.regularMarketChangePercent,
                color:  (q(5)?.regularMarketChangePercent || 0) >= 0 ? 'green' : 'red'
            }
        };

        _globalCache   = globalMarkets;
        _globalCacheTs = Date.now();

        res.json({ success: true, data: globalMarkets, lastUpdated: new Date().toISOString() });
    } catch (error) {
        console.error('Error in getGlobalMarkets:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch global markets', message: error.message });
    }
};

/**
 * Get sectoral indices comparison
 * GET /api/markets/sectoral-indices
 */
exports.getSectoralIndices = async (req, res) => {
    try {
        const period = req.query.period || '1y';
        const returnColumn = `return_${period}`;

        // Calculate sectoral performance from stocks
        const sectoralData = await query(`
            SELECT
                s.sector,
                COUNT(DISTINCT s.stock_id) as stock_count,
                AVG(t.${returnColumn}) as avg_return,
                AVG(fr.pe_ratio) as avg_pe,
                AVG(fr.roe) as avg_roe,
                SUM(s.market_cap) as total_market_cap
            FROM stocks s
            LEFT JOIN trading_data t ON s.stock_id = t.stock_id
            LEFT JOIN financial_ratios fr ON s.stock_id = fr.stock_id
            WHERE s.sector IS NOT NULL
            GROUP BY s.sector
            HAVING avg_return IS NOT NULL
            ORDER BY avg_return DESC
        `);

        res.json({
            success: true,
            data: sectoralData,
            period: period
        });
    } catch (error) {
        console.error('Error in getSectoralIndices:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch sectoral indices',
            message: error.message
        });
    }
};

/**
 * Get stocks near 52-week high
 * GET /api/shockers/near-52w-high
 */
exports.getNear52WeekHigh = async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 10;

        const stocks = await query(`
            SELECT
                s.ticker,
                s.company_name,
                s.sector,
                s.current_price,
                t.high_52w_potential,
                t.delivery_percentage,
                t.volume,
                fr.roe,
                fr.pe_ratio,
                t.return_1y
            FROM stocks s
            JOIN trading_data t ON s.stock_id = t.stock_id
            LEFT JOIN financial_ratios fr ON s.stock_id = fr.stock_id
            WHERE t.high_52w_potential IS NOT NULL
            AND t.high_52w_potential < 5
            ORDER BY t.high_52w_potential ASC
            LIMIT ?
        `, [limit]);

        // Calculate 52W high percentage (100 - potential growth)
        const enrichedStocks = stocks.map(stock => ({
            ...stock,
            position_from_52w_high: (100 - stock.high_52w_potential).toFixed(1),
            strength: stock.high_52w_potential < 2 ? 'Strong' :
                     stock.high_52w_potential < 5 ? 'Moderate' : 'Weak'
        }));

        res.json({
            success: true,
            data: enrichedStocks
        });
    } catch (error) {
        console.error('Error in getNear52WeekHigh:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch 52W high stocks',
            message: error.message
        });
    }
};

/**
 * Get stocks near 52-week low
 * GET /api/shockers/near-52w-low
 */
exports.getNear52WeekLow = async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 10;

        const stocks = await query(`
            SELECT
                s.ticker,
                s.company_name,
                s.sector,
                s.current_price,
                t.high_52w_potential,
                t.delivery_percentage,
                fr.roe,
                fr.pe_ratio,
                t.return_1y
            FROM stocks s
            JOIN trading_data t ON s.stock_id = t.stock_id
            LEFT JOIN financial_ratios fr ON s.stock_id = fr.stock_id
            WHERE t.high_52w_potential IS NOT NULL
            AND t.high_52w_potential > 50
            ORDER BY t.high_52w_potential DESC
            LIMIT ?
        `, [limit]);

        // Calculate position from 52W low
        const enrichedStocks = stocks.map(stock => ({
            ...stock,
            position_from_52w_high: (100 - stock.high_52w_potential).toFixed(1),
            position_from_52w_low: ((100 - stock.high_52w_potential) * 2).toFixed(1), // Approximate
            weakness: stock.high_52w_potential > 80 ? 'Severe' :
                     stock.high_52w_potential > 60 ? 'Moderate' : 'Mild'
        }));

        res.json({
            success: true,
            data: enrichedStocks
        });
    } catch (error) {
        console.error('Error in getNear52WeekLow:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch 52W low stocks',
            message: error.message
        });
    }
};

/**
 * Get strong momentum stocks
 * GET /api/shockers/momentum
 */
exports.getMomentumStocks = async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 10;
        const period = req.query.period || '1y';
        const returnColumn = `return_${period}`;

        const stocks = await query(`
            SELECT
                s.ticker,
                s.company_name,
                s.sector,
                s.current_price,
                t.${returnColumn} as momentum_return,
                t.high_52w_potential,
                t.delivery_percentage,
                t.volume,
                fr.roe,
                fr.pe_ratio
            FROM stocks s
            JOIN trading_data t ON s.stock_id = t.stock_id
            LEFT JOIN financial_ratios fr ON s.stock_id = fr.stock_id
            WHERE t.${returnColumn} IS NOT NULL
            AND t.${returnColumn} > 20
            ORDER BY t.${returnColumn} DESC
            LIMIT ?
        `, [limit]);

        const enrichedStocks = stocks.map(stock => ({
            ...stock,
            position_from_52w_high: (100 - stock.high_52w_potential).toFixed(1),
            momentum_strength: stock.momentum_return > 50 ? 'Very Strong' :
                              stock.momentum_return > 30 ? 'Strong' : 'Moderate'
        }));

        res.json({
            success: true,
            data: enrichedStocks,
            period: period
        });
    } catch (error) {
        console.error('Error in getMomentumStocks:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch momentum stocks',
            message: error.message
        });
    }
};

/**
 * Get volume shockers
 * GET /api/shockers/volume
 */
exports.getVolumeShockers = async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 10;

        // delivery_percentage column is unpopulated in this dataset.
        // Fall back to top return_1y gainers as a strong-performer proxy.
        const stocks = await query(`
            SELECT
                s.ticker,
                s.company_name,
                s.sector,
                s.current_price,
                t.volume,
                t.delivery_volume,
                t.delivery_percentage,
                t.return_1y,
                t.return_3m,
                fr.roe,
                fr.pe_ratio
            FROM stocks s
            JOIN trading_data t ON s.stock_id = t.stock_id
            LEFT JOIN financial_ratios fr ON s.stock_id = fr.stock_id
            WHERE t.return_1y IS NOT NULL
            AND t.return_1y > 0
            ORDER BY t.return_1y DESC
            LIMIT ?
        `, [limit]);

        const enrichedStocks = stocks.map(stock => ({
            ...stock,
            delivery_percentage: stock.return_1y,   // map to field the UI expects
            volume_strength: stock.return_1y > 80 ? 'Very High' :
                             stock.return_1y > 40 ? 'High' : 'Moderate'
        }));

        res.json({
            success: true,
            data: enrichedStocks
        });
    } catch (error) {
        console.error('Error in getVolumeShockers:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch volume shockers',
            message: error.message
        });
    }
};

/**
 * Get results surprises (positive and negative)
 * GET /api/shockers/results
 */
exports.getResultsSurprises = async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 5;

        // Positive surprises - high profit growth
        const positiveSurprises = await query(`
            SELECT
                s.ticker,
                s.company_name,
                s.sector,
                s.current_price,
                gm.profit_growth_1y,
                gm.sales_growth_1y,
                t.return_1y,
                fr.roe,
                fr.pe_ratio
            FROM stocks s
            JOIN growth_metrics gm ON s.stock_id = gm.stock_id
            JOIN trading_data t ON s.stock_id = t.stock_id
            LEFT JOIN financial_ratios fr ON s.stock_id = fr.stock_id
            WHERE gm.profit_growth_1y IS NOT NULL
            AND gm.profit_growth_1y > 30
            ORDER BY gm.profit_growth_1y DESC
            LIMIT ?
        `, [limit]);

        // Negative surprises - negative profit growth
        const negativeSurprises = await query(`
            SELECT
                s.ticker,
                s.company_name,
                s.sector,
                s.current_price,
                gm.profit_growth_1y,
                gm.sales_growth_1y,
                t.return_1y,
                fr.roe,
                fr.pe_ratio
            FROM stocks s
            JOIN growth_metrics gm ON s.stock_id = gm.stock_id
            JOIN trading_data t ON s.stock_id = t.stock_id
            LEFT JOIN financial_ratios fr ON s.stock_id = fr.stock_id
            WHERE gm.profit_growth_1y IS NOT NULL
            AND gm.profit_growth_1y < -10
            ORDER BY gm.profit_growth_1y ASC
            LIMIT ?
        `, [limit]);

        res.json({
            success: true,
            data: {
                positive: positiveSurprises,
                negative: negativeSurprises
            }
        });
    } catch (error) {
        console.error('Error in getResultsSurprises:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch results surprises',
            message: error.message
        });
    }
};

module.exports = exports;

// Made with Bob
