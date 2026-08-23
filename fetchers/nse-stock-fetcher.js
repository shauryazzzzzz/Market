// NSE Stock Data Fetcher
// Fetches real-time stock prices and market data from NSE India

const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');

class NSEStockFetcher {
  constructor() {
    this.baseURL = 'https://www.nseindia.com';
    this.headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'application/json, text/plain, */*',
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Encoding': 'gzip, deflate, br',
      'Connection': 'keep-alive',
      'Referer': 'https://www.nseindia.com/',
      'X-Requested-With': 'XMLHttpRequest'
    };
    this.cookies = '';
  }

  // Initialize session by visiting homepage
  async initSession() {
    try {
      console.log('Initializing NSE session...');
      const response = await axios.get(this.baseURL, {
        headers: this.headers,
        timeout: 10000
      });
      
      // Extract cookies from response
      if (response.headers['set-cookie']) {
        this.cookies = response.headers['set-cookie']
          .map(cookie => cookie.split(';')[0])
          .join('; ');
        console.log('✓ Session initialized successfully');
      }
      
      // Wait a bit to avoid rate limiting
      await this.delay(1000);
      return true;
    } catch (error) {
      console.error('✗ Failed to initialize session:', error.message);
      return false;
    }
  }

  // Fetch all equity stocks list
  async fetchAllStocks() {
    try {
      await this.initSession();
      
      console.log('Fetching all NSE stocks...');
      const url = `${this.baseURL}/api/equity-stockIndices?index=SECURITIES%20IN%20F%26O`;
      
      const response = await axios.get(url, {
        headers: {
          ...this.headers,
          'Cookie': this.cookies
        },
        timeout: 15000
      });

      if (response.data && response.data.data) {
        const stocks = response.data.data.map(stock => ({
          symbol: stock.symbol,
          name: stock.meta?.companyName || stock.symbol,
          price: parseFloat(stock.lastPrice) || 0,
          change: parseFloat(stock.change) || 0,
          pChange: parseFloat(stock.pChange) || 0,
          previousClose: parseFloat(stock.previousClose) || 0,
          open: parseFloat(stock.open) || 0,
          dayHigh: parseFloat(stock.dayHigh) || 0,
          dayLow: parseFloat(stock.dayLow) || 0,
          yearHigh: parseFloat(stock.yearHigh) || 0,
          yearLow: parseFloat(stock.yearLow) || 0,
          totalTradedVolume: parseInt(stock.totalTradedVolume) || 0,
          totalTradedValue: parseFloat(stock.totalTradedValue) || 0,
          lastUpdateTime: stock.lastUpdateTime || new Date().toISOString(),
          fetchedAt: new Date().toISOString()
        }));

        console.log(`✓ Fetched ${stocks.length} stocks from NSE`);
        return stocks;
      }

      return [];
    } catch (error) {
      console.error('✗ Error fetching stocks:', error.message);
      return [];
    }
  }

  // Fetch specific stock quote
  async fetchStockQuote(symbol) {
    try {
      await this.initSession();
      
      console.log(`Fetching quote for ${symbol}...`);
      const url = `${this.baseURL}/api/quote-equity?symbol=${encodeURIComponent(symbol)}`;
      
      const response = await axios.get(url, {
        headers: {
          ...this.headers,
          'Cookie': this.cookies
        },
        timeout: 10000
      });

      if (response.data) {
        const data = response.data;
        const priceInfo = data.priceInfo || {};
        const metadata = data.metadata || {};
        const securityInfo = data.securityInfo || {};

        const quote = {
          symbol: symbol,
          name: metadata.companyName || symbol,
          industry: metadata.industry || 'Unknown',
          sector: this.mapSector(metadata.industry),
          isin: metadata.isin || '',
          
          // Price data
          price: parseFloat(priceInfo.lastPrice) || 0,
          change: parseFloat(priceInfo.change) || 0,
          pChange: parseFloat(priceInfo.pChange) || 0,
          previousClose: parseFloat(priceInfo.previousClose) || 0,
          open: parseFloat(priceInfo.open) || 0,
          close: parseFloat(priceInfo.close) || 0,
          
          // Day range
          dayHigh: parseFloat(priceInfo.intraDayHighLow?.max) || 0,
          dayLow: parseFloat(priceInfo.intraDayHighLow?.min) || 0,
          
          // 52-week range
          weekHigh52: parseFloat(priceInfo.weekHighLow?.max) || 0,
          weekLow52: parseFloat(priceInfo.weekHighLow?.min) || 0,
          
          // Volume
          totalTradedVolume: parseInt(securityInfo.totalTradedVolume) || 0,
          totalTradedValue: parseFloat(securityInfo.totalTradedValue) || 0,
          
          // Market cap
          marketCap: parseFloat(securityInfo.marketCap) || 0,
          
          // Additional info
          faceValue: parseFloat(securityInfo.faceValue) || 0,
          issuedSize: parseInt(securityInfo.issuedSize) || 0,
          
          fetchedAt: new Date().toISOString()
        };

        console.log(`✓ Fetched quote for ${symbol}`);
        return quote;
      }

      return null;
    } catch (error) {
      console.error(`✗ Error fetching quote for ${symbol}:`, error.message);
      return null;
    }
  }

  // Fetch market indices (Nifty 50, Bank Nifty, etc.)
  async fetchIndices() {
    try {
      await this.initSession();
      
      console.log('Fetching market indices...');
      const url = `${this.baseURL}/api/allIndices`;
      
      const response = await axios.get(url, {
        headers: {
          ...this.headers,
          'Cookie': this.cookies
        },
        timeout: 10000
      });

      if (response.data && response.data.data) {
        const indices = response.data.data
          .filter(index => ['NIFTY 50', 'NIFTY BANK', 'NIFTY IT', 'NIFTY PHARMA', 'NIFTY AUTO'].includes(index.index))
          .map(index => ({
            name: index.index,
            value: parseFloat(index.last) || 0,
            change: parseFloat(index.change) || 0,
            pChange: parseFloat(index.percentChange) || 0,
            open: parseFloat(index.open) || 0,
            high: parseFloat(index.high) || 0,
            low: parseFloat(index.low) || 0,
            previousClose: parseFloat(index.previousClose) || 0,
            yearHigh: parseFloat(index.yearHigh) || 0,
            yearLow: parseFloat(index.yearLow) || 0,
            fetchedAt: new Date().toISOString()
          }));

        console.log(`✓ Fetched ${indices.length} market indices`);
        return indices;
      }

      return [];
    } catch (error) {
      console.error('✗ Error fetching indices:', error.message);
      return [];
    }
  }

  // Fetch top gainers
  async fetchTopGainers() {
    try {
      await this.initSession();
      
      console.log('Fetching top gainers...');
      const url = `${this.baseURL}/api/live-analysis-variations?index=gainers`;
      
      const response = await axios.get(url, {
        headers: {
          ...this.headers,
          'Cookie': this.cookies
        },
        timeout: 10000
      });

      if (response.data && response.data.NIFTY && response.data.NIFTY.data) {
        const gainers = response.data.NIFTY.data.slice(0, 10).map(stock => ({
          symbol: stock.symbol,
          name: stock.meta?.companyName || stock.symbol,
          price: parseFloat(stock.lastPrice) || 0,
          change: parseFloat(stock.change) || 0,
          pChange: parseFloat(stock.pChange) || 0,
          volume: parseInt(stock.totalTradedVolume) || 0,
          fetchedAt: new Date().toISOString()
        }));

        console.log(`✓ Fetched ${gainers.length} top gainers`);
        return gainers;
      }

      return [];
    } catch (error) {
      console.error('✗ Error fetching top gainers:', error.message);
      return [];
    }
  }

  // Fetch top losers
  async fetchTopLosers() {
    try {
      await this.initSession();
      
      console.log('Fetching top losers...');
      const url = `${this.baseURL}/api/live-analysis-variations?index=losers`;
      
      const response = await axios.get(url, {
        headers: {
          ...this.headers,
          'Cookie': this.cookies
        },
        timeout: 10000
      });

      if (response.data && response.data.NIFTY && response.data.NIFTY.data) {
        const losers = response.data.NIFTY.data.slice(0, 10).map(stock => ({
          symbol: stock.symbol,
          name: stock.meta?.companyName || stock.symbol,
          price: parseFloat(stock.lastPrice) || 0,
          change: parseFloat(stock.change) || 0,
          pChange: parseFloat(stock.pChange) || 0,
          volume: parseInt(stock.totalTradedVolume) || 0,
          fetchedAt: new Date().toISOString()
        }));

        console.log(`✓ Fetched ${losers.length} top losers`);
        return losers;
      }

      return [];
    } catch (error) {
      console.error('✗ Error fetching top losers:', error.message);
      return [];
    }
  }

  // Map industry to sector
  mapSector(industry) {
    const sectorMap = {
      'Banks': 'Financial',
      'Finance': 'Financial',
      'Insurance': 'Financial',
      'IT': 'Technology',
      'Software': 'Technology',
      'Pharma': 'Healthcare',
      'Healthcare': 'Healthcare',
      'Auto': 'Automobile',
      'Telecom': 'Telecom',
      'FMCG': 'Consumer',
      'Consumer': 'Consumer',
      'Cement': 'Industrial',
      'Steel': 'Industrial',
      'Power': 'Energy',
      'Oil': 'Energy'
    };

    for (const [key, value] of Object.entries(sectorMap)) {
      if (industry && industry.includes(key)) {
        return value;
      }
    }

    return 'Other';
  }

  // Save data to JSON file
  async saveToFile(data, filename) {
    try {
      const dataDir = path.join(__dirname, '..', 'data');
      await fs.mkdir(dataDir, { recursive: true });
      
      const filepath = path.join(dataDir, filename);
      await fs.writeFile(filepath, JSON.stringify(data, null, 2));
      
      console.log(`✓ Data saved to ${filename}`);
      return true;
    } catch (error) {
      console.error(`✗ Error saving to file:`, error.message);
      return false;
    }
  }

  // Utility: delay function
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Export the class
module.exports = NSEStockFetcher;

// CLI usage
if (require.main === module) {
  const fetcher = new NSEStockFetcher();
  
  (async () => {
    console.log('\n=== NSE Stock Fetcher - Proof of Concept ===\n');
    
    // Fetch all stocks
    const stocks = await fetcher.fetchAllStocks();
    if (stocks.length > 0) {
      await fetcher.saveToFile(stocks, 'nse-stocks.json');
      console.log(`\nSample stock: ${stocks[0].symbol} - ₹${stocks[0].price}`);
    }
    
    await fetcher.delay(2000);
    
    // Fetch specific stock quote
    const quote = await fetcher.fetchStockQuote('RELIANCE');
    if (quote) {
      await fetcher.saveToFile(quote, 'reliance-quote.json');
      console.log(`\nRELIANCE: ₹${quote.price} (${quote.pChange >= 0 ? '+' : ''}${quote.pChange}%)`);
    }
    
    await fetcher.delay(2000);
    
    // Fetch indices
    const indices = await fetcher.fetchIndices();
    if (indices.length > 0) {
      await fetcher.saveToFile(indices, 'market-indices.json');
      console.log(`\nNIFTY 50: ${indices[0].value} (${indices[0].pChange >= 0 ? '+' : ''}${indices[0].pChange}%)`);
    }
    
    await fetcher.delay(2000);
    
    // Fetch top gainers
    const gainers = await fetcher.fetchTopGainers();
    if (gainers.length > 0) {
      await fetcher.saveToFile(gainers, 'top-gainers.json');
      console.log(`\nTop Gainer: ${gainers[0].symbol} (+${gainers[0].pChange}%)`);
    }
    
    await fetcher.delay(2000);
    
    // Fetch top losers
    const losers = await fetcher.fetchTopLosers();
    if (losers.length > 0) {
      await fetcher.saveToFile(losers, 'top-losers.json');
      console.log(`\nTop Loser: ${losers[0].symbol} (${losers[0].pChange}%)`);
    }
    
    console.log('\n=== Fetching Complete ===\n');
  })();
}

// Made with Bob
