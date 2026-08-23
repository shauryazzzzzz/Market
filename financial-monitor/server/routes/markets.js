const express = require('express');
const router = express.Router();
const marketController = require('../controllers/marketController');

/**
 * Market Routes
 * Handles global markets, sectoral indices, and stock shockers
 */

// Global markets
router.get('/global', marketController.getGlobalMarkets);

// Sectoral indices
router.get('/sectoral-indices', marketController.getSectoralIndices);

// Stock shockers
router.get('/shockers/near-52w-high', marketController.getNear52WeekHigh);
router.get('/shockers/near-52w-low', marketController.getNear52WeekLow);
router.get('/shockers/momentum', marketController.getMomentumStocks);
router.get('/shockers/volume', marketController.getVolumeShockers);
router.get('/shockers/results', marketController.getResultsSurprises);

module.exports = router;

// Made with Bob
