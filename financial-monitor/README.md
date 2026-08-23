# Financial Result Monitor

A comprehensive financial dashboard for monitoring NSE 500 stocks with quarterly results, trading statistics, and fundamental analysis ratios.

## Project Overview

This application provides real-time financial analysis and monitoring for India's top 500 NSE stocks, featuring:

- **Quarterly Financial Results**: YoY and QoQ comparisons
- **Trading Statistics**: Volume, delivery, price changes across multiple timeframes
- **Fundamental Analysis**: ROA, ROE, D/E, and other key ratios
- **Cash Flow Analysis**: Operations, finance, and investing activities
- **Sector-Based Navigation**: Easy filtering and categorization
- **Hybrid Data Sources**: CSV upload + API integration

## Technology Stack

- **Frontend**: React.js + CSS3
- **Backend**: Node.js + Express.js
- **Database**: SQLite3
- **Data Sources**: Screener.in CSV, Yahoo Finance API, Google Finance API
- **Charts**: Recharts / Chart.js

## Project Structure

```
financial-monitor/
├── client/                 # React frontend
├── server/                 # Node.js backend
├── uploads/                # CSV file storage
├── data/                   # SQLite database
├── docs/                   # Documentation
│   ├── financial-monitor-plan.md
│   ├── csv-mapping-guide.md
│   └── architecture-overview.md
└── README.md
```

## Documentation

- **[Technical Specification](docs/financial-monitor-plan.md)** - Detailed technical plan
- **[CSV Mapping Guide](docs/csv-mapping-guide.md)** - CSV to database mapping
- **[Architecture Overview](docs/architecture-overview.md)** - System architecture

## Key Features

### 1. Dashboard
- Market overview with key indices
- Top performers (daily, weekly, monthly)
- Sector-wise performance grid
- Quick search functionality

### 2. Stock Detail Page
- Current price and change indicators
- Trading statistics
- Quarterly results with comparisons
- Cash flow analysis
- Financial ratios grid
- Interactive charts

### 3. Data Management
- CSV upload from Screener.in format
- API-based data fetching
- Automatic data refresh

## Database Schema

### Core Tables
1. **stocks** - Master stock information
2. **quarterly_results** - Quarterly financial results
3. **trading_data** - Daily trading statistics
4. **cash_flow** - Cash flow statements
5. **financial_ratios** - Financial ratios and metrics
6. **shareholding_pattern** - Promoter/FII/DII holdings
7. **growth_metrics** - Growth rates (1Y, 3Y, 5Y)

## Getting Started

### Prerequisites
- Node.js 18+
- npm or yarn

### Installation
```bash
# Clone the repository
git clone <repository-url>
cd financial-monitor

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env

# Initialize database
npm run db:init

# Start development server
npm run dev
```

### CSV Data Upload

The application supports CSV uploads from Screener.in with 61 columns of comprehensive financial data.

**CSV Location**: Place your CSV files in the `uploads/screener/` directory.

**Sample CSV Format**: See [CSV Mapping Guide](docs/csv-mapping-guide.md) for detailed format.

## API Endpoints

### Stock Management
- `GET /api/stocks` - List all stocks
- `GET /api/stocks/:ticker` - Get stock details
- `GET /api/stocks/sector/:sector` - Get stocks by sector
- `GET /api/stocks/search?q=query` - Search stocks

### Financial Data
- `GET /api/financial/:ticker/quarterly` - Quarterly results
- `GET /api/financial/:ticker/trading` - Trading data
- `GET /api/financial/:ticker/cashflow` - Cash flow data
- `GET /api/financial/:ticker/ratios` - Financial ratios

### Data Management
- `POST /api/upload/screener-csv` - Upload CSV
- `POST /api/fetch/update/:ticker` - Fetch latest data

### Dashboard
- `GET /api/dashboard/overview` - Dashboard summary
- `GET /api/dashboard/top-performers` - Top performers
- `GET /api/dashboard/sector-summary` - Sector summary

## Development Timeline

**Estimated Time**: 9-11 days

1. Project Setup & Database (1 day)
2. CSV Upload & Import (1 day)
3. API Integration (1 day)
4. Backend APIs & Calculations (2 days)
5. Frontend Components (3-4 days)
6. Testing & Documentation (1-2 days)

## Todo List

- [ ] Set up project structure and initialize application
- [ ] Design and create SQLite database schema
- [ ] Create CSV upload functionality
- [ ] Implement data import service
- [ ] Set up API integration layer
- [ ] Create backend REST API endpoints
- [ ] Build financial metrics calculation functions
- [ ] Design and implement dashboard homepage
- [ ] Create sector-based navigation component
- [ ] Build stock search functionality
- [ ] Develop individual stock detail page
- [ ] Create trading statistics component
- [ ] Build quarterly results comparison view
- [ ] Implement fundamental analysis ratios display
- [ ] Create cash flow analysis section
- [ ] Design responsive UI with charts
- [ ] Implement data refresh mechanism
- [ ] Add error handling and validation
- [ ] Create user documentation
- [ ] Test with NSE 500 stock data

## Contributing

This is a personal project. For questions or suggestions, please contact the project owner.

## License

Private project - All rights reserved

## Contact

Project Owner: Saurabh Solanki
Project Location: C:\Users\SaurabhSolanki\financial-monitor\

---

**Status**: Planning Phase Complete ✅  
**Next Step**: Switch to Code mode to begin implementation