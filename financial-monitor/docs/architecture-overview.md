# Financial Monitor - System Architecture

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         USER INTERFACE                           │
│                      (React Frontend)                            │
├─────────────────────────────────────────────────────────────────┤
│  Dashboard  │  Sector View  │  Stock Detail  │  Search  │ Upload│
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      REST API LAYER                              │
│                   (Express.js Backend)                           │
├─────────────────────────────────────────────────────────────────┤
│  Stock APIs  │  Financial APIs  │  Upload APIs  │  Dashboard    │
└─────────────────────────────────────────────────────────────────┘
                              │
                    ┌─────────┴─────────┐
                    ▼                   ▼
┌──────────────────────────┐  ┌──────────────────────────┐
│   DATA SERVICES          │  │   EXTERNAL APIs          │
├──────────────────────────┤  ├──────────────────────────┤
│ • CSV Parser             │  │ • Yahoo Finance          │
│ • Data Transformer       │  │ • Google Finance         │
│ • Calculator Service     │  │ • Screener.in            │
│ • Validation Service     │  │ • Rate Limiter           │
└──────────────────────────┘  └──────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────────────┐
│                      SQLite DATABASE                             │
├─────────────────────────────────────────────────────────────────┤
│  stocks  │  quarterly_results  │  trading_data  │  cash_flow    │
│  financial_ratios  │  shareholding  │  growth_metrics            │
└─────────────────────────────────────────────────────────────────┘
```

## Component Architecture

### Frontend Components (React)

```
src/
├── components/
│   ├── Dashboard/
│   │   ├── DashboardHome.jsx          # Main dashboard with overview
│   │   ├── TopPerformers.jsx          # Top performing stocks cards
│   │   ├── SectorSummary.jsx          # Sector-wise performance grid
│   │   └── MarketOverview.jsx         # Market indices summary
│   │
│   ├── StockDetail/
│   │   ├── StockHeader.jsx            # Stock name, price, change
│   │   ├── TradingStats.jsx           # Volume, delivery, returns
│   │   ├── QuarterlyResults.jsx       # YoY and QoQ comparisons
│   │   ├── CashFlowSection.jsx        # Cash flow analysis
│   │   ├── RatiosGrid.jsx             # Financial ratios display
│   │   └── StockCharts.jsx            # Price and performance charts
│   │
│   ├── SectorView/
│   │   ├── SectorList.jsx             # List of all sectors
│   │   ├── SectorCard.jsx             # Individual sector card
│   │   ├── StockTable.jsx             # Sortable stock table
│   │   └── SectorFilter.jsx           # Filter controls
│   │
│   ├── Search/
│   │   ├── SearchBar.jsx              # Main search input
│   │   ├── AutoComplete.jsx           # Autocomplete dropdown
│   │   └── RecentSearches.jsx         # Recent search history
│   │
│   ├── Upload/
│   │   ├── FileUpload.jsx             # Drag-drop upload
│   │   ├── UploadProgress.jsx         # Progress indicator
│   │   ├── ValidationResults.jsx      # Upload results display
│   │   └── FileTypeSelector.jsx       # Select data type
│   │
│   ├── Charts/
│   │   ├── LineChart.jsx              # Price trends
│   │   ├── BarChart.jsx               # Comparison charts
│   │   ├── PieChart.jsx               # Sector distribution
│   │   └── GaugeChart.jsx             # Ratio indicators
│   │
│   └── Common/
│       ├── Header.jsx                 # App header with navigation
│       ├── Sidebar.jsx                # Side navigation
│       ├── Footer.jsx                 # App footer
│       ├── LoadingSpinner.jsx         # Loading indicator
│       ├── ErrorBoundary.jsx          # Error handling
│       └── Card.jsx                   # Reusable card component
│
├── services/
│   ├── api.js                         # API client
│   ├── stockService.js                # Stock data operations
│   ├── uploadService.js               # File upload operations
│   └── chartService.js                # Chart data formatting
│
├── utils/
│   ├── formatters.js                  # Number, date formatters
│   ├── validators.js                  # Input validation
│   ├── constants.js                   # App constants
│   └── helpers.js                     # Utility functions
│
├── hooks/
│   ├── useStockData.js                # Stock data hook
│   ├── useSearch.js                   # Search functionality hook
│   └── useUpload.js                   # Upload functionality hook
│
└── App.js                             # Main app component
```

### Backend Structure (Node.js/Express)

```
server/
├── config/
│   ├── database.js                    # SQLite configuration
│   ├── api.js                         # API keys and endpoints
│   └── constants.js                   # Server constants
│
├── controllers/
│   ├── stockController.js             # Stock CRUD operations
│   ├── financialController.js         # Financial data operations
│   ├── uploadController.js            # File upload handling
│   ├── dashboardController.js         # Dashboard data aggregation
│   └── searchController.js            # Search operations
│
├── models/
│   ├── Stock.js                       # Stock model
│   ├── QuarterlyResult.js             # Quarterly results model
│   ├── TradingData.js                 # Trading data model
│   ├── CashFlow.js                    # Cash flow model
│   ├── FinancialRatio.js              # Financial ratios model
│   ├── Shareholding.js                # Shareholding model
│   └── GrowthMetric.js                # Growth metrics model
│
├── services/
│   ├── csvParser.js                   # CSV parsing logic
│   ├── dataTransformer.js             # Data transformation
│   ├── calculator.js                  # Financial calculations
│   ├── validator.js                   # Data validation
│   ├── yahooFinance.js                # Yahoo Finance API
│   ├── googleFinance.js               # Google Finance API
│   └── cacheService.js                # Response caching
│
├── routes/
│   ├── stocks.js                      # Stock routes
│   ├── financial.js                   # Financial data routes
│   ├── upload.js                      # Upload routes
│   ├── dashboard.js                   # Dashboard routes
│   └── search.js                      # Search routes
│
├── middleware/
│   ├── errorHandler.js                # Error handling
│   ├── validator.js                   # Request validation
│   ├── rateLimiter.js                 # API rate limiting
│   └── logger.js                      # Request logging
│
├── database/
│   ├── schema.sql                     # Database schema
│   ├── migrations/                    # Database migrations
│   └── seeds/                         # Sample data
│
└── server.js                          # Main server file
```

## Database Schema (SQLite)

### Entity Relationship Diagram

```
┌─────────────────┐
│     stocks      │
├─────────────────┤
│ stock_id (PK)   │
│ ticker (UNIQUE) │◄─────────┐
│ company_name    │          │
│ bse_code        │          │
│ isin_code       │          │
│ sector          │          │
│ industry        │          │
│ market_cap      │          │
│ current_price   │          │
│ nse_rank        │          │
│ created_at      │          │
│ updated_at      │          │
└─────────────────┘          │
                             │
        ┌────────────────────┼────────────────────┐
        │                    │                    │
        ▼                    ▼                    ▼
┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
│quarterly_results │  │  trading_data    │  │   cash_flow      │
├──────────────────┤  ├──────────────────┤  ├──────────────────┤
│ result_id (PK)   │  │ trading_id (PK)  │  │ cashflow_id (PK) │
│ stock_id (FK)    │  │ stock_id (FK)    │  │ stock_id (FK)    │
│ quarter          │  │ date             │  │ quarter          │
│ fiscal_year      │  │ close_price      │  │ fiscal_year      │
│ quarter_end_date │  │ return_3m        │  │ operating_cf     │
│ revenue          │  │ return_6m        │  │ investing_cf     │
│ operating_profit │  │ return_1y        │  │ financing_cf     │
│ profit_after_tax │  │ return_3y        │  │ free_cash_flow   │
│ eps              │  │ return_5y        │  │ created_at       │
│ revenue_growth   │  │ high_52w_pot     │  └──────────────────┘
│ op_growth        │  │ created_at       │
│ pat_growth       │  └──────────────────┘
│ created_at       │
└──────────────────┘
        │
        ├────────────────────┬────────────────────┐
        ▼                    ▼                    ▼
┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
│financial_ratios  │  │  shareholding    │  │ growth_metrics   │
├──────────────────┤  ├──────────────────┤  ├──────────────────┤
│ ratio_id (PK)    │  │ holding_id (PK)  │  │ metric_id (PK)   │
│ stock_id (FK)    │  │ stock_id (FK)    │  │ stock_id (FK)    │
│ quarter          │  │ quarter          │  │ profit_growth_1y │
│ fiscal_year      │  │ fiscal_year      │  │ profit_growth_3y │
│ roe              │  │ promoter_holding │  │ profit_growth_5y │
│ roe_3y_avg       │  │ fii_holding      │  │ sales_growth_1y  │
│ roe_5y_avg       │  │ dii_holding      │  │ sales_growth_3y  │
│ debt_to_equity   │  │ public_holding   │  │ sales_growth_5y  │
│ pe_ratio         │  │ created_at       │  │ created_at       │
│ peg_ratio        │  └──────────────────┘  └──────────────────┘
│ price_to_sales   │
│ price_to_book    │
│ dividend_yield   │
│ profit_margin    │
│ operating_margin │
│ piotroski_score  │
│ created_at       │
└──────────────────┘
```

## API Endpoints

### Stock Management
```
GET    /api/stocks                    # List all stocks with pagination
GET    /api/stocks/:ticker            # Get specific stock details
GET    /api/stocks/sector/:sector     # Get stocks by sector
GET    /api/stocks/search?q=query     # Search stocks
GET    /api/stocks/top/:metric        # Top performers by metric
```

### Financial Data
```
GET    /api/financial/:ticker/quarterly        # Quarterly results
GET    /api/financial/:ticker/trading          # Trading data
GET    /api/financial/:ticker/cashflow         # Cash flow data
GET    /api/financial/:ticker/ratios           # Financial ratios
GET    /api/financial/:ticker/comparison       # YoY and QoQ comparisons
GET    /api/financial/:ticker/growth           # Growth metrics
GET    /api/financial/:ticker/shareholding     # Shareholding pattern
```

### Data Management
```
POST   /api/upload/screener-csv       # Upload Screener.in CSV
POST   /api/upload/manual-csv         # Upload manual CSV
POST   /api/fetch/update/:ticker      # Fetch latest data from APIs
POST   /api/fetch/bulk                # Bulk update multiple stocks
GET    /api/upload/history            # Upload history
```

### Dashboard
```
GET    /api/dashboard/overview        # Dashboard summary
GET    /api/dashboard/top-performers  # Top performing stocks
GET    /api/dashboard/sector-summary  # Sector-wise summary
GET    /api/dashboard/market-stats    # Market statistics
```

## Data Flow

### CSV Upload Flow
```
1. User uploads CSV file
   ↓
2. File validation (size, type, format)
   ↓
3. Parse CSV rows
   ↓
4. Transform data (date formats, numbers)
   ↓
5. Validate each record
   ↓
6. Begin database transaction
   ↓
7. Insert/Update records in batches
   ↓
8. Commit transaction
   ↓
9. Return success/error report
   ↓
10. Archive uploaded file
```

### API Data Fetch Flow
```
1. User requests data update
   ↓
2. Check cache (15-minute TTL)
   ↓
3. If cached, return cached data
   ↓
4. If not cached, call external API
   ↓
5. Transform API response
   ↓
6. Update database
   ↓
7. Cache response
   ↓
8. Return data to user
```

### Dashboard Load Flow
```
1. User opens dashboard
   ↓
2. Fetch market overview
   ↓
3. Fetch top performers (parallel)
   ↓
4. Fetch sector summary (parallel)
   ↓
5. Aggregate data
   ↓
6. Return to frontend
   ↓
7. Render components
```

## Security Considerations

### Input Validation
- Sanitize all CSV inputs
- Validate file types and sizes
- Check for SQL injection patterns
- Limit upload frequency per user

### API Security
- Rate limiting (100 requests/minute)
- CORS configuration
- API key validation for external APIs
- Request logging

### Data Protection
- Parameterized SQL queries
- Input sanitization
- Error message sanitization
- Secure file storage

## Performance Optimization

### Frontend
- Code splitting by route
- Lazy loading components
- Memoization of calculations
- Virtual scrolling for large lists
- Debounced search input

### Backend
- Database indexing on key columns
- Query result caching (15 min)
- Connection pooling
- Batch processing for uploads
- Gzip compression

### Database
```sql
-- Key indexes for performance
CREATE INDEX idx_ticker ON stocks(ticker);
CREATE INDEX idx_sector ON stocks(sector);
CREATE INDEX idx_market_cap ON stocks(market_cap DESC);
CREATE INDEX idx_quarter_date ON quarterly_results(quarter_end_date DESC);
CREATE INDEX idx_stock_quarter ON quarterly_results(stock_id, quarter_end_date);
```

## Deployment Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Development Environment                   │
├─────────────────────────────────────────────────────────────┤
│  • Local SQLite database                                     │
│  • Hot reload (React + Node)                                 │
│  • Mock API responses                                        │
│  • Sample data (50 stocks)                                   │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                    Production Environment                    │
├─────────────────────────────────────────────────────────────┤
│  • SQLite database with backups                              │
│  • PM2 process manager                                       │
│  • Nginx reverse proxy                                       │
│  • SSL/TLS encryption                                        │
│  • Automated backups                                         │
│  • Error monitoring                                          │
└─────────────────────────────────────────────────────────────┘
```

## Technology Stack Summary

### Frontend
- **Framework**: React 18+
- **State Management**: React Context API / Redux (if needed)
- **Routing**: React Router v6
- **Charts**: Recharts or Chart.js
- **Styling**: CSS3 with CSS Modules
- **HTTP Client**: Axios
- **Build Tool**: Vite or Create React App

### Backend
- **Runtime**: Node.js 18+
- **Framework**: Express.js 4+
- **Database**: SQLite3
- **ORM**: Better-sqlite3 (synchronous) or Sequelize
- **File Upload**: Multer
- **CSV Parsing**: Papa Parse or csv-parser
- **Validation**: Joi or express-validator
- **Logging**: Winston or Morgan

### Development Tools
- **Version Control**: Git
- **Package Manager**: npm or yarn
- **Linting**: ESLint
- **Formatting**: Prettier
- **Testing**: Jest + React Testing Library

## Folder Structure Summary

```
financial-monitor/
├── client/                 # React frontend
│   ├── public/
│   ├── src/
│   └── package.json
├── server/                 # Node.js backend
│   ├── config/
│   ├── controllers/
│   ├── models/
│   ├── routes/
│   ├── services/
│   ├── middleware/
│   ├── database/
│   └── server.js
├── uploads/                # CSV file storage
│   ├── screener/
│   ├── manual/
│   └── archive/
├── data/                   # SQLite database
│   └── financial.db
├── docs/                   # Documentation
│   ├── api.md
│   ├── setup.md
│   └── user-guide.md
├── .env                    # Environment variables
├── .gitignore
├── package.json
└── README.md
```

## Next Steps

This architecture provides:
1. ✅ Scalable component structure
2. ✅ Clear separation of concerns
3. ✅ Efficient data flow
4. ✅ Security best practices
5. ✅ Performance optimization
6. ✅ Easy maintenance and testing

Ready to proceed with implementation!