# Financial Monitor - Quick Start Guide

## 🚀 Getting Started

### Step 1: Install Dependencies

```bash
cd C:/Users/SaurabhSolanki/financial-monitor
npm install
```

### Step 2: Initialize Database

```bash
npm run db:init
```

This will create the SQLite database with all required tables at `data/financial.db`

### Step 3: Import Your CSV Data

You have **two options** to import your Screener.in CSV file:

#### Option A: Using the Import Script (Recommended)

```bash
node server/scripts/importCSV.js "C:/Users/SaurabhSolanki/OneDrive - IBM/Documents/Personal documents/Investment/Screener 21 May.csv"
```

#### Option B: Copy CSV to Project and Import

1. **Copy your CSV file** to the project:
   ```bash
   # Create uploads directory
   mkdir uploads/screener/current

   # Copy your CSV file
   copy "C:/Users/SaurabhSolanki/OneDrive - IBM/Documents/Personal documents/Investment/Screener 21 May.csv" uploads/screener/current/
   ```

2. **Run the import**:
   ```bash
   node server/scripts/importCSV.js uploads/screener/current/"Screener 21 May.csv"
   ```

### Step 4: Verify Import

After import completes, you should see:
- ✅ Total stocks imported
- 📈 Data imported for all tables
- ⚠️ Any errors (if applicable)

## 📊 What Gets Imported

From your Screener.in CSV (61 columns), the system imports:

1. **Stock Master Data** (500 stocks)
   - Ticker, Company Name, Sector, Industry
   - Market Cap, Current Price, NSE Rank

2. **Quarterly Results**
   - Revenue, Operating Profit, PAT
   - Growth rates (YoY)
   - Margins (OPM, NPM)

3. **Latest Quarter Data**
   - Latest quarter financials
   - QoQ and YoY comparisons

4. **Trading Data**
   - Current price
   - Returns (3M, 6M, 1Y, 3Y, 5Y)
   - 52-week high potential

5. **Cash Flow**
   - Operating cash flow
   - Free cash flow

6. **Financial Ratios** (20+ metrics)
   - ROE, ROA, D/E
   - PE, PEG, P/S, P/B
   - Piotroski Score
   - And more...

7. **Shareholding Pattern**
   - Promoter, FII, DII, Public holdings

8. **Growth Metrics**
   - Profit growth (1Y, 3Y, 5Y)
   - Sales growth (1Y, 3Y, 5Y)

## 🔍 Verify Data

You can verify the import by checking the database:

```bash
# Install SQLite browser (optional)
# Or use command line:
sqlite3 data/financial.db "SELECT COUNT(*) FROM stocks;"
sqlite3 data/financial.db "SELECT ticker, company_name, sector FROM stocks LIMIT 5;"
```

## 📝 Import Summary Example

After successful import, you'll see:

```
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

## ⚠️ Troubleshooting

### Error: "Cannot find module 'better-sqlite3'"
**Solution**: Run `npm install` first

### Error: "File not found"
**Solution**: Check the CSV file path. Use full path with quotes:
```bash
node server/scripts/importCSV.js "C:/full/path/to/your/file.csv"
```

### Error: "Database not found"
**Solution**: Run `npm run db:init` first to create the database

### Import shows errors for some rows
**Solution**: This is normal. Some stocks may have missing data. Check the error summary to see which rows were skipped.

## 🎯 Next Steps

After successful import:

1. **Start the Backend Server** (Coming soon)
   ```bash
   npm run server
   ```

2. **Start the Frontend** (Coming soon)
   ```bash
   npm run client
   ```

3. **Access the Dashboard**
   - Open browser: http://localhost:3000
   - View stocks, sectors, financial data

## 📁 Project Structure

```
financial-monitor/
├── data/
│   └── financial.db          # SQLite database (created after init)
├── uploads/
│   └── screener/
│       ├── current/           # Place CSV files here
│       └── archive/           # Old imports stored here
├── server/
│   ├── database/
│   │   ├── schema.sql        # Database schema
│   │   └── init.js           # Database initialization
│   ├── services/
│   │   ├── csvParser.js      # CSV parsing logic
│   │   └── dataImporter.js   # Data import service
│   ├── scripts/
│   │   └── importCSV.js      # Import script
│   └── models/
│       └── Stock.js          # Stock model
└── docs/                      # Documentation
```

## 💡 Tips

1. **Keep your CSV updated**: Re-run the import script whenever you download a new CSV from Screener.in

2. **Backup your data**: The database file is at `data/financial.db`. Back it up regularly.

3. **Archive old CSVs**: After import, old CSV files are moved to `uploads/screener/archive/`

4. **Check logs**: Import script shows detailed progress and any errors

## 🆘 Need Help?

- Check the main [README.md](README.md) for project overview
- See [csv-mapping-guide.md](docs/csv-mapping-guide.md) for CSV format details
- Review [architecture-overview.md](docs/architecture-overview.md) for system design

---

**Ready to import?** Run the commands above and your data will be ready in minutes! 🚀