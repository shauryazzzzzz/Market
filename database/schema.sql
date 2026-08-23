-- Comprehensive Global Stock Market Database Schema
-- Top Level Organization: Geography (Country-based)
-- Data Sources:
-- - Daily Trading: NSE India / Google Finance / Yahoo Finance
-- - Quarterly/Annual Results: Screener.in / SEC / Local exchanges
-- - IPO Data: NSE India / SEC / Local exchanges
-- - Fundamental & Technical Analysis: Multiple sources

-- ============================================
-- GEOGRAPHY & MARKET STRUCTURE
-- ============================================

CREATE TABLE IF NOT EXISTS countries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    country_code TEXT NOT NULL UNIQUE, -- 'US', 'IN', 'CN', 'JP', 'BR', 'TW', 'KR', 'DE'
    country_name TEXT NOT NULL,
    region TEXT, -- 'North America', 'Asia', 'Europe', 'South America'
    currency_code TEXT, -- 'USD', 'INR', 'CNY', 'JPY', 'BRL', 'TWD', 'KRW', 'EUR'
    currency_symbol TEXT,
    timezone TEXT,
    market_open_time TEXT,
    market_close_time TEXT,
    is_active BOOLEAN DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS exchanges (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    country_id INTEGER NOT NULL,
    exchange_code TEXT NOT NULL UNIQUE, -- 'NSE', 'BSE', 'NYSE', 'NASDAQ', 'SSE', 'TSE'
    exchange_name TEXT NOT NULL,
    website_url TEXT,
    data_source_url TEXT,
    is_active BOOLEAN DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (country_id) REFERENCES countries(id)
);

CREATE TABLE IF NOT EXISTS market_indices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    country_id INTEGER NOT NULL,
    index_code TEXT NOT NULL UNIQUE, -- 'NIFTY50', 'SENSEX', 'SPX', 'DJI', 'SSE', 'N225'
    index_name TEXT NOT NULL,
    description TEXT,
    base_value REAL,
    base_date DATE,
    is_active BOOLEAN DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (country_id) REFERENCES countries(id)
);

-- ============================================
-- ASSET CLASSES (Level 2 Organization)
-- ============================================

CREATE TABLE IF NOT EXISTS asset_classes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    asset_code TEXT NOT NULL UNIQUE, -- 'EQUITY', 'DEBT', 'GOLD', 'GOVT_BOND', 'PRIVATE_BOND', 'REAL_ESTATE', 'INVIT', 'MF', 'ETF'
    asset_name TEXT NOT NULL,
    description TEXT,
    icon_name TEXT,
    display_order INTEGER,
    is_active BOOLEAN DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS asset_sub_categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    asset_class_id INTEGER NOT NULL,
    sub_category_code TEXT NOT NULL,
    sub_category_name TEXT NOT NULL,
    description TEXT,
    FOREIGN KEY (asset_class_id) REFERENCES asset_classes(id),
    UNIQUE(asset_class_id, sub_category_code)
);

-- ============================================
-- IPO CALENDAR TABLES (Country & Asset Class specific)
-- ============================================

CREATE TABLE IF NOT EXISTS ipo_calendar (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    country_id INTEGER NOT NULL,
    asset_class_id INTEGER NOT NULL,
    exchange_id INTEGER,
    company_name TEXT NOT NULL,
    symbol TEXT,
    issue_type TEXT, -- 'Mainboard', 'SME', 'Debt', 'REIT', 'InvIT'
    issue_size REAL, -- in local currency
    issue_size_usd REAL, -- converted to USD for comparison
    price_band_min REAL,
    price_band_max REAL,
    open_date DATE,
    close_date DATE,
    allotment_date DATE,
    listing_date DATE,
    lot_size INTEGER,
    issue_price REAL,
    listing_price REAL,
    listing_gain_percent REAL,
    subscription_times REAL,
    status TEXT, -- 'Upcoming', 'Open', 'Closed', 'Listed'
    lead_managers TEXT,
    registrar TEXT,
    prospectus_url TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (country_id) REFERENCES countries(id),
    FOREIGN KEY (asset_class_id) REFERENCES asset_classes(id),
    FOREIGN KEY (exchange_id) REFERENCES exchanges(id)
);

CREATE TABLE IF NOT EXISTS ipo_subscription_data (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ipo_id INTEGER NOT NULL,
    category TEXT NOT NULL, -- 'QIB', 'NII', 'Retail', 'Employee'
    subscription_times REAL,
    applications INTEGER,
    shares_offered INTEGER,
    shares_bid INTEGER,
    fetch_date DATE,
    FOREIGN KEY (ipo_id) REFERENCES ipo_calendar(id)
);

CREATE TABLE IF NOT EXISTS ipo_grey_market (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ipo_id INTEGER NOT NULL,
    grey_market_premium REAL,
    expected_listing_price REAL,
    kostak_rate REAL,
    subject_to_sauda TEXT,
    fetch_date DATE,
    FOREIGN KEY (ipo_id) REFERENCES ipo_calendar(id)
);

CREATE TABLE IF NOT EXISTS data_fetch_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source TEXT NOT NULL, -- 'NSE', 'BSE', 'Manual'
    fetch_type TEXT NOT NULL, -- 'IPO_List', 'Subscription', 'Grey_Market'
    status TEXT NOT NULL, -- 'Success', 'Failed', 'Partial'
    records_fetched INTEGER,
    error_message TEXT,
    fetch_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_ipo_status ON ipo_calendar(status);
CREATE INDEX IF NOT EXISTS idx_ipo_dates ON ipo_calendar(open_date, close_date, listing_date);
CREATE INDEX IF NOT EXISTS idx_ipo_symbol ON ipo_calendar(symbol);
CREATE INDEX IF NOT EXISTS idx_subscription_ipo ON ipo_subscription_data(ipo_id);
CREATE INDEX IF NOT EXISTS idx_grey_market_ipo ON ipo_grey_market(ipo_id);

-- Trigger to update updated_at timestamp
CREATE TRIGGER IF NOT EXISTS update_ipo_timestamp
AFTER UPDATE ON ipo_calendar
BEGIN
    UPDATE ipo_calendar SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- ============================================
-- STOCK MASTER DATA
-- ============================================

CREATE TABLE IF NOT EXISTS stocks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    country_id INTEGER NOT NULL,
    asset_class_id INTEGER NOT NULL,
    exchange_id INTEGER NOT NULL,
    symbol TEXT NOT NULL,
    company_name TEXT NOT NULL,
    isin TEXT,
    industry TEXT,
    sector TEXT,
    sub_sector TEXT,
    market_cap REAL, -- in local currency
    market_cap_usd REAL, -- converted to USD
    series TEXT, -- 'EQ', 'BE', etc. (India specific)
    face_value REAL,
    is_active BOOLEAN DEFAULT 1,
    listing_date DATE,
    website_url TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (country_id) REFERENCES countries(id),
    FOREIGN KEY (asset_class_id) REFERENCES asset_classes(id),
    FOREIGN KEY (exchange_id) REFERENCES exchanges(id),
    UNIQUE(exchange_id, symbol)
);

-- ============================================
-- DAILY TRADING DATA (NSE/Google Finance)
-- ============================================

CREATE TABLE IF NOT EXISTS daily_prices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    stock_id INTEGER NOT NULL,
    trade_date DATE NOT NULL,
    open_price REAL,
    high_price REAL,
    low_price REAL,
    close_price REAL,
    prev_close REAL,
    volume INTEGER,
    turnover REAL,
    trades INTEGER,
    deliverable_qty INTEGER,
    deliverable_percent REAL,
    change_percent REAL,
    vwap REAL, -- Volume Weighted Average Price
    data_source TEXT, -- 'NSE', 'Google Finance'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (stock_id) REFERENCES stocks(id),
    UNIQUE(stock_id, trade_date)
);

CREATE TABLE IF NOT EXISTS intraday_data (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    stock_id INTEGER NOT NULL,
    timestamp TIMESTAMP NOT NULL,
    price REAL,
    volume INTEGER,
    bid_price REAL,
    ask_price REAL,
    bid_qty INTEGER,
    ask_qty INTEGER,
    FOREIGN KEY (stock_id) REFERENCES stocks(id)
);

-- ============================================
-- FUNDAMENTAL ANALYSIS (Screener.in)
-- ============================================

CREATE TABLE IF NOT EXISTS quarterly_results (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    stock_id INTEGER NOT NULL,
    quarter TEXT NOT NULL, -- 'Q1', 'Q2', 'Q3', 'Q4'
    fiscal_year INTEGER NOT NULL,
    quarter_end_date DATE,
    
    -- Income Statement
    revenue REAL,
    operating_profit REAL,
    opm_percent REAL, -- Operating Profit Margin
    other_income REAL,
    interest REAL,
    depreciation REAL,
    profit_before_tax REAL,
    tax_percent REAL,
    net_profit REAL,
    eps REAL, -- Earnings Per Share
    
    -- Additional Metrics
    sales_growth_yoy REAL,
    profit_growth_yoy REAL,
    sales_growth_qoq REAL,
    profit_growth_qoq REAL,
    
    data_source TEXT DEFAULT 'Screener.in',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (stock_id) REFERENCES stocks(id),
    UNIQUE(stock_id, quarter, fiscal_year)
);

CREATE TABLE IF NOT EXISTS annual_results (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    stock_id INTEGER NOT NULL,
    fiscal_year INTEGER NOT NULL,
    year_end_date DATE,
    
    -- Income Statement
    revenue REAL,
    operating_profit REAL,
    opm_percent REAL,
    other_income REAL,
    interest REAL,
    depreciation REAL,
    profit_before_tax REAL,
    tax_percent REAL,
    net_profit REAL,
    eps REAL,
    dividend_percent REAL,
    
    -- Balance Sheet
    equity_capital REAL,
    reserves REAL,
    borrowings REAL,
    other_liabilities REAL,
    total_liabilities REAL,
    fixed_assets REAL,
    investments REAL,
    other_assets REAL,
    total_assets REAL,
    
    -- Cash Flow
    cash_from_operating REAL,
    cash_from_investing REAL,
    cash_from_financing REAL,
    net_cash_flow REAL,
    
    -- Growth Metrics
    sales_growth REAL,
    profit_growth REAL,
    
    data_source TEXT DEFAULT 'Screener.in',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (stock_id) REFERENCES stocks(id),
    UNIQUE(stock_id, fiscal_year)
);

CREATE TABLE IF NOT EXISTS fundamental_ratios (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    stock_id INTEGER NOT NULL,
    as_of_date DATE NOT NULL,
    
    -- Valuation Ratios
    pe_ratio REAL, -- Price to Earnings
    pb_ratio REAL, -- Price to Book
    ps_ratio REAL, -- Price to Sales
    pcf_ratio REAL, -- Price to Cash Flow
    dividend_yield REAL,
    market_cap REAL,
    enterprise_value REAL,
    ev_ebitda REAL,
    
    -- Profitability Ratios
    roe REAL, -- Return on Equity
    roa REAL, -- Return on Assets
    roce REAL, -- Return on Capital Employed
    net_profit_margin REAL,
    operating_margin REAL,
    gross_margin REAL,
    
    -- Liquidity Ratios
    current_ratio REAL,
    quick_ratio REAL,
    cash_ratio REAL,
    
    -- Leverage Ratios
    debt_to_equity REAL,
    debt_to_assets REAL,
    interest_coverage REAL,
    
    -- Efficiency Ratios
    asset_turnover REAL,
    inventory_turnover REAL,
    receivables_turnover REAL,
    
    -- Per Share Data
    book_value_per_share REAL,
    sales_per_share REAL,
    cash_per_share REAL,
    
    data_source TEXT DEFAULT 'Screener.in',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (stock_id) REFERENCES stocks(id),
    UNIQUE(stock_id, as_of_date)
);

CREATE TABLE IF NOT EXISTS shareholding_pattern (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    stock_id INTEGER NOT NULL,
    quarter TEXT NOT NULL,
    fiscal_year INTEGER NOT NULL,
    
    promoter_holding REAL,
    fii_holding REAL, -- Foreign Institutional Investors
    dii_holding REAL, -- Domestic Institutional Investors
    public_holding REAL,
    promoter_pledged REAL,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (stock_id) REFERENCES stocks(id),
    UNIQUE(stock_id, quarter, fiscal_year)
);

-- ============================================
-- TECHNICAL ANALYSIS
-- ============================================

CREATE TABLE IF NOT EXISTS technical_indicators (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    stock_id INTEGER NOT NULL,
    calculation_date DATE NOT NULL,
    
    -- Moving Averages
    sma_20 REAL, -- Simple Moving Average 20 days
    sma_50 REAL,
    sma_100 REAL,
    sma_200 REAL,
    ema_12 REAL, -- Exponential Moving Average
    ema_26 REAL,
    
    -- Momentum Indicators
    rsi_14 REAL, -- Relative Strength Index
    macd REAL, -- Moving Average Convergence Divergence
    macd_signal REAL,
    macd_histogram REAL,
    stochastic_k REAL,
    stochastic_d REAL,
    
    -- Volatility Indicators
    bollinger_upper REAL,
    bollinger_middle REAL,
    bollinger_lower REAL,
    atr_14 REAL, -- Average True Range
    
    -- Volume Indicators
    obv REAL, -- On Balance Volume
    volume_sma_20 REAL,
    
    -- Trend Indicators
    adx_14 REAL, -- Average Directional Index
    cci_20 REAL, -- Commodity Channel Index
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (stock_id) REFERENCES stocks(id),
    UNIQUE(stock_id, calculation_date)
);

CREATE TABLE IF NOT EXISTS support_resistance (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    stock_id INTEGER NOT NULL,
    calculation_date DATE NOT NULL,
    
    resistance_3 REAL,
    resistance_2 REAL,
    resistance_1 REAL,
    pivot_point REAL,
    support_1 REAL,
    support_2 REAL,
    support_3 REAL,
    
    method TEXT, -- 'Classic', 'Fibonacci', 'Camarilla', 'Woodie'
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (stock_id) REFERENCES stocks(id)
);

CREATE TABLE IF NOT EXISTS chart_patterns (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    stock_id INTEGER NOT NULL,
    detected_date DATE NOT NULL,
    
    pattern_type TEXT, -- 'Head and Shoulders', 'Double Top', 'Triangle', etc.
    pattern_status TEXT, -- 'Forming', 'Confirmed', 'Broken'
    timeframe TEXT, -- 'Daily', 'Weekly', 'Monthly'
    confidence_score REAL, -- 0-100
    
    entry_price REAL,
    target_price REAL,
    stop_loss REAL,
    
    description TEXT,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (stock_id) REFERENCES stocks(id)
);

-- ============================================
-- CORPORATE ACTIONS
-- ============================================

CREATE TABLE IF NOT EXISTS corporate_actions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    stock_id INTEGER NOT NULL,
    action_type TEXT NOT NULL, -- 'Dividend', 'Bonus', 'Split', 'Rights', 'Buyback'
    ex_date DATE,
    record_date DATE,
    announcement_date DATE,
    
    -- Dividend specific
    dividend_amount REAL,
    dividend_type TEXT, -- 'Interim', 'Final', 'Special'
    
    -- Bonus/Split specific
    ratio_from INTEGER,
    ratio_to INTEGER,
    
    -- Rights specific
    rights_price REAL,
    
    status TEXT, -- 'Announced', 'Completed'
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (stock_id) REFERENCES stocks(id)
);

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================

CREATE INDEX IF NOT EXISTS idx_stocks_symbol ON stocks(symbol);
CREATE INDEX IF NOT EXISTS idx_stocks_sector ON stocks(sector);
CREATE INDEX IF NOT EXISTS idx_daily_prices_stock_date ON daily_prices(stock_id, trade_date);
CREATE INDEX IF NOT EXISTS idx_daily_prices_date ON daily_prices(trade_date);
CREATE INDEX IF NOT EXISTS idx_quarterly_stock_year ON quarterly_results(stock_id, fiscal_year);
CREATE INDEX IF NOT EXISTS idx_annual_stock_year ON annual_results(stock_id, fiscal_year);
CREATE INDEX IF NOT EXISTS idx_fundamental_stock_date ON fundamental_ratios(stock_id, as_of_date);
CREATE INDEX IF NOT EXISTS idx_technical_stock_date ON technical_indicators(stock_id, calculation_date);
CREATE INDEX IF NOT EXISTS idx_corporate_stock_date ON corporate_actions(stock_id, ex_date);

-- ============================================
-- TRIGGERS
-- ============================================

CREATE TRIGGER IF NOT EXISTS update_stock_timestamp
AFTER UPDATE ON stocks
BEGIN
    UPDATE stocks SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS update_quarterly_timestamp
AFTER UPDATE ON quarterly_results
BEGIN
    UPDATE quarterly_results SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS update_annual_timestamp
AFTER UPDATE ON annual_results
BEGIN
    UPDATE annual_results SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- Made with Bob
