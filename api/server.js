// Aladdin Investing - Backend API Server
// Provides REST API endpoints for frontend

const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs').promises;

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// ============================================
// UTILITY FUNCTIONS
// ============================================

// Load JSON data from file
async function loadData(filename) {
  try {
    const dataPath = path.join(__dirname, '..', 'data', filename);
    const data = await fs.readFile(dataPath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error(`Error loading ${filename}:`, error.message);
    return null;
  }
}

// ============================================
// API ROUTES
// ============================================

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// ============================================
// STOCKS API
// ============================================

// Get all stocks
app.get('/api/stocks', async (req, res) => {
  try {
    const stocks = await loadData('nse-stocks.json');
    
    if (!stocks) {
      return res.status(404).json({
        error: 'Stocks data not found',
        message: 'Please run the NSE fetcher first: npm run fetch:stocks'
      });
    }

    // Apply filters if provided
    let filtered = stocks;
    const { sector, minPrice, maxPrice, minMarketCap, maxMarketCap } = req.query;

    if (sector && sector !== 'all') {
      filtered = filtered.filter(s => s.sector === sector);
    }

    if (minPrice) {
      filtered = filtered.filter(s => s.price >= parseFloat(minPrice));
    }

    if (maxPrice) {
      filtered = filtered.filter(s => s.price <= parseFloat(maxPrice));
    }

    if (minMarketCap) {
      filtered = filtered.filter(s => s.marketCap >= parseFloat(minMarketCap));
    }

    if (maxMarketCap) {
      filtered = filtered.filter(s => s.marketCap <= parseFloat(maxMarketCap));
    }

    res.json({
      success: true,
      count: filtered.length,
      data: filtered
    });
  } catch (error) {
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

// Get specific stock quote
app.get('/api/stocks/:symbol', async (req, res) => {
  try {
    const { symbol } = req.params;
    const filename = `${symbol.toLowerCase()}-quote.json`;
    const quote = await loadData(filename);

    if (!quote) {
      return res.status(404).json({
        error: 'Stock not found',
        message: `No data available for ${symbol}`
      });
    }

    res.json({
      success: true,
      data: quote
    });
  } catch (error) {
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

// Get top gainers
app.get('/api/stocks/movers/gainers', async (req, res) => {
  try {
    const gainers = await loadData('top-gainers.json');

    if (!gainers) {
      return res.status(404).json({
        error: 'Data not found',
        message: 'Please run the NSE fetcher first'
      });
    }

    res.json({
      success: true,
      count: gainers.length,
      data: gainers
    });
  } catch (error) {
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

// Get top losers
app.get('/api/stocks/movers/losers', async (req, res) => {
  try {
    const losers = await loadData('top-losers.json');

    if (!losers) {
      return res.status(404).json({
        error: 'Data not found',
        message: 'Please run the NSE fetcher first'
      });
    }

    res.json({
      success: true,
      count: losers.length,
      data: losers
    });
  } catch (error) {
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

// ============================================
// MARKET INDICES API
// ============================================

// Get all market indices
app.get('/api/indices', async (req, res) => {
  try {
    const indices = await loadData('market-indices.json');

    if (!indices) {
      return res.status(404).json({
        error: 'Data not found',
        message: 'Please run the NSE fetcher first'
      });
    }

    res.json({
      success: true,
      count: indices.length,
      data: indices
    });
  } catch (error) {
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

// ============================================
// IPO API
// ============================================

// Get all IPOs
app.get('/api/ipos', async (req, res) => {
  try {
    const ipos = await loadData('ipo-calendar.json');

    if (!ipos) {
      return res.status(404).json({
        error: 'Data not found',
        message: 'Please run the IPO fetcher first: npm run fetch:ipo'
      });
    }

    // Filter by status if provided
    const { status } = req.query;
    let filtered = ipos;

    if (status) {
      filtered = ipos.filter(ipo => ipo.status === status);
    }

    res.json({
      success: true,
      count: filtered.length,
      data: filtered
    });
  } catch (error) {
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

// Get IPOs by status
app.get('/api/ipos/:status', async (req, res) => {
  try {
    const { status } = req.params;
    const validStatuses = ['upcoming', 'open', 'closed', 'listed'];

    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        error: 'Invalid status',
        message: `Status must be one of: ${validStatuses.join(', ')}`
      });
    }

    const ipos = await loadData('ipo-calendar.json');

    if (!ipos) {
      return res.status(404).json({
        error: 'Data not found',
        message: 'Please run the IPO fetcher first'
      });
    }

    const filtered = ipos.filter(ipo => ipo.status === status);

    res.json({
      success: true,
      count: filtered.length,
      data: filtered
    });
  } catch (error) {
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

// ============================================
// STRATEGIES API
// ============================================

// Get stocks by strategy
app.get('/api/strategies/:strategy', async (req, res) => {
  try {
    const { strategy } = req.params;
    const validStrategies = ['blue-chip', 'value', 'momentum', 'quantitative'];

    if (!validStrategies.includes(strategy)) {
      return res.status(400).json({
        error: 'Invalid strategy',
        message: `Strategy must be one of: ${validStrategies.join(', ')}`
      });
    }

    const filename = `strategy-${strategy}.json`;
    const stocks = await loadData(filename);

    if (!stocks) {
      return res.status(404).json({
        error: 'Data not found',
        message: `No data available for ${strategy} strategy`
      });
    }

    res.json({
      success: true,
      strategy: strategy,
      count: stocks.length,
      data: stocks
    });
  } catch (error) {
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

// ============================================
// SCREENER API
// ============================================

// Screen stocks with filters
app.post('/api/screener', async (req, res) => {
  try {
    const stocks = await loadData('nse-stocks.json');

    if (!stocks) {
      return res.status(404).json({
        error: 'Data not found',
        message: 'Please run the NSE fetcher first'
      });
    }

    const filters = req.body;
    let filtered = stocks;

    // Apply filters
    if (filters.sector && filters.sector !== 'all') {
      filtered = filtered.filter(s => s.sector === filters.sector);
    }

    if (filters.minPrice !== undefined) {
      filtered = filtered.filter(s => s.price >= filters.minPrice);
    }

    if (filters.maxPrice !== undefined) {
      filtered = filtered.filter(s => s.price <= filters.maxPrice);
    }

    if (filters.minMarketCap !== undefined) {
      filtered = filtered.filter(s => s.marketCap >= filters.minMarketCap);
    }

    if (filters.maxMarketCap !== undefined) {
      filtered = filtered.filter(s => s.marketCap <= filters.maxMarketCap);
    }

    if (filters.minVolume !== undefined) {
      filtered = filtered.filter(s => s.totalTradedVolume >= filters.minVolume);
    }

    res.json({
      success: true,
      filters: filters,
      count: filtered.length,
      data: filtered
    });
  } catch (error) {
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

// ============================================
// ERROR HANDLING
// ============================================

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Not found',
    message: `Route ${req.method} ${req.path} not found`
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: err.message
  });
});

// ── Only start standalone server when run directly (not required by server.js)
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`\n🚀 Aladdin Investing API Server`);
    console.log(`📡 Running on http://localhost:${PORT}`);
    console.log(`⏰ Started at ${new Date().toISOString()}\n`);
  });
}

module.exports = app;

// Made with Bob
