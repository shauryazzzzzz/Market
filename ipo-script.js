// Aladdin Investing - IPO Calendar JavaScript
// Iteration 1: Interactive tabs with mock data

// Mock IPO Data
const mockIPOData = {
  upcoming: [
    {
      company: 'TechVision Solutions Ltd',
      logo: '🚀',
      openDate: '2026-06-15',
      closeDate: '2026-06-18',
      priceRange: '₹450-480',
      lotSize: 30,
      issueSize: '₹2,500 Cr',
      type: 'Mainboard',
      sector: 'Technology'
    },
    {
      company: 'Green Energy Power Ltd',
      logo: '⚡',
      openDate: '2026-06-20',
      closeDate: '2026-06-23',
      priceRange: '₹320-350',
      lotSize: 40,
      issueSize: '₹1,800 Cr',
      type: 'Mainboard',
      sector: 'Energy'
    },
    {
      company: 'HealthCare Innovations',
      logo: '🏥',
      openDate: '2026-06-25',
      closeDate: '2026-06-28',
      priceRange: '₹280-310',
      lotSize: 45,
      issueSize: '₹950 Cr',
      type: 'SME',
      sector: 'Healthcare'
    }
  ],
  
  open: [
    {
      company: 'Digital Finance Corp',
      logo: '💳',
      openDate: '2026-05-28',
      closeDate: '2026-05-31',
      priceRange: '₹550-600',
      lotSize: 25,
      issueSize: '₹3,200 Cr',
      type: 'Mainboard',
      sector: 'Financial Services',
      subscription: {
        retail: 2.5,
        hni: 8.3,
        qib: 12.7,
        total: 7.8
      },
      gmp: 85,
      daysLeft: 1
    },
    {
      company: 'Smart Logistics Ltd',
      logo: '📦',
      openDate: '2026-05-27',
      closeDate: '2026-05-30',
      priceRange: '₹180-200',
      lotSize: 70,
      issueSize: '₹650 Cr',
      type: 'SME',
      sector: 'Logistics',
      subscription: {
        retail: 1.8,
        hni: 4.2,
        qib: 6.5,
        total: 4.2
      },
      gmp: 25,
      daysLeft: 0
    }
  ],
  
  closed: [
    {
      company: 'AutoTech Manufacturing',
      logo: '🚗',
      openDate: '2026-05-20',
      closeDate: '2026-05-23',
      priceRange: '₹420-450',
      lotSize: 35,
      issueSize: '₹1,500 Cr',
      type: 'Mainboard',
      sector: 'Automobile',
      subscription: {
        retail: 3.2,
        hni: 15.8,
        qib: 28.5,
        total: 15.8
      },
      gmp: 120,
      listingDate: '2026-06-05'
    },
    {
      company: 'FoodTech Ventures',
      logo: '🍔',
      openDate: '2026-05-15',
      closeDate: '2026-05-18',
      priceRange: '₹250-280',
      lotSize: 50,
      issueSize: '₹800 Cr',
      type: 'Mainboard',
      sector: 'Consumer',
      subscription: {
        retail: 4.5,
        hni: 22.3,
        qib: 35.7,
        total: 20.8
      },
      gmp: 95,
      listingDate: '2026-05-30'
    }
  ],
  
  listed: [
    {
      company: 'CloudNet Services',
      logo: '☁️',
      listingDate: '2026-05-25',
      issuePrice: 380,
      listingPrice: 495,
      currentPrice: 512,
      change: 34.7,
      marketCap: '₹8,500 Cr',
      sector: 'Technology'
    },
    {
      company: 'Renewable Solar Ltd',
      logo: '☀️',
      listingDate: '2026-05-18',
      issuePrice: 290,
      listingPrice: 325,
      currentPrice: 342,
      change: 17.9,
      marketCap: '₹4,200 Cr',
      sector: 'Energy'
    },
    {
      company: 'BioPharm Research',
      logo: '💊',
      listingDate: '2026-05-10',
      issuePrice: 520,
      listingPrice: 480,
      currentPrice: 495,
      change: -4.8,
      marketCap: '₹6,800 Cr',
      sector: 'Healthcare'
    }
  ]
};

// State Management
const state = {
  activeTab: 'upcoming'
};

// Initialize on page load
document.addEventListener('DOMContentLoaded', function() {
  console.log('IPO Calendar page loaded - Initializing...');
  initializeEventListeners();
  renderIPOCards();
});

// Initialize event listeners
function initializeEventListeners() {
  const tabButtons = document.querySelectorAll('.tab-button');
  tabButtons.forEach(button => {
    button.addEventListener('click', function() {
      const tab = this.getAttribute('data-tab');
      switchTab(tab);
    });
  });
}

// Switch between tabs
function switchTab(tab) {
  state.activeTab = tab;
  
  // Update active button
  document.querySelectorAll('.tab-button').forEach(btn => {
    btn.classList.remove('is-active');
  });
  document.querySelector(`[data-tab="${tab}"]`).classList.add('is-active');
  
  // Render cards for selected tab
  renderIPOCards();
  
  console.log('Switched to tab:', tab);
}

// Render IPO cards based on active tab
function renderIPOCards() {
  const container = document.getElementById('ipo-cards-container');
  if (!container) return;
  
  const data = mockIPOData[state.activeTab];
  
  if (!data || data.length === 0) {
    container.innerHTML = `
      <div style="text-align: center; padding: 60px 20px; color: var(--muted);">
        <p style="font-size: 18px;">No IPOs found in this category</p>
      </div>
    `;
    return;
  }
  
  // Render based on tab type
  switch(state.activeTab) {
    case 'upcoming':
      renderUpcomingIPOs(container, data);
      break;
    case 'open':
      renderOpenIPOs(container, data);
      break;
    case 'closed':
      renderClosedIPOs(container, data);
      break;
    case 'listed':
      renderListedIPOs(container, data);
      break;
  }
}

// Render upcoming IPOs
function renderUpcomingIPOs(container, data) {
  container.innerHTML = data.map(ipo => `
    <div class="ipo-card">
      <div class="ipo-card-header">
        <div class="ipo-logo">${ipo.logo}</div>
        <div class="ipo-company-info">
          <h3>${ipo.company}</h3>
          <div class="ipo-meta">
            <span class="badge badge-${ipo.type.toLowerCase()}">${ipo.type}</span>
            <span class="ipo-sector">${ipo.sector}</span>
          </div>
        </div>
      </div>
      
      <div class="ipo-details-grid">
        <div class="ipo-detail">
          <span class="detail-label">Open Date</span>
          <span class="detail-value">${formatDate(ipo.openDate)}</span>
        </div>
        <div class="ipo-detail">
          <span class="detail-label">Close Date</span>
          <span class="detail-value">${formatDate(ipo.closeDate)}</span>
        </div>
        <div class="ipo-detail">
          <span class="detail-label">Price Range</span>
          <span class="detail-value">${ipo.priceRange}</span>
        </div>
        <div class="ipo-detail">
          <span class="detail-label">Lot Size</span>
          <span class="detail-value">${ipo.lotSize} shares</span>
        </div>
        <div class="ipo-detail">
          <span class="detail-label">Issue Size</span>
          <span class="detail-value">${ipo.issueSize}</span>
        </div>
      </div>
      
      <div class="ipo-card-footer">
        <button class="ghost-button">View Details</button>
        <button class="primary-button">Set Reminder</button>
      </div>
    </div>
  `).join('');
}

// Render open IPOs
function renderOpenIPOs(container, data) {
  container.innerHTML = data.map(ipo => `
    <div class="ipo-card ipo-card-open">
      <div class="ipo-card-header">
        <div class="ipo-logo">${ipo.logo}</div>
        <div class="ipo-company-info">
          <h3>${ipo.company}</h3>
          <div class="ipo-meta">
            <span class="badge badge-${ipo.type.toLowerCase()}">${ipo.type}</span>
            <span class="ipo-sector">${ipo.sector}</span>
            <span class="badge badge-live">LIVE</span>
          </div>
        </div>
        ${ipo.daysLeft !== undefined ? `
          <div class="days-left">
            <strong>${ipo.daysLeft}</strong>
            <span>day${ipo.daysLeft !== 1 ? 's' : ''} left</span>
          </div>
        ` : ''}
      </div>
      
      <div class="ipo-details-grid">
        <div class="ipo-detail">
          <span class="detail-label">Price Range</span>
          <span class="detail-value">${ipo.priceRange}</span>
        </div>
        <div class="ipo-detail">
          <span class="detail-label">Issue Size</span>
          <span class="detail-value">${ipo.issueSize}</span>
        </div>
        <div class="ipo-detail">
          <span class="detail-label">GMP</span>
          <span class="detail-value metric-positive">₹${ipo.gmp}</span>
        </div>
      </div>
      
      <div class="subscription-status">
        <h4>Subscription Status</h4>
        <div class="subscription-grid">
          <div class="subscription-item">
            <span class="sub-label">Retail</span>
            <span class="sub-value">${ipo.subscription.retail}x</span>
          </div>
          <div class="subscription-item">
            <span class="sub-label">HNI</span>
            <span class="sub-value">${ipo.subscription.hni}x</span>
          </div>
          <div class="subscription-item">
            <span class="sub-label">QIB</span>
            <span class="sub-value">${ipo.subscription.qib}x</span>
          </div>
          <div class="subscription-item">
            <span class="sub-label">Total</span>
            <span class="sub-value total">${ipo.subscription.total}x</span>
          </div>
        </div>
      </div>
      
      <div class="ipo-card-footer">
        <button class="ghost-button">View Details</button>
        <button class="primary-button">Apply Now</button>
      </div>
    </div>
  `).join('');
}

// Render closed IPOs
function renderClosedIPOs(container, data) {
  container.innerHTML = data.map(ipo => `
    <div class="ipo-card">
      <div class="ipo-card-header">
        <div class="ipo-logo">${ipo.logo}</div>
        <div class="ipo-company-info">
          <h3>${ipo.company}</h3>
          <div class="ipo-meta">
            <span class="badge badge-${ipo.type.toLowerCase()}">${ipo.type}</span>
            <span class="ipo-sector">${ipo.sector}</span>
          </div>
        </div>
      </div>
      
      <div class="ipo-details-grid">
        <div class="ipo-detail">
          <span class="detail-label">Price Range</span>
          <span class="detail-value">${ipo.priceRange}</span>
        </div>
        <div class="ipo-detail">
          <span class="detail-label">Issue Size</span>
          <span class="detail-value">${ipo.issueSize}</span>
        </div>
        <div class="ipo-detail">
          <span class="detail-label">GMP</span>
          <span class="detail-value metric-positive">₹${ipo.gmp}</span>
        </div>
        <div class="ipo-detail">
          <span class="detail-label">Listing Date</span>
          <span class="detail-value">${formatDate(ipo.listingDate)}</span>
        </div>
      </div>
      
      <div class="subscription-status">
        <h4>Final Subscription</h4>
        <div class="subscription-grid">
          <div class="subscription-item">
            <span class="sub-label">Retail</span>
            <span class="sub-value">${ipo.subscription.retail}x</span>
          </div>
          <div class="subscription-item">
            <span class="sub-label">HNI</span>
            <span class="sub-value">${ipo.subscription.hni}x</span>
          </div>
          <div class="subscription-item">
            <span class="sub-label">QIB</span>
            <span class="sub-value">${ipo.subscription.qib}x</span>
          </div>
          <div class="subscription-item">
            <span class="sub-label">Total</span>
            <span class="sub-value total">${ipo.subscription.total}x</span>
          </div>
        </div>
      </div>
      
      <div class="ipo-card-footer">
        <button class="ghost-button">View Details</button>
        <button class="primary-button">Track Listing</button>
      </div>
    </div>
  `).join('');
}

// Render listed IPOs
function renderListedIPOs(container, data) {
  container.innerHTML = data.map(ipo => `
    <div class="ipo-card">
      <div class="ipo-card-header">
        <div class="ipo-logo">${ipo.logo}</div>
        <div class="ipo-company-info">
          <h3>${ipo.company}</h3>
          <div class="ipo-meta">
            <span class="ipo-sector">${ipo.sector}</span>
            <span class="detail-label">Listed: ${formatDate(ipo.listingDate)}</span>
          </div>
        </div>
      </div>
      
      <div class="ipo-details-grid">
        <div class="ipo-detail">
          <span class="detail-label">Issue Price</span>
          <span class="detail-value">₹${ipo.issuePrice}</span>
        </div>
        <div class="ipo-detail">
          <span class="detail-label">Listing Price</span>
          <span class="detail-value">₹${ipo.listingPrice}</span>
        </div>
        <div class="ipo-detail">
          <span class="detail-label">Current Price</span>
          <span class="detail-value">₹${ipo.currentPrice}</span>
        </div>
        <div class="ipo-detail">
          <span class="detail-label">Returns</span>
          <span class="detail-value ${ipo.change >= 0 ? 'metric-positive' : 'metric-negative'}">
            ${ipo.change >= 0 ? '+' : ''}${ipo.change.toFixed(1)}%
          </span>
        </div>
        <div class="ipo-detail">
          <span class="detail-label">Market Cap</span>
          <span class="detail-value">${ipo.marketCap}</span>
        </div>
      </div>
      
      <div class="ipo-card-footer">
        <button class="ghost-button">View Chart</button>
        <button class="primary-button">Analyze Stock</button>
      </div>
    </div>
  `).join('');
}

// Format date helper
function formatDate(dateString) {
  const date = new Date(dateString);
  const options = { day: 'numeric', month: 'short', year: 'numeric' };
  return date.toLocaleDateString('en-IN', options);
}

// Log initialization
console.log('IPO Calendar script loaded successfully');
console.log('Current state:', state);

// Made with Bob
