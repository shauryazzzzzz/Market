// Aladdin Investing - Markets Page JavaScript V2
// Connected to backend API with real stock data

// API Configuration
const API_BASE_URL = 'http://localhost:3001/api';

// State Management
const state = {
  selectedCountry: 'IN',
  selectedAsset: 'EQUITY',
  selectedSector: 'Financial',
  selectedIndustry: 'Private Banks',
  selectedMarketCap: 'LARGE',
  allStocks: [],
  loading: false
};

// Initialize on page load
document.addEventListener('DOMContentLoaded', function() {
  console.log('Markets page loaded - Initializing with API...');
  initializeEventListeners();
  fetchStocksData();
});

// Fetch stocks data from API
async function fetchStocksData() {
  try {
    state.loading = true;
    showLoading();
    
    console.log('Fetching stocks from API...');
    const response = await fetch(`${API_BASE_URL}/stocks`);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const result = await response.json();
    
    if (result.success && result.data) {
      state.allStocks = result.data;
      console.log(`✓ Loaded ${result.data.length} stocks from API`);
      updateDisplay();
    } else {
      throw new Error('Invalid API response');
    }
    
    state.loading = false;
    hideLoading();
  } catch (error) {
    console.error('✗ Error fetching stocks:', error);
    state.loading = false;
    hideLoading();
    showError('Failed to load stock data. Please ensure the API server is running on port 3001.');
  }
}

// Show loading indicator
function showLoading() {
  const tbody = document.getElementById('stocks-table-body');
  if (tbody) {
    tbody.innerHTML = `
      <tr>
        <td colspan="9" style="text-align: center; padding: 40px;">
          <div style="font-size: 18px; color: var(--muted);">
            ⏳ Loading stock data...
          </div>
        </td>
      </tr>
    `;
  }
}

// Hide loading indicator
function hideLoading() {
  // Loading is hidden when data is displayed
}

// Show error message
function showError(message) {
  const tbody = document.getElementById('stocks-table-body');
  if (tbody) {
    tbody.innerHTML = `
      <tr>
        <td colspan="9" style="text-align: center; padding: 40px;">
          <div style="color: var(--negative); font-size: 18px; margin-bottom: 10px;">
            ⚠️ ${message}
          </div>
          <button onclick="fetchStocksData()" class="primary-button">
            Retry
          </button>
        </td>
      </tr>
    `;
  }
}

// Initialize event listeners
function initializeEventListeners() {
  // Geography tabs
  const geographyTabs = document.querySelectorAll('.geography-tab');
  geographyTabs.forEach(tab => {
    tab.addEventListener('click', function() {
      const country = this.getAttribute('data-country');
      selectGeography(country);
    });
  });

  // Asset class cards
  const assetCards = document.querySelectorAll('.asset-card');
  assetCards.forEach(card => {
    card.addEventListener('click', function() {
      const asset = this.getAttribute('data-asset');
      selectAsset(asset);
    });
  });

  // Sector buttons
  const sectorBtns = document.querySelectorAll('.sector-btn');
  sectorBtns.forEach(btn => {
    btn.addEventListener('click', function() {
      const sector = this.getAttribute('data-sector');
      selectSector(sector);
    });
  });

  // Industry buttons
  const industryBtns = document.querySelectorAll('.industry-btn');
  industryBtns.forEach(btn => {
    btn.addEventListener('click', function() {
      const industry = this.getAttribute('data-industry');
      selectIndustry(industry);
    });
  });

  // Market cap buttons
  const marketCapBtns = document.querySelectorAll('.marketcap-btn');
  marketCapBtns.forEach(btn => {
    btn.addEventListener('click', function() {
      const cap = this.getAttribute('data-cap');
      selectMarketCap(cap);
    });
  });
}

// Selection handlers
function selectGeography(country) {
  state.selectedCountry = country;
  updateActiveState('.geography-tab', `[data-country="${country}"]`);
  updateDisplay();
  console.log('Selected country:', country);
}

function selectAsset(asset) {
  state.selectedAsset = asset;
  updateActiveState('.asset-card', `[data-asset="${asset}"]`);
  updateDisplay();
  console.log('Selected asset:', asset);
}

function selectSector(sector) {
  state.selectedSector = sector;
  updateActiveState('.sector-btn', `[data-sector="${sector}"]`);
  updateIndustryButtons(sector);
  updateDisplay();
  console.log('Selected sector:', sector);
}

function selectIndustry(industry) {
  state.selectedIndustry = industry;
  updateActiveState('.industry-btn', `[data-industry="${industry}"]`);
  updateDisplay();
  console.log('Selected industry:', industry);
}

function selectMarketCap(cap) {
  state.selectedMarketCap = cap;
  updateActiveState('.marketcap-btn', `[data-cap="${cap}"]`);
  updateDisplay();
  console.log('Selected market cap:', cap);
}

// Update active state for buttons
function updateActiveState(selector, activeSelector) {
  document.querySelectorAll(selector).forEach(el => el.classList.remove('is-active'));
  const activeEl = document.querySelector(activeSelector);
  if (activeEl) {
    activeEl.classList.add('is-active');
  }
}

// Update industry buttons based on selected sector
function updateIndustryButtons(sector) {
  const industryList = document.querySelector('.industry-list');
  if (!industryList) return;

  // Get unique industries for the selected sector from actual data
  const industries = [...new Set(
    state.allStocks
      .filter(stock => stock.sector === sector)
      .map(stock => stock.industry)
  )];

  if (industries.length === 0) {
    industryList.innerHTML = '<h3>Industries</h3><p style="color: var(--muted);">No industries found</p>';
    return;
  }

  industryList.innerHTML = '<h3>Industries</h3>' + industries.map(ind => `
    <button class="industry-btn ${ind === state.selectedIndustry ? 'is-active' : ''}" 
            data-industry="${ind}">
      ${ind}
    </button>
  `).join('');

  // Re-attach event listeners
  industryList.querySelectorAll('.industry-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      const industry = this.getAttribute('data-industry');
      selectIndustry(industry);
    });
  });

  // Auto-select first industry if current selection is not available
  if (!industries.includes(state.selectedIndustry) && industries.length > 0) {
    state.selectedIndustry = industries[0];
  }
}

// Update display with current selections
function updateDisplay() {
  if (state.allStocks.length === 0) return;
  
  updateResultsTitle();
  updateStocksTable();
  updateResultsCount();
}

// Update results title
function updateResultsTitle() {
  const titleEl = document.getElementById('results-title');
  if (!titleEl) return;

  const countryNames = {
    'IN': 'India',
    'US': 'USA',
    'CN': 'China',
    'JP': 'Japan',
    'BR': 'Brazil',
    'TW': 'Taiwan',
    'KR': 'Korea',
    'DE': 'Germany'
  };

  const country = countryNames[state.selectedCountry] || state.selectedCountry;
  const assetName = state.selectedAsset.replace('_', ' ');
  const sectorName = state.selectedSector;
  const industryName = state.selectedIndustry;
  const capName = state.selectedMarketCap.replace('_', ' ') + ' Cap';

  titleEl.textContent = `${country} → ${assetName} → ${sectorName} → ${industryName} → ${capName}`;
}

// Update stocks table
function updateStocksTable() {
  const tbody = document.getElementById('stocks-table-body');
  if (!tbody) return;

  const stocks = getFilteredStocks();

  if (stocks && stocks.length > 0) {
    tbody.innerHTML = stocks.map(stock => `
      <tr>
        <td><strong>${stock.symbol}</strong></td>
        <td>${stock.name}</td>
        <td>${stock.sector}</td>
        <td>₹${stock.price.toFixed(2)}</td>
        <td class="${stock.pChange >= 0 ? 'metric-positive' : 'metric-negative'}">
          ${stock.pChange >= 0 ? '+' : ''}${stock.pChange.toFixed(2)}%
        </td>
        <td>₹${(stock.marketCap / 10000).toFixed(1)}L Cr</td>
        <td>${stock.pe.toFixed(1)}</td>
        <td>${stock.pb.toFixed(1)}</td>
        <td class="metric-positive">${stock.roe.toFixed(1)}%</td>
      </tr>
    `).join('');
  } else {
    tbody.innerHTML = `
      <tr>
        <td colspan="9" style="text-align: center; padding: 40px; color: var(--muted);">
          No stocks found for this combination. Try different filters.
        </td>
      </tr>
    `;
  }
}

// Get filtered stocks based on current selections
function getFilteredStocks() {
  let filtered = state.allStocks;

  // Filter by sector
  if (state.selectedSector) {
    filtered = filtered.filter(stock => stock.sector === state.selectedSector);
  }

  // Filter by industry
  if (state.selectedIndustry) {
    filtered = filtered.filter(stock => stock.industry === state.selectedIndustry);
  }

  // Filter by market cap
  const marketCapRanges = {
    'LARGE': [100000, Infinity],
    'MID': [10000, 100000],
    'SMALL': [1000, 10000],
    'MICRO': [0, 1000]
  };

  const [minCap, maxCap] = marketCapRanges[state.selectedMarketCap] || [0, Infinity];
  filtered = filtered.filter(stock => stock.marketCap >= minCap && stock.marketCap <= maxCap);

  return filtered;
}

// Update results count
function updateResultsCount() {
  const countEl = document.getElementById('results-count');
  if (!countEl) return;

  const stocks = getFilteredStocks();
  countEl.textContent = `${stocks.length} stocks found`;
}

// Log initialization
console.log('Markets script V2 loaded - Connected to API');
console.log('API Base URL:', API_BASE_URL);

// Made with Bob
