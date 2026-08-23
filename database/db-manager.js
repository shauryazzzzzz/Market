const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const DB_PATH = path.join(__dirname, 'ipo_data.db');
const SCHEMA_PATH = path.join(__dirname, 'schema.sql');

class DatabaseManager {
  constructor() {
    this.db = null;
  }

  initialize() {
    return new Promise((resolve, reject) => {
      this.db = new sqlite3.Database(DB_PATH, (err) => {
        if (err) {
          reject(err);
          return;
        }
        console.log('Connected to SQLite database');
        this.createTables()
          .then(() => resolve())
          .catch(reject);
      });
    });
  }

  createTables() {
    return new Promise((resolve, reject) => {
      const schema = fs.readFileSync(SCHEMA_PATH, 'utf8');
      this.db.exec(schema, (err) => {
        if (err) {
          reject(err);
          return;
        }
        console.log('Database schema initialized');
        resolve();
      });
    });
  }

  // IPO Calendar Operations
  insertIPO(ipoData) {
    return new Promise((resolve, reject) => {
      const sql = `
        INSERT INTO ipo_calendar (
          company_name, symbol, issue_type, issue_size, price_band_min, price_band_max,
          open_date, close_date, allotment_date, listing_date, lot_size, issue_price,
          listing_price, listing_gain_percent, subscription_times, status,
          lead_managers, registrar, exchange
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;
      
      this.db.run(sql, [
        ipoData.company_name, ipoData.symbol, ipoData.issue_type, ipoData.issue_size,
        ipoData.price_band_min, ipoData.price_band_max, ipoData.open_date, ipoData.close_date,
        ipoData.allotment_date, ipoData.listing_date, ipoData.lot_size, ipoData.issue_price,
        ipoData.listing_price, ipoData.listing_gain_percent, ipoData.subscription_times,
        ipoData.status, ipoData.lead_managers, ipoData.registrar, ipoData.exchange
      ], function(err) {
        if (err) {
          reject(err);
          return;
        }
        resolve(this.lastID);
      });
    });
  }

  updateIPO(id, ipoData) {
    return new Promise((resolve, reject) => {
      const fields = Object.keys(ipoData).map(key => `${key} = ?`).join(', ');
      const values = Object.values(ipoData);
      values.push(id);
      
      const sql = `UPDATE ipo_calendar SET ${fields} WHERE id = ?`;
      
      this.db.run(sql, values, function(err) {
        if (err) {
          reject(err);
          return;
        }
        resolve(this.changes);
      });
    });
  }

  getIPOBySymbol(symbol) {
    return new Promise((resolve, reject) => {
      const sql = 'SELECT * FROM ipo_calendar WHERE symbol = ? ORDER BY created_at DESC LIMIT 1';
      this.db.get(sql, [symbol], (err, row) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(row);
      });
    });
  }

  getAllIPOs(status = null) {
    return new Promise((resolve, reject) => {
      let sql = 'SELECT * FROM ipo_calendar';
      const params = [];
      
      if (status) {
        sql += ' WHERE status = ?';
        params.push(status);
      }
      
      sql += ' ORDER BY open_date DESC';
      
      this.db.all(sql, params, (err, rows) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(rows);
      });
    });
  }

  getUpcomingIPOs() {
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT * FROM ipo_calendar 
        WHERE status IN ('Upcoming', 'Open') 
        ORDER BY open_date ASC
      `;
      this.db.all(sql, [], (err, rows) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(rows);
      });
    });
  }

  getRecentListings(limit = 10) {
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT * FROM ipo_calendar 
        WHERE status = 'Listed' 
        ORDER BY listing_date DESC 
        LIMIT ?
      `;
      this.db.all(sql, [limit], (err, rows) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(rows);
      });
    });
  }

  // Subscription Data Operations
  insertSubscriptionData(subscriptionData) {
    return new Promise((resolve, reject) => {
      const sql = `
        INSERT INTO ipo_subscription_data (
          ipo_id, category, subscription_times, applications,
          shares_offered, shares_bid, fetch_date
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `;
      
      this.db.run(sql, [
        subscriptionData.ipo_id, subscriptionData.category, subscriptionData.subscription_times,
        subscriptionData.applications, subscriptionData.shares_offered,
        subscriptionData.shares_bid, subscriptionData.fetch_date
      ], function(err) {
        if (err) {
          reject(err);
          return;
        }
        resolve(this.lastID);
      });
    });
  }

  getSubscriptionData(ipoId) {
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT * FROM ipo_subscription_data 
        WHERE ipo_id = ? 
        ORDER BY fetch_date DESC
      `;
      this.db.all(sql, [ipoId], (err, rows) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(rows);
      });
    });
  }

  // Grey Market Operations
  insertGreyMarketData(greyMarketData) {
    return new Promise((resolve, reject) => {
      const sql = `
        INSERT INTO ipo_grey_market (
          ipo_id, grey_market_premium, expected_listing_price,
          kostak_rate, subject_to_sauda, fetch_date
        ) VALUES (?, ?, ?, ?, ?, ?)
      `;
      
      this.db.run(sql, [
        greyMarketData.ipo_id, greyMarketData.grey_market_premium,
        greyMarketData.expected_listing_price, greyMarketData.kostak_rate,
        greyMarketData.subject_to_sauda, greyMarketData.fetch_date
      ], function(err) {
        if (err) {
          reject(err);
          return;
        }
        resolve(this.lastID);
      });
    });
  }

  getGreyMarketData(ipoId) {
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT * FROM ipo_grey_market 
        WHERE ipo_id = ? 
        ORDER BY fetch_date DESC 
        LIMIT 1
      `;
      this.db.get(sql, [ipoId], (err, row) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(row);
      });
    });
  }

  // Logging Operations
  logFetch(logData) {
    return new Promise((resolve, reject) => {
      const sql = `
        INSERT INTO data_fetch_log (
          source, fetch_type, status, records_fetched, error_message
        ) VALUES (?, ?, ?, ?, ?)
      `;
      
      this.db.run(sql, [
        logData.source, logData.fetch_type, logData.status,
        logData.records_fetched, logData.error_message
      ], function(err) {
        if (err) {
          reject(err);
          return;
        }
        resolve(this.lastID);
      });
    });
  }

  // Statistics
  getIPOStats() {
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT 
          COUNT(*) as total_ipos,
          SUM(CASE WHEN status = 'Upcoming' THEN 1 ELSE 0 END) as upcoming,
          SUM(CASE WHEN status = 'Open' THEN 1 ELSE 0 END) as open,
          SUM(CASE WHEN status = 'Listed' THEN 1 ELSE 0 END) as listed,
          AVG(CASE WHEN listing_gain_percent IS NOT NULL THEN listing_gain_percent ELSE NULL END) as avg_listing_gain,
          SUM(CASE WHEN issue_size IS NOT NULL THEN issue_size ELSE 0 END) as total_issue_size
        FROM ipo_calendar
      `;
      
      this.db.get(sql, [], (err, row) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(row);
      });
    });
  }

  close() {
    return new Promise((resolve, reject) => {
      if (this.db) {
        this.db.close((err) => {
          if (err) {
            reject(err);
            return;
          }
          console.log('Database connection closed');
          resolve();
        });
      } else {
        resolve();
      }
    });
  }
}

module.exports = new DatabaseManager();

// Made with Bob
