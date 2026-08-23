# Frontend Guide - How to See and Run the Frontend

## 🚀 Quick Start - See the Frontend

### Step 1: Start the Backend Server
Open a terminal and run:
```bash
cd C:/Users/SaurabhSolanki/financial-monitor
npm start
```
Backend will run on: **http://localhost:5000**

### Step 2: Start the Frontend (React)
Open a **NEW** terminal and run:
```bash
cd C:/Users/SaurabhSolanki/financial-monitor/client
npm start
```
Frontend will automatically open in your browser at: **http://localhost:3000**

### Step 3: View the Dashboard
Your browser will open automatically showing the React app!

---

## 📁 Current Frontend Status

### ✅ What's Ready
- React app installed and configured
- Basic project structure created
- Development server ready

### 🔄 What's Being Built Next
- Dashboard homepage with financial metrics
- Stock search and filtering
- Individual stock detail pages
- Charts and visualizations
- Sector-based navigation

---

## 🖥️ How to Run Both Servers

### Option 1: Two Separate Terminals (Recommended)

**Terminal 1 - Backend:**
```bash
cd C:/Users/SaurabhSolanki/financial-monitor
npm start
```

**Terminal 2 - Frontend:**
```bash
cd C:/Users/SaurabhSolanki/financial-monitor/client
npm start
```

### Option 2: Using npm Scripts (Coming Soon)
We'll add a script to run both together:
```bash
npm run dev
```

---

## 🌐 URLs

| Service | URL | Description |
|---------|-----|-------------|
| Frontend | http://localhost:3000 | React Dashboard UI |
| Backend API | http://localhost:5000 | REST API Server |
| API Health | http://localhost:5000/health | Server health check |
| API Docs | http://localhost:5000/api/stocks | Stock data endpoint |

---

## 🔧 Troubleshooting

### Frontend won't start?
```bash
cd C:/Users/SaurabhSolanki/financial-monitor/client
npm install
npm start
```

### Backend won't start?
```bash
cd C:/Users/SaurabhSolanki/financial-monitor
npm install
npm start
```

### Port already in use?
- Frontend (3000): Change in `client/package.json`
- Backend (5000): Change in `server/server.js` or `.env`

### Can't connect to API?
Make sure backend is running on port 5000 before starting frontend.

---

## 📱 What You'll See

### Current (Default React App)
- React logo spinning
- "Edit src/App.js and save to reload"
- Learn React link

### Coming Soon (Financial Monitor Dashboard)
- **Homepage**: Market overview, top performers, sector summary
- **Stock List**: Searchable, filterable list of NSE 500 stocks
- **Stock Details**: Complete financial analysis for each stock
- **Sector View**: Sector-wise performance comparison
- **Charts**: Interactive financial charts and graphs

---

## 🎨 Frontend Technology Stack

- **React 18** - UI framework
- **React Router** - Navigation
- **Axios** - API calls
- **Chart.js / Recharts** - Data visualization
- **CSS Modules** - Styling
- **Material-UI / Tailwind** - UI components (to be added)

---

## 📊 API Integration

The frontend will connect to these backend endpoints:

```javascript
// Example API calls from frontend
const API_BASE = 'http://localhost:5000/api';

// Get all stocks
fetch(`${API_BASE}/stocks`)

// Search stocks
fetch(`${API_BASE}/stocks/search?q=Reliance`)

// Get stock details
fetch(`${API_BASE}/stocks/RELIANCE/complete`)

// Dashboard overview
fetch(`${API_BASE}/dashboard/overview`)

// Top performers
fetch(`${API_BASE}/dashboard/top-performers`)
```

---

## 🚦 Development Workflow

1. **Start Backend** (Terminal 1)
   ```bash
   cd C:/Users/SaurabhSolanki/financial-monitor
   npm start
   ```

2. **Start Frontend** (Terminal 2)
   ```bash
   cd C:/Users/SaurabhSolanki/financial-monitor/client
   npm start
   ```

3. **Make Changes**
   - Edit files in `client/src/`
   - Save and see live reload in browser

4. **Test API Integration**
   - Open browser DevTools (F12)
   - Check Network tab for API calls
   - Verify data is loading correctly

---

## 📝 Next Steps

1. ✅ React app installed
2. 🔄 Create API service layer
3. 🔄 Build Dashboard components
4. ⏳ Add routing
5. ⏳ Implement stock search
6. ⏳ Create stock detail page
7. ⏳ Add charts and visualizations
8. ⏳ Style with CSS/UI framework

---

## 💡 Tips

- **Hot Reload**: Frontend auto-refreshes when you save files
- **DevTools**: Use F12 to debug and inspect API calls
- **Console**: Check browser console for errors
- **Network Tab**: Monitor API requests and responses
- **React DevTools**: Install browser extension for better debugging

---

## 🎯 Current Status

**Backend**: ✅ 100% Complete (13 APIs ready)  
**Frontend**: 🔄 10% Complete (React installed, building UI next)  
**Database**: ✅ Ready (8 tables, schema complete)  
**Data Import**: ✅ Ready (CSV parser working)

---

**Ready to build the dashboard UI!** 🚀