const express = require('express');
const router = express.Router();
const stockController = require('../controllers/stockController');

/**
 * Stock Routes
 * Base path: /api/stocks
 */

// Get all sectors (must be before /:ticker to avoid conflict)
router.get('/sectors/list', stockController.getSectors);

// Get sector summary
router.get('/sectors/summary', stockController.getSectorSummary);

// Get top stocks by market cap
router.get('/top/market-cap', stockController.getTopStocks);

// Search stocks
router.get('/search', stockController.searchStocks);

// Get stocks by sector
router.get('/sector/:sector', stockController.getStocksBySector);

// Get complete stock data
router.get('/:ticker/complete', stockController.getCompleteStockData);

// Get stock by ticker
router.get('/:ticker', stockController.getStockByTicker);

// Get all stocks (with filters and pagination)
router.get('/', stockController.getAllStocks);

module.exports = router;

// Made with Bob
