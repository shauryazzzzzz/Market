// Aladdin Investing - Stock Screener JavaScript
// Iteration 1: Interactive filters with mock data

// Mock Stock Data
const mockStocksData = [
  { symbol: 'RELIANCE', name: 'Reliance Industries', sector: 'Energy', price: 2450.80, change: 1.2, marketCap: 1650000, pe: 24.5, pb: 2.8, roe: 12.5, dividend: 0.5, volume: 5.2 },
  { symbol: 'TCS', name: 'Tata Consultancy Services', sector: 'Technology', price: 3520.60, change: 0.8, marketCap: 1280000, pe: 28.3, pb: 12.5, roe: 42.8, dividend: 1.8, volume: 2.1 },
  { symbol: 'HDFCBANK', name: 'HDFC Bank', sector: 'Financial', price: 1650.25, change: 1.5, marketCap: 920000, pe: 18.5, pb: 2.8, roe: 16.2, dividend: 1.2, volume: 8.5 },
  { symbol: 'INFY', name: 'Infosys', sector: 'Technology', price: 1420.40, change: 0.3, marketCap: 590000, pe: 24.6, pb: 8.2, roe: 28.5, dividend: 2.1, volume: 3.8 },
  { symbol: 'ICICIBANK', name: 'ICICI Bank', sector: 'Financial', price: 950.50, change: 0.9, marketCap: 670000, pe: 16.2, pb: 2.3, roe: 15.8, dividend: 1.5, volume: 6.2 },
  { symbol: 'HINDUNILVR', name: 'Hindustan Unilever', sector: 'Consumer', price: 2380.30, change: -0.2, marketCap: 560000, pe: 58.2, pb: 18.5, roe: 82.5, dividend: 1.9, volume: 1.2 },
  { symbol: 'BHARTIARTL', name: 'Bharti Airtel', sector: 'Telecom', price: 1180.75, change: 1.8, marketCap: 680000, pe: 42.5, pb: 8.2, roe: 18.5, dividend: 0.8, volume: 4.5 },
  { symbol: 'ITC', name: 'ITC Ltd', sector: 'Consumer', price: 420.60, change: 0.5, marketCap: 520000, pe: 28.7, pb: 5.2, roe: 22.8, dividend: 5.2, volume: 12.5 },
  { symbol: 'SBIN', name: 'State Bank of India', sector: 'Financial', price: 620.40, change: 2.1, marketCap: 550000, pe: 9.8, pb: 1.2, roe: 18.2, dividend: 2.8, volume: 15.8 },
  { symbol: 'LT', name: 'Larsen & Toubro', sector: 'Industrial', price: 3280.90, change: 1.3, marketCap: 450000, pe: 32.4, pb: 4.5, roe: 15.8, dividend: 1.4, volume: 2.8 },
  { symbol: 'ASIANPAINT', name: 'Asian Paints', sector: 'Consumer', price: 2950.40, change: 1.2, marketCap: 282000, pe: 68.5, pb: 22.8, roe: 28.5, dividend: 1.1, volume: 0.8 },
  { symbol: 'MARUTI', name: 'Maruti Suzuki', sector: 'Automobile', price: 10850.30, change: 0.5, marketCap: 328000, pe: 28.5, pb: 3.8, roe: 14.2, dividend: 1.8, volume: 1.5 },
  { symbol: 'TITAN', name: 'Titan Company', sector: 'Consumer', price: 3420.50, change: 4.2, marketCap: 305000, pe: 85.2, pb: 28.5, roe: 32.8, dividend: 0.8, volume: 2.1 },
  { symbol: 'SUNPHARMA', name: 'Sun Pharmaceutical', sector: 'Healthcare', price: 1450.80, change: 0.8, marketCap: 348000, pe: 38.5, pb: 5.2, roe: 12.8, dividend: 0.9, volume: 3.2 },
  { symbol: 'NESTLEIND', name: 'Nestle India', sector: 'Consumer', price: 24500.60, change: 0.8, marketCap: 236000, pe: 78.5, pb: 58.2, roe: 85.2, dividend: 2.5, volume: 0.2 },
  { symbol: 'KOTAKBANK', name: 'Kotak Mahindra Bank', sector: 'Financial', price: 1850.40, change: 1.1, marketCap: 368000, pe: 18.8, pb: 2.5, roe: 14.5, dividend: 0.6, volume: 3.5 },
  { symbol: 'AXISBANK', name: 'Axis Bank', sector: 'Financial', price: 1020.75, change: -0.3, marketCap: 310000, pe: 14.8, pb: 1.9, roe: 14.5, dividend: 1.2, volume: 8.2 },
  { symbol: 'WIPRO', name: 'Wipro', sector: 'Technology', price: 445.30, change: -0.2, marketCap: 245000, pe: 22.1, pb: 3.8, roe: 16.8, dividend: 1.5, volume: 5.8 },
  { symbol: 'ULTRACEMCO', name: 'UltraTech Cement', sector: 'Industrial', price: 9250.80, change: 1.5, marketCap: 268000, pe: 42.5, pb: 5.8, roe: 16.2, dividend: 0.7, volume: 0.5 },
  { symbol: 'TATAMOTORS', name: 'Tata Motors', sector: 'Automobile', price: 785.30, change: 6.5, marketCap: 285000, pe: 18.5, pb: 2.2, roe: 22.5, dividend: 0.0, volume: 28.5 }
];

// Filter State
const filters = {
  sector: 'all',
  marketCapMin: 0,
  marketCapMax: 2000000,
  peMin: 0,
  peMax: 100,
  pbMin: 0,
  pbMax: 100,
  roeMin: 0,
  roeMax: 100,
  dividendMin: 0,
  priceMin: 0,
  priceMax: 50000
};

// Initialize on page load
document.addEventListener('DOMContentLoaded', function() {
  console.log('Screener page loaded - Initializing...');
  initializeEventListeners();
  applyFilters();
});

// Initialize event listeners
function initializeEventListeners() {
  // Sector filter
  const sectorSelect = document.getElementById('sector-filter');
  if (sectorSelect) {
    sectorSelect.addEventListener('change', function() {
      filters.sector = this.value;
      applyFilters();
    });
  }
  
  // Market Cap filter
  const marketCapMin = document.getElementById('marketcap-min');
  const marketCapMax = document.getElementById('marketcap-max');
  if (marketCapMin) {
    marketCapMin.addEventListener('input', function() {
      filters.marketCapMin = parseFloat(this.value) * 10000; // Convert to Cr
      applyFilters();
    });
  }
  if (marketCapMax) {
    marketCapMax.addEventListener('input', function() {
      filters.marketCapMax = parseFloat(this.value) * 10000;
      applyFilters();
    });
  }
  
  // P/E Ratio filter
  const peMin = document.getElementById('pe-min');
  const peMax = document.getElementById('pe-max');
  if (peMin) {
    peMin.addEventListener('input', function() {
      filters.peMin = parseFloat(this.value);
      applyFilters();
    });
  }
  if (peMax) {
    peMax.addEventListener('input', function() {
      filters.peMax = parseFloat(this.value);
      applyFilters();
    });
  }
  
  // P/B Ratio filter
  const pbMin = document.getElementById('pb-min');
  const pbMax = document.getElementById('pb-max');
  if (pbMin) {
    pbMin.addEventListener('input', function() {
      filters.pbMin = parseFloat(this.value);
      applyFilters();
    });
  }
  if (pbMax) {
    pbMax.addEventListener('input', function() {
      filters.pbMax = parseFloat(this.value);
      applyFilters();
    });
  }
  
  // ROE filter
  const roeMin = document.getElementById('roe-min');
  const roeMax = document.getElementById('roe-max');
  if (roeMin) {
    roeMin.addEventListener('input', function() {
      filters.roeMin = parseFloat(this.value);
      applyFilters();
    });
  }
  if (roeMax) {
    roeMax.addEventListener('input', function() {
      filters.roeMax = parseFloat(this.value);
      applyFilters();
    });
  }
  
  // Dividend Yield filter
  const dividendMin = document.getElementById('dividend-min');
  if (dividendMin) {
    dividendMin.addEventListener('input', function() {
      filters.dividendMin = parseFloat(this.value);
      applyFilters();
    });
  }
  
  // Price filter
  const priceMin = document.getElementById('price-min');
  const priceMax = document.getElementById('price-max');
  if (priceMin) {
    priceMin.addEventListener('input', function() {
      filters.priceMin = parseFloat(this.value);
      applyFilters();
    });
  }
  if (priceMax) {
    priceMax.addEventListener('input', function() {
      filters.priceMax = parseFloat(this.value);
      applyFilters();
    });
  }
  
  // Reset button
  const resetBtn = document.getElementById('reset-filters');
  if (resetBtn) {
    resetBtn.addEventListener('click', resetFilters);
  }
  
  // Apply button
  const applyBtn = document.getElementById('apply-filters');
  if (applyBtn) {
    applyBtn.addEventListener('click', applyFilters);
  }
}

// Apply filters
function applyFilters() {
  const filteredStocks = mockStocksData.filter(stock => {
    // Sector filter
    if (filters.sector !== 'all' && stock.sector !== filters.sector) {
      return false;
    }
    
    // Market Cap filter
    if (stock.marketCap < filters.marketCapMin || stock.marketCap > filters.marketCapMax) {
      return false;
    }
    
    // P/E Ratio filter
    if (stock.pe < filters.peMin || stock.pe > filters.peMax) {
      return false;
    }
    
    // P/B Ratio filter
    if (stock.pb < filters.pbMin || stock.pb > filters.pbMax) {
      return false;
    }
    
    // ROE filter
    if (stock.roe < filters.roeMin || stock.roe > filters.roeMax) {
      return false;
    }
    
    // Dividend Yield filter
    if (stock.dividend < filters.dividendMin) {
      return false;
    }
    
    // Price filter
    if (stock.price < filters.priceMin || stock.price > filters.priceMax) {
      return false;
    }
    
    return true;
  });
  
  renderResults(filteredStocks);
  updateResultsCount(filteredStocks.length);
  
  console.log('Filters applied:', filters);
  console.log('Filtered stocks:', filteredStocks.length);
}

// Reset filters
function resetFilters() {
  filters.sector = 'all';
  filters.marketCapMin = 0;
  filters.marketCapMax = 2000000;
  filters.peMin = 0;
  filters.peMax = 100;
  filters.pbMin = 0;
  filters.pbMax = 100;
  filters.roeMin = 0;
  filters.roeMax = 100;
  filters.dividendMin = 0;
  filters.priceMin = 0;
  filters.priceMax = 50000;
  
  // Reset form inputs
  document.getElementById('sector-filter').value = 'all';
  document.getElementById('marketcap-min').value = '0';
  document.getElementById('marketcap-max').value = '200';
  document.getElementById('pe-min').value = '0';
  document.getElementById('pe-max').value = '100';
  document.getElementById('pb-min').value = '0';
  document.getElementById('pb-max').value = '100';
  document.getElementById('roe-min').value = '0';
  document.getElementById('roe-max').value = '100';
  document.getElementById('dividend-min').value = '0';
  document.getElementById('price-min').value = '0';
  document.getElementById('price-max').value = '50000';
  
  applyFilters();
  
  console.log('Filters reset');
}

// Render results
function renderResults(stocks) {
  const tbody = document.getElementById('screener-results-body');
  if (!tbody) return;
  
  if (stocks.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="10" style="text-align: center; padding: 40px; color: var(--muted);">
          No stocks match your filters. Try adjusting the criteria.
        </td>
      </tr>
    `;
    return;
  }
  
  tbody.innerHTML = stocks.map(stock => `
    <tr>
      <td><strong>${stock.symbol}</strong></td>
      <td>${stock.name}</td>
      <td><span class="badge badge-${stock.sector.toLowerCase()}">${stock.sector}</span></td>
      <td>₹${stock.price.toFixed(2)}</td>
      <td class="${stock.change >= 0 ? 'metric-positive' : 'metric-negative'}">
        ${stock.change >= 0 ? '+' : ''}${stock.change.toFixed(2)}%
      </td>
      <td>₹${(stock.marketCap / 10000).toFixed(1)}L Cr</td>
      <td>${stock.pe.toFixed(1)}</td>
      <td>${stock.pb.toFixed(1)}</td>
      <td class="metric-positive">${stock.roe.toFixed(1)}%</td>
      <td class="metric-positive">${stock.dividend.toFixed(1)}%</td>
    </tr>
  `).join('');
}

// Update results count
function updateResultsCount(count) {
  const countEl = document.getElementById('results-count');
  if (countEl) {
    countEl.textContent = `${count} stocks found`;
  }
}

// Log initialization
console.log('Screener script loaded successfully');
console.log('Total stocks available:', mockStocksData.length);

// Made with Bob
