# Financial Monitor - Quick Reference Card

## 🚀 Start Commands

```bash
# Start everything (recommended)
npm run dev

# Start backend only
npm run server

# Start frontend only
cd client && npm start
```

## 🌐 URLs

- **Frontend:** http://localhost:3000
- **Backend API:** http://localhost:5000/api
- **Health Check:** http://localhost:5000/health

## 📊 Database Commands

```bash
# Initialize database
npm run db:init

# Import CSV data
node server/scripts/importCSV.js "Screener 21 May.csv"
```

## 🔍 Test API Endpoints

```bash
# Health check
curl http://localhost:5000/health

# Get all stocks
curl http://localhost:5000/api/stocks

# Search stocks
curl "http://localhost:5000/api/stocks/search?q=tata"

# Get stock by ticker
curl http://localhost:5000/api/stocks/RELIANCE

# Dashboard overview
curl http://localhost:5000/api/dashboard/overview

# Top performers
curl http://localhost:5000/api/dashboard/top-performers

# Sector summary
curl http://localhost:5000/api/dashboard/sector-summary
```

## 📁 Key Files

- **Backend:** `server/server.js`
- **Database:** `data/financial.db`
- **CSV Data:** `Screener 21 May.csv`
- **Frontend:** `client/src/App.js`
- **Dashboard:** `client/src/components/Dashboard.js`
- **Config:** `.env`

## 🔧 Troubleshooting

### Port already in use
```bash
# Change port in .env
PORT=5001
```

### Database not found
```bash
npm run db:init
```

### Dependencies missing
```bash
npm install
cd client && npm install
```

### Clear cache
```bash
npm cache clean --force
```

## 📊 Dashboard Features

- Market Overview (4 stat cards)
- Top Performers (by returns, market cap, revenue, profit)
- Sector Performance (8+ sectors)
- Market Statistics
- Real-time data loading
- Responsive design

## 🎯 Success Indicators

✅ Backend running on port 5000  
✅ Frontend running on port 3000  
✅ Database has 500 stocks  
✅ Dashboard displays data  
✅ No console errors  

## 📞 Quick Help

**Project Location:** `C:\Users\SaurabhSolanki\financial-monitor\`  
**Documentation:** See README.md, QUICK-START.md, INITIALIZATION-GUIDE.md  
**Status:** See CURRENT-STATUS.md  

---

**Made with Bob** 🤖