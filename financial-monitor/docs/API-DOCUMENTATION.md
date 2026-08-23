# Financial Monitor - API Documentation

## Base URL
```
http://localhost:5000/api
```

## Authentication
Currently, no authentication is required. (To be added in future versions)

---

## Stock Endpoints

### 1. Get All Stocks
Get a list of all stocks with optional filters and pagination.

**Endpoint:** `GET /api/stocks`

**Query Parameters:**
- `sector` (string, optional) - Filter by sector
- `search` (string, optional) - Search by ticker or company name
- `minMarketCap` (number, optional) - Minimum market cap filter
- `maxMarketCap` (number, optional) - Maximum market cap filter
- `sortBy` (string, optional) - Sort field (default: `nse_rank`)
- `sortOrder` (string, optional) - Sort order: `ASC` or `DESC` (default: `ASC`)
- `limit` (number, optional) - Results per page (default: 50)
- `offset` (number, optional) - Pagination offset (default: 0)

**Example Request:**
```bash
GET /api/stocks?sector=IT&limit=10&sortBy=market_cap&sortOrder=DESC
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "stock_id": 1,
      "ticker": "TCS",
      "company_name": "Tata Consultancy Services",
      "sector": "IT",
      "industry": "IT Services",
      "market_cap": 1320000,
      "current_price": 3875.50,
      "nse_rank": 2
    }
  ],
  "pagination": {
    "total": 100,
    "limit": 10,
    "offset": 0,
    "hasMore": true
  }
}
```

---

### 2. Get Stock by Ticker
Get detailed information for a specific stock.

**Endpoint:** `GET /api/stocks/:ticker`

**Example Request:**
```bash
GET /api/stocks/RELIANCE
```

**Response:**
```json
{
  "success": true,
  "data": {
    "stock_id": 1,
    "ticker": "RELIANCE",
    "company_name": "Reliance Industries Ltd",
    "sector": "Energy",
    "industry": "Oil & Gas",
    "market_cap": 1850000,
    "current_price": 2865.75,
    "nse_rank": 1,
    "created_at": "2024-05-28T10:00:00.000Z",
    "updated_at": "2024-05-28T10:00:00.000Z"
  }
}
```

---

### 3. Get Complete Stock Data
Get comprehensive data including quarterly results, ratios, cash flow, etc.

**Endpoint:** `GET /api/stocks/:ticker/complete`

**Example Request:**
```bash
GET /api/stocks/RELIANCE/complete
```

**Response:**
```json
{
  "success": true,
  "data": {
    "stock_id": 1,
    "ticker": "RELIANCE",
    "company_name": "Reliance Industries Ltd",
    "sector": "Energy",
    "market_cap": 1850000,
    "current_price": 2865.75,
    "latestResults": {
      "revenue": 250000,
      "operating_profit": 45000,
      "profit_after_tax": 18000,
      "revenue_growth_yoy": 18.40,
      "pat_growth_yoy": 12.47
    },
    "quarterlyResults": [...],
    "tradingData": {
      "return_3m": 0.62,
      "return_6m": -2.83,
      "return_1y": 9.41,
      "return_3y": 39.93,
      "return_5y": 31.71
    },
    "cashFlow": {...},
    "ratios": {
      "roe": 14.39,
      "pe_ratio": 173.80,
      "debt_to_equity": 1.64
    },
    "shareholding": {...},
    "growthMetrics": {...}
  }
}
```

---

### 4. Get All Sectors
Get list of all unique sectors.

**Endpoint:** `GET /api/stocks/sectors/list`

**Response:**
```json
{
  "success": true,
  "data": [
    "IT",
    "Banking",
    "Energy",
    "Pharma",
    "Auto",
    "FMCG"
  ]
}
```

---

### 5. Get Stocks by Sector
Get all stocks in a specific sector.

**Endpoint:** `GET /api/stocks/sector/:sector`

**Example Request:**
```bash
GET /api/stocks/sector/IT
```

**Response:**
```json
{
  "success": true,
  "data": [...],
  "count": 45
}
```

---

### 6. Get Sector Summary
Get aggregated statistics for all sectors.

**Endpoint:** `GET /api/stocks/sectors/summary`

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "sector": "IT",
      "stock_count": 45,
      "avg_market_cap": 125000,
      "total_market_cap": 5625000,
      "min_market_cap": 5000,
      "max_market_cap": 1320000
    }
  ]
}
```

---

### 7. Get Top Stocks
Get top stocks by market capitalization.

**Endpoint:** `GET /api/stocks/top/market-cap`

**Query Parameters:**
- `limit` (number, optional) - Number of stocks to return (default: 10)

**Example Request:**
```bash
GET /api/stocks/top/market-cap?limit=5
```

**Response:**
```json
{
  "success": true,
  "data": [...]
}
```

---

### 8. Search Stocks
Search stocks by ticker or company name.

**Endpoint:** `GET /api/stocks/search`

**Query Parameters:**
- `q` (string, required) - Search query (minimum 2 characters)
- `limit` (number, optional) - Maximum results (default: 10)

**Example Request:**
```bash
GET /api/stocks/search?q=tata&limit=5
```

**Response:**
```json
{
  "success": true,
  "data": [...],
  "count": 5
}
```

---

## Dashboard Endpoints

### 1. Get Dashboard Overview
Get overall dashboard statistics.

**Endpoint:** `GET /api/dashboard/overview`

**Response:**
```json
{
  "success": true,
  "data": {
    "totalStocks": 500,
    "sectorCount": 12,
    "totalMarketCap": 45000000,
    "avgMarketCap": 90000,
    "lastUpdated": "2024-05-28T10:00:00.000Z"
  }
}
```

---

### 2. Get Top Performers
Get top performing stocks by various metrics.

**Endpoint:** `GET /api/dashboard/top-performers`

**Query Parameters:**
- `limit` (number, optional) - Number of stocks per category (default: 10)
- `metric` (string, optional) - Return metric: `return_3m`, `return_6m`, `return_1y`, `return_3y`, `return_5y` (default: `return_1y`)

**Example Request:**
```bash
GET /api/dashboard/top-performers?limit=5&metric=return_1y
```

**Response:**
```json
{
  "success": true,
  "data": {
    "topByReturn": [...],
    "topByMarketCap": [...],
    "topByRevenueGrowth": [...],
    "topByProfitGrowth": [...]
  }
}
```

---

### 3. Get Sector Summary
Get sector-wise performance metrics.

**Endpoint:** `GET /api/dashboard/sector-summary`

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "sector": "IT",
      "stock_count": 45,
      "total_market_cap": 5625000,
      "avg_market_cap": 125000,
      "avg_return_1y": 15.5,
      "avg_return_3y": 45.2,
      "avg_revenue_growth": 18.3,
      "avg_profit_growth": 22.1,
      "avg_roe": 25.4,
      "avg_pe_ratio": 28.5
    }
  ]
}
```

---

### 4. Get Market Statistics
Get overall market statistics and distributions.

**Endpoint:** `GET /api/dashboard/market-stats`

**Response:**
```json
{
  "success": true,
  "data": {
    "overall": {
      "total_stocks": 500,
      "total_market_cap": 45000000,
      "avg_return_1y": 12.5,
      "avg_return_3y": 35.8,
      "avg_pe_ratio": 25.3,
      "avg_roe": 18.7
    },
    "marketCapDistribution": [...],
    "peDistribution": [...]
  }
}
```

---

### 5. Get Recent Updates
Get recently updated stocks.

**Endpoint:** `GET /api/dashboard/recent-updates`

**Query Parameters:**
- `limit` (number, optional) - Number of updates (default: 20)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "ticker": "RELIANCE",
      "company_name": "Reliance Industries Ltd",
      "sector": "Energy",
      "updated_at": "2024-05-28T10:00:00.000Z"
    }
  ]
}
```

---

## Error Responses

All endpoints return errors in the following format:

```json
{
  "success": false,
  "error": "Error message",
  "message": "Detailed error description"
}
```

### Common HTTP Status Codes
- `200` - Success
- `400` - Bad Request (invalid parameters)
- `404` - Not Found (resource doesn't exist)
- `429` - Too Many Requests (rate limit exceeded)
- `500` - Internal Server Error

---

## Rate Limiting

- **Window**: 1 minute
- **Max Requests**: 100 per IP
- **Response**: 429 Too Many Requests

---

## Examples

### Using cURL

```bash
# Get all stocks
curl http://localhost:5000/api/stocks

# Get specific stock
curl http://localhost:5000/api/stocks/RELIANCE

# Search stocks
curl "http://localhost:5000/api/stocks/search?q=tata"

# Get dashboard overview
curl http://localhost:5000/api/dashboard/overview
```

### Using JavaScript (Fetch)

```javascript
// Get all stocks
fetch('http://localhost:5000/api/stocks')
  .then(res => res.json())
  .then(data => console.log(data));

// Get stock by ticker
fetch('http://localhost:5000/api/stocks/RELIANCE')
  .then(res => res.json())
  .then(data => console.log(data));

// Search stocks
fetch('http://localhost:5000/api/stocks/search?q=tata')
  .then(res => res.json())
  .then(data => console.log(data));
```

---

## Health Check

**Endpoint:** `GET /health`

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2024-05-28T10:00:00.000Z",
  "uptime": 3600,
  "environment": "development"
}
```

---

## Notes

1. All monetary values are in **Crores (INR)**
2. All percentages are in **decimal format** (e.g., 15.5 means 15.5%)
3. Dates are in **ISO 8601 format**
4. The API uses **SQLite** database
5. **CORS** is enabled for `http://localhost:3000` by default

---

## Future Endpoints (Coming Soon)

- `POST /api/upload/csv` - Upload CSV file
- `GET /api/financial/:ticker/quarterly` - Get quarterly results
- `GET /api/financial/:ticker/ratios` - Get financial ratios
- `GET /api/financial/:ticker/cashflow` - Get cash flow data
- `POST /api/fetch/update/:ticker` - Fetch latest data from APIs

---

For more information, see the [README.md](../README.md) and [QUICK-START.md](../QUICK-START.md)