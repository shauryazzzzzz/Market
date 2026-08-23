const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Database initialization script
const initDatabase = async () => {
    try {
        console.log('🚀 Initializing Financial Monitor Database...\n');

        // Create data directory if it doesn't exist
        const dataDir = path.join(__dirname, '../../data');
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
            console.log('✅ Created data directory');
        }

        // Database path
        const dbPath = process.env.DB_PATH || './data/financial.db';
        const fullDbPath = path.join(__dirname, '../..', dbPath);

        // Check if database already exists
        const dbExists = fs.existsSync(fullDbPath);
        if (dbExists) {
            console.log('⚠️  Database already exists. It will be recreated.\n');
            fs.unlinkSync(fullDbPath);
        }

        // Create database connection
        const db = new sqlite3.Database(fullDbPath);
        console.log('✅ Database connection established\n');

        // Read schema file
        const schemaPath = path.join(__dirname, 'schema.sql');
        const schema = fs.readFileSync(schemaPath, 'utf8');

        // Execute schema
        console.log('📝 Executing schema...');
        await new Promise((resolve, reject) => {
            db.exec(schema, (err) => {
                if (err) return reject(err);
                resolve();
            });
        });
        console.log('✅ Schema created successfully\n');

        // Verify tables
        const tables = await new Promise((resolve, reject) => {
            db.all(`
                SELECT name FROM sqlite_master 
                WHERE type='table' 
                ORDER BY name
            `, (err, rows) => {
                if (err) return reject(err);
                resolve(rows);
            });
        });

        console.log('📊 Created tables:');
        tables.forEach(table => {
            console.log(`   - ${table.name}`);
        });

        // Verify indexes
        const indexes = await new Promise((resolve, reject) => {
            db.all(`
                SELECT name FROM sqlite_master 
                WHERE type='index' AND name NOT LIKE 'sqlite_%'
                ORDER BY name
            `, (err, rows) => {
                if (err) return reject(err);
                resolve(rows);
            });
        });

        console.log('\n🔍 Created indexes:');
        indexes.forEach(index => {
            console.log(`   - ${index.name}`);
        });

        // Close database
        await new Promise((resolve) => {
            db.close(() => resolve());
        });

        console.log('\n✅ Database initialization completed successfully!');
        console.log(`📍 Database location: ${fullDbPath}\n`);

        return true;
    } catch (error) {
        console.error('❌ Error initializing database:', error.message);
        console.error(error.stack);
        return false;
    }
};

// Run initialization if called directly
if (require.main === module) {
    initDatabase().then(success => {
        process.exit(success ? 0 : 1);
    });
}

module.exports = initDatabase;

// Made with Bob
