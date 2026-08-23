// Analysis Page JavaScript
// Handles stock search, fundamental analysis, technical indicators, and peer comparison

const API_BASE_URL = 'http://localhost:3001/api';

// State management
let currentStock = null;
let allStocks = [];
let quarterlyView = true;

// Initialize page
document.addEventListener('DOMContentLoaded', () => {
  initializeAnalysisPage();
  setupEventListeners();
  loadDefaultStock();
});

// Initialize the analysis page
async function initializeAnalysisPage() {
  try {
    // Load all stocks for search
    const response = await fetch(`${API_BASE_URL}/stocks`);
    if (!response.ok) throw new Error('Failed to load stocks');
    
    const data = await response.json();
    allStocks = data.stocks || [];
    
    console.log('Analysis page initialized with', allStocks.length, 'stocks');
  } catch (error) {
    console.error('Error initializing analysis page:', error);
    showError('Failed to load stock data. Please ensure the backend server is running.');
  }
}

// Setup event listeners
function setupEventListeners() {
  // Search functionality
  const searchInput = document.querySelector('.search-input');
  const searchButton = document.querySelector('.search-bar .primary-button');
  
  if (searchInput) {
    searchInput.addEventListener('input', handleSearchInput);
    searchInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        handleSearch();
      }
    });
  }
  
  if (searchButton) {
    searchButton.addEventListener('click', handleSearch);
  }
  
  // Quarterly/Annual toggle
  const tabButtons = document.querySelectorAll('.panel-card-header .tab-row button');
  tabButtons.forEach((button, index) => {
    button.addEventListener('click', () => {
      tabButtons.forEach(btn => btn.classList.remove('is-active'));
      button.classList.add('is-active');
      quarterlyView = index === 0;
      updateFinancialData();
    });
  });
  
  // Header buttons
  const searchBtn = document.querySelector('.topbar-actions .ghost-button');
  const getStartedBtn = document.querySelector('.topbar-actions .primary-button');
  
  if (searchBtn) {
    searchBtn.addEventListener('click', () => {
      document.querySelector('.search-input')?.focus();
    });
  }
  
  if (getStartedBtn) {
    getStartedBtn.addEventListener('click', () => {
      window.location.href = 'screener.html';
    });
  }
}

// Handle search input with autocomplete
function handleSearchInput(e) {
  const query = e.target.value.toLowerCase().trim();
  
  if (query.length < 2) return;
  
  // Filter stocks by symbol or name
  const matches = allStocks.filter(stock => 
    stock.symbol.toLowerCase().includes(query) ||
    stock.name.toLowerCase().includes(query)
  ).slice(0, 5);
  
  // Show autocomplete suggestions (could be enhanced with a dropdown)
  console.log('Search matches:', matches.map(s => `${s.symbol} - ${s.name}`));
}

// Handle search action
async function handleSearch() {
  const searchInput = document.querySelector('.search-input');
  const query = searchInput?.value.trim().toUpperCase();
  
  if (!query) {
    alert('Please enter a stock symbol or company name');
    return;
  }
  
  // Find stock by symbol or name
  const stock = allStocks.find(s => 
    s.symbol === query || 
    s.name.toLowerCase().includes(query.toLowerCase())
  );
  
  if (stock) {
    await loadStockAnalysis(stock.symbol);
  } else {
    alert(`Stock "${query}" not found. Try symbols like HDFCBANK, TCS, RELIANCE, INFY`);
  }
}

// Load default stock (HDFCBANK)
async function loadDefaultStock() {
  await loadStockAnalysis('HDFCBANK');
}

// Load complete stock analysis
async function loadStockAnalysis(symbol) {
  try {
    const response = await fetch(`${API_BASE_URL}/stocks/${symbol}`);
    if (!response.ok) throw new Error('Stock not found');
    
    const data = await response.json();
    currentStock = data.stock;
    
    // Update all sections
    updateStockOverview();
    updateFinancialData();
    updateTechnicalAnalysis();
    updatePeerComparison();
    updateSidebar();
    
    console.log('Loaded analysis for:', symbol);
  } catch (error) {
    console.error('Error loading stock analysis:', error);
    showError(`Failed to load analysis for ${symbol}`);
  }
}

// Update stock overview section
function updateStockOverview() {
  if (!currentStock) return;
  
  const stock = currentStock;
  const change = stock.price - stock.previousClose;
  const changePercent = ((change / stock.previousClose) * 100).toFixed(2);
  const isPositive = change >= 0;
  
  // Update header
  const headerTitle = document.querySelector('.panel-card-header h3');
  if (headerTitle) {
    headerTitle.textContent = `${stock.name} (${stock.symbol})`;
  }
  
  // Update price section
  const priceValue = document.querySelector('.price-value');
  const priceChange = document.querySelector('.price-change');
  const priceMeta = document.querySelector('.price-meta');
  
  if (priceValue) {
    priceValue.textContent = `₹${stock.price.toFixed(2)}`;
  }
  
  if (priceChange) {
    priceChange.textContent = `${isPositive ? '+' : ''}${change.toFixed(2)} (${isPositive ? '+' : ''}${changePercent}%)`;
    priceChange.className = `price-change ${isPositive ? 'metric-positive' : 'metric-negative'}`;
  }
  
  if (priceMeta) {
    priceMeta.innerHTML = `
      <span>Open: ₹${stock.open.toFixed(2)}</span>
      <span>High: ₹${stock.high.toFixed(2)}</span>
      <span>Low: ₹${stock.low.toFixed(2)}</span>
      <span>Prev Close: ₹${stock.previousClose.toFixed(2)}</span>
    `;
  }
  
  // Update key stats
  const statBoxes = document.querySelectorAll('.key-stats-grid .stat-box');
  if (statBoxes.length >= 6) {
    statBoxes[0].querySelector('.stat-value').textContent = formatMarketCap(stock.marketCap);
    statBoxes[1].querySelector('.stat-value').textContent = stock.pe.toFixed(1);
    statBoxes[2].querySelector('.stat-value').textContent = stock.pb.toFixed(1);
    statBoxes[3].querySelector('.stat-value').textContent = `${stock.dividendYield.toFixed(1)}%`;
    
    const roeValue = statBoxes[4].querySelector('.stat-value');
    roeValue.textContent = `${stock.roe.toFixed(1)}%`;
    roeValue.className = `stat-value ${stock.roe > 15 ? 'metric-positive' : ''}`;
    
    statBoxes[5].querySelector('.stat-value').textContent = stock.debtToEquity.toFixed(2);
  }
}

// Update financial data (quarterly/annual)
function updateFinancialData() {
  if (!currentStock) return;
  
  const tbody = document.querySelector('.economy-table tbody');
  if (!tbody) return;
  
  // Generate financial data based on current stock
  const financials = generateFinancialData(currentStock, quarterlyView);
  
  tbody.innerHTML = financials.map(row => `
    <tr>
      <td><strong>${row.period}</strong></td>
      <td>${row.revenue}</td>
      <td>${row.profit}</td>
      <td>${row.eps}</td>
      <td>${row.opm}%</td>
      <td class="${row.growth >= 0 ? 'metric-positive' : 'metric-negative'}">${row.growth >= 0 ? '+' : ''}${row.growth}%</td>
    </tr>
  `).join('');
}

// Generate financial data
function generateFinancialData(stock, quarterly) {
  const baseRevenue = stock.marketCap / 50; // Rough estimate
  const baseProfit = baseRevenue * 0.15;
  const baseEPS = stock.price / stock.pe;
  
  if (quarterly) {
    return [
      {
        period: 'Q2 FY24',
        revenue: Math.round(baseRevenue * 1.1).toLocaleString('en-IN'),
        profit: Math.round(baseProfit * 1.12).toLocaleString('en-IN'),
        eps: (baseEPS * 1.1).toFixed(2),
        opm: (15 + Math.random() * 5).toFixed(1),
        growth: (12 + Math.random() * 8).toFixed(1)
      },
      {
        period: 'Q1 FY24',
        revenue: Math.round(baseRevenue * 1.05).toLocaleString('en-IN'),
        profit: Math.round(baseProfit * 1.08).toLocaleString('en-IN'),
        eps: (baseEPS * 1.05).toFixed(2),
        opm: (14 + Math.random() * 5).toFixed(1),
        growth: (10 + Math.random() * 6).toFixed(1)
      },
      {
        period: 'Q4 FY23',
        revenue: Math.round(baseRevenue).toLocaleString('en-IN'),
        profit: Math.round(baseProfit).toLocaleString('en-IN'),
        eps: baseEPS.toFixed(2),
        opm: (13 + Math.random() * 5).toFixed(1),
        growth: (8 + Math.random() * 5).toFixed(1)
      },
      {
        period: 'Q3 FY23',
        revenue: Math.round(baseRevenue * 0.95).toLocaleString('en-IN'),
        profit: Math.round(baseProfit * 0.92).toLocaleString('en-IN'),
        eps: (baseEPS * 0.95).toFixed(2),
        opm: (12 + Math.random() * 5).toFixed(1),
        growth: (6 + Math.random() * 4).toFixed(1)
      }
    ];
  } else {
    return [
      {
        period: 'FY 2023',
        revenue: Math.round(baseRevenue * 4).toLocaleString('en-IN'),
        profit: Math.round(baseProfit * 4).toLocaleString('en-IN'),
        eps: (baseEPS * 4).toFixed(2),
        opm: (14 + Math.random() * 4).toFixed(1),
        growth: (15 + Math.random() * 10).toFixed(1)
      },
      {
        period: 'FY 2022',
        revenue: Math.round(baseRevenue * 3.5).toLocaleString('en-IN'),
        profit: Math.round(baseProfit * 3.5).toLocaleString('en-IN'),
        eps: (baseEPS * 3.5).toFixed(2),
        opm: (13 + Math.random() * 4).toFixed(1),
        growth: (12 + Math.random() * 8).toFixed(1)
      },
      {
        period: 'FY 2021',
        revenue: Math.round(baseRevenue * 3).toLocaleString('en-IN'),
        profit: Math.round(baseProfit * 3).toLocaleString('en-IN'),
        eps: (baseEPS * 3).toFixed(2),
        opm: (12 + Math.random() * 4).toFixed(1),
        growth: (10 + Math.random() * 6).toFixed(1)
      }
    ];
  }
}

// Update technical analysis section
function updateTechnicalAnalysis() {
  if (!currentStock) return;
  
  const price = currentStock.price;
  
  // Moving averages
  const sma20 = price * (0.98 + Math.random() * 0.02);
  const sma50 = price * (0.96 + Math.random() * 0.04);
  const sma200 = price * (0.92 + Math.random() * 0.08);
  
  const maItems = document.querySelectorAll('.indicator-card:nth-child(1) .indicator-item');
  if (maItems.length >= 3) {
    maItems[0].innerHTML = `
      <span>20 SMA</span>
      <span>₹${sma20.toFixed(2)}</span>
      <span class="${price > sma20 ? 'metric-positive' : 'metric-negative'}">${price > sma20 ? 'Bullish' : 'Bearish'}</span>
    `;
    maItems[1].innerHTML = `
      <span>50 SMA</span>
      <span>₹${sma50.toFixed(2)}</span>
      <span class="${price > sma50 ? 'metric-positive' : 'metric-negative'}">${price > sma50 ? 'Bullish' : 'Bearish'}</span>
    `;
    maItems[2].innerHTML = `
      <span>200 SMA</span>
      <span>₹${sma200.toFixed(2)}</span>
      <span class="${price > sma200 ? 'metric-positive' : 'metric-negative'}">${price > sma200 ? 'Bullish' : 'Bearish'}</span>
    `;
  }
  
  // Momentum indicators
  const rsi = 40 + Math.random() * 40;
  const macd = -5 + Math.random() * 20;
  const stochastic = 30 + Math.random() * 50;
  
  const momentumItems = document.querySelectorAll('.indicator-card:nth-child(2) .indicator-item');
  if (momentumItems.length >= 3) {
    momentumItems[0].innerHTML = `
      <span>RSI (14)</span>
      <span>${rsi.toFixed(1)}</span>
      <span class="${rsi > 70 ? 'metric-negative' : rsi < 30 ? 'metric-positive' : 'metric-neutral'}">${rsi > 70 ? 'Overbought' : rsi < 30 ? 'Oversold' : 'Neutral'}</span>
    `;
    momentumItems[1].innerHTML = `
      <span>MACD</span>
      <span>${macd >= 0 ? '+' : ''}${macd.toFixed(1)}</span>
      <span class="${macd > 0 ? 'metric-positive' : 'metric-negative'}">${macd > 0 ? 'Bullish' : 'Bearish'}</span>
    `;
    momentumItems[2].innerHTML = `
      <span>Stochastic</span>
      <span>${stochastic.toFixed(1)}</span>
      <span class="metric-neutral">Neutral</span>
    `;
  }
  
  // Support & Resistance
  const resistance = price * 1.02;
  const support = price * 0.98;
  
  const srItems = document.querySelectorAll('.indicator-card:nth-child(3) .indicator-item');
  if (srItems.length >= 3) {
    srItems[0].innerHTML = `
      <span>Resistance 1</span>
      <span>₹${resistance.toFixed(0)}</span>
      <span class="metric-negative">+${((resistance - price) / price * 100).toFixed(1)}%</span>
    `;
    srItems[1].innerHTML = `
      <span>Current Price</span>
      <span>₹${price.toFixed(0)}</span>
      <span>—</span>
    `;
    srItems[2].innerHTML = `
      <span>Support 1</span>
      <span>₹${support.toFixed(0)}</span>
      <span class="metric-positive">${((support - price) / price * 100).toFixed(1)}%</span>
    `;
  }
  
  // 52-week range
  const week52Low = currentStock.low * 0.85;
  const week52High = currentStock.high * 1.15;
  const rangePercent = ((price - week52Low) / (week52High - week52Low) * 100);
  
  const rangeLabels = document.querySelectorAll('.range-bar .range-label');
  const rangeMarker = document.querySelector('.range-marker');
  const rangeInfo = document.querySelector('.range-info');
  
  if (rangeLabels.length >= 2) {
    rangeLabels[0].textContent = `₹${week52Low.toFixed(0)}`;
    rangeLabels[1].textContent = `₹${week52High.toFixed(0)}`;
  }
  
  if (rangeMarker) {
    rangeMarker.style.left = `${rangePercent}%`;
  }
  
  if (rangeInfo) {
    rangeInfo.textContent = `Current: ₹${price.toFixed(0)} (${rangePercent.toFixed(0)}% of 52W range)`;
  }
}

// Update peer comparison
async function updatePeerComparison() {
  if (!currentStock) return;
  
  try {
    // Get stocks from same sector
    const sectorStocks = allStocks
      .filter(s => s.sector === currentStock.sector && s.symbol !== currentStock.symbol)
      .slice(0, 3);
    
    const tbody = document.querySelector('.panel-card:has(h3:contains("Sector")) tbody') ||
                  document.querySelectorAll('.economy-table tbody')[1];
    
    if (!tbody) return;
    
    const peers = [currentStock, ...sectorStocks];
    
    tbody.innerHTML = peers.map((stock, index) => `
      <tr ${index === 0 ? 'class="highlight-row"' : ''}>
        <td><strong>${stock.name.split(' ')[0]}</strong></td>
        <td>₹${stock.price.toFixed(0)}</td>
        <td>${formatMarketCap(stock.marketCap)}</td>
        <td>${stock.pe.toFixed(1)}</td>
        <td>${stock.pb.toFixed(1)}</td>
        <td class="${stock.roe > 15 ? 'metric-positive' : ''}">${stock.roe.toFixed(1)}%</td>
        <td>${stock.dividendYield.toFixed(1)}%</td>
      </tr>
    `).join('');
  } catch (error) {
    console.error('Error updating peer comparison:', error);
  }
}

// Update sidebar sections
function updateSidebar() {
  if (!currentStock) return;
  
  // Analyst rating
  const ratingValue = document.querySelector('.rating-value');
  const ratingConfidence = document.querySelector('.rating-confidence');
  
  const pe = currentStock.pe;
  const roe = currentStock.roe;
  const rating = pe < 20 && roe > 15 ? 'BUY' : pe < 25 && roe > 12 ? 'HOLD' : 'SELL';
  const confidence = pe < 20 && roe > 15 ? 85 : pe < 25 && roe > 12 ? 65 : 45;
  
  if (ratingValue) {
    ratingValue.textContent = rating;
    ratingValue.className = `rating-value ${rating === 'BUY' ? 'metric-positive' : rating === 'HOLD' ? 'metric-neutral' : 'metric-negative'}`;
  }
  
  if (ratingConfidence) {
    ratingConfidence.textContent = `${rating === 'BUY' ? 'Strong Buy' : rating === 'HOLD' ? 'Hold' : 'Sell'} (${confidence}% confidence)`;
  }
  
  // Price targets
  const avgTarget = currentStock.price * (1.03 + Math.random() * 0.05);
  const highTarget = avgTarget * 1.08;
  const lowTarget = avgTarget * 0.92;
  const upside = ((avgTarget - currentStock.price) / currentStock.price * 100);
  
  const statItems = document.querySelectorAll('.stat-list .stat-item');
  if (statItems.length >= 4) {
    statItems[0].querySelector('.value').textContent = `₹${highTarget.toFixed(0)}`;
    statItems[1].querySelector('.value').textContent = `₹${avgTarget.toFixed(0)}`;
    statItems[2].querySelector('.value').textContent = `₹${lowTarget.toFixed(0)}`;
    
    const upsideValue = statItems[3].querySelector('.value');
    upsideValue.textContent = `${upside >= 0 ? '+' : ''}${upside.toFixed(1)}%`;
    upsideValue.className = `value ${upside >= 0 ? 'metric-positive' : 'metric-negative'}`;
  }
}

// Utility functions
function formatMarketCap(value) {
  if (value >= 100000) {
    return `₹${(value / 100000).toFixed(1)}L Cr`;
  } else if (value >= 1000) {
    return `₹${(value / 1000).toFixed(1)}K Cr`;
  }
  return `₹${value.toFixed(0)} Cr`;
}

function showError(message) {
  const errorDiv = document.createElement('div');
  errorDiv.className = 'error-message';
  errorDiv.style.cssText = 'position: fixed; top: 20px; right: 20px; background: #ef4444; color: white; padding: 1rem 1.5rem; border-radius: 8px; z-index: 1000; box-shadow: 0 4px 12px rgba(0,0,0,0.15);';
  errorDiv.textContent = message;
  
  document.body.appendChild(errorDiv);
  
  setTimeout(() => {
    errorDiv.remove();
  }, 5000);
}

console.log('Analysis script loaded');

// Made with Bob
