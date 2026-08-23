// Aladdin Investing - Markets Page JavaScript
// Iteration 1: Interactive buttons with mock data

// Mock Data
const mockData = {
  countries: {
    IN: { name: 'India', currency: 'INR', symbol: '₹' },
    US: { name: 'USA', currency: 'USD', symbol: '$' },
    CN: { name: 'China', currency: 'CNY', symbol: '¥' },
    JP: { name: 'Japan', currency: 'JPY', symbol: '¥' },
    BR: { name: 'Brazil', currency: 'BRL', symbol: 'R$' },
    TW: { name: 'Taiwan', currency: 'TWD', symbol: 'NT$' },
    KR: { name: 'Korea', currency: 'KRW', symbol: '₩' },
    DE: { name: 'Germany', currency: 'EUR', symbol: '€' }
  },
  
  stocks: {
    IN: {
      EQUITY: {
        FINANCIAL: {
          PRIVATE_BANKS: {
            LARGE: [
              { symbol: 'HDFCBANK', name: 'HDFC Bank Ltd', price: 1650.25, change: 1.2, marketCap: 920000, pe: 18.5, pb: 2.8, roe: 16.2 },
              { symbol: 'ICICIBANK', name: 'ICICI Bank Ltd', price: 950.50, change: 0.8, marketCap: 670000, pe: 16.2, pb: 2.3, roe: 15.8 },
              { symbol: 'AXISBANK', name: 'Axis Bank Ltd', price: 1020.75, change: -0.3, marketCap: 310000, pe: 14.8, pb: 1.9, roe: 14.5 }
            ],
            MID: [
              { symbol: 'INDUSINDBK', name: 'IndusInd Bank', price: 1450.30, change: 0.5, marketCap: 112000, pe: 15.2, pb: 2.1, roe: 13.8 },
              { symbol: 'BANDHANBNK', name: 'Bandhan Bank', price: 245.80, change: -0.8, marketCap: 39500, pe: 12.5, pb: 1.5, roe: 12.2 }
            ]
          },
          PUBLIC_BANKS: {
            LARGE: [
              { symbol: 'SBIN', name: 'State Bank of India', price: 620.40, change: 1.5, marketCap: 550000, pe: 9.8, pb: 1.2, roe: 18.2 },
              { symbol: 'PNB', name: 'Punjab National Bank', price: 95.25, change: 2.1, marketCap: 105000, pe: 8.5, pb: 0.9, roe: 15.5 }
            ]
          }
        },
        TECHNOLOGY: {
          IT_SERVICES: {
            LARGE: [
              { symbol: 'TCS', name: 'Tata Consultancy Services', price: 3520.80, change: 0.5, marketCap: 1280000, pe: 28.3, pb: 12.5, roe: 42.8 },
              { symbol: 'INFY', name: 'Infosys Ltd', price: 1420.60, change: 0.3, marketCap: 590000, pe: 24.6, pb: 8.2, roe: 28.5 },
              { symbol: 'WIPRO', name: 'Wipro Ltd', price: 445.30, change: -0.2, marketCap: 245000, pe: 22.1, pb: 3.8, roe: 16.8 }
            ]
          }
        }
      }
    },
    US: {
      EQUITY: {
        TECHNOLOGY: {
          SOFTWARE: {
            LARGE: [
              { symbol: 'MSFT', name: 'Microsoft Corporation', price: 378.50, change: 1.8, marketCap: 2800000, pe: 35.2, pb: 12.8, roe: 38.5 },
              { symbol: 'AAPL', name: 'Apple Inc', price: 195.20, change: 0.9, marketCap: 3050000, pe: 31.5, pb: 48.2, roe: 147.2 }
            ]
          }
        }
      }
    }
  }
};

// State Management
const state = {
  selectedCountry: 'IN',
  selectedAsset: 'EQUITY',
  selectedSector: 'FINANCIAL',
  selectedIndustry: 'PRIVATE_BANKS',
  selectedMarketCap: 'LARGE'
};

// Initialize on page load
document.addEventListener('DOMContentLoaded', function() {
  console.log('Markets page loaded - Initializing...');
  initializeEventListeners();
  updateDisplay();
});

// Initialize all event listeners
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

  const industries = {
    FINANCIAL: [
      { code: 'PRIVATE_BANKS', name: 'Private Banks' },
      { code: 'PUBLIC_BANKS', name: 'Public Banks' },
      { code: 'NBFC', name: 'NBFCs' },
      { code: 'INSURANCE', name: 'Insurance' },
      { code: 'ASSET_MGMT', name: 'Asset Management' }
    ],
    TECHNOLOGY: [
      { code: 'IT_SERVICES', name: 'IT Services' },
      { code: 'SOFTWARE', name: 'Software Products' },
      { code: 'HARDWARE', name: 'Hardware' },
      { code: 'SEMICONDUCTORS', name: 'Semiconductors' }
    ],
    HEALTHCARE: [
      { code: 'PHARMA', name: 'Pharmaceuticals' },
      { code: 'HOSPITALS', name: 'Hospitals' },
      { code: 'DIAGNOSTICS', name: 'Diagnostics' },
      { code: 'MEDICAL_DEVICES', name: 'Medical Devices' }
    ]
  };

  const sectorIndustries = industries[sector] || industries.FINANCIAL;
  
  industryList.innerHTML = '<h3>Industries</h3>' + sectorIndustries.map(ind => `
    <button class="industry-btn ${ind.code === state.selectedIndustry ? 'is-active' : ''}" 
            data-industry="${ind.code}">
      ${ind.name}
    </button>
  `).join('');

  // Re-attach event listeners
  industryList.querySelectorAll('.industry-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      const industry = this.getAttribute('data-industry');
      selectIndustry(industry);
    });
  });
}

// Update display with current selections
function updateDisplay() {
  updateResultsTitle();
  updateStocksTable();
  updateResultsCount();
}

// Update results title
function updateResultsTitle() {
  const titleEl = document.getElementById('results-title');
  if (!titleEl) return;

  const country = mockData.countries[state.selectedCountry];
  const assetName = state.selectedAsset.replace('_', ' ');
  const sectorName = state.selectedSector.replace('_', ' ');
  const industryName = state.selectedIndustry.replace('_', ' ');
  const capName = state.selectedMarketCap.replace('_', ' ') + ' Cap';

  titleEl.textContent = `${country.name} → ${assetName} → ${sectorName} → ${industryName} → ${capName}`;
}

// Update stocks table
function updateStocksTable() {
  const tbody = document.getElementById('stocks-table-body');
  if (!tbody) return;

  const stocks = getStocksForCurrentSelection();
  const currency = mockData.countries[state.selectedCountry].symbol;

  if (stocks && stocks.length > 0) {
    tbody.innerHTML = stocks.map(stock => `
      <tr>
        <td><strong>${stock.symbol}</strong></td>
        <td>${stock.name}</td>
        <td>${getSectorName(state.selectedSector)}</td>
        <td>${currency}${stock.price.toFixed(2)}</td>
        <td class="${stock.change >= 0 ? 'metric-positive' : 'metric-negative'}">
          ${stock.change >= 0 ? '+' : ''}${stock.change.toFixed(2)}%
        </td>
        <td>${currency}${(stock.marketCap / 10000).toFixed(1)}L Cr</td>
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

// Get stocks for current selection
function getStocksForCurrentSelection() {
  try {
    const countryData = mockData.stocks[state.selectedCountry];
    if (!countryData) return [];

    const assetData = countryData[state.selectedAsset];
    if (!assetData) return [];

    const sectorData = assetData[state.selectedSector];
    if (!sectorData) return [];

    const industryData = sectorData[state.selectedIndustry];
    if (!industryData) return [];

    return industryData[state.selectedMarketCap] || [];
  } catch (error) {
    console.error('Error getting stocks:', error);
    return [];
  }
}

// Update results count
function updateResultsCount() {
  const countEl = document.getElementById('results-count');
  if (!countEl) return;

  const stocks = getStocksForCurrentSelection();
  countEl.textContent = `${stocks.length} stocks found`;
}

// Helper function to get sector name
function getSectorName(sectorCode) {
  const names = {
    FINANCIAL: 'Financial Institutions',
    TECHNOLOGY: 'Technology',
    HEALTHCARE: 'Healthcare',
    CONSUMER: 'Consumer Goods',
    ENERGY: 'Energy',
    INDUSTRIAL: 'Industrials'
  };
  return names[sectorCode] || sectorCode;
}

// Log initialization
console.log('Markets script loaded successfully');
console.log('Current state:', state);

// Made with Bob
