 # TradingView Clone - Complete Architecture

## Overview
A comprehensive financial markets platform mirroring TradingView's functionality with a two-level hierarchical navigation system.

## Navigation Hierarchy

### Level 1: Geography (Countries)
- 🇮🇳 India
- 🇺🇸 USA
- 🇨🇳 China
- 🇯🇵 Japan
- 🇧🇷 Brazil
- 🇹🇼 Taiwan
- 🇰🇷 Korea
- 🇩🇪 Germany

### Level 2: Asset Classes
1. **Equity** - Stocks, Shares
2. **Debt** - Corporate Bonds, Debentures
3. **Gold** - Gold ETFs, Sovereign Gold Bonds
4. **Government Bonds** - Treasury Bills, G-Secs
5. **Private Bonds** - Corporate Debt Securities
6. **Real Estate** - REITs (Real Estate Investment Trusts)
7. **InvIT** - Infrastructure Investment Trusts
8. **Mutual Funds** - Equity MF, Debt MF, Hybrid MF
9. **ETF** - Exchange Traded Funds

## Data Sources

### Daily Trading Data
- **Primary**: NSE India (for Indian markets)
- **Secondary**: Google Finance (for global markets)
- **Frequency**: Real-time / End of day

### Quarterly & Annual Results
- **Primary**: Screener.in (for Indian companies)
- **Secondary**: SEC EDGAR (for US companies)
- **Frequency**: Quarterly updates

### IPO Data
- **Primary**: NSE India IPO section
- **Secondary**: Exchange websites
- **Frequency**: Daily updates

### Fundamental Analysis
- **Source**: Screener.in
- **Data**: Financial ratios, balance sheets, P&L statements
- **Frequency**: Quarterly updates

### Technical Analysis
- **Calculation**: Internal (based on price data)
- **Indicators**: RSI, MACD, Moving Averages, Bollinger Bands
- **Frequency**: Daily calculations

## Database Schema

### Core Tables

#### Geography & Market Structure
- `countries` - Country master data
- `exchanges` - Stock exchanges per country
- `market_indices` - Major indices (NIFTY, SENSEX, S&P 500, etc.)

#### Asset Classification
- `asset_classes` - Asset class master (Equity, Debt, Gold, etc.)
- `asset_sub_categories` - Sub-categories within each asset class

#### IPO Calendar
- `ipo_calendar` - IPO listings with country and asset class
- `ipo_subscription_data` - Subscription details by category
- `ipo_grey_market` - Grey market premium data

#### Stock Master & Trading
- `stocks` - Stock master with country and asset class
- `daily_prices` - OHLC data, volume, turnover
- `intraday_data` - Tick-by-tick data

#### Fundamental Analysis
- `quarterly_results` - Quarterly financial statements
- `annual_results` - Annual financial statements
- `fundamental_ratios` - PE, PB, ROE, ROCE, etc.
- `shareholding_pattern` - Promoter, FII, DII holdings

#### Technical Analysis
- `technical_indicators` - RSI, MACD, SMA, EMA, etc.
- `support_resistance` - Support and resistance levels
- `chart_patterns` - Head & Shoulders, Triangles, etc.

#### Corporate Actions
- `corporate_actions` - Dividends, Bonus, Splits, Rights

## API Endpoints

### Geography
- `GET /api/countries` - List all countries
- `GET /api/countries/:code/exchanges` - Exchanges in a country
- `GET /api/countries/:code/indices` - Indices in a country

### Asset Classes
- `GET /api/asset-classes` - List all asset classes
- `GET /api/asset-classes/:code/sub-categories` - Sub-categories

### IPO Calendar
- `GET /api/ipos?country=IN&asset=EQUITY` - Filter by country and asset
- `GET /api/ipos/upcoming` - Upcoming IPOs
- `GET /api/ipos/open` - Currently open IPOs
- `GET /api/ipos/:id` - IPO details
- `GET /api/ipos/:id/subscription` - Subscription data

### Stocks
- `GET /api/stocks?country=IN&asset=EQUITY` - Filter stocks
- `GET /api/stocks/:symbol/price` - Current price
- `GET /api/stocks/:symbol/historical` - Historical data
- `GET /api/stocks/:symbol/fundamentals` - Fundamental ratios
- `GET /api/stocks/:symbol/technicals` - Technical indicators

### Screener
- `GET /api/screener/top-gainers?country=IN` - Top gainers
- `GET /api/screener/top-losers?country=IN` - Top losers
- `GET /api/screener/most-active?country=IN` - Most active by volume

## Frontend Structure

### Main Pages
1. **index.html** - Economy dashboard (existing)
2. **markets.html** - Main markets page with geography selection
3. **ipo-calendar.html** - Dedicated IPO calendar
4. **screener.html** - Stock screener with filters
5. **analysis.html** - Fundamental & technical analysis tools

### UI Components
- Geography selector (Level 1 navigation)
- Asset class tabs (Level 2 navigation)
- IPO cards with status indicators
- Stock tables with sorting and filtering
- Chart components for technical analysis
- Fundamental ratio displays

## Data Fetching Strategy

### Daily Sync (Automated)
1. **Morning (6:00 AM)**: Fetch overnight data
   - Global market indices
   - Pre-market indicators
   
2. **Market Hours (Every 5 min)**: Real-time updates
   - Stock prices
   - Index values
   - IPO subscription data

3. **Evening (6:00 PM)**: End-of-day processing
   - Daily OHLC data
   - Volume analysis
   - Technical indicator calculations

### Weekly Sync
- Shareholding pattern updates
- Corporate action announcements
- Analyst ratings

### Quarterly Sync
- Financial results from Screener.in
- Fundamental ratio calculations
- Balance sheet updates

## Technology Stack

### Backend
- **Runtime**: Node.js
- **Database**: SQLite3
- **HTTP Server**: Native Node.js http module
- **Data Fetching**: Native https module

### Frontend
- **HTML5**: Semantic markup
- **CSS3**: Custom styling (no frameworks)
- **JavaScript**: Vanilla JS (no frameworks)
- **Charts**: Custom SVG-based charts

## File Structure

```
website-clones/tradingview-economy/
├── database/
│   ├── schema.sql              # Complete database schema
│   ├── db-manager.js           # Database operations
│   ├── init-db.js              # Database initialization
│   └── ipo_data.db             # SQLite database file
├── fetchers/
│   ├── nse-ipo-fetcher.js      # NSE IPO data fetcher
│   ├── stock-data-fetcher.js   # Stock price fetcher
│   ├── screener-fetcher.js     # Screener.in data fetcher
│   └── google-finance-fetcher.js # Google Finance fetcher
├── api-server.js               # Main API server
├── server.js                   # Static file server
├── index.html                  # Economy dashboard
├── markets.html                # Markets page
├── styles.css                  # Global styles
├── markets-styles.css          # Markets-specific styles
├── script.js                   # Economy page scripts
├── markets-script.js           # Markets page scripts
├── package.json                # Dependencies
└── README.md                   # Documentation
```

## Installation & Setup

### 1. Install Dependencies
```bash
npm install
```

### 2. Initialize Database
```bash
npm run init:db
```

### 3. Fetch Initial Data
```bash
npm run sync:all
```

### 4. Start Servers
```bash
# Terminal 1: Static file server
npm start

# Terminal 2: API server
npm run api
```

### 5. Access Application
- Frontend: http://localhost:3000
- API: http://localhost:3001/api

## Scheduled Tasks (Windows Task Scheduler)

### Daily Tasks
```powershell
# Morning sync (6:00 AM)
cd C:\path\to\project
npm run fetch:stocks

# Evening sync (6:00 PM)
npm run sync:all
```

### Weekly Tasks
```powershell
# Sunday 8:00 PM
npm run fetch:fundamentals
```

## Future Enhancements

1. **Real-time WebSocket** - Live price updates
2. **User Authentication** - Watchlists, portfolios
3. **Alerts System** - Price alerts, news alerts
4. **Mobile App** - React Native version
5. **Advanced Charts** - TradingView charting library integration
6. **AI Analysis** - ML-based stock recommendations
7. **News Integration** - Financial news aggregation
8. **Social Features** - Community ideas, discussions

## Data Update Frequency

| Data Type | Frequency | Source |
|-----------|-----------|--------|
| Stock Prices | 5 minutes | NSE/Google Finance |
| IPO Subscription | 1 hour | NSE |
| Indices | 5 minutes | NSE/BSE |
| Quarterly Results | Quarterly | Screener.in |
| Fundamental Ratios | Daily | Screener.in |
| Technical Indicators | Daily | Calculated |
| Corporate Actions | Daily | NSE |

## Performance Considerations

1. **Database Indexing**: All foreign keys and frequently queried columns
2. **Caching**: API responses cached for 5 minutes
3. **Pagination**: Large datasets paginated (50 items per page)
4. **Lazy Loading**: Charts and heavy components loaded on demand
5. **CDN**: Static assets served from CDN (future)

## Security Considerations

1. **API Rate Limiting**: Prevent abuse
2. **Input Validation**: Sanitize all user inputs
3. **SQL Injection Prevention**: Parameterized queries
4. **CORS**: Configured for specific origins
5. **HTTPS**: SSL certificates for production

## Maintenance

### Daily
- Monitor data fetch logs
- Check API response times
- Verify database integrity

### Weekly
- Review error logs
- Update data source endpoints if changed
- Backup database

### Monthly
- Performance optimization
- Update dependencies
- Security patches

---

**Version**: 2.0.0  
**Last Updated**: 2024-12-14  
**Maintainer**: Development Team