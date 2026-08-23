# Financial Monitor - Testing Guide

## Prerequisites

Before testing, ensure you have:
1. ✅ Installed all dependencies (`npm install`)
2. ✅ Initialized the database (`npm run db:init`)
3. ✅ Imported CSV data (`node server/scripts/importCSV.js <path-to-csv>`)
4. ✅ Started the server (`npm start`)

---

## Backend API Testing

### 1. Health Check

**Test server is running:**
```bash
curl http://localhost:5000/health
```

**Expected Response:**
```json
{
  "status": "ok",
  "timestamp": "2024-05-28T10:00:00.000Z",
  "uptime": 3600,
  "environment": "development"
}
```

---

### 2. Stock APIs

#### Get All Stocks
```bash
curl http://localhost:5000/api/stocks
```

#### Get Stock by Ticker
```bash
curl http://localhost:5000/api/stocks/RELIANCE
curl http://localhost:5000/api/stocks/TCS
curl http://localhost:5000/api/stocks/INFY
```

#### Get Complete Stock Data
```bash
curl http://localhost:5000/api/stocks/RELIANCE/complete
```

#### Search Stocks
```bash
curl "http://localhost:5000/api/stocks/search?q=tata"
curl "http://localhost:5000/api/stocks/search?q=rel"
curl "http://localhost:5000/api/stocks/search?q=hdfc"
```

#### Get Stocks by Sector
```bash
curl http://localhost:5000/api/stocks/sector/IT
curl http://localhost:5000/api/stocks/sector/Banking
curl http://localhost:5000/api/stocks/sector/Energy
```

#### Get All Sectors
```bash
curl http://localhost:5000/api/stocks/sectors/list
```

#### Get Sector Summary
```bash
curl http://localhost:5000/api/stocks/sectors/summary
```

#### Get Top Stocks
```bash
curl "http://localhost:5000/api/stocks/top/market-cap?limit=10"
```

#### Filter Stocks
```bash
# By sector
curl "http://localhost:5000/api/stocks?sector=IT&limit=10"

# By market cap range
curl "http://localhost:5000/api/stocks?minMarketCap=100000&limit=10"

# Search with filters
curl "http://localhost:5000/api/stocks?search=bank&sector=Banking"

# Sort by market cap
curl "http://localhost:5000/api/stocks?sortBy=market_cap&sortOrder=DESC&limit=20"
```

---

### 3. Dashboard APIs

#### Dashboard Overview
```bash
curl http://localhost:5000/api/dashboard/overview
```

#### Top Performers
```bash
# By 1-year return
curl "http://localhost:5000/api/dashboard/top-performers?metric=return_1y&limit=10"

# By 3-year return
curl "http://localhost:5000/api/dashboard/top-performers?metric=return_3y&limit=10"

# By 5-year return
curl "http://localhost:5000/api/dashboard/top-performers?metric=return_5y&limit=10"
```

#### Sector Summary
```bash
curl http://localhost:5000/api/dashboard/sector-summary
```

#### Market Statistics
```bash
curl http://localhost:5000/api/dashboard/market-stats
```

#### Recent Updates
```bash
curl "http://localhost:5000/api/dashboard/recent-updates?limit=20"
```

---

## Testing with Postman

### Import Collection

Create a Postman collection with these requests:

**Collection: Financial Monitor API**

1. **Health Check**
   - Method: GET
   - URL: `http://localhost:5000/health`

2. **Get All Stocks**
   - Method: GET
   - URL: `http://localhost:5000/api/stocks`
   - Params: `limit=50`, `offset=0`

3. **Get Stock Details**
   - Method: GET
   - URL: `http://localhost:5000/api/stocks/{{ticker}}`
   - Variable: `ticker = RELIANCE`

4. **Search Stocks**
   - Method: GET
   - URL: `http://localhost:5000/api/stocks/search`
   - Params: `q=tata`, `limit=10`

5. **Dashboard Overview**
   - Method: GET
   - URL: `http://localhost:5000/api/dashboard/overview`

---

## Database Testing

### Verify Data Import

```bash
# Check total stocks
sqlite3 data/financial.db "SELECT COUNT(*) FROM stocks;"

# Check sectors
sqlite3 data/financial.db "SELECT DISTINCT sector FROM stocks;"

# Check top 10 by market cap
sqlite3 data/financial.db "SELECT ticker, company_name, market_cap FROM stocks ORDER BY market_cap DESC LIMIT 10;"

# Check quarterly results
sqlite3 data/financial.db "SELECT COUNT(*) FROM quarterly_results;"

# Check trading data
sqlite3 data/financial.db "SELECT COUNT(*) FROM trading_data;"

# Check financial ratios
sqlite3 data/financial.db "SELECT COUNT(*) FROM financial_ratios;"
```

### Sample Queries

```sql
-- Get stock with all data
SELECT s.*, qr.revenue, qr.profit_after_tax, fr.roe, fr.pe_ratio
FROM stocks s
LEFT JOIN quarterly_results qr ON s.stock_id = qr.stock_id
LEFT JOIN financial_ratios fr ON s.stock_id = fr.stock_id
WHERE s.ticker = 'RELIANCE';

-- Get sector-wise count
SELECT sector, COUNT(*) as count, SUM(market_cap) as total_market_cap
FROM stocks
GROUP BY sector
ORDER BY total_market_cap DESC;

-- Get top performers by return
SELECT s.ticker, s.company_name, t.return_1y
FROM stocks s
JOIN trading_data t ON s.stock_id = t.stock_id
ORDER BY t.return_1y DESC
LIMIT 10;
```

---

## Performance Testing

### Load Testing with Apache Bench

```bash
# Test health endpoint
ab -n 1000 -c 10 http://localhost:5000/health

# Test stocks endpoint
ab -n 1000 -c 10 http://localhost:5000/api/stocks

# Test dashboard endpoint
ab -n 1000 -c 10 http://localhost:5000/api/dashboard/overview
```

### Expected Performance
- Response time: < 100ms for simple queries
- Response time: < 500ms for complex queries
- Throughput: > 100 requests/second

---

## Error Testing

### Test Invalid Requests

```bash
# Invalid ticker
curl http://localhost:5000/api/stocks/INVALID

# Invalid search query (too short)
curl "http://localhost:5000/api/stocks/search?q=a"

# Invalid parameters
curl "http://localhost:5000/api/stocks?limit=abc"
```

### Expected Error Responses

```json
{
  "success": false,
  "error": "Stock not found"
}
```

```json
{
  "success": false,
  "error": "Search query must be at least 2 characters"
}
```

---

## Integration Testing

### Test Complete Flow

1. **Start Server**
   ```bash
   npm start
   ```

2. **Verify Health**
   ```bash
   curl http://localhost:5000/health
   ```

3. **Get Dashboard Data**
   ```bash
   curl http://localhost:5000/api/dashboard/overview
   ```

4. **Search for Stock**
   ```bash
   curl "http://localhost:5000/api/stocks/search?q=reliance"
   ```

5. **Get Stock Details**
   ```bash
   curl http://localhost:5000/api/stocks/RELIANCE/complete
   ```

6. **Get Sector Data**
   ```bash
   curl http://localhost:5000/api/stocks/sector/Energy
   ```

---

## Frontend Testing (After React Setup)

### Manual Testing Checklist

- [ ] Dashboard loads successfully
- [ ] Top performers display correctly
- [ ] Sector summary shows all sectors
- [ ] Search functionality works
- [ ] Stock detail page loads
- [ ] Charts render properly
- [ ] Filters work correctly
- [ ] Pagination works
- [ ] Mobile responsive design
- [ ] Error handling works

### Browser Testing

Test in:
- [ ] Chrome
- [ ] Firefox
- [ ] Edge
- [ ] Safari (if available)

---

## Automated Testing (Future)

### Unit Tests
```bash
npm test
```

### Integration Tests
```bash
npm run test:integration
```

### E2E Tests
```bash
npm run test:e2e
```

---

## Common Issues & Solutions

### Issue: Server won't start
**Solution**: Check if port 5000 is already in use
```bash
# Windows
netstat -ano | findstr :5000

# Kill process if needed
taskkill /PID <process_id> /F
```

### Issue: Database not found
**Solution**: Initialize database
```bash
npm run db:init
```

### Issue: No data returned
**Solution**: Import CSV data
```bash
node server/scripts/importCSV.js <path-to-csv>
```

### Issue: CORS errors
**Solution**: Check CORS_ORIGIN in .env file
```
CORS_ORIGIN=http://localhost:3000
```

---

## Test Data Validation

### Verify Data Quality

```bash
# Check for null values
sqlite3 data/financial.db "SELECT COUNT(*) FROM stocks WHERE ticker IS NULL;"

# Check for duplicate tickers
sqlite3 data/financial.db "SELECT ticker, COUNT(*) FROM stocks GROUP BY ticker HAVING COUNT(*) > 1;"

# Check data ranges
sqlite3 data/financial.db "SELECT MIN(market_cap), MAX(market_cap), AVG(market_cap) FROM stocks;"
```

---

## Monitoring

### Check Server Logs

```bash
# View logs in real-time
npm start

# Check for errors
grep "Error" logs/server.log
```

### Monitor Database Size

```bash
# Check database file size
ls -lh data/financial.db

# Check table sizes
sqlite3 data/financial.db ".schema"
```

---

## Success Criteria

✅ All API endpoints return 200 status
✅ Data is correctly imported (500 stocks)
✅ Search returns relevant results
✅ Dashboard shows accurate statistics
✅ No database errors
✅ Response times < 500ms
✅ Rate limiting works (429 after 100 requests)

---

## Next Steps After Testing

1. ✅ Verify all backend APIs work
2. ✅ Test with real NSE 500 data
3. ⏭️ Build React frontend
4. ⏭️ Connect frontend to APIs
5. ⏭️ Add charts and visualizations
6. ⏭️ Deploy to production

---

For more information, see:
- [API Documentation](docs/API-DOCUMENTATION.md)
- [Quick Start Guide](QUICK-START.md)
- [README](README.md)