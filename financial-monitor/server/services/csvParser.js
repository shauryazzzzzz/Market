const Papa = require('papaparse');
const fs = require('fs');

/**
 * Parse quarter from date string (YYYYMM format)
 * @param {string} dateStr - Date in YYYYMM format (e.g., "202603")
 * @returns {Object} Quarter information
 */
const parseQuarterFromDate = (dateStr) => {
    if (!dateStr || dateStr.length !== 6) {
        return { quarter: null, fiscalYear: null, quarterEndDate: null };
    }

    const year = parseInt(dateStr.substring(0, 4));
    const month = parseInt(dateStr.substring(4, 6));

    let quarter, quarterEndDate;

    if (month === 3) {
        quarter = 'Q4';
        quarterEndDate = `${year}-03-31`;
    } else if (month === 6) {
        quarter = 'Q1';
        quarterEndDate = `${year}-06-30`;
    } else if (month === 9) {
        quarter = 'Q2';
        quarterEndDate = `${year}-09-30`;
    } else if (month === 12) {
        quarter = 'Q3';
        quarterEndDate = `${year}-12-31`;
    } else {
        // Default to end of month
        const lastDay = new Date(year, month, 0).getDate();
        quarter = `Q${Math.ceil(month / 3)}`;
        quarterEndDate = `${year}-${String(month).padStart(2, '0')}-${lastDay}`;
    }

    return { quarter, fiscalYear: year, quarterEndDate };
};

/**
 * Parse numeric value from string
 * @param {string} value - String value
 * @returns {number|null} Parsed number or null
 */
const parseNumber = (value) => {
    if (!value || value === '' || value === 'N/A' || value === '-') {
        return null;
    }
    
    // Remove commas and parse
    const cleaned = String(value).replace(/,/g, '');
    const parsed = parseFloat(cleaned);
    
    return isNaN(parsed) ? null : parsed;
};

/**
 * Parse Screener.in CSV file
 * @param {string} filePath - Path to CSV file
 * @returns {Promise<Object>} Parsed data with stocks, results, ratios, etc.
 */
const parseScreenerCSV = (filePath) => {
    return new Promise((resolve, reject) => {
        const fileContent = fs.readFileSync(filePath, 'utf8');

        Papa.parse(fileContent, {
            header: true,
            skipEmptyLines: true,
            complete: (results) => {
                try {
                    const parsedData = {
                        stocks: [],
                        quarterlyResults: [],
                        quarterlyResultsLatest: [],
                        tradingData: [],
                        cashFlow: [],
                        financialRatios: [],
                        shareholdingPattern: [],
                        growthMetrics: [],
                        errors: []
                    };

                    results.data.forEach((row, index) => {
                        try {
                            // Skip if NSE Code is missing
                            if (!row['NSE Code'] || row['NSE Code'].trim() === '') {
                                parsedData.errors.push({
                                    row: index + 2,
                                    error: 'Missing NSE Code',
                                    action: 'Skipped'
                                });
                                return;
                            }

                            const ticker = row['NSE Code'].trim();
                            const quarterInfo = parseQuarterFromDate(row['Last result date']);

                            // 1. Stock master data
                            parsedData.stocks.push({
                                ticker: ticker,
                                company_name: row['Name'] || '',
                                bse_code: row['BSE Code'] || null,
                                isin_code: row['ISIN Code'] || null,
                                sector: row['Industry Group'] || 'Unknown',
                                industry: row['Industry'] || null,
                                market_cap: parseNumber(row['Market Capitalization']),
                                current_price: parseNumber(row['Current Price']),
                                nse_rank: null // Will be calculated later
                            });

                            // 2. Quarterly results (annual data)
                            if (quarterInfo.quarter) {
                                parsedData.quarterlyResults.push({
                                    ticker: ticker,
                                    quarter: quarterInfo.quarter,
                                    fiscal_year: quarterInfo.fiscalYear,
                                    quarter_end_date: quarterInfo.quarterEndDate,
                                    revenue: parseNumber(row['Sales']),
                                    operating_profit: parseNumber(row['Operating profit']),
                                    profit_after_tax: parseNumber(row['Profit after tax']),
                                    eps: null, // Not directly available
                                    revenue_growth_yoy: parseNumber(row['Sales growth']),
                                    operating_profit_growth_yoy: parseNumber(row['Operating profit growth']),
                                    pat_growth_yoy: parseNumber(row['Profit growth']),
                                    opm: parseNumber(row['OPM']),
                                    npm: parseNumber(row['NPM last year'])
                                });

                                // 3. Latest quarter data
                                parsedData.quarterlyResultsLatest.push({
                                    ticker: ticker,
                                    quarter: quarterInfo.quarter,
                                    fiscal_year: quarterInfo.fiscalYear,
                                    quarter_end_date: quarterInfo.quarterEndDate,
                                    revenue: parseNumber(row['Sales latest quarter']),
                                    operating_profit: parseNumber(row['Operating profit latest quarter']),
                                    profit_after_tax: parseNumber(row['Profit after tax latest quarter']),
                                    opm: parseNumber(row['OPM latest quarter']),
                                    npm: parseNumber(row['NPM latest quarter']),
                                    revenue_growth_qoq: parseNumber(row['QoQ Sales']),
                                    revenue_growth_yoy: parseNumber(row['YOY Quarterly sales growth']),
                                    pat_growth_qoq: parseNumber(row['QoQ Profits']),
                                    pat_growth_yoy: parseNumber(row['YOY Quarterly profit growth'])
                                });
                            }

                            // 4. Trading data
                            parsedData.tradingData.push({
                                ticker: ticker,
                                date: new Date().toISOString().split('T')[0], // Current date
                                close_price: parseNumber(row['Current Price']),
                                return_3m: parseNumber(row['Return over 3months']),
                                return_6m: parseNumber(row['Return over 6months']),
                                return_1y: parseNumber(row['Return over 1year']),
                                return_3y: parseNumber(row['Return over 3years']),
                                return_5y: parseNumber(row['Return over 5years']),
                                high_52w_potential: parseNumber(row['Possible growth if touches 52 week high'])
                            });

                            // 5. Cash flow
                            if (quarterInfo.quarter) {
                                parsedData.cashFlow.push({
                                    ticker: ticker,
                                    quarter: quarterInfo.quarter,
                                    fiscal_year: quarterInfo.fiscalYear,
                                    operating_cash_flow: parseNumber(row['Cash from operations last year']),
                                    investing_cash_flow: null, // Not in CSV
                                    financing_cash_flow: null, // Not in CSV
                                    free_cash_flow: parseNumber(row['Net cash flow last year'])
                                });
                            }

                            // 6. Financial ratios
                            if (quarterInfo.quarter) {
                                parsedData.financialRatios.push({
                                    ticker: ticker,
                                    quarter: quarterInfo.quarter,
                                    fiscal_year: quarterInfo.fiscalYear,
                                    roe: parseNumber(row['Return on equity']),
                                    roe_3y_avg: parseNumber(row['Average return on equity 3Years']),
                                    roe_5y_avg: parseNumber(row['Average return on equity 5Years']),
                                    roa: null, // Not in CSV
                                    debt_to_equity: parseNumber(row['Debt to equity']),
                                    price_to_sales: parseNumber(row['Price to Sales']),
                                    price_to_book: parseNumber(row['Price to book value']),
                                    pe_ratio: parseNumber(row['Price to Earning']),
                                    peg_ratio: parseNumber(row['PEG Ratio']),
                                    dividend_yield: parseNumber(row['Dividend yield']),
                                    ev_ebitda: parseNumber(row['EVEBITDA']),
                                    current_ratio: null, // Not in CSV
                                    quick_ratio: null, // Not in CSV
                                    profit_margin: parseNumber(row['NPM last year']),
                                    operating_margin: parseNumber(row['OPM']),
                                    piotroski_score: parseNumber(row['Piotroski score']),
                                    graham_price_ratio: parseNumber(row['wrt Graham Price'])
                                });
                            }

                            // 7. Shareholding pattern
                            if (quarterInfo.quarter) {
                                parsedData.shareholdingPattern.push({
                                    ticker: ticker,
                                    quarter: quarterInfo.quarter,
                                    fiscal_year: quarterInfo.fiscalYear,
                                    promoter_holding: parseNumber(row['Promoter holding']),
                                    fii_holding: parseNumber(row['FII holding']),
                                    dii_holding: parseNumber(row['DII holding']),
                                    public_holding: parseNumber(row['Public holding'])
                                });
                            }

                            // 8. Growth metrics
                            parsedData.growthMetrics.push({
                                ticker: ticker,
                                profit_growth_1y: parseNumber(row['Profit growth']),
                                profit_growth_3y: parseNumber(row['Profit growth 3Years']),
                                profit_growth_5y: parseNumber(row['Profit growth 5Years']),
                                sales_growth_1y: parseNumber(row['Sales growth']),
                                sales_growth_3y: parseNumber(row['Sales growth 3Years']),
                                sales_growth_5y: parseNumber(row['Sales growth 5Years'])
                            });

                        } catch (error) {
                            parsedData.errors.push({
                                row: index + 2,
                                ticker: row['NSE Code'] || 'Unknown',
                                error: error.message,
                                action: 'Skipped'
                            });
                        }
                    });

                    // Calculate NSE ranks based on market cap
                    parsedData.stocks.sort((a, b) => (b.market_cap || 0) - (a.market_cap || 0));
                    parsedData.stocks.forEach((stock, index) => {
                        stock.nse_rank = index + 1;
                    });

                    resolve(parsedData);
                } catch (error) {
                    reject(error);
                }
            },
            error: (error) => {
                reject(error);
            }
        });
    });
};

/**
 * Validate CSV file
 * @param {string} filePath - Path to CSV file
 * @returns {Object} Validation result
 */
const validateCSV = (filePath) => {
    try {
        // Check if file exists
        if (!fs.existsSync(filePath)) {
            return { valid: false, error: 'File does not exist' };
        }

        // Check file size (max 10MB)
        const stats = fs.statSync(filePath);
        const maxSize = parseInt(process.env.MAX_FILE_SIZE) || 10485760; // 10MB
        if (stats.size > maxSize) {
            return { valid: false, error: `File size exceeds ${maxSize / 1048576}MB limit` };
        }

        // Check file extension
        if (!filePath.toLowerCase().endsWith('.csv')) {
            return { valid: false, error: 'File must be a CSV file' };
        }

        return { valid: true };
    } catch (error) {
        return { valid: false, error: error.message };
    }
};

module.exports = {
    parseScreenerCSV,
    validateCSV,
    parseQuarterFromDate,
    parseNumber
};

// Made with Bob
