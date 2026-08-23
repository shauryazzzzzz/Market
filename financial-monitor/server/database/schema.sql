-- Financial Monitor Database Schema
-- SQLite Database for NSE 500 Stocks

-- Drop tables if they exist (for clean initialization)
DROP TABLE IF EXISTS growth_metrics;
DROP TABLE IF EXISTS shareholding_pattern;
DROP TABLE IF EXISTS financial_ratios;
DROP TABLE IF EXISTS cash_flow;
DROP TABLE IF EXISTS trading_data;
DROP TABLE IF EXISTS quarterly_results;
DROP TABLE IF EXISTS stocks;

-- Table 1: stocks (Master stock information)
CREATE TABLE stocks (
    stock_id INTEGER PRIMARY KEY AUTOINCREMENT,
    ticker TEXT NOT NULL UNIQUE,
    company_name TEXT NOT NULL,
    bse_code TEXT,
    isin_code TEXT,
    sector TEXT NOT NULL,
    industry TEXT,
    market_cap REAL,
    current_price REAL,
    nse_rank INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Table 2: quarterly_results (Quarterly financial results)
CREATE TABLE quarterly_results (
    result_id INTEGER PRIMARY KEY AUTOINCREMENT,
    stock_id INTEGER NOT NULL,
    quarter TEXT NOT NULL,
    fiscal_year INTEGER NOT NULL,
    quarter_end_date DATE NOT NULL,
    revenue REAL,
    operating_profit REAL,
    profit_after_tax REAL,
    eps REAL,
    revenue_growth_yoy REAL,
    operating_profit_growth_yoy REAL,
    pat_growth_yoy REAL,
    opm REAL,
    npm REAL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (stock_id) REFERENCES stocks(stock_id) ON DELETE CASCADE,
    UNIQUE(stock_id, quarter, fiscal_year)
);

-- Table 3: quarterly_results_latest (Latest quarter specific data)
CREATE TABLE quarterly_results_latest (
    latest_id INTEGER PRIMARY KEY AUTOINCREMENT,
    stock_id INTEGER NOT NULL,
    quarter TEXT NOT NULL,
    fiscal_year INTEGER NOT NULL,
    quarter_end_date DATE NOT NULL,
    revenue REAL,
    operating_profit REAL,
    profit_after_tax REAL,
    opm REAL,
    npm REAL,
    revenue_growth_qoq REAL,
    revenue_growth_yoy REAL,
    pat_growth_qoq REAL,
    pat_growth_yoy REAL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (stock_id) REFERENCES stocks(stock_id) ON DELETE CASCADE,
    UNIQUE(stock_id)
);

-- Table 4: trading_data (Daily trading statistics)
CREATE TABLE trading_data (
    trading_id INTEGER PRIMARY KEY AUTOINCREMENT,
    stock_id INTEGER NOT NULL,
    date DATE NOT NULL,
    open_price REAL,
    high_price REAL,
    low_price REAL,
    close_price REAL,
    volume INTEGER,
    delivery_volume INTEGER,
    delivery_percentage REAL,
    return_3m REAL,
    return_6m REAL,
    return_1y REAL,
    return_3y REAL,
    return_5y REAL,
    high_52w_potential REAL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (stock_id) REFERENCES stocks(stock_id) ON DELETE CASCADE,
    UNIQUE(stock_id, date)
);

-- Table 5: cash_flow (Cash flow statements)
CREATE TABLE cash_flow (
    cashflow_id INTEGER PRIMARY KEY AUTOINCREMENT,
    stock_id INTEGER NOT NULL,
    quarter TEXT NOT NULL,
    fiscal_year INTEGER NOT NULL,
    operating_cash_flow REAL,
    investing_cash_flow REAL,
    financing_cash_flow REAL,
    free_cash_flow REAL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (stock_id) REFERENCES stocks(stock_id) ON DELETE CASCADE,
    UNIQUE(stock_id, quarter, fiscal_year)
);

-- Table 6: financial_ratios (Financial ratios and metrics)
CREATE TABLE financial_ratios (
    ratio_id INTEGER PRIMARY KEY AUTOINCREMENT,
    stock_id INTEGER NOT NULL,
    quarter TEXT NOT NULL,
    fiscal_year INTEGER NOT NULL,
    roe REAL,
    roe_3y_avg REAL,
    roe_5y_avg REAL,
    roa REAL,
    debt_to_equity REAL,
    price_to_sales REAL,
    price_to_book REAL,
    pe_ratio REAL,
    peg_ratio REAL,
    dividend_yield REAL,
    ev_ebitda REAL,
    current_ratio REAL,
    quick_ratio REAL,
    profit_margin REAL,
    operating_margin REAL,
    piotroski_score INTEGER,
    graham_price_ratio REAL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (stock_id) REFERENCES stocks(stock_id) ON DELETE CASCADE,
    UNIQUE(stock_id, quarter, fiscal_year)
);

-- Table 7: shareholding_pattern (Promoter/FII/DII holdings)
CREATE TABLE shareholding_pattern (
    holding_id INTEGER PRIMARY KEY AUTOINCREMENT,
    stock_id INTEGER NOT NULL,
    quarter TEXT NOT NULL,
    fiscal_year INTEGER NOT NULL,
    promoter_holding REAL,
    fii_holding REAL,
    dii_holding REAL,
    public_holding REAL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (stock_id) REFERENCES stocks(stock_id) ON DELETE CASCADE,
    UNIQUE(stock_id, quarter, fiscal_year)
);

-- Table 8: growth_metrics (Growth rates)
CREATE TABLE growth_metrics (
    metric_id INTEGER PRIMARY KEY AUTOINCREMENT,
    stock_id INTEGER NOT NULL,
    profit_growth_1y REAL,
    profit_growth_3y REAL,
    profit_growth_5y REAL,
    sales_growth_1y REAL,
    sales_growth_3y REAL,
    sales_growth_5y REAL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (stock_id) REFERENCES stocks(stock_id) ON DELETE CASCADE,
    UNIQUE(stock_id)
);

-- Create indexes for better query performance
CREATE INDEX idx_stocks_ticker ON stocks(ticker);
CREATE INDEX idx_stocks_sector ON stocks(sector);
CREATE INDEX idx_stocks_market_cap ON stocks(market_cap DESC);
CREATE INDEX idx_stocks_nse_rank ON stocks(nse_rank);

CREATE INDEX idx_quarterly_results_stock ON quarterly_results(stock_id);
CREATE INDEX idx_quarterly_results_date ON quarterly_results(quarter_end_date DESC);
CREATE INDEX idx_quarterly_results_stock_date ON quarterly_results(stock_id, quarter_end_date DESC);

CREATE INDEX idx_trading_data_stock ON trading_data(stock_id);
CREATE INDEX idx_trading_data_date ON trading_data(date DESC);
CREATE INDEX idx_trading_data_stock_date ON trading_data(stock_id, date DESC);

CREATE INDEX idx_cash_flow_stock ON cash_flow(stock_id);
CREATE INDEX idx_financial_ratios_stock ON financial_ratios(stock_id);
CREATE INDEX idx_shareholding_stock ON shareholding_pattern(stock_id);
CREATE INDEX idx_growth_metrics_stock ON growth_metrics(stock_id);

-- Create trigger to update updated_at timestamp
CREATE TRIGGER update_stocks_timestamp 
AFTER UPDATE ON stocks
FOR EACH ROW
BEGIN
    UPDATE stocks SET updated_at = CURRENT_TIMESTAMP WHERE stock_id = NEW.stock_id;
END;

-- Made with Bob
