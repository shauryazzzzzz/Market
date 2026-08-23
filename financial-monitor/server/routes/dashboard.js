const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboardController');

/**
 * Dashboard Routes
 * Base path: /api/dashboard
 */

// Get dashboard overview
router.get('/overview', dashboardController.getDashboardOverview);

// Get top performers
router.get('/top-performers', dashboardController.getTopPerformers);

// Get sector summary
router.get('/sector-summary', dashboardController.getSectorSummary);

// Get market statistics
router.get('/market-stats', dashboardController.getMarketStats);

// Get recent updates
router.get('/recent-updates', dashboardController.getRecentUpdates);

// Get top stocks by delivery volume
router.get('/top-delivery-volume', dashboardController.getTopDeliveryVolume);

// Get top price change stocks (gainers/losers)
router.get('/top-price-change', dashboardController.getTopPriceChange);

// Get sector performance with top stocks
router.get('/sector-performance', dashboardController.getSectorPerformance);

module.exports = router;

// Made with Bob
