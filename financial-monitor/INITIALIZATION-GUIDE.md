# Financial Monitor - Initialization Guide

## 🎯 Quick Initialization Steps

This guide will help you initialize the Financial Monitor application from scratch.

### Prerequisites Checklist
- ✅ Node.js 18+ installed
- ✅ npm installed
- ✅ Project cloned/downloaded
- ✅ CSV data file available

---

## 📋 Step-by-Step Initialization

### Step 1: Install Backend Dependencies
```bash
cd c:/Users/SaurabhSolanki/financial-monitor
npm install
```

**Expected Output:**
- All dependencies installed successfully
- No UNMET DEPENDENCY errors

**Dependencies Being Installed:**
- express (Web framework)
- better-sqlite3 (Database)
- cors (Cross-origin requests)
- helmet (Security)
- morgan (Logging)
- dotenv (Environment variables)
- papaparse (CSV parsing)
- multer (File uploads)
- axios (HTTP client)
- express-validator (Input validation)
- express-rate-limit (Rate limiting)
- nodemon (Development)
- concurrently (Run multiple commands)

---

### Step 2: Verify Environment Configuration
```bash
# Check if .env file exists
dir .env
```

**Current Configuration (.env):**
```
PORT=5000
NODE_ENV=development
DB_PATH=./data/financial.db
CORS_ORIGIN=http://localhost:3000
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=100
MAX_FILE_SIZE=10485760
UPLOAD_DIR=./uploads
```

✅ **Status:** Environment file already configured

---

### Step 3: Initialize Database
```bash
npm run db:init
```

**What This Does:**
1. Creates `data/` directory if it doesn't exist
2. Creates SQLite database at `data/financial.db`
3. Executes schema.sql to create 8 tables:
   - stocks (Master stock information)
   - quarterly_results (Quarterly financial data)
   - quarterly_results_latest (Latest quarter data)
   - trading_data (Trading statistics)
   - cash_flow (Cash flow statements)
   - financial_ratios (20+ financial ratios)
   - shareholding_pattern (Promoter/FII/DII holdings)
   - growth_metrics (Growth rates)
4. Creates 15+ indexes for performance
5. Creates triggers for timestamp updates

**Expected Output:**
```
🚀 Initializing Financial Monitor Database...
✅ Created data directory
✅ Database connection established
📝 Executing schema...
✅ Schema created successfully

📊 Created tables:
   - cash_flow
   - financial_ratios
   - growth_metrics
   - quarterly_results
   - quarterly_results_latest
   - shareholding_pattern
   - stocks
   - trading_data

🔍 Created indexes:
   - idx_cash_flow_stock
   - idx_financial_ratios_stock
   - idx_growth_metrics_stock
   - idx_quarterly_results_date
   - idx_quarterly_results_stock
   - idx_quarterly_results_stock_date
   - idx_shareholding_stock
   - idx_stocks_market_cap
   - idx_stocks_nse_rank
   - idx_stocks_sector
   - idx_stocks_ticker
   - idx_trading_data_date
   - idx_trading_data_stock
   - idx_trading_data_stock_date

✅ Database initialization completed successfully!
📍 Database location: C:\Users\SaurabhSolanki\financial-monitor\data\financial.db
```

---

### Step 4: Import CSV Data
```bash
node server/scripts/importCSV.js "Screener 21 May.csv"
```

**CSV File Location:** Already in project root: `Screener 21 May.csv`

**What This Does:**
1. Reads the Screener.in CSV file (61 columns)
2. Parses and validates data
3. Imports data into all 8 tables
4. Shows detailed import summary

**Expected Output:**
```
🚀 Starting CSV import...
📁 File: Screener 21 May.csv

============================================================
📊 IMPORT SUMMARY
============================================================
✅ Total Stocks: 500
   - New: 500
   - Updated: 0

📈 Data Imported:
   - Quarterly Results: 500
   - Latest Quarter: 500
   - Trading Data: 500
   - Cash Flow: 500
   - Financial Ratios: 500
   - Shareholding: 500
   - Growth Metrics: 500

============================================================
✅ Import completed successfully!
============================================================
```

**Data Coverage:**
- 500 NSE stocks
- ~4,000 total records across 8 tables
- 61 data points per stock

---

### Step 5: Install Client Dependencies
```bash
cd client
npm install
```

✅ **Status:** Client dependencies already installed
- React 19.2.6
- React Router DOM 7.15.1
- Axios 1.16.1
- Testing libraries
- Web vitals

---

### Step 6: Start Development Servers

#### Option A: Start Both Servers Together (Recommended)
```bash
cd c:/Users/SaurabhSolanki/financial-monitor
npm run dev
```

This starts:
- Backend server on http://localhost:5000
- Frontend server on http://localhost:3000

#### Option B: Start Servers Separately

**Terminal 1 - Backend:**
```bash
npm run server
```

**Terminal 2 - Frontend:**
```bash
npm run client
```

---

### Step 7: Verify Installation

#### Test Backend API
```bash
# Health check
curl http://localhost:5000/health

# Get all stocks
curl http://localhost:5000/api/stocks

# Search stocks
curl http://localhost:5000/api/stocks/search?q=tata

# Dashboard overview
curl http://localhost:5000/api/dashboard/overview
```

#### Test Frontend
Open browser: http://localhost:3000

---

## 🗂️ Project Structure After Initialization

```
financial-monitor/
├── node_modules/              ✅ Backend dependencies
├── client/
│   ├── node_modules/          ✅ Frontend dependencies
│   ├── public/
│   ├── src/
│   └── package.json
├── server/
│   ├── config/
│   ├── controllers/
│   ├── database/
│   ├── models/
│   ├── routes/
│   ├── scripts/
│   ├── services/
│   └── server.js
├── data/
│   ├── financial.db           ✅ SQLite database
│   ├── csv/
│   └── exports/
├── docs/
├── .env                       ✅ Environment config
├── package.json
└── Screener 21 May.csv        ✅ CSV data file
```

---

## 🔍 Verification Checklist

After initialization, verify:

- [ ] Backend dependencies installed (no UNMET errors)
- [ ] Client dependencies installed
- [ ] .env file exists with correct configuration
- [ ] Database file created at `data/financial.db`
- [ ] Database has 8 tables
- [ ] Database has 15+ indexes
- [ ] CSV data imported (500 stocks)
- [ ] Backend server starts without errors
- [ ] Frontend server starts without errors
- [ ] API endpoints respond correctly
- [ ] Frontend loads in browser

---

## 🚨 Troubleshooting

### Issue: npm install fails
**Solution:**
```bash
npm cache clean --force
npm install --force
```

### Issue: Database initialization fails
**Solution:**
```bash
# Delete existing database
del data\financial.db
# Reinitialize
npm run db:init
```

### Issue: CSV import fails
**Solution:**
- Check CSV file path is correct
- Ensure database is initialized first
- Verify CSV file format matches Screener.in format

### Issue: Port already in use
**Solution:**
```bash
# Change port in .env file
PORT=5001
```

### Issue: CORS errors
**Solution:**
- Verify CORS_ORIGIN in .env matches frontend URL
- Default: http://localhost:3000

---

## 📊 Database Schema Overview

### Table: stocks (Master Data)
- stock_id, ticker, company_name, sector, industry
- market_cap, current_price, nse_rank
- Indexes: ticker, sector, market_cap, nse_rank

### Table: quarterly_results
- Quarterly financial results
- Revenue, profit, margins, growth rates
- Indexes: stock_id, date

### Table: quarterly_results_latest
- Latest quarter specific data
- QoQ and YoY comparisons

### Table: trading_data
- Current price, volume, delivery
- Returns (3M, 6M, 1Y, 3Y, 5Y)
- 52-week high potential

### Table: cash_flow
- Operating, investing, financing cash flows
- Free cash flow

### Table: financial_ratios
- 20+ ratios: ROE, ROA, D/E, PE, PEG, etc.
- Piotroski score, Graham price ratio

### Table: shareholding_pattern
- Promoter, FII, DII, Public holdings

### Table: growth_metrics
- Profit growth (1Y, 3Y, 5Y)
- Sales growth (1Y, 3Y, 5Y)

---

## 🎯 Next Steps After Initialization

1. **Explore the API**
   - Test all 13 API endpoints
   - Review API documentation: `docs/API-DOCUMENTATION.md`

2. **Start Development**
   - Build frontend components
   - Integrate with backend APIs
   - Add charts and visualizations

3. **Test with Real Data**
   - Verify data accuracy
   - Test search functionality
   - Check sector filtering

4. **Customize**
   - Modify UI/UX as needed
   - Add new features
   - Optimize performance

---

## 📚 Additional Resources

- **README.md** - Project overview
- **QUICK-START.md** - Quick start guide
- **PROJECT-STATUS.md** - Current project status
- **docs/API-DOCUMENTATION.md** - Complete API reference
- **docs/csv-mapping-guide.md** - CSV format details
- **docs/architecture-overview.md** - System architecture
- **TESTING-GUIDE.md** - Testing instructions

---

## ✅ Initialization Complete!

Once all steps are completed:
1. Backend server running on port 5000
2. Frontend server running on port 3000
3. Database populated with 500 stocks
4. All APIs functional
5. Ready for development!

**Access the application:**
- Frontend: http://localhost:3000
- Backend API: http://localhost:5000/api
- Health Check: http://localhost:5000/health

---

**Last Updated:** May 28, 2026  
**Status:** Ready for initialization  
**Estimated Time:** 10-15 minutes