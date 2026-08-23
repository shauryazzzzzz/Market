const db = require('../config/database');

/**
 * Stock Model
 * Handles all database operations for stocks
 */
class Stock {
    /**
     * Get all stocks with optional filters
     * @param {Object} filters - Filter options
     * @returns {Promise<Array>} Array of stocks
     */
    static async getAll(filters = {}) {
        let query = 'SELECT * FROM stocks WHERE 1=1';
        const params = [];

        if (filters.sector) {
            query += ' AND sector = ?';
            params.push(filters.sector);
        }

        if (filters.search) {
            query += ' AND (ticker LIKE ? OR company_name LIKE ?)';
            const searchTerm = `%${filters.search}%`;
            params.push(searchTerm, searchTerm);
        }

        if (filters.minMarketCap) {
            query += ' AND market_cap >= ?';
            params.push(filters.minMarketCap);
        }

        if (filters.maxMarketCap) {
            query += ' AND market_cap <= ?';
            params.push(filters.maxMarketCap);
        }

        // Sorting
        const sortBy = filters.sortBy || 'nse_rank';
        const sortOrder = filters.sortOrder || 'ASC';
        query += ` ORDER BY ${sortBy} ${sortOrder}`;

        // Pagination
        if (filters.limit) {
            query += ' LIMIT ?';
            params.push(filters.limit);

            if (filters.offset) {
                query += ' OFFSET ?';
                params.push(filters.offset);
            }
        }

        return await db.query(query, params);
    }

    /**
     * Get stock by ticker
     * @param {string} ticker - Stock ticker symbol
     * @returns {Promise<Object>} Stock object
     */
    static async getByTicker(ticker) {
        const query = 'SELECT * FROM stocks WHERE ticker = ?';
        return await db.queryOne(query, [ticker]);
    }

    /**
     * Get stock by ID
     * @param {number} stockId - Stock ID
     * @returns {Promise<Object>} Stock object
     */
    static async getById(stockId) {
        const query = 'SELECT * FROM stocks WHERE stock_id = ?';
        return await db.queryOne(query, [stockId]);
    }

    /**
     * Get all unique sectors
     * @returns {Promise<Array>} Array of sectors
     */
    static async getSectors() {
        const query = 'SELECT DISTINCT sector FROM stocks ORDER BY sector';
        return await db.query(query);
    }

    /**
     * Get stocks by sector
     * @param {string} sector - Sector name
     * @returns {Promise<Array>} Array of stocks
     */
    static async getBySector(sector) {
        const query = `
            SELECT * FROM stocks 
            WHERE sector = ? 
            ORDER BY market_cap DESC
        `;
        return await db.query(query, [sector]);
    }

    /**
     * Get top stocks by market cap
     * @param {number} limit - Number of stocks to return
     * @returns {Promise<Array>} Array of top stocks
     */
    static async getTopByMarketCap(limit = 10) {
        const query = `
            SELECT * FROM stocks 
            ORDER BY market_cap DESC 
            LIMIT ?
        `;
        return await db.query(query, [limit]);
    }

    /**
     * Search stocks by ticker or company name
     * @param {string} searchTerm - Search term
     * @param {number} limit - Maximum results
     * @returns {Promise<Array>} Array of matching stocks
     */
    static async search(searchTerm, limit = 10) {
        const query = `
            SELECT * FROM stocks 
            WHERE ticker LIKE ? OR company_name LIKE ?
            ORDER BY nse_rank ASC
            LIMIT ?
        `;
        const term = `%${searchTerm}%`;
        return await db.query(query, [term, term, limit]);
    }

    /**
     * Get stock count
     * @param {Object} filters - Filter options
     * @returns {Promise<number>} Total count
     */
    static async getCount(filters = {}) {
        let query = 'SELECT COUNT(*) as count FROM stocks WHERE 1=1';
        const params = [];

        if (filters.sector) {
            query += ' AND sector = ?';
            params.push(filters.sector);
        }

        if (filters.search) {
            query += ' AND (ticker LIKE ? OR company_name LIKE ?)';
            const searchTerm = `%${filters.search}%`;
            params.push(searchTerm, searchTerm);
        }

        const result = await db.queryOne(query, params);
        return result ? result.count : 0;
    }

    /**
     * Get sector summary with stock counts and aggregate data
     * @returns {Promise<Array>} Array of sector summaries
     */
    static async getSectorSummary() {
        const query = `
            SELECT 
                sector,
                COUNT(*) as stock_count,
                AVG(market_cap) as avg_market_cap,
                SUM(market_cap) as total_market_cap,
                MIN(market_cap) as min_market_cap,
                MAX(market_cap) as max_market_cap
            FROM stocks
            GROUP BY sector
            ORDER BY total_market_cap DESC
        `;
        return await db.query(query);
    }

    /**
     * Update stock price
     * @param {string} ticker - Stock ticker
     * @param {number} price - New price
     * @returns {Promise<Object>} Update result
     */
    static async updatePrice(ticker, price) {
        const query = `
            UPDATE stocks 
            SET current_price = ?, updated_at = CURRENT_TIMESTAMP 
            WHERE ticker = ?
        `;
        return await db.execute(query, [price, ticker]);
    }

    /**
     * Update stock market cap
     * @param {string} ticker - Stock ticker
     * @param {number} marketCap - New market cap
     * @returns {Promise<Object>} Update result
     */
    static async updateMarketCap(ticker, marketCap) {
        const query = `
            UPDATE stocks 
            SET market_cap = ?, updated_at = CURRENT_TIMESTAMP 
            WHERE ticker = ?
        `;
        return await db.execute(query, [marketCap, ticker]);
    }

    /**
     * Get stock with all related data
     * @param {string} ticker - Stock ticker
     * @returns {Promise<Object>} Complete stock data
     */
    static async getCompleteData(ticker) {
        const stock = await this.getByTicker(ticker);
        if (!stock) return null;

        // Get latest quarterly results
        const latestResults = await db.queryOne(`
            SELECT * FROM quarterly_results_latest 
            WHERE stock_id = ?
        `, [stock.stock_id]);

        // Get recent quarterly results (last 4 quarters)
        const quarterlyResults = await db.query(`
            SELECT * FROM quarterly_results 
            WHERE stock_id = ? 
            ORDER BY quarter_end_date DESC 
            LIMIT 4
        `, [stock.stock_id]);

        // Get latest trading data
        const tradingData = await db.queryOne(`
            SELECT * FROM trading_data 
            WHERE stock_id = ? 
            ORDER BY date DESC 
            LIMIT 1
        `, [stock.stock_id]);

        // Get latest cash flow
        const cashFlow = await db.queryOne(`
            SELECT * FROM cash_flow 
            WHERE stock_id = ? 
            ORDER BY fiscal_year DESC, quarter DESC 
            LIMIT 1
        `, [stock.stock_id]);

        // Get latest financial ratios
        const ratios = await db.queryOne(`
            SELECT * FROM financial_ratios 
            WHERE stock_id = ? 
            ORDER BY fiscal_year DESC, quarter DESC 
            LIMIT 1
        `, [stock.stock_id]);

        // Get latest shareholding
        const shareholding = await db.queryOne(`
            SELECT * FROM shareholding_pattern 
            WHERE stock_id = ? 
            ORDER BY fiscal_year DESC, quarter DESC 
            LIMIT 1
        `, [stock.stock_id]);

        // Get growth metrics
        const growthMetrics = await db.queryOne(`
            SELECT * FROM growth_metrics 
            WHERE stock_id = ?
        `, [stock.stock_id]);

        return {
            ...stock,
            latestResults,
            quarterlyResults,
            tradingData,
            cashFlow,
            ratios,
            shareholding,
            growthMetrics
        };
    }
}

module.exports = Stock;

// Made with Bob
