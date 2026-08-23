# Financial Result Monitor - Technical Specification

## Project Overview
A comprehensive financial dashboard for monitoring NSE 500 stocks with quarterly results, trading statistics, and fundamental analysis ratios.

## Technology Stack
- **Frontend**: React.js with modern hooks
- **Backend**: Node.js + Express.js
- **Database**: SQLite3
- **Data Sources**: Yahoo Finance API, Google Finance, CSV uploads
- **Charts**: Chart.js or Recharts
- **Styling**: CSS3 with responsive design

## Project Structure
```
financial-monitor/
├── client/                    # React frontend
│   ├── public/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Dashboard/
│   │   │   ├── StockDetail/
│   │   │   ├── SectorView/
│   │   │   ├── Search/
│   │   │   ├── Upload/
│   │   │   └── Charts/
│   │   ├── services/
│   │   ├── utils/
│   │   └── App.js
│   └── package.json
├── server/                    # Node.js backend
│   ├── config/
│   ├── controllers/
│   ├── models/
│   ├── routes/
│   ├── services/
│   │   ├── dataFetcher.js    # API integration
│   │   ├── csvParser.js      # CSV processing
│   │   └── calculator.js     # Financial calculations
│   ├── middleware/
│   ├── database/
│   │   └── schema.sql
│   └── server.js
├── uploads/                   # CSV file storage
└── data/                      # SQLite database
```

## Database Schema

### Tables

#### 1. stocks
- stock_id (PRIMARY KEY)
- ticker (UNIQUE, e.g., "RELIANCE")
- company_name
- sector
- industry
- market_cap
- nse_rank (1-500)
- created_at
- updated_at

#### 2. quarterly_results
- result_id (PRIMARY KEY)
- stock_id (FOREIGN KEY)
- quarter (e.g., "Q4")
- fiscal_year (e.g., 2024)
- quarter_end_date
- revenue
- operating_profit
- profit_after_tax
- eps
- created_at

#### 3. trading_data
- trading_id (PRIMARY KEY)
- stock_id (FOREIGN KEY)
- date
- open_price
- high_price
- low_price
- close_price
- volume
- delivery_volume
- delivery_percentage
- created_at

#### 4. cash_flow
- cashflow_id (PRIMARY KEY)
- stock_id (FOREIGN KEY)
- quarter
- fiscal_year
- operating_cash_flow
- investing_cash_flow
- financing_cash_flow
- free_cash_flow
- created_at

#### 5. financial_ratios
- ratio_id (PRIMARY KEY)
- stock_id (FOREIGN KEY)
- quarter
- fiscal_year
- roa (Return on Assets)
- roe (Return on Equity)
- debt_to_equity
- current_ratio
- quick_ratio
- profit_margin
- operating_margin
- created_at

## Key Features & Metrics

### 1. Trading Statistics
- Daily volume traded
- Delivery volume and percentage
- Price changes:
  - Daily (%)
  - Weekly (%)
  - Monthly (%)
  - Quarterly (%)
  - Annually (%)

### 2. Financial Results Analysis
- **YoY Comparison** (Year-over-Year):
  - Revenue growth %
  - Operating profit growth %
  - PAT growth %
  
- **QoQ Comparison** (Quarter-over-Quarter):
  - Revenue growth %
  - Operating profit growth %
  - PAT growth %

### 3. Cash Flow Analysis
- Cash from Operations
- Cash from Investing Activities
- Cash from Financing Activities
- Free Cash Flow
- Growth comparisons (QoQ and YoY)

### 4. Fundamental Ratios
- ROA (Return on Assets)
- ROE (Return on Equity)
- D/E (Debt to Equity)
- Sales Growth %
- Operating Profit Growth %
- PAT Growth %
- Current Ratio
- Quick Ratio
- Profit Margin
- Operating Margin

## API Endpoints

### Stock Management
- `GET /api/stocks` - List all stocks with filters
- `GET /api/stocks/:ticker` - Get specific stock details
- `GET /api/stocks/sector/:sector` - Get stocks by sector
- `GET /api/stocks/search?q=query` - Search stocks

### Financial Data
- `GET /api/financial/:ticker/quarterly` - Get quarterly results
- `GET /api/financial/:ticker/trading` - Get trading data
- `GET /api/financial/:ticker/cashflow` - Get cash flow data
- `GET /api/financial/:ticker/ratios` - Get financial ratios
- `GET /api/financial/:ticker/comparison` - Get YoY and QoQ comparisons

### Data Management
- `POST /api/upload/csv` - Upload CSV file
- `POST /api/fetch/update/:ticker` - Fetch latest data from APIs
- `POST /api/fetch/bulk` - Bulk update multiple stocks

### Dashboard
- `GET /api/dashboard/overview` - Get dashboard summary
- `GET /api/dashboard/top-performers` - Get top performing stocks
- `GET /api/dashboard/sector-summary` - Get sector-wise summary

## CSV Upload Format

### Sample CSV Structure for Quarterly Results
```csv
Ticker,Quarter,FiscalYear,QuarterEndDate,Revenue,OperatingProfit,PAT,EPS
RELIANCE,Q4,2024,2024-03-31,250000,45000,18000,28.5
TCS,Q4,2024,2024-03-31,62000,18500,12000,32.8
```

### Sample CSV Structure for Trading Data
```csv
Ticker,Date,Open,High,Low,Close,Volume,DeliveryVolume,DeliveryPercentage
RELIANCE,2024-05-27,2850.50,2875.00,2840.00,2865.75,8500000,4250000,50.0
```

### CSV Upload Process
1. User selects CSV file type (Quarterly Results, Trading Data, Cash Flow, Ratios)
2. File is validated for correct format
3. Data is parsed and validated
4. Existing records are updated or new records inserted
5. Success/error report is generated

## UI Components

### 1. Dashboard Homepage
- **Top Section**: Market overview with key indices
- **Top Performers**: Cards showing best performing stocks (daily, weekly, monthly)
- **Sector Overview**: Grid showing sector-wise performance
- **Quick Search**: Prominent search bar

### 2. Sector View
- Sector-based color coding
- List of stocks in each sector
- Sector aggregate metrics
- Sortable columns

### 3. Stock Detail Page
- **Header**: Stock name, ticker, current price, change %
- **Trading Stats**: Volume, delivery, price changes (all timeframes)
- **Quarterly Results**: Table with YoY and QoQ comparisons
- **Cash Flow**: Visual representation with growth metrics
- **Ratios**: Grid of all fundamental ratios with comparisons
- **Charts**: Interactive charts for trends

### 4. Search Component
- Autocomplete functionality
- Search by ticker or company name
- Recent searches

### 5. Upload Component
- Drag-and-drop file upload
- File type selection
- Progress indicator
- Validation results display

## Data Fetching Strategy

### API Integration
- **Yahoo Finance API**: Primary source for trading data
- **Fallback**: Google Finance or Screener.in
- **Rate Limiting**: Implement queue system to respect API limits
- **Caching**: Cache API responses for 15 minutes
- **Error Handling**: Graceful fallback to cached data

### Update Frequency
- Trading data: Real-time during market hours, end-of-day otherwise
- Quarterly results: Manual trigger or scheduled weekly check
- Ratios: Calculated on-demand from available data

## Calculation Formulas

### Growth Calculations
```
YoY Growth % = ((Current Year Value - Previous Year Value) / Previous Year Value) × 100
QoQ Growth % = ((Current Quarter Value - Previous Quarter Value) / Previous Quarter Value) × 100
```

### Price Change Calculations
```
Daily Change % = ((Close - Previous Close) / Previous Close) × 100
Weekly Change % = ((Current Close - Close 7 days ago) / Close 7 days ago) × 100
Monthly Change % = ((Current Close - Close 30 days ago) / Close 30 days ago) × 100
```

### Financial Ratios
```
ROA = (Net Income / Total Assets) × 100
ROE = (Net Income / Shareholders Equity) × 100
D/E = Total Debt / Total Equity
Profit Margin = (Net Income / Revenue) × 100
Operating Margin = (Operating Income / Revenue) × 100
```

## UI Design Principles

### Color Scheme
- **Positive Growth**: Green (#10b981)
- **Negative Growth**: Red (#ef4444)
- **Neutral**: Gray (#6b7280)
- **Sector Colors**: Unique color per sector for easy identification

### Sector Color Mapping
- IT: Blue (#3b82f6)
- Banking: Green (#10b981)
- Pharma: Purple (#8b5cf6)
- Auto: Orange (#f97316)
- FMCG: Yellow (#eab308)
- Energy: Red (#ef4444)
- Metals: Gray (#6b7280)
- Realty: Brown (#92400e)

### Responsive Design
- Mobile-first approach
- Breakpoints: 640px, 768px, 1024px, 1280px
- Touch-friendly buttons and controls
- Collapsible sections on mobile

## Error Handling

### Frontend
- Loading states for all async operations
- Error boundaries for component failures
- User-friendly error messages
- Retry mechanisms

### Backend
- Input validation middleware
- Database transaction rollbacks
- API error handling with fallbacks
- Comprehensive logging

## Performance Optimization

### Frontend
- Code splitting by route
- Lazy loading of components
- Memoization of expensive calculations
- Virtual scrolling for large lists

### Backend
- Database indexing on frequently queried columns
- Query optimization
- Response caching
- Connection pooling

## Security Considerations

- Input sanitization for CSV uploads
- File type validation
- Size limits on uploads (max 10MB)
- SQL injection prevention (parameterized queries)
- CORS configuration
- Rate limiting on API endpoints

## Testing Strategy

### Unit Tests
- Financial calculation functions
- CSV parsing logic
- API response handlers

### Integration Tests
- API endpoint testing
- Database operations
- File upload workflow

### Sample Data
- Create sample CSV files for NSE top 50 stocks
- Include various scenarios (growth, decline, stable)
- Test edge cases (missing data, invalid formats)

## Deployment Considerations

### Development
- Local SQLite database
- Mock API responses for testing
- Hot reload for both frontend and backend

### Production
- Environment variables for API keys
- Database backup strategy
- Error monitoring and logging
- Performance monitoring

## Future Enhancements (Out of Scope for MVP)

- User authentication and portfolios
- Alerts and notifications
- Comparison of multiple stocks
- Export to PDF/Excel
- Advanced charting with technical indicators
- News integration
- Peer comparison within sector
- Historical data analysis (5+ years)

## CSV Upload Location

The application will create an `uploads/` directory in the project root where CSV files will be stored temporarily during processing. After successful import, files can be:
1. Moved to an `archive/` subdirectory with timestamp
2. Deleted if user prefers
3. Kept for audit trail

The upload path will be: `financial-monitor/uploads/`

## Development Timeline Estimate

1. **Project Setup & Database** (Tasks 1-2): 1 day
2. **CSV Upload & Import** (Tasks 3-4): 1 day
3. **API Integration** (Task 5): 1 day
4. **Backend APIs & Calculations** (Tasks 6-7): 2 days
5. **Frontend Components** (Tasks 8-16): 3-4 days
6. **Testing & Documentation** (Tasks 17-20): 1-2 days

**Total Estimated Time**: 9-11 days

## Next Steps

Once you approve this plan, we can switch to Code mode to begin implementation. The recommended approach is to:

1. Start with project structure and database setup
2. Build backend APIs with sample data
3. Create frontend components incrementally
4. Test with real NSE stock data
5. Refine UI/UX based on feedback