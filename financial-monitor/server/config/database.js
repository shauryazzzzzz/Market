const sqlite3 = require('sqlite3').verbose();
const path = require('path');
require('dotenv').config();

let db = null;

/**
 * Get database connection
 * @returns {Promise<Database>} SQLite database instance
 */
const getDatabase = () => {
    return new Promise((resolve, reject) => {
        if (db) {
            return resolve(db);
        }

        const dbPath = process.env.DB_PATH || './data/financial.db';
        const fullDbPath = path.join(__dirname, '../..', dbPath);
        
        db = new sqlite3.Database(fullDbPath, (err) => {
            if (err) {
                console.error('❌ Error connecting to database:', err.message);
                return reject(err);
            }
            
            // Performance PRAGMAs — applied once at connection open
            db.serialize(() => {
                db.run('PRAGMA foreign_keys = ON');
                db.run('PRAGMA journal_mode = WAL');    // concurrent reads while writing
                db.run('PRAGMA synchronous = NORMAL');  // fsync only on checkpoint (safe + faster)
                db.run('PRAGMA cache_size = -8000');    // 8 MB page cache (negative = KiB)
                db.run('PRAGMA temp_store = MEMORY');   // temp tables/indices in RAM
                db.run('PRAGMA mmap_size = 67108864');  // 64 MB memory-mapped I/O
            });
    
            console.log('✅ Database connection established (WAL, 8MB cache, mmap)');
            resolve(db);
        });
    });
};

/**
 * Close database connection
 */
const closeDatabase = () => {
    return new Promise((resolve) => {
        if (db) {
            db.close((err) => {
                if (err) {
                    console.error('Error closing database:', err);
                }
                db = null;
                console.log('✅ Database connection closed');
                resolve();
            });
        } else {
            resolve();
        }
    });
};

/**
 * Execute a query with parameters
 * @param {string} sql - SQL query
 * @param {Array} params - Query parameters
 * @returns {Promise<Array>} Query result
 */
const query = async (sql, params = []) => {
    const database = await getDatabase();
    return new Promise((resolve, reject) => {
        database.all(sql, params, (err, rows) => {
            if (err) {
                console.error('❌ Query error:', err.message);
                return reject(err);
            }
            resolve(rows || []);
        });
    });
};

/**
 * Execute a single row query
 * @param {string} sql - SQL query
 * @param {Array} params - Query parameters
 * @returns {Promise<Object>} Single row result
 */
const queryOne = async (sql, params = []) => {
    const database = await getDatabase();
    return new Promise((resolve, reject) => {
        database.get(sql, params, (err, row) => {
            if (err) {
                console.error('❌ Query error:', err.message);
                return reject(err);
            }
            resolve(row);
        });
    });
};

/**
 * Execute an insert/update/delete query
 * @param {string} sql - SQL query
 * @param {Array} params - Query parameters
 * @returns {Promise<Object>} Query result with changes info
 */
const execute = async (sql, params = []) => {
    const database = await getDatabase();
    return new Promise((resolve, reject) => {
        database.run(sql, params, function(err) {
            if (err) {
                console.error('❌ Execute error:', err.message);
                return reject(err);
            }
            resolve({
                changes: this.changes,
                lastInsertRowid: this.lastID
            });
        });
    });
};

/**
 * Execute multiple queries in a transaction
 * @param {Function} callback - Async function containing queries to execute
 * @returns {Promise<*>} Result of the callback
 */
const transaction = async (callback) => {
    const database = await getDatabase();
    
    return new Promise(async (resolve, reject) => {
        database.run('BEGIN TRANSACTION', async (err) => {
            if (err) return reject(err);
            
            try {
                const result = await callback();
                database.run('COMMIT', (err) => {
                    if (err) return reject(err);
                    resolve(result);
                });
            } catch (error) {
                database.run('ROLLBACK', () => {
                    reject(error);
                });
            }
        });
    });
};

/**
 * Execute batch insert
 * @param {string} sql - SQL insert statement
 * @param {Array} records - Array of records to insert
 * @returns {Promise<Object>} Insert result
 */
const batchInsert = async (sql, records) => {
    return transaction(async () => {
        const database = await getDatabase();
        let inserted = 0;
        
        for (const record of records) {
            await new Promise((resolve, reject) => {
                const params = Array.isArray(record) ? record : Object.values(record);
                database.run(sql, params, function(err) {
                    if (err) return reject(err);
                    inserted++;
                    resolve();
                });
            });
        }
        
        return { inserted };
    });
};

/**
 * Execute raw SQL (for schema creation)
 * @param {string} sql - SQL statements
 * @returns {Promise<void>}
 */
const exec = async (sql) => {
    const database = await getDatabase();
    return new Promise((resolve, reject) => {
        database.exec(sql, (err) => {
            if (err) {
                console.error('❌ Exec error:', err.message);
                return reject(err);
            }
            resolve();
        });
    });
};

module.exports = {
    getDatabase,
    closeDatabase,
    query,
    queryOne,
    execute,
    transaction,
    batchInsert,
    exec
};

// Made with Bob
