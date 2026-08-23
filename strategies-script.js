// Aladdin Investing - Investment Strategies JavaScript
// Iteration 1: Interactive strategy cards with mock data

// Mock Strategy Data
const mockStrategiesData = {
  'blue-chip': {
    name: 'Blue Chip Investing',
    description: 'Invest in large, established companies with strong fundamentals',
    icon: '🏆',
    stocks: [
      { symbol: 'RELIANCE', name: 'Reliance Industries', price: 2450.80, change: 1.2, marketCap: 1650000, pe: 24.5, dividend: 0.5, rating: 4.5 },
      { symbol: 'TCS', name: 'Tata Consultancy Services', price: 3520.60, change: 0.8, marketCap: 1280000, pe: 28.3, dividend: 1.8, rating: 4.8 },
      { symbol: 'HDFCBANK', name: 'HDFC Bank', price: 1650.25, change: 1.5, marketCap: 920000, pe: 18.5, dividend: 1.2, rating: 4.6 },
      { symbol: 'INFY', name: 'Infosys', price: 1420.40, change: 0.3, marketCap: 590000, pe: 24.6, dividend: 2.1, rating: 4.4 },
      { symbol: 'ICICIBANK', name: 'ICICI Bank', price: 950.50, change: 0.9, marketCap: 670000, pe: 16.2, dividend: 1.5, rating: 4.5 },
      { symbol: 'HINDUNILVR', name: 'Hindustan Unilever', price: 2380.30, change: -0.2, marketCap: 560000, pe: 58.2, dividend: 1.9, rating: 4.3 },
      { symbol: 'BHARTIARTL', name: 'Bharti Airtel', price: 1180.75, change: 1.8, marketCap: 680000, pe: 42.5, dividend: 0.8, rating: 4.2 },
      { symbol: 'ITC', name: 'ITC Ltd', price: 420.60, change: 0.5, marketCap: 520000, pe: 28.7, dividend: 5.2, rating: 4.1 },
      { symbol: 'SBIN', name: 'State Bank of India', price: 620.40, change: 2.1, marketCap: 550000, pe: 9.8, dividend: 2.8, rating: 4.0 },
      { symbol: 'LT', name: 'Larsen & Toubro', price: 3280.90, change: 1.3, marketCap: 450000, pe: 32.4, dividend: 1.4, rating: 4.4 }
    ]
  },
  
  'value': {
    name: 'Value Investing',
    description: 'Find undervalued stocks trading below intrinsic value',
    icon: '💎',
    stocks: [
      { symbol: 'VEDL', name: 'Vedanta Ltd', price: 285.40, change: 2.5, marketCap: 106000, pe: 8.2, pb: 1.1, roe: 15.8, rating: 3.8 },
      { symbol: 'TATASTEEL', name: 'Tata Steel', price: 135.60, change: 1.8, marketCap: 165000, pe: 12.5, pb: 0.9, roe: 12.3, rating: 3.9 },
      { symbol: 'HINDALCO', name: 'Hindalco Industries', price: 520.30, change: 1.2, marketCap: 115000, pe: 10.8, pb: 1.3, roe: 14.2, rating: 3.7 },
      { symbol: 'COALINDIA', name: 'Coal India', price: 285.75, change: 0.9, marketCap: 175000, pe: 7.5, pb: 1.0, roe: 18.5, rating: 3.6 },
      { symbol: 'NTPC', name: 'NTPC Ltd', price: 295.80, change: 1.5, marketCap: 285000, pe: 14.2, pb: 1.4, roe: 11.8, rating: 3.8 },
      { symbol: 'ONGC', name: 'Oil & Natural Gas Corp', price: 185.40, change: 2.2, marketCap: 233000, pe: 9.3, pb: 0.8, roe: 13.5, rating: 3.5 },
      { symbol: 'GAIL', name: 'GAIL India', price: 165.90, change: 0.8, marketCap: 108000, pe: 11.5, pb: 1.2, roe: 12.8, rating: 3.6 },
      { symbol: 'IOC', name: 'Indian Oil Corporation', price: 95.25, change: 1.3, marketCap: 135000, pe: 8.8, pb: 0.7, roe: 10.2, rating: 3.4 },
      { symbol: 'SAIL', name: 'Steel Authority of India', price: 115.60, change: 2.8, marketCap: 47500, pe: 15.2, pb: 0.6, roe: 8.5, rating: 3.3 },
      { symbol: 'NMDC', name: 'NMDC Ltd', price: 145.30, change: 1.6, marketCap: 42500, pe: 9.8, pb: 1.5, roe: 16.2, rating: 3.7 }
    ]
  },
  
  'momentum': {
    name: 'Momentum Trading',
    description: 'Ride the trend with stocks showing strong price momentum',
    icon: '📈',
    stocks: [
      { symbol: 'ADANIENT', name: 'Adani Enterprises', price: 2850.40, change: 5.2, marketCap: 325000, momentum: 92, volume: 2.5, rating: 4.2 },
      { symbol: 'ADANIPORTS', name: 'Adani Ports', price: 1180.60, change: 4.8, marketCap: 245000, momentum: 88, volume: 3.2, rating: 4.1 },
      { symbol: 'TATAMOTORS', name: 'Tata Motors', price: 785.30, change: 6.5, marketCap: 285000, momentum: 95, volume: 8.5, rating: 4.3 },
      { symbol: 'BAJFINANCE', name: 'Bajaj Finance', price: 7250.80, change: 3.8, marketCap: 445000, momentum: 85, volume: 1.8, rating: 4.4 },
      { symbol: 'TITAN', name: 'Titan Company', price: 3420.50, change: 4.2, marketCap: 305000, momentum: 87, volume: 2.1, rating: 4.2 },
      { symbol: 'DMART', name: 'Avenue Supermarts', price: 4180.90, change: 5.8, marketCap: 272000, momentum: 91, volume: 1.5, rating: 4.5 },
      { symbol: 'PIDILITIND', name: 'Pidilite Industries', price: 2850.40, change: 3.5, marketCap: 145000, momentum: 82, volume: 0.8, rating: 4.0 },
      { symbol: 'HAVELLS', name: 'Havells India', price: 1520.60, change: 4.5, marketCap: 95000, momentum: 86, volume: 1.2, rating: 3.9 },
      { symbol: 'DIXON', name: 'Dixon Technologies', price: 6850.30, change: 7.2, marketCap: 42000, momentum: 96, volume: 0.5, rating: 4.6 },
      { symbol: 'POLYCAB', name: 'Polycab India', price: 5420.80, change: 5.5, marketCap: 82000, momentum: 89, volume: 0.7, rating: 4.1 }
    ]
  },
  
  'quantitative': {
    name: 'Quantitative Strategy',
    description: 'Data-driven approach using multiple financial metrics',
    icon: '🔢',
    stocks: [
      { symbol: 'ASIANPAINT', name: 'Asian Paints', price: 2950.40, change: 1.2, marketCap: 282000, score: 8.5, roe: 28.5, roce: 32.8, rating: 4.6 },
      { symbol: 'NESTLEIND', name: 'Nestle India', price: 24500.60, change: 0.8, marketCap: 236000, score: 8.8, roe: 85.2, roce: 92.5, rating: 4.8 },
      { symbol: 'BRITANNIA', name: 'Britannia Industries', price: 4850.30, change: 1.5, marketCap: 116000, score: 8.2, roe: 32.8, roce: 38.5, rating: 4.5 },
      { symbol: 'DABUR', name: 'Dabur India', price: 520.80, change: 0.5, marketCap: 92000, score: 7.8, roe: 18.5, roce: 22.3, rating: 4.2 },
      { symbol: 'MARICO', name: 'Marico Ltd', price: 585.40, change: 0.9, marketCap: 76000, score: 7.5, roe: 22.8, roce: 28.5, rating: 4.1 },
      { symbol: 'COLPAL', name: 'Colgate-Palmolive', price: 2680.90, change: 1.1, marketCap: 73000, score: 8.0, roe: 48.5, roce: 52.8, rating: 4.4 },
      { symbol: 'PAGEIND', name: 'Page Industries', price: 42500.30, change: 0.3, marketCap: 47500, score: 7.9, roe: 28.2, roce: 32.5, rating: 4.3 },
      { symbol: 'BERGEPAINT', name: 'Berger Paints', price: 485.60, change: 1.8, marketCap: 47000, score: 7.2, roe: 18.8, roce: 24.2, rating: 3.9 },
      { symbol: 'PIDILITIND', name: 'Pidilite Industries', price: 2850.40, change: 1.3, marketCap: 145000, score: 8.1, roe: 24.5, roce: 28.8, rating: 4.4 },
      { symbol: 'TRENT', name: 'Trent Ltd', price: 3850.80, change: 2.5, marketCap: 135000, score: 8.3, roe: 26.8, roce: 30.5, rating: 4.5 }
    ]
  }
};

// State Management
const state = {
  activeStrategy: 'blue-chip'
};

// Initialize on page load
document.addEventListener('DOMContentLoaded', function() {
  console.log('Strategies page loaded - Initializing...');
  initializeEventListeners();
  renderStrategyContent();
});

// Initialize event listeners
function initializeEventListeners() {
  const strategyCards = document.querySelectorAll('.strategy-card');
  strategyCards.forEach(card => {
    card.addEventListener('click', function() {
      const strategy = this.getAttribute('data-strategy');
      selectStrategy(strategy);
    });
  });
}

// Select strategy
function selectStrategy(strategy) {
  state.activeStrategy = strategy;
  
  // Update active card
  document.querySelectorAll('.strategy-card').forEach(card => {
    card.classList.remove('is-active');
  });
  document.querySelector(`[data-strategy="${strategy}"]`).classList.add('is-active');
  
  // Render content
  renderStrategyContent();
  
  // Scroll to results
  document.getElementById('strategy-results').scrollIntoView({ behavior: 'smooth', block: 'start' });
  
  console.log('Selected strategy:', strategy);
}

// Render strategy content
function renderStrategyContent() {
  const data = mockStrategiesData[state.activeStrategy];
  if (!data) return;
  
  // Update title
  const titleEl = document.getElementById('strategy-title');
  if (titleEl) {
    titleEl.innerHTML = `${data.icon} ${data.name}`;
  }
  
  // Update description
  const descEl = document.getElementById('strategy-description');
  if (descEl) {
    descEl.textContent = data.description;
  }
  
  // Update stock count
  const countEl = document.getElementById('stock-count');
  if (countEl) {
    countEl.textContent = `${data.stocks.length} stocks`;
  }
  
  // Render stocks table
  renderStocksTable(data.stocks);
}

// Render stocks table
function renderStocksTable(stocks) {
  const tbody = document.getElementById('strategy-stocks-body');
  if (!tbody) return;
  
  // Different columns based on strategy
  let tableHTML = '';
  
  switch(state.activeStrategy) {
    case 'blue-chip':
      tableHTML = stocks.map((stock, index) => `
        <tr>
          <td>${index + 1}</td>
          <td><strong>${stock.symbol}</strong></td>
          <td>${stock.name}</td>
          <td>₹${stock.price.toFixed(2)}</td>
          <td class="${stock.change >= 0 ? 'metric-positive' : 'metric-negative'}">
            ${stock.change >= 0 ? '+' : ''}${stock.change.toFixed(2)}%
          </td>
          <td>₹${(stock.marketCap / 10000).toFixed(1)}L Cr</td>
          <td>${stock.pe.toFixed(1)}</td>
          <td class="metric-positive">${stock.dividend.toFixed(1)}%</td>
          <td>${renderStarRating(stock.rating)}</td>
        </tr>
      `).join('');
      break;
      
    case 'value':
      tableHTML = stocks.map((stock, index) => `
        <tr>
          <td>${index + 1}</td>
          <td><strong>${stock.symbol}</strong></td>
          <td>${stock.name}</td>
          <td>₹${stock.price.toFixed(2)}</td>
          <td>${stock.pe.toFixed(1)}</td>
          <td>${stock.pb.toFixed(1)}</td>
          <td class="metric-positive">${stock.roe.toFixed(1)}%</td>
          <td>${renderStarRating(stock.rating)}</td>
        </tr>
      `).join('');
      break;
      
    case 'momentum':
      tableHTML = stocks.map((stock, index) => `
        <tr>
          <td>${index + 1}</td>
          <td><strong>${stock.symbol}</strong></td>
          <td>${stock.name}</td>
          <td>₹${stock.price.toFixed(2)}</td>
          <td class="metric-positive">+${stock.change.toFixed(1)}%</td>
          <td>${stock.momentum}</td>
          <td>${stock.volume.toFixed(1)}M</td>
          <td>${renderStarRating(stock.rating)}</td>
        </tr>
      `).join('');
      break;
      
    case 'quantitative':
      tableHTML = stocks.map((stock, index) => `
        <tr>
          <td>${index + 1}</td>
          <td><strong>${stock.symbol}</strong></td>
          <td>${stock.name}</td>
          <td>₹${stock.price.toFixed(2)}</td>
          <td><strong>${stock.score.toFixed(1)}/10</strong></td>
          <td class="metric-positive">${stock.roe.toFixed(1)}%</td>
          <td class="metric-positive">${stock.roce.toFixed(1)}%</td>
          <td>${renderStarRating(stock.rating)}</td>
        </tr>
      `).join('');
      break;
  }
  
  tbody.innerHTML = tableHTML;
}

// Render star rating
function renderStarRating(rating) {
  const fullStars = Math.floor(rating);
  const hasHalfStar = rating % 1 >= 0.5;
  const emptyStars = 5 - fullStars - (hasHalfStar ? 1 : 0);
  
  let stars = '';
  for (let i = 0; i < fullStars; i++) stars += '⭐';
  if (hasHalfStar) stars += '⭐';
  for (let i = 0; i < emptyStars; i++) stars += '☆';
  
  return `<span class="star-rating">${stars}</span>`;
}

// Log initialization
console.log('Strategies script loaded successfully');
console.log('Current state:', state);

// Made with Bob
