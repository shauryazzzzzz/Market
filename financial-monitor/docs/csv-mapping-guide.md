# CSV Data Mapping Guide - Screener.in Format

## Overview
This document maps the Screener.in CSV format to our Financial Monitor database schema.

## Source CSV Structure (Screener.in)

The CSV contains **61 columns** with comprehensive financial data:

### Column List (from your template):
1. Name
2. BSE Code
3. NSE Code
4. ISIN Code
5. Industry Group
6. Industry
7. Current Price
8. Last result date
9. Market Capitalization
10. Return on equity
11. Average return on equity 3Years
12. Average return on equity 5Years
13. Profit growth
14. Profit growth 3Years
15. Profit growth 5Years
16. Sales growth
17. Sales growth 3Years
18. Sales growth 5Years
19. Return over 3months
20. Return over 6months
21. Return over 1year
22. Return over 3years
23. Return over 5years
24. Possible growth if touches 52 week high
25. wrt Graham Price
26. Piotroski score
27. Price to Sales
28. Price to book value
29. PE wrt Industry
30. Price to Earning
31. PEG Ratio
32. Debt to equity
33. Dividend yield
34. EVEBITDA
35. Promoter holding
36. FII holding
37. DII holding
38. Public holding
39. Debt
40. Sales
41. Operating profit
42. Operating profit growth
43. OPM (Operating Profit Margin)
44. Profit after tax
45. NPM last year (Net Profit Margin)
46. Sales latest quarter
47. QoQ Sales
48. YOY Quarterly sales growth
49. OPM latest quarter
50. Operating profit latest quarter
51. NPM latest quarter
52. Profit after tax latest quarter
53. YOY Quarterly profit growth
54. QoQ Profits
55. Cash from operations last year
56. Net cash flow last year
57. PE to 3PE
58. ROE TO 3ROE
59. PE TO 5 PE
60. RO3 TO 5 ROE
61. PE TO 7 PE
62. ROE TO 7 ROE

## Database Schema Mapping

### Table 1: stocks
| Database Column | CSV Column | Notes |
|----------------|------------|-------|
| ticker | NSE Code | Primary identifier |
| company_name | Name | Full company name |
| bse_code | BSE Code | BSE ticker |
| isin_code | ISIN Code | International identifier |
| sector | Industry Group | e.g., "Capital Markets", "Finance" |
| industry | Industry | Specific industry |
| market_cap | Market Capitalization | In Crores |
| current_price | Current Price | Latest trading price |
| nse_rank | - | To be calculated based on market cap |

### Table 2: quarterly_results
| Database Column | CSV Column | Calculation/Notes |
|----------------|------------|-------------------|
| ticker | NSE Code | Foreign key |
| quarter | - | Extract from "Last result date" |
| fiscal_year | - | Extract from "Last result date" |
| quarter_end_date | Last result date | Format: YYYYMMDD → YYYY-MM-DD |
| revenue | Sales | Annual sales in Crores |
| operating_profit | Operating profit | In Crores |
| profit_after_tax | Profit after tax | In Crores |
| eps | - | Calculate: PAT / Shares Outstanding |
| revenue_growth_yoy | Sales growth | Percentage |
| operating_profit_growth_yoy | Operating profit growth | Percentage |
| pat_growth_yoy | Profit growth | Percentage |

### Table 3: quarterly_results_latest (for latest quarter data)
| Database Column | CSV Column | Notes |
|----------------|------------|-------|
| ticker | NSE Code | Foreign key |
| quarter | - | Current quarter |
| revenue | Sales latest quarter | In Crores |
| operating_profit | Operating profit latest quarter | In Crores |
| profit_after_tax | Profit after tax latest quarter | In Crores |
| opm | OPM latest quarter | Operating Profit Margin % |
| npm | NPM latest quarter | Net Profit Margin % |
| revenue_growth_qoq | QoQ Sales | Quarter-over-Quarter % |
| revenue_growth_yoy | YOY Quarterly sales growth | Year-over-Year % |
| pat_growth_qoq | QoQ Profits | Quarter-over-Quarter % |
| pat_growth_yoy | YOY Quarterly profit growth | Year-over-Year % |

### Table 4: trading_data
| Database Column | CSV Column | Notes |
|----------------|------------|-------|
| ticker | NSE Code | Foreign key |
| date | - | Current date or last trading day |
| close_price | Current Price | Latest price |
| return_3m | Return over 3months | Percentage |
| return_6m | Return over 6months | Percentage |
| return_1y | Return over 1year | Percentage |
| return_3y | Return over 3years | Percentage |
| return_5y | Return over 5years | Percentage |
| high_52w_potential | Possible growth if touches 52 week high | Percentage |

### Table 5: cash_flow
| Database Column | CSV Column | Notes |
|----------------|------------|-------|
| ticker | NSE Code | Foreign key |
| quarter | - | Latest fiscal year |
| fiscal_year | - | From Last result date |
| operating_cash_flow | Cash from operations last year | In Crores |
| net_cash_flow | Net cash flow last year | In Crores |
| free_cash_flow | - | Calculate: Operating CF - CapEx |

### Table 6: financial_ratios
| Database Column | CSV Column | Notes |
|----------------|------------|-------|
| ticker | NSE Code | Foreign key |
| quarter | - | Latest quarter |
| fiscal_year | - | Current fiscal year |
| roe | Return on equity | Percentage |
| roe_3y_avg | Average return on equity 3Years | Percentage |
| roe_5y_avg | Average return on equity 5Years | Percentage |
| debt_to_equity | Debt to equity | Ratio |
| price_to_sales | Price to Sales | Ratio |
| price_to_book | Price to book value | Ratio |
| pe_ratio | Price to Earning | Ratio |
| peg_ratio | PEG Ratio | Ratio |
| dividend_yield | Dividend yield | Percentage |
| ev_ebitda | EVEBITDA | Ratio |
| profit_margin | NPM last year | Net Profit Margin % |
| operating_margin | OPM | Operating Profit Margin % |
| piotroski_score | Piotroski score | Score 0-9 |
| graham_price_ratio | wrt Graham Price | Percentage |

### Table 7: shareholding_pattern
| Database Column | CSV Column | Notes |
|----------------|------------|-------|
| ticker | NSE Code | Foreign key |
| quarter | - | Latest quarter |
| promoter_holding | Promoter holding | Percentage |
| fii_holding | FII holding | Percentage |
| dii_holding | DII holding | Percentage |
| public_holding | Public holding | Percentage |

### Table 8: growth_metrics
| Database Column | CSV Column | Notes |
|----------------|------------|-------|
| ticker | NSE Code | Foreign key |
| profit_growth_1y | Profit growth | Percentage |
| profit_growth_3y | Profit growth 3Years | Percentage |
| profit_growth_5y | Profit growth 5Years | Percentage |
| sales_growth_1y | Sales growth | Percentage |
| sales_growth_3y | Sales growth 3Years | Percentage |
| sales_growth_5y | Sales growth 5Years | Percentage |

## Data Import Process

### Step 1: Parse CSV
```javascript
// Read CSV file
// Parse each row
// Validate data types
// Handle missing values (empty strings, null)
```

### Step 2: Data Transformation
```javascript
// Convert date format: 202603 → 2026-03-31
// Convert percentages: Remove % sign, parse as float
// Convert numbers: Remove commas, parse as float
// Handle negative values
// Calculate derived fields
```

### Step 3: Database Population
```javascript
// Insert into stocks table (master data)
// Insert into quarterly_results
// Insert into trading_data
// Insert into cash_flow
// Insert into financial_ratios
// Insert into shareholding_pattern
// Insert into growth_metrics
```

## Data Validation Rules

### Required Fields
- NSE Code (must not be empty)
- Name (must not be empty)
- Market Capitalization (must be > 0)
- Current Price (must be > 0)

### Optional Fields
- Any field can be null/empty except required fields
- Percentages can be negative (for losses)
- Ratios should be >= 0

### Data Type Conversions
```javascript
// Date: "202603" → "2026-03-31" (last day of quarter)
// Number: "45179.97" → 45179.97
// Percentage: "14.39" → 14.39
// Empty: "" → null
```

## Quarter Calculation Logic

```javascript
function parseQuarterFromDate(dateStr) {
  // Input: "202603" (YYYYMM format)
  // Output: { quarter: "Q4", fiscalYear: 2026, quarterEndDate: "2026-03-31" }
  
  const year = parseInt(dateStr.substring(0, 4));
  const month = parseInt(dateStr.substring(4, 6));
  
  let quarter, quarterEndDate;
  
  if (month === 3) {
    quarter = "Q4";
    quarterEndDate = `${year}-03-31`;
  } else if (month === 6) {
    quarter = "Q1";
    quarterEndDate = `${year}-06-30`;
  } else if (month === 9) {
    quarter = "Q2";
    quarterEndDate = `${year}-09-30`;
  } else if (month === 12) {
    quarter = "Q3";
    quarterEndDate = `${year}-12-31`;
  }
  
  return { quarter, fiscalYear: year, quarterEndDate };
}
```

## NSE Rank Calculation

```javascript
// Sort all stocks by Market Capitalization (descending)
// Assign rank 1 to highest market cap
// Filter top 500 stocks
// Store rank in stocks table
```

## Sample Data Extraction

From your CSV, here's an example mapping for "360 ONE":

```javascript
{
  // stocks table
  ticker: "360ONE",
  company_name: "360 ONE",
  bse_code: "542772",
  isin_code: "INE466L01038",
  sector: "Capital Markets",
  industry: "Stockbroking & Allied",
  market_cap: 45179.97,
  current_price: 1112.00,
  
  // quarterly_results
  quarter: "Q3",
  fiscal_year: 2026,
  quarter_end_date: "2026-03-31",
  revenue: 15931.31,
  operating_profit: 4361.62,
  profit_after_tax: 1216.17,
  
  // financial_ratios
  roe: 14.39,
  roe_3y_avg: 18.25,
  roe_5y_avg: 18.86,
  debt_to_equity: 1.64,
  pe_ratio: 173.80,
  
  // cash_flow
  operating_cash_flow: -2921.05,
  net_cash_flow: -177.32,
  
  // trading_data
  return_3m: 0.62,
  return_6m: -2.83,
  return_1y: 9.41,
  return_3y: 39.93,
  return_5y: 31.71
}
```

## Upload Folder Structure

```
financial-monitor/
├── uploads/
│   ├── screener/           # Screener.in CSV files
│   │   ├── current/        # Latest uploads
│   │   └── archive/        # Historical uploads
│   ├── manual/             # Manual CSV uploads
│   └── temp/               # Temporary processing
```

## CSV Upload API Endpoint

```javascript
POST /api/upload/screener-csv

Request:
- Content-Type: multipart/form-data
- File: screener.csv

Response:
{
  "success": true,
  "recordsProcessed": 500,
  "recordsInserted": 450,
  "recordsUpdated": 50,
  "errors": [],
  "summary": {
    "stocks": 500,
    "newStocks": 10,
    "updatedStocks": 490
  }
}
```

## Error Handling

### Common Issues
1. **Missing NSE Code**: Skip row, log error
2. **Invalid date format**: Use current date as fallback
3. **Non-numeric values**: Convert to null
4. **Duplicate entries**: Update existing record
5. **Missing required fields**: Skip row, log error

### Error Log Format
```json
{
  "row": 15,
  "ticker": "EXAMPLE",
  "error": "Invalid market cap value",
  "value": "N/A",
  "action": "Skipped"
}
```

## Performance Optimization

### Batch Processing
- Process CSV in chunks of 100 rows
- Use database transactions
- Commit after each chunk
- Rollback on error

### Indexing
```sql
CREATE INDEX idx_ticker ON stocks(ticker);
CREATE INDEX idx_sector ON stocks(sector);
CREATE INDEX idx_market_cap ON stocks(market_cap DESC);
CREATE INDEX idx_quarter_date ON quarterly_results(quarter_end_date DESC);
```

## Data Refresh Strategy

### Full Refresh
- Upload new Screener.in CSV
- Replace all data
- Maintain historical records in archive

### Incremental Update
- Compare with existing data
- Update only changed records
- Preserve historical quarterly data

## Next Steps

1. Create database schema with all mapped tables
2. Implement CSV parser for Screener.in format
3. Build data transformation layer
4. Create upload API endpoint
5. Implement validation and error handling
6. Test with your sample CSV file