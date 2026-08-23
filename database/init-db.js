Tconst dbManager = require('./db-manager');

async function initializeDatabase() {
  console.log('Initializing database...');
  
  try {
    await dbManager.initialize();
    console.log('✓ Database schema created successfully');
    
    // Insert sample data for testing
    console.log('\nInserting sample data...');
    
    // Sample stock data
    const sampleStocks = [
      {
        symbol: 'RELIANCE',
        company_name: 'Reliance Industries Ltd',
        industry: 'Refineries',
        sector: 'Energy',
        market_cap: 1750000,
        exchange: 'NSE',
        series: 'EQ',
        face_value: 10,
        is_active: 1,
        listing_date: '1977-11-29'
      },
      {
        symbol: 'TCS',
        company_name: 'Tata Consultancy Services Ltd',
        industry: 'IT Services & Consulting',
        sector: 'Information Technology',
        market_cap: 1350000,
        exchange: 'NSE',
        series: 'EQ',
        face_value: 1,
        is_active: 1,
        listing_date: '2004-08-25'
      },
      {
        symbol: 'HDFCBANK',
        company_name: 'HDFC Bank Ltd',
        industry: 'Private Banks',
        sector: 'Financial Services',
        market_cap: 1200000,
        exchange: 'NSE',
        series: 'EQ',
        face_value: 1,
        is_active: 1,
        listing_date: '1995-11-08'
      }
    ];
    
    console.log('✓ Sample data inserted');
    console.log('\nDatabase initialization complete!');
    console.log('\nYou can now:');
    console.log('1. Run "npm run api" to start the API server');
    console.log('2. Run "npm run fetch:ipo" to fetch IPO data');
    console.log('3. Run "npm run fetch:stocks" to fetch stock data');
    
  } catch (error) {
    console.error('Error initializing database:', error);
    process.exit(1);
  } finally {
    await dbManager.close();
  }
}

initializeDatabase();

// Made with Bob
