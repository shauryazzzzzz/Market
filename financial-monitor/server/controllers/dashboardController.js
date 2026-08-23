const db = require('../config/database');
const Stock = require('../models/Stock');

/**
 * Dashboard Controller
 * Handles dashboard-related requests with aggregated data
 */

/**
 * Get dashboard overview
 * GET /api/dashboard/overview
 */
exports.getDashboardOverview = async (req, res) => {
    try {
        // Get total stocks count
        const totalStocks = await Stock.getCount();

        // Get sector count
        const sectors = await Stock.getSectors();
        const sectorCount = sectors.length;

        // Get total market cap
        const marketCapQuery = await db.queryOne(`
            SELECT SUM(market_cap) as total_market_cap,
                   AVG(market_cap) as avg_market_cap
            FROM stocks
        `);

        // Get latest update time
        const latestUpdate = await db.queryOne(`
            SELECT MAX(updated_at) as last_updated
            FROM stocks
        `);

        res.json({
            success: true,
            data: {
                totalStocks,
                sectorCount,
                totalMarketCap: marketCapQuery?.total_market_cap || 0,
                avgMarketCap: marketCapQuery?.avg_market_cap || 0,
                lastUpdated: latestUpdate?.last_updated
            }
        });
    } catch (error) {
        console.error('Error in getDashboardOverview:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch dashboard overview',
            message: error.message
        });
    }
};

/**
 * Get top performers by various metrics
 * GET /api/dashboard/top-performers
 */
exports.getTopPerformers = async (req, res) => {
    try {
        const limit = req.query.limit ? parseInt(req.query.limit) : 10;
        const metric = req.query.metric || 'return_1y'; // return_3m, return_6m, return_1y, return_3y, return_5y

        // Get top performers by return
        const topByReturn = await db.query(`
            SELECT s.ticker, s.company_name, s.sector, s.current_price, s.market_cap,
                   t.${metric} as return_value,
                   t.return_3m, t.return_6m, t.return_1y, t.return_3y, t.return_5y
            FROM stocks s
            JOIN trading_data t ON s.stock_id = t.stock_id
            WHERE t.${metric} IS NOT NULL
            ORDER BY t.${metric} DESC
            LIMIT ?
        `, [limit]);

        // Get top by market cap
        const topByMarketCap = await Stock.getTopByMarketCap(limit);

        // Get top by revenue growth
        const topByRevenueGrowth = await db.query(`
            SELECT s.ticker, s.company_name, s.sector, s.current_price,
                   qr.revenue, qr.revenue_growth_yoy
            FROM stocks s
            JOIN quarterly_results qr ON s.stock_id = qr.stock_id
            WHERE qr.revenue_growth_yoy IS NOT NULL
            ORDER BY qr.revenue_growth_yoy DESC
            LIMIT ?
        `, [limit]);

        // Get top by profit growth
        const topByProfitGrowth = await db.query(`
            SELECT s.ticker, s.company_name, s.sector, s.current_price,
                   qr.profit_after_tax, qr.pat_growth_yoy
            FROM stocks s
            JOIN quarterly_results qr ON s.stock_id = qr.stock_id
            WHERE qr.pat_growth_yoy IS NOT NULL
            ORDER BY qr.pat_growth_yoy DESC
            LIMIT ?
        `, [limit]);

        res.json({
            success: true,
            data: {
                topByReturn,
                topByMarketCap,
                topByRevenueGrowth,
                topByProfitGrowth
            }
        });
    } catch (error) {
        console.error('Error in getTopPerformers:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch top performers',
            message: error.message
        });
    }
};

/**
 * Get sector-wise summary with performance metrics
 * GET /api/dashboard/sector-summary
 */
exports.getSectorSummary = async (req, res) => {
    try {
        const sectorSummary = await db.query(`
            SELECT 
                s.sector,
                COUNT(DISTINCT s.stock_id) as stock_count,
                SUM(s.market_cap) as total_market_cap,
                AVG(s.market_cap) as avg_market_cap,
                AVG(t.return_1y) as avg_return_1y,
                AVG(t.return_3y) as avg_return_3y,
                AVG(qr.revenue_growth_yoy) as avg_revenue_growth,
                AVG(qr.pat_growth_yoy) as avg_profit_growth,
                AVG(fr.roe) as avg_roe,
                AVG(fr.pe_ratio) as avg_pe_ratio
            FROM stocks s
            LEFT JOIN trading_data t ON s.stock_id = t.stock_id
            LEFT JOIN quarterly_results qr ON s.stock_id = qr.stock_id
            LEFT JOIN financial_ratios fr ON s.stock_id = fr.stock_id
            GROUP BY s.sector
            ORDER BY total_market_cap DESC
        `);

        res.json({
            success: true,
            data: sectorSummary
        });
    } catch (error) {
        console.error('Error in getSectorSummary:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch sector summary',
            message: error.message
        });
    }
};

/**
 * Get market statistics
 * GET /api/dashboard/market-stats
 */
exports.getMarketStats = async (req, res) => {
    try {
        // Get overall market statistics
        const stats = await db.queryOne(`
            SELECT 
                COUNT(DISTINCT s.stock_id) as total_stocks,
                SUM(s.market_cap) as total_market_cap,
                AVG(t.return_1y) as avg_return_1y,
                AVG(t.return_3y) as avg_return_3y,
                AVG(t.return_5y) as avg_return_5y,
                AVG(fr.pe_ratio) as avg_pe_ratio,
                AVG(fr.roe) as avg_roe,
                AVG(fr.debt_to_equity) as avg_debt_to_equity,
                AVG(qr.revenue_growth_yoy) as avg_revenue_growth,
                AVG(qr.pat_growth_yoy) as avg_profit_growth
            FROM stocks s
            LEFT JOIN trading_data t ON s.stock_id = t.stock_id
            LEFT JOIN financial_ratios fr ON s.stock_id = fr.stock_id
            LEFT JOIN quarterly_results qr ON s.stock_id = qr.stock_id
        `);

        // Get distribution by market cap ranges
        const marketCapDistribution = await db.query(`
            SELECT 
                CASE 
                    WHEN market_cap >= 100000 THEN 'Large Cap (>1L Cr)'
                    WHEN market_cap >= 30000 THEN 'Mid Cap (30K-1L Cr)'
                    WHEN market_cap >= 10000 THEN 'Small Cap (10K-30K Cr)'
                    ELSE 'Micro Cap (<10K Cr)'
                END as category,
                COUNT(*) as count,
                SUM(market_cap) as total_market_cap
            FROM stocks
            GROUP BY category
            ORDER BY total_market_cap DESC
        `);

        // Get PE ratio distribution
        const peDistribution = await db.query(`
            SELECT 
                CASE 
                    WHEN pe_ratio < 15 THEN 'Low (<15)'
                    WHEN pe_ratio < 25 THEN 'Moderate (15-25)'
                    WHEN pe_ratio < 40 THEN 'High (25-40)'
                    ELSE 'Very High (>40)'
                END as category,
                COUNT(*) as count
            FROM financial_ratios
            WHERE pe_ratio IS NOT NULL
            GROUP BY category
        `);

        res.json({
            success: true,
            data: {
                overall: stats,
                marketCapDistribution,
                peDistribution
            }
        });
    } catch (error) {
        console.error('Error in getMarketStats:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch market statistics',
            message: error.message
        });
    }
};

/**
 * Get recent updates
 * GET /api/dashboard/recent-updates
 */
exports.getRecentUpdates = async (req, res) => {
    try {
        const limit = req.query.limit ? parseInt(req.query.limit) : 20;

        const recentUpdates = await db.query(`
            SELECT s.ticker, s.company_name, s.sector, s.updated_at
            FROM stocks s
            ORDER BY s.updated_at DESC
            LIMIT ?
        `, [limit]);

        res.json({
            success: true,
            data: recentUpdates
        });
    } catch (error) {
        console.error('Error in getRecentUpdates:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch recent updates',
            message: error.message
        });
    }
};

/**
 * Get top stocks by delivery volume spike
 * GET /api/dashboard/top-delivery-volume
 */
exports.getTopDeliveryVolume = async (req, res) => {
    try {
        const limit = req.query.limit ? parseInt(req.query.limit) : 5;

        const topDeliveryVolume = await db.query(`
            SELECT
                s.ticker,
                s.company_name,
                s.sector,
                s.current_price,
                t.delivery_volume,
                t.delivery_percentage,
                t.volume,
                t.close_price,
                t.return_1y,
                t.high_52w_potential
            FROM stocks s
            JOIN trading_data t ON s.stock_id = t.stock_id
            WHERE t.delivery_volume IS NOT NULL
            ORDER BY t.delivery_volume DESC
            LIMIT ?
        `, [limit]);

        res.json({
            success: true,
            data: topDeliveryVolume
        });
    } catch (error) {
        console.error('Error in getTopDeliveryVolume:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch top delivery volume stocks',
            message: error.message
        });
    }
};

/**
 * Get top stocks by price change with time period filter
 * GET /api/dashboard/top-price-change?period=1d|1w|1m|1y
 */
exports.getTopPriceChange = async (req, res) => {
    try {
        const period = req.query.period || '1y'; // 1d, 1w, 1m, 3m, 6m, 1y
        const limit = req.query.limit ? parseInt(req.query.limit) : 5;
        
        // Map period to return column
        const periodMap = {
            '1d': 'return_1d',
            '1w': 'return_1w',
            '1m': 'return_1m',
            '3m': 'return_3m',
            '6m': 'return_6m',
            '1y': 'return_1y',
            '3y': 'return_3y',
            '5y': 'return_5y'
        };
        
        const returnColumn = periodMap[period] || 'return_1y';

        const topGainers = await db.query(`
            SELECT
                s.ticker,
                s.company_name,
                s.sector,
                s.current_price,
                s.market_cap,
                t.${returnColumn} as price_change,
                t.delivery_percentage,
                t.high_52w_potential,
                fr.pe_ratio,
                fr.roe
            FROM stocks s
            JOIN trading_data t ON s.stock_id = t.stock_id
            LEFT JOIN financial_ratios fr ON s.stock_id = fr.stock_id
            WHERE t.${returnColumn} IS NOT NULL
            ORDER BY t.${returnColumn} DESC
            LIMIT ?
        `, [limit]);

        const topLosers = await db.query(`
            SELECT
                s.ticker,
                s.company_name,
                s.sector,
                s.current_price,
                s.market_cap,
                t.${returnColumn} as price_change,
                t.delivery_percentage,
                t.high_52w_potential,
                fr.pe_ratio,
                fr.roe
            FROM stocks s
            JOIN trading_data t ON s.stock_id = t.stock_id
            LEFT JOIN financial_ratios fr ON s.stock_id = fr.stock_id
            WHERE t.${returnColumn} IS NOT NULL
            ORDER BY t.${returnColumn} ASC
            LIMIT ?
        `, [limit]);

        res.json({
            success: true,
            data: {
                period,
                gainers: topGainers,
                losers: topLosers
            }
        });
    } catch (error) {
        console.error('Error in getTopPriceChange:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch top price change stocks',
            message: error.message
        });
    }
};

/**
 * Get sectoral performance with top 5 stocks per sector
 * GET /api/dashboard/sector-performance
 */
exports.getSectorPerformance = async (req, res) => {
    try {
        const period = req.query.period || '1y';
        const limit = req.query.limit ? parseInt(req.query.limit) : 5;
        
        const periodMap = {
            '1d': 'return_1d',
            '1w': 'return_1w',
            '1m': 'return_1m',
            '3m': 'return_3m',
            '6m': 'return_6m',
            '1y': 'return_1y',
            '3y': 'return_3y',
            '5y': 'return_5y'
        };
        
        const returnColumn = periodMap[period] || 'return_1y';

        // Get all sectors
        const sectors = await Stock.getSectors();
        
        // Get top 5 stocks for each sector
        const sectorPerformance = [];
        
        for (const sectorObj of sectors) {
            const sector = sectorObj.sector;
            
            const topStocks = await db.query(`
                SELECT 
                    s.ticker,
                    s.company_name,
                    s.current_price,
                    s.market_cap,
                    t.${returnColumn} as price_change,
                    fr.roe,
                    fr.pe_ratio,
                    fr.debt_to_equity,
                    qr.revenue_growth_yoy,
                    qr.pat_growth_yoy
                FROM stocks s
                JOIN trading_data t ON s.stock_id = t.stock_id
                LEFT JOIN financial_ratios fr ON s.stock_id = fr.stock_id
                LEFT JOIN quarterly_results_latest qr ON s.stock_id = qr.stock_id
                WHERE s.sector = ?
                AND t.${returnColumn} IS NOT NULL
                ORDER BY t.${returnColumn} DESC
                LIMIT ?
            `, [sector, limit]);
            
            // Calculate sector averages
            const sectorAvg = await db.queryOne(`
                SELECT 
                    AVG(t.${returnColumn}) as avg_return,
                    AVG(fr.roe) as avg_roe,
                    AVG(fr.pe_ratio) as avg_pe,
                    COUNT(DISTINCT s.stock_id) as stock_count
                FROM stocks s
                JOIN trading_data t ON s.stock_id = t.stock_id
                LEFT JOIN financial_ratios fr ON s.stock_id = fr.stock_id
                WHERE s.sector = ?
            `, [sector]);
            
            sectorPerformance.push({
                sector,
                averages: sectorAvg,
                topStocks
            });
        }
        
        // Sort sectors by average return
        sectorPerformance.sort((a, b) => 
            (b.averages?.avg_return || 0) - (a.averages?.avg_return || 0)
        );

        res.json({
            success: true,
            data: {
                period,
                sectors: sectorPerformance
            }
        });
    } catch (error) {
        console.error('Error in getSectorPerformance:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch sector performance',
            message: error.message
        });
    }
};

module.exports = exports;

// Made with Bob
