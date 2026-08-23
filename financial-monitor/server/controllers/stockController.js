const Stock = require('../models/Stock');

/**
 * Stock Controller
 * Handles all stock-related HTTP requests
 */

/**
 * Get all stocks with filters and pagination
 * GET /api/stocks
 */
exports.getAllStocks = async (req, res) => {
    try {
        const filters = {
            sector: req.query.sector,
            search: req.query.search,
            minMarketCap: req.query.minMarketCap ? parseFloat(req.query.minMarketCap) : null,
            maxMarketCap: req.query.maxMarketCap ? parseFloat(req.query.maxMarketCap) : null,
            sortBy: req.query.sortBy || 'nse_rank',
            sortOrder: req.query.sortOrder || 'ASC',
            limit: req.query.limit ? parseInt(req.query.limit) : 50,
            offset: req.query.offset ? parseInt(req.query.offset) : 0
        };

        const stocks = await Stock.getAll(filters);
        const total = await Stock.getCount(filters);

        res.json({
            success: true,
            data: stocks,
            pagination: {
                total,
                limit: filters.limit,
                offset: filters.offset,
                hasMore: (filters.offset + filters.limit) < total
            }
        });
    } catch (error) {
        console.error('Error in getAllStocks:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch stocks',
            message: error.message
        });
    }
};

/**
 * Get stock by ticker
 * GET /api/stocks/:ticker
 */
exports.getStockByTicker = async (req, res) => {
    try {
        const { ticker } = req.params;
        const stock = await Stock.getByTicker(ticker.toUpperCase());

        if (!stock) {
            return res.status(404).json({
                success: false,
                error: 'Stock not found'
            });
        }

        res.json({
            success: true,
            data: stock
        });
    } catch (error) {
        console.error('Error in getStockByTicker:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch stock',
            message: error.message
        });
    }
};

/**
 * Get complete stock data with all related information
 * GET /api/stocks/:ticker/complete
 */
exports.getCompleteStockData = async (req, res) => {
    try {
        const { ticker } = req.params;
        const stockData = await Stock.getCompleteData(ticker.toUpperCase());

        if (!stockData) {
            return res.status(404).json({
                success: false,
                error: 'Stock not found'
            });
        }

        res.json({
            success: true,
            data: stockData
        });
    } catch (error) {
        console.error('Error in getCompleteStockData:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch complete stock data',
            message: error.message
        });
    }
};

/**
 * Get all sectors
 * GET /api/stocks/sectors/list
 */
exports.getSectors = async (req, res) => {
    try {
        const sectors = await Stock.getSectors();

        res.json({
            success: true,
            data: sectors.map(s => s.sector)
        });
    } catch (error) {
        console.error('Error in getSectors:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch sectors',
            message: error.message
        });
    }
};

/**
 * Get stocks by sector
 * GET /api/stocks/sector/:sector
 */
exports.getStocksBySector = async (req, res) => {
    try {
        const { sector } = req.params;
        const stocks = await Stock.getBySector(sector);

        res.json({
            success: true,
            data: stocks,
            count: stocks.length
        });
    } catch (error) {
        console.error('Error in getStocksBySector:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch stocks by sector',
            message: error.message
        });
    }
};

/**
 * Get sector summary
 * GET /api/stocks/sectors/summary
 */
exports.getSectorSummary = async (req, res) => {
    try {
        const summary = await Stock.getSectorSummary();

        res.json({
            success: true,
            data: summary
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
 * Get top stocks by market cap
 * GET /api/stocks/top/market-cap
 */
exports.getTopStocks = async (req, res) => {
    try {
        const limit = req.query.limit ? parseInt(req.query.limit) : 10;
        const stocks = await Stock.getTopByMarketCap(limit);

        res.json({
            success: true,
            data: stocks
        });
    } catch (error) {
        console.error('Error in getTopStocks:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch top stocks',
            message: error.message
        });
    }
};

/**
 * Search stocks
 * GET /api/stocks/search
 */
exports.searchStocks = async (req, res) => {
    try {
        const { q } = req.query;
        
        if (!q || q.trim().length < 2) {
            return res.status(400).json({
                success: false,
                error: 'Search query must be at least 2 characters'
            });
        }

        const limit = req.query.limit ? parseInt(req.query.limit) : 10;
        const stocks = await Stock.search(q.trim(), limit);

        res.json({
            success: true,
            data: stocks,
            count: stocks.length
        });
    } catch (error) {
        console.error('Error in searchStocks:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to search stocks',
            message: error.message
        });
    }
};

// Made with Bob
