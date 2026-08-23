const db = require('../config/database');
const { parseScreenerCSV } = require('./csvParser');

/**
 * Import stock data into database
 * @param {Array} stocks - Array of stock objects
 * @returns {Promise<Object>} Import result
 */
const importStocks = async (stocks) => {
    const sql = `
        INSERT OR REPLACE INTO stocks (
            ticker, company_name, bse_code, isin_code, sector, industry,
            market_cap, current_price, nse_rank
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    let inserted = 0;
    let updated = 0;

    await db.transaction(async () => {
        for (const stock of stocks) {
            const params = [
                stock.ticker, stock.company_name, stock.bse_code, stock.isin_code,
                stock.sector, stock.industry, stock.market_cap, stock.current_price, stock.nse_rank
            ];
            const result = await db.execute(sql, params);
            if (result.changes > 0) {
                inserted++;
            } else {
                updated++;
            }
        }
    });

    return { inserted, updated };
};

/**
 * Import quarterly results into database
 * @param {Array} results - Array of quarterly result objects
 * @returns {Promise<Object>} Import result
 */
const importQuarterlyResults = async (results) => {
    const sql = `
        INSERT OR REPLACE INTO quarterly_results (
            stock_id, quarter, fiscal_year, quarter_end_date,
            revenue, operating_profit, profit_after_tax, eps,
            revenue_growth_yoy, operating_profit_growth_yoy, pat_growth_yoy,
            opm, npm
        )
        SELECT 
            s.stock_id, ?, ?, ?,
            ?, ?, ?, ?,
            ?, ?, ?,
            ?, ?
        FROM stocks s
        WHERE s.ticker = ?
    `;

    let inserted = 0;

    await db.transaction(async () => {
        for (const item of results) {
            const params = [
                item.quarter, item.fiscal_year, item.quarter_end_date,
                item.revenue, item.operating_profit, item.profit_after_tax, item.eps,
                item.revenue_growth_yoy, item.operating_profit_growth_yoy, item.pat_growth_yoy,
                item.opm, item.npm,
                item.ticker
            ];
            const result = await db.execute(sql, params);
            if (result.changes > 0) inserted++;
        }
    });

    return { inserted };
};

/**
 * Import latest quarterly results into database
 * @param {Array} results - Array of latest quarterly result objects
 * @returns {Promise<Object>} Import result
 */
const importQuarterlyResultsLatest = async (results) => {
    const sql = `
        INSERT OR REPLACE INTO quarterly_results_latest (
            stock_id, quarter, fiscal_year, quarter_end_date,
            revenue, operating_profit, profit_after_tax,
            opm, npm, revenue_growth_qoq, revenue_growth_yoy,
            pat_growth_qoq, pat_growth_yoy
        )
        SELECT 
            s.stock_id, ?, ?, ?,
            ?, ?, ?,
            ?, ?, ?, ?,
            ?, ?
        FROM stocks s
        WHERE s.ticker = ?
    `;

    let inserted = 0;

    await db.transaction(async () => {
        for (const item of results) {
            const params = [
                item.quarter, item.fiscal_year, item.quarter_end_date,
                item.revenue, item.operating_profit, item.profit_after_tax,
                item.opm, item.npm, item.revenue_growth_qoq, item.revenue_growth_yoy,
                item.pat_growth_qoq, item.pat_growth_yoy,
                item.ticker
            ];
            const result = await db.execute(sql, params);
            if (result.changes > 0) inserted++;
        }
    });

    return { inserted };
};

/**
 * Import trading data into database
 * @param {Array} tradingData - Array of trading data objects
 * @returns {Promise<Object>} Import result
 */
const importTradingData = async (tradingData) => {
    const sql = `
        INSERT OR REPLACE INTO trading_data (
            stock_id, date, close_price,
            return_3m, return_6m, return_1y, return_3y, return_5y,
            high_52w_potential
        )
        SELECT 
            s.stock_id, ?, ?,
            ?, ?, ?, ?, ?,
            ?
        FROM stocks s
        WHERE s.ticker = ?
    `;

    let inserted = 0;

    await db.transaction(async () => {
        for (const item of tradingData) {
            const params = [
                item.date, item.close_price,
                item.return_3m, item.return_6m, item.return_1y, item.return_3y, item.return_5y,
                item.high_52w_potential,
                item.ticker
            ];
            const result = await db.execute(sql, params);
            if (result.changes > 0) inserted++;
        }
    });

    return { inserted };
};

/**
 * Import cash flow data into database
 * @param {Array} cashFlowData - Array of cash flow objects
 * @returns {Promise<Object>} Import result
 */
const importCashFlow = async (cashFlowData) => {
    const sql = `
        INSERT OR REPLACE INTO cash_flow (
            stock_id, quarter, fiscal_year,
            operating_cash_flow, investing_cash_flow, financing_cash_flow, free_cash_flow
        )
        SELECT 
            s.stock_id, ?, ?,
            ?, ?, ?, ?
        FROM stocks s
        WHERE s.ticker = ?
    `;

    let inserted = 0;

    await db.transaction(async () => {
        for (const item of cashFlowData) {
            const params = [
                item.quarter, item.fiscal_year,
                item.operating_cash_flow, item.investing_cash_flow, item.financing_cash_flow, item.free_cash_flow,
                item.ticker
            ];
            const result = await db.execute(sql, params);
            if (result.changes > 0) inserted++;
        }
    });

    return { inserted };
};

/**
 * Import financial ratios into database
 * @param {Array} ratios - Array of financial ratio objects
 * @returns {Promise<Object>} Import result
 */
const importFinancialRatios = async (ratios) => {
    const sql = `
        INSERT OR REPLACE INTO financial_ratios (
            stock_id, quarter, fiscal_year,
            roe, roe_3y_avg, roe_5y_avg, roa, debt_to_equity,
            price_to_sales, price_to_book, pe_ratio, peg_ratio,
            dividend_yield, ev_ebitda, current_ratio, quick_ratio,
            profit_margin, operating_margin, piotroski_score, graham_price_ratio
        )
        SELECT 
            s.stock_id, ?, ?,
            ?, ?, ?, ?, ?,
            ?, ?, ?, ?,
            ?, ?, ?, ?,
            ?, ?, ?, ?
        FROM stocks s
        WHERE s.ticker = ?
    `;

    let inserted = 0;

    await db.transaction(async () => {
        for (const item of ratios) {
            const params = [
                item.quarter, item.fiscal_year,
                item.roe, item.roe_3y_avg, item.roe_5y_avg, item.roa, item.debt_to_equity,
                item.price_to_sales, item.price_to_book, item.pe_ratio, item.peg_ratio,
                item.dividend_yield, item.ev_ebitda, item.current_ratio, item.quick_ratio,
                item.profit_margin, item.operating_margin, item.piotroski_score, item.graham_price_ratio,
                item.ticker
            ];
            const result = await db.execute(sql, params);
            if (result.changes > 0) inserted++;
        }
    });

    return { inserted };
};

/**
 * Import shareholding pattern into database
 * @param {Array} shareholding - Array of shareholding objects
 * @returns {Promise<Object>} Import result
 */
const importShareholdingPattern = async (shareholding) => {
    const sql = `
        INSERT OR REPLACE INTO shareholding_pattern (
            stock_id, quarter, fiscal_year,
            promoter_holding, fii_holding, dii_holding, public_holding
        )
        SELECT 
            s.stock_id, ?, ?,
            ?, ?, ?, ?
        FROM stocks s
        WHERE s.ticker = ?
    `;

    let inserted = 0;

    await db.transaction(async () => {
        for (const item of shareholding) {
            const params = [
                item.quarter, item.fiscal_year,
                item.promoter_holding, item.fii_holding, item.dii_holding, item.public_holding,
                item.ticker
            ];
            const result = await db.execute(sql, params);
            if (result.changes > 0) inserted++;
        }
    });

    return { inserted };
};

/**
 * Import growth metrics into database
 * @param {Array} metrics - Array of growth metric objects
 * @returns {Promise<Object>} Import result
 */
const importGrowthMetrics = async (metrics) => {
    const sql = `
        INSERT OR REPLACE INTO growth_metrics (
            stock_id, profit_growth_1y, profit_growth_3y, profit_growth_5y,
            sales_growth_1y, sales_growth_3y, sales_growth_5y
        )
        SELECT 
            s.stock_id, ?, ?, ?,
            ?, ?, ?
        FROM stocks s
        WHERE s.ticker = ?
    `;

    let inserted = 0;

    await db.transaction(async () => {
        for (const item of metrics) {
            const params = [
                item.profit_growth_1y, item.profit_growth_3y, item.profit_growth_5y,
                item.sales_growth_1y, item.sales_growth_3y, item.sales_growth_5y,
                item.ticker
            ];
            const result = await db.execute(sql, params);
            if (result.changes > 0) inserted++;
        }
    });

    return { inserted };
};

/**
 * Import complete dataset from CSV file
 * @param {string} filePath - Path to CSV file
 * @returns {Promise<Object>} Import result with statistics
 */
const importFromCSV = async (filePath) => {
    try {
        console.log('📊 Parsing CSV file...');
        const parsedData = await parseScreenerCSV(filePath);

        console.log(`✅ Parsed ${parsedData.stocks.length} stocks`);

        const results = {
            stocks: { inserted: 0, updated: 0 },
            quarterlyResults: { inserted: 0 },
            quarterlyResultsLatest: { inserted: 0 },
            tradingData: { inserted: 0 },
            cashFlow: { inserted: 0 },
            financialRatios: { inserted: 0 },
            shareholdingPattern: { inserted: 0 },
            growthMetrics: { inserted: 0 },
            errors: parsedData.errors
        };

        // Import in order (stocks first, then related data)
        console.log('💾 Importing stocks...');
        results.stocks = await importStocks(parsedData.stocks);
        console.log(`✅ Stocks: ${results.stocks.inserted} inserted, ${results.stocks.updated} updated`);

        console.log('💾 Importing quarterly results...');
        results.quarterlyResults = await importQuarterlyResults(parsedData.quarterlyResults);
        console.log(`✅ Quarterly results: ${results.quarterlyResults.inserted} inserted`);

        console.log('💾 Importing latest quarterly results...');
        results.quarterlyResultsLatest = await importQuarterlyResultsLatest(parsedData.quarterlyResultsLatest);
        console.log(`✅ Latest quarterly results: ${results.quarterlyResultsLatest.inserted} inserted`);

        console.log('💾 Importing trading data...');
        results.tradingData = await importTradingData(parsedData.tradingData);
        console.log(`✅ Trading data: ${results.tradingData.inserted} inserted`);

        console.log('💾 Importing cash flow...');
        results.cashFlow = await importCashFlow(parsedData.cashFlow);
        console.log(`✅ Cash flow: ${results.cashFlow.inserted} inserted`);

        console.log('💾 Importing financial ratios...');
        results.financialRatios = await importFinancialRatios(parsedData.financialRatios);
        console.log(`✅ Financial ratios: ${results.financialRatios.inserted} inserted`);

        console.log('💾 Importing shareholding pattern...');
        results.shareholdingPattern = await importShareholdingPattern(parsedData.shareholdingPattern);
        console.log(`✅ Shareholding pattern: ${results.shareholdingPattern.inserted} inserted`);

        console.log('💾 Importing growth metrics...');
        results.growthMetrics = await importGrowthMetrics(parsedData.growthMetrics);
        console.log(`✅ Growth metrics: ${results.growthMetrics.inserted} inserted`);

        console.log('\n✅ Import completed successfully!');

        return {
            success: true,
            results,
            summary: {
                totalStocks: results.stocks.inserted + results.stocks.updated,
                newStocks: results.stocks.inserted,
                updatedStocks: results.stocks.updated,
                errors: results.errors.length
            }
        };
    } catch (error) {
        console.error('❌ Import error:', error.message);
        throw error;
    }
};

module.exports = {
    importStocks,
    importQuarterlyResults,
    importQuarterlyResultsLatest,
    importTradingData,
    importCashFlow,
    importFinancialRatios,
    importShareholdingPattern,
    importGrowthMetrics,
    importFromCSV
};

// Made with Bob
