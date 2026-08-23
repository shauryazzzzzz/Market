// Stock Data Generator
// Generates realistic stock data for NSE stocks when live data is unavailable
// Uses real NSE stock symbols with market-realistic prices and metrics

const fs = require('fs').promises;
const path = require('path');

class StockDataGenerator {
  constructor() {
    // Real NSE stock symbols with their typical price ranges and sectors
    this.nseStocks = [
      // Large Cap - Financial
      { symbol: 'HDFCBANK', name: 'HDFC Bank Ltd', sector: 'Financial', industry: 'Private Banks', priceRange: [1500, 1700], marketCap: 920000 },
      { symbol: 'ICICIBANK', name: 'ICICI Bank Ltd', sector: 'Financial', industry: 'Private Banks', priceRange: [900, 1000], marketCap: 670000 },
      { symbol: 'AXISBANK', name: 'Axis Bank Ltd', sector: 'Financial', industry: 'Private Banks', priceRange: [950, 1050], marketCap: 310000 },
      { symbol: 'KOTAKBANK', name: 'Kotak Mahindra Bank', sector: 'Financial', industry: 'Private Banks', priceRange: [1750, 1900], marketCap: 368000 },
      { symbol: 'SBIN', name: 'State Bank of India', sector: 'Financial', industry: 'Public Banks', priceRange: [580, 650], marketCap: 550000 },
      { symbol: 'BAJFINANCE', name: 'Bajaj Finance', sector: 'Financial', industry: 'NBFC', priceRange: [6800, 7500], marketCap: 445000 },
      
      // Large Cap - Technology
      { symbol: 'TCS', name: 'Tata Consultancy Services', sector: 'Technology', industry: 'IT Services', priceRange: [3400, 3600], marketCap: 1280000 },
      { symbol: 'INFY', name: 'Infosys Ltd', sector: 'Technology', industry: 'IT Services', priceRange: [1350, 1450], marketCap: 590000 },
      { symbol: 'WIPRO', name: 'Wipro Ltd', sector: 'Technology', industry: 'IT Services', priceRange: [420, 470], marketCap: 245000 },
      { symbol: 'HCLTECH', name: 'HCL Technologies', sector: 'Technology', industry: 'IT Services', priceRange: [1150, 1250], marketCap: 325000 },
      { symbol: 'TECHM', name: 'Tech Mahindra', sector: 'Technology', industry: 'IT Services', priceRange: [1050, 1150], marketCap: 105000 },
      
      // Large Cap - Consumer
      { symbol: 'HINDUNILVR', name: 'Hindustan Unilever', sector: 'Consumer', industry: 'FMCG', priceRange: [2300, 2450], marketCap: 560000 },
      { symbol: 'ITC', name: 'ITC Ltd', sector: 'Consumer', industry: 'FMCG', priceRange: [400, 440], marketCap: 520000 },
      { symbol: 'NESTLEIND', name: 'Nestle India', sector: 'Consumer', industry: 'FMCG', priceRange: [23500, 25500], marketCap: 236000 },
      { symbol: 'BRITANNIA', name: 'Britannia Industries', sector: 'Consumer', industry: 'FMCG', priceRange: [4700, 5000], marketCap: 116000 },
      { symbol: 'ASIANPAINT', name: 'Asian Paints', sector: 'Consumer', industry: 'Paints', priceRange: [2850, 3050], marketCap: 282000 },
      { symbol: 'TITAN', name: 'Titan Company', sector: 'Consumer', industry: 'Jewellery', priceRange: [3300, 3500], marketCap: 305000 },
      
      // Large Cap - Energy
      { symbol: 'RELIANCE', name: 'Reliance Industries', sector: 'Energy', industry: 'Refineries', priceRange: [2350, 2550], marketCap: 1650000 },
      { symbol: 'ONGC', name: 'Oil & Natural Gas Corp', sector: 'Energy', industry: 'Oil Exploration', priceRange: [175, 195], marketCap: 233000 },
      { symbol: 'NTPC', name: 'NTPC Ltd', sector: 'Energy', industry: 'Power Generation', priceRange: [280, 310], marketCap: 285000 },
      { symbol: 'POWERGRID', name: 'Power Grid Corp', sector: 'Energy', industry: 'Power Transmission', priceRange: [240, 270], marketCap: 215000 },
      
      // Large Cap - Healthcare
      { symbol: 'SUNPHARMA', name: 'Sun Pharmaceutical', sector: 'Healthcare', industry: 'Pharmaceuticals', priceRange: [1400, 1500], marketCap: 348000 },
      { symbol: 'DRREDDY', name: 'Dr Reddys Laboratories', sector: 'Healthcare', industry: 'Pharmaceuticals', priceRange: [5800, 6200], marketCap: 98000 },
      { symbol: 'CIPLA', name: 'Cipla Ltd', sector: 'Healthcare', industry: 'Pharmaceuticals', priceRange: [1350, 1450], marketCap: 109000 },
      { symbol: 'APOLLOHOSP', name: 'Apollo Hospitals', sector: 'Healthcare', industry: 'Hospitals', priceRange: [6200, 6600], marketCap: 88000 },
      
      // Large Cap - Automobile
      { symbol: 'MARUTI', name: 'Maruti Suzuki India', sector: 'Automobile', industry: 'Passenger Vehicles', priceRange: [10500, 11500], marketCap: 328000 },
      { symbol: 'TATAMOTORS', name: 'Tata Motors', sector: 'Automobile', industry: 'Commercial Vehicles', priceRange: [750, 850], marketCap: 285000 },
      { symbol: 'M&M', name: 'Mahindra & Mahindra', sector: 'Automobile', industry: 'Tractors & Vehicles', priceRange: [2650, 2850], marketCap: 325000 },
      { symbol: 'BAJAJ-AUTO', name: 'Bajaj Auto', sector: 'Automobile', industry: 'Two Wheelers', priceRange: [9200, 9800], marketCap: 265000 },
      
      // Large Cap - Industrial
      { symbol: 'LT', name: 'Larsen & Toubro', sector: 'Industrial', industry: 'Construction', priceRange: [3150, 3400], marketCap: 450000 },
      { symbol: 'ULTRACEMCO', name: 'UltraTech Cement', sector: 'Industrial', industry: 'Cement', priceRange: [8900, 9600], marketCap: 268000 },
      { symbol: 'TATASTEEL', name: 'Tata Steel', sector: 'Industrial', industry: 'Steel', priceRange: [125, 145], marketCap: 165000 },
      { symbol: 'HINDALCO', name: 'Hindalco Industries', sector: 'Industrial', industry: 'Aluminium', priceRange: [500, 550], marketCap: 115000 },
      
      // Large Cap - Telecom
      { symbol: 'BHARTIARTL', name: 'Bharti Airtel', sector: 'Telecom', industry: 'Telecom Services', priceRange: [1150, 1250], marketCap: 680000 },
      
      // Mid Cap Stocks
      { symbol: 'INDUSINDBK', name: 'IndusInd Bank', sector: 'Financial', industry: 'Private Banks', priceRange: [1400, 1500], marketCap: 112000 },
      { symbol: 'BANDHANBNK', name: 'Bandhan Bank', sector: 'Financial', industry: 'Private Banks', priceRange: [230, 260], marketCap: 39500 },
      { symbol: 'PIDILITIND', name: 'Pidilite Industries', sector: 'Consumer', industry: 'Chemicals', priceRange: [2750, 2950], marketCap: 145000 },
      { symbol: 'HAVELLS', name: 'Havells India', sector: 'Consumer', industry: 'Electricals', priceRange: [1450, 1600], marketCap: 95000 },
      { symbol: 'DMART', name: 'Avenue Supermarts', sector: 'Consumer', industry: 'Retail', priceRange: [4050, 4350], marketCap: 272000 },
      { symbol: 'VEDL', name: 'Vedanta Ltd', sector: 'Industrial', industry: 'Mining', priceRange: [270, 300], marketCap: 106000 },
      { symbol: 'COALINDIA', name: 'Coal India', sector: 'Energy', industry: 'Coal Mining', priceRange: [270, 300], marketCap: 175000 },
      { symbol: 'GAIL', name: 'GAIL India', sector: 'Energy', industry: 'Gas Distribution', priceRange: [155, 175], marketCap: 108000 }
    ];
  }

  // Generate realistic price within range
  generatePrice(priceRange) {
    const [min, max] = priceRange;
    return parseFloat((Math.random() * (max - min) + min).toFixed(2));
  }

  // Generate realistic percentage change
  generateChange() {
    // Most stocks move between -3% to +3% daily
    return parseFloat((Math.random() * 6 - 3).toFixed(2));
  }

  // Generate realistic volume
  generateVolume(marketCap) {
    // Larger market cap = higher volume
    const baseVolume = marketCap / 100;
    return Math.floor(baseVolume * (0.5 + Math.random()));
  }

  // Generate realistic PE ratio based on sector
  generatePE(sector) {
    const peRanges = {
      'Financial': [10, 20],
      'Technology': [20, 35],
      'Consumer': [40, 80],
      'Energy': [8, 15],
      'Healthcare': [25, 45],
      'Automobile': [15, 30],
      'Industrial': [20, 40],
      'Telecom': [30, 50]
    };
    const [min, max] = peRanges[sector] || [15, 30];
    return parseFloat((Math.random() * (max - min) + min).toFixed(1));
  }

  // Generate realistic PB ratio
  generatePB(sector) {
    const pbRanges = {
      'Financial': [1.5, 3.5],
      'Technology': [5, 15],
      'Consumer': [10, 30],
      'Energy': [0.8, 2],
      'Healthcare': [3, 8],
      'Automobile': [2, 5],
      'Industrial': [2, 6],
      'Telecom': [4, 10]
    };
    const [min, max] = pbRanges[sector] || [2, 8];
    return parseFloat((Math.random() * (max - min) + min).toFixed(1));
  }

  // Generate realistic ROE
  generateROE(sector) {
    const roeRanges = {
      'Financial': [12, 20],
      'Technology': [25, 45],
      'Consumer': [30, 90],
      'Energy': [8, 15],
      'Healthcare': [10, 25],
      'Automobile': [12, 25],
      'Industrial': [10, 20],
      'Telecom': [15, 25]
    };
    const [min, max] = roeRanges[sector] || [10, 25];
    return parseFloat((Math.random() * (max - min) + min).toFixed(1));
  }

  // Generate realistic dividend yield
  generateDividend(sector) {
    const divRanges = {
      'Financial': [1, 3],
      'Technology': [1.5, 3],
      'Consumer': [0.8, 2.5],
      'Energy': [2, 5],
      'Healthcare': [0.5, 2],
      'Automobile': [1, 3],
      'Industrial': [1, 2.5],
      'Telecom': [0.5, 1.5]
    };
    const [min, max] = divRanges[sector] || [0.5, 2.5];
    return parseFloat((Math.random() * (max - min) + min).toFixed(1));
  }

  // Generate complete stock data
  generateStockData(stock) {
    const price = this.generatePrice(stock.priceRange);
    const change = this.generateChange();
    const previousClose = parseFloat((price / (1 + change / 100)).toFixed(2));
    
    return {
      symbol: stock.symbol,
      name: stock.name,
      sector: stock.sector,
      industry: stock.industry,
      price: price,
      change: parseFloat((price - previousClose).toFixed(2)),
      pChange: change,
      previousClose: previousClose,
      open: parseFloat((previousClose * (1 + (Math.random() * 0.02 - 0.01))).toFixed(2)),
      dayHigh: parseFloat((price * (1 + Math.random() * 0.02)).toFixed(2)),
      dayLow: parseFloat((price * (1 - Math.random() * 0.02)).toFixed(2)),
      weekHigh52: parseFloat((price * (1 + Math.random() * 0.3 + 0.1)).toFixed(2)),
      weekLow52: parseFloat((price * (1 - Math.random() * 0.3)).toFixed(2)),
      totalTradedVolume: this.generateVolume(stock.marketCap),
      totalTradedValue: parseFloat((price * this.generateVolume(stock.marketCap)).toFixed(2)),
      marketCap: stock.marketCap,
      pe: this.generatePE(stock.sector),
      pb: this.generatePB(stock.sector),
      roe: this.generateROE(stock.sector),
      dividend: this.generateDividend(stock.sector),
      fetchedAt: new Date().toISOString()
    };
  }

  // Generate all stocks data
  generateAllStocks() {
    return this.nseStocks.map(stock => this.generateStockData(stock));
  }

  // Generate stocks by sector
  generateStocksBySector(sector) {
    return this.nseStocks
      .filter(stock => stock.sector === sector)
      .map(stock => this.generateStockData(stock));
  }

  // Generate stocks by market cap
  generateStocksByMarketCap(minCap, maxCap) {
    return this.nseStocks
      .filter(stock => stock.marketCap >= minCap && stock.marketCap <= maxCap)
      .map(stock => this.generateStockData(stock));
  }

  // Save data to file
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
}

// Export the class
module.exports = StockDataGenerator;

// CLI usage
if (require.main === module) {
  const generator = new StockDataGenerator();
  
  (async () => {
    console.log('\n=== Stock Data Generator ===\n');
    
    // Generate all stocks
    const allStocks = generator.generateAllStocks();
    await generator.saveToFile(allStocks, 'nse-stocks.json');
    console.log(`Generated ${allStocks.length} stocks\n`);
    
    // Generate by sector
    const sectors = ['Financial', 'Technology', 'Consumer', 'Energy', 'Healthcare', 'Automobile', 'Industrial', 'Telecom'];
    for (const sector of sectors) {
      const stocks = generator.generateStocksBySector(sector);
      await generator.saveToFile(stocks, `stocks-${sector.toLowerCase()}.json`);
      console.log(`Generated ${stocks.length} ${sector} stocks`);
    }
    
    console.log('\n=== Generation Complete ===\n');
  })();
}

// Made with Bob
