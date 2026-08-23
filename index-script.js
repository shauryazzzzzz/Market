// Aladdin Investing - Home Page JavaScript
// Populates dynamic content with market data

// API Configuration
const API_BASE_URL = 'http://localhost:3001/api';

// Initialize on page load
document.addEventListener('DOMContentLoaded', function() {
  console.log('Home page loaded - Initializing...');
  initializeHomePage();
});

// Initialize home page
async function initializeHomePage() {
  try {
    // Fetch market data
    await Promise.all([
      populateTicker(),
      populateHeroStats(),
      populateSpotlight(),
      populateOverview(),
      populateHeatmap(),
      populateMacroTabs(),
      populateEconomyTable()
    ]);
    
    console.log('✓ Home page initialized successfully');
  } catch (error) {
    console.error('✗ Error initializing home page:', error);
  }
}

// Populate ticker strip
async function populateTicker() {
  try {
    const response = await fetch(`${API_BASE_URL}/indices`);
    const result = await response.json();
    
    if (result.success && result.data) {
      const tickerTrack = document.getElementById('ticker-track');
      if (!tickerTrack) return;
      
      tickerTrack.innerHTML = result.data.map(index => `
        <div class="ticker-item">
          <span class="ticker-label">${index.name}</span>
          <span class="ticker-value">${index.value.toFixed(2)}</span>
          <span class="ticker-change ${index.pChange >= 0 ? 'positive' : 'negative'}">
            ${index.pChange >= 0 ? '+' : ''}${index.pChange.toFixed(2)}%
          </span>
        </div>
      `).join('');
    }
  } catch (error) {
    console.error('Error loading ticker:', error);
  }
}

// Populate hero stats
async function populateHeroStats() {
  try {
    const response = await fetch(`${API_BASE_URL}/stocks`);
    const result = await response.json();
    
    if (result.success && result.data) {
      const heroStats = document.getElementById('hero-stats');
      if (!heroStats) return;
      
      const totalStocks = result.data.length;
      const avgChange = (result.data.reduce((sum, s) => sum + s.pChange, 0) / totalStocks).toFixed(2);
      const gainers = result.data.filter(s => s.pChange > 0).length;
      const losers = result.data.filter(s => s.pChange < 0).length;
      
      heroStats.innerHTML = `
        <div class="stat-item">
          <span class="stat-value">${totalStocks}</span>
          <span class="stat-label">Stocks Tracked</span>
        </div>
        <div class="stat-item">
          <span class="stat-value ${avgChange >= 0 ? 'positive' : 'negative'}">
            ${avgChange >= 0 ? '+' : ''}${avgChange}%
          </span>
          <span class="stat-label">Avg Change</span>
        </div>
        <div class="stat-item">
          <span class="stat-value positive">${gainers}</span>
          <span class="stat-label">Gainers</span>
        </div>
        <div class="stat-item">
          <span class="stat-value negative">${losers}</span>
          <span class="stat-label">Losers</span>
        </div>
      `;
    }
  } catch (error) {
    console.error('Error loading hero stats:', error);
  }
}

// Populate spotlight grid
async function populateSpotlight() {
  try {
    const response = await fetch(`${API_BASE_URL}/stocks/movers/gainers`);
    const result = await response.json();
    
    if (result.success && result.data) {
      const spotlightGrid = document.getElementById('spotlight-grid');
      if (!spotlightGrid) return;
      
      const topGainers = result.data.slice(0, 5);
      spotlightGrid.innerHTML = topGainers.map(stock => `
        <div class="spotlight-item">
          <div class="spotlight-header">
            <strong>${stock.symbol}</strong>
            <span class="metric-positive">+${stock.pChange.toFixed(2)}%</span>
          </div>
          <p class="spotlight-detail">${stock.name}</p>
        </div>
      `).join('');
    }
  } catch (error) {
    console.error('Error loading spotlight:', error);
  }
}

// Populate overview grid
async function populateOverview() {
  try {
    const response = await fetch(`${API_BASE_URL}/stocks`);
    const result = await response.json();
    
    if (result.success && result.data) {
      const overviewGrid = document.getElementById('overview-grid');
      if (!overviewGrid) return;
      
      const sectors = {};
      result.data.forEach(stock => {
        if (!sectors[stock.sector]) {
          sectors[stock.sector] = { count: 0, totalChange: 0 };
        }
        sectors[stock.sector].count++;
        sectors[stock.sector].totalChange += stock.pChange;
      });
      
      overviewGrid.innerHTML = Object.entries(sectors).map(([sector, data]) => {
        const avgChange = (data.totalChange / data.count).toFixed(2);
        return `
          <div class="overview-item">
            <span class="overview-label">${sector}</span>
            <span class="overview-value ${avgChange >= 0 ? 'positive' : 'negative'}">
              ${avgChange >= 0 ? '+' : ''}${avgChange}%
            </span>
            <span class="overview-count">${data.count} stocks</span>
          </div>
        `;
      }).join('');
    }
  } catch (error) {
    console.error('Error loading overview:', error);
  }
}

// Populate heatmap
async function populateHeatmap() {
  try {
    const response = await fetch(`${API_BASE_URL}/stocks`);
    const result = await response.json();
    
    if (result.success && result.data) {
      const heatmapGrid = document.getElementById('heatmap-grid');
      if (!heatmapGrid) return;
      
      const topStocks = result.data.slice(0, 12);
      heatmapGrid.innerHTML = topStocks.map(stock => {
        const intensity = Math.abs(stock.pChange) / 5; // Normalize to 0-1
        const color = stock.pChange >= 0 ? 
          `rgba(34, 197, 94, ${Math.min(intensity, 1)})` : 
          `rgba(239, 68, 68, ${Math.min(intensity, 1)})`;
        
        return `
          <div class="heatmap-cell" style="background-color: ${color};">
            <strong>${stock.symbol}</strong>
            <span>${stock.pChange >= 0 ? '+' : ''}${stock.pChange.toFixed(1)}%</span>
          </div>
        `;
      }).join('');
    }
  } catch (error) {
    console.error('Error loading heatmap:', error);
  }
}

// Populate macro tabs
function populateMacroTabs() {
  const macroTabs = document.getElementById('macro-tabs');
  if (!macroTabs) return;
  
  const tabs = ['Overview', 'Markets', 'Sectors', 'Indices'];
  macroTabs.innerHTML = tabs.map((tab, index) => `
    <button class="tab-button ${index === 0 ? 'is-active' : ''}" 
            onclick="switchMacroTab('${tab.toLowerCase()}')">
      ${tab}
    </button>
  `).join('');
}

// Populate economy table
async function populateEconomyTable() {
  try {
    const response = await fetch(`${API_BASE_URL}/stocks`);
    const result = await response.json();
    
    if (result.success && result.data) {
      const tbody = document.getElementById('economy-table-body');
      if (!tbody) return;
      
      // Group by sector and show summary
      const sectors = {};
      result.data.forEach(stock => {
        if (!sectors[stock.sector]) {
          sectors[stock.sector] = {
            stocks: [],
            totalChange: 0,
            avgPrice: 0
          };
        }
        sectors[stock.sector].stocks.push(stock);
        sectors[stock.sector].totalChange += stock.pChange;
        sectors[stock.sector].avgPrice += stock.price;
      });
      
      tbody.innerHTML = Object.entries(sectors).map(([sector, data]) => {
        const avgChange = (data.totalChange / data.stocks.length).toFixed(2);
        const avgPrice = (data.avgPrice / data.stocks.length).toFixed(2);
        
        return `
          <tr>
            <td><strong>${sector}</strong></td>
            <td class="${avgChange >= 0 ? 'metric-positive' : 'metric-negative'}">
              ${avgChange >= 0 ? '+' : ''}${avgChange}%
            </td>
            <td>₹${avgPrice}</td>
            <td>${data.stocks.length} stocks</td>
            <td>
              <span class="trend-indicator ${avgChange >= 0 ? 'up' : 'down'}">
                ${avgChange >= 0 ? '↗' : '↘'}
              </span>
            </td>
          </tr>
        `;
      }).join('');
      
      // Update status
      const statusEl = document.getElementById('data-source-status');
      if (statusEl) {
        statusEl.textContent = 'Live data';
        statusEl.className = 'metric-positive';
      }
      
      const updatedEl = document.getElementById('data-updated-at');
      if (updatedEl) {
        updatedEl.textContent = `Updated: ${new Date().toLocaleTimeString()}`;
      }
    }
  } catch (error) {
    console.error('Error loading economy table:', error);
    const statusEl = document.getElementById('data-source-status');
    if (statusEl) {
      statusEl.textContent = 'Error loading data';
      statusEl.className = 'metric-negative';
    }
  }
}

// Switch macro tab
function switchMacroTab(tab) {
  console.log('Switched to tab:', tab);
  // Update active state
  document.querySelectorAll('.tab-button').forEach(btn => {
    btn.classList.remove('is-active');
  });
  event.target.classList.add('is-active');
  
  // In a full implementation, this would load different data
  // For now, just log the action
}

// Make function global for onclick
window.switchMacroTab = switchMacroTab;

console.log('Home page script loaded successfully');

// Made with Bob
