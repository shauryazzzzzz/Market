const macroTabs = [
  "Overview",
  "Inflation",
  "Interest Rates",
  "GDP",
  "Employment",
  "Trade Balance"
];

const regionFilters = [
  "All regions",
  "North America",
  "Europe",
  "Asia",
  "Middle East",
  "Latin America"
];

const tableViews = ["Overview", "Top economies", "Emerging markets"];

const fallbackData = {
  fetchedAt: null,
  sourceStatus: "fallback",
  heroStats: [
    { label: "Tracked economies", value: "24", detail: "Across developed and emerging markets" },
    { label: "Indicators monitored", value: "120+", detail: "Inflation, GDP, rates, jobs, trade" },
    { label: "Upcoming events", value: "18", detail: "High-impact releases this week" }
  ],
  spotlightItems: [
    { label: "Global CPI trend", value: "3.4%", tone: "positive", detail: "Cooling for a third straight month" },
    { label: "Policy rate bias", value: "Neutral+", tone: "neutral", detail: "Cuts priced later in the year" },
    { label: "Labor resilience", value: "Stable", tone: "positive", detail: "Hiring remains firm in major economies" },
    { label: "Growth pulse", value: "Mixed", tone: "negative", detail: "Manufacturing still uneven" }
  ],
  economyRows: [
    {
      country: "United States",
      color: "#2962ff",
      region: "North America",
      gdp: "+2.4%",
      inflation: "3.3%",
      rate: "5.25%",
      unemployment: "3.9%",
      trend: "Resilient",
      trendTone: "positive"
    },
    {
      country: "Euro Area",
      color: "#0ea5e9",
      region: "Europe",
      gdp: "+0.8%",
      inflation: "2.4%",
      rate: "4.50%",
      unemployment: "6.4%",
      trend: "Stabilizing",
      trendTone: "neutral"
    },
    {
      country: "United Kingdom",
      color: "#7c3aed",
      region: "Europe",
      gdp: "+0.6%",
      inflation: "2.9%",
      rate: "5.00%",
      unemployment: "4.3%",
      trend: "Cooling",
      trendTone: "negative"
    },
    {
      country: "India",
      color: "#f59e0b",
      region: "Asia",
      gdp: "+6.8%",
      inflation: "4.8%",
      rate: "6.50%",
      unemployment: "7.1%",
      trend: "Expanding",
      trendTone: "positive"
    },
    {
      country: "Japan",
      color: "#ef4444",
      region: "Asia",
      gdp: "+1.1%",
      inflation: "2.2%",
      rate: "0.10%",
      unemployment: "2.6%",
      trend: "Reflating",
      trendTone: "positive"
    },
    {
      country: "Brazil",
      color: "#22ab94",
      region: "Latin America",
      gdp: "+2.1%",
      inflation: "4.1%",
      rate: "10.50%",
      unemployment: "7.5%",
      trend: "Recovering",
      trendTone: "neutral"
    }
  ],
  indicators: [
    { name: "Consumer Price Index", value: "3.4%", change: "-0.2 pp", summary: "Inflation pressures continue to ease.", width: "72%" },
    { name: "Core Inflation", value: "3.7%", change: "-0.1 pp", summary: "Sticky services inflation remains in focus.", width: "64%" },
    { name: "Policy Rate", value: "5.25%", change: "0.0 pp", summary: "Central banks remain cautious on cuts.", width: "58%" },
    { name: "GDP Growth", value: "2.4%", change: "+0.3 pp", summary: "Consumption and services support growth.", width: "76%" },
    { name: "Unemployment", value: "3.9%", change: "+0.1 pp", summary: "Labor markets are softening gradually.", width: "49%" },
    { name: "PMI Composite", value: "52.1", change: "+1.4", summary: "Business activity improved month over month.", width: "81%" }
  ],
  calendarEvents: [
    { time: "08:00", title: "Germany CPI Flash", impact: "High impact", detail: "Markets watch for confirmation of disinflation trend." },
    { time: "12:30", title: "US Core PCE Price Index", impact: "High impact", detail: "A key inflation gauge for Federal Reserve expectations." },
    { time: "14:00", title: "BoE Governor Speech", impact: "Medium impact", detail: "Guidance on growth risks and policy path." },
    { time: "06:00", title: "Japan Industrial Production", impact: "Medium impact", detail: "Signals on manufacturing recovery and exports." }
  ],
  movers: [
    { title: "US rate-cut odds", value: "62%", detail: "Markets price the first cut later this year." },
    { title: "Eurozone inflation surprise", value: "-0.3", detail: "Latest release came in below consensus." },
    { title: "India growth premium", value: "+4.4 pp", detail: "Strongest GDP differential among major economies." },
    { title: "Japan wage momentum", value: "+2.1%", detail: "Supports the reflation narrative." }
  ],
  newsItems: [
    {
      tag: "Inflation",
      title: "Cooling price pressures revive hopes for a softer policy path",
      meta: "4 min read · Updated today",
      summary: "Headline inflation continues to moderate, but services and wages keep central banks cautious."
    },
    {
      tag: "Central Banks",
      title: "Rate-setters signal patience as growth remains uneven across regions",
      meta: "6 min read · Macro desk",
      summary: "Officials are balancing easing inflation with still-resilient labor markets and sticky core readings."
    },
    {
      tag: "Growth",
      title: "Emerging markets outperform as domestic demand offsets export weakness",
      meta: "5 min read · Global markets",
      summary: "Several large economies are seeing stronger internal momentum despite softer external trade."
    }
  ],
  ideaItems: [
    {
      tag: "Theme",
      title: "Disinflation without recession remains the dominant macro trade",
      meta: "Analyst consensus",
      summary: "A gradual cooling in inflation paired with stable employment keeps risk assets supported."
    },
    {
      tag: "Watchlist",
      title: "Three indicators that could reshape the next central bank cycle",
      meta: "Strategy note",
      summary: "Core inflation, wage growth, and credit conditions remain the most important signals to monitor."
    }
  ]
};

const state = {
  activeMacroTab: "Overview",
  activeRegion: "All regions",
  activeTableView: "Overview",
  dataset: fallbackData
};

function formatUpdatedAt(value) {
  if (!value) {
    return "Using bundled fallback";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Cache time unavailable";
  }

  return `Updated ${date.toLocaleString()}`;
}

function formatSourceStatus(status) {
  switch (status) {
    case "live-page-scan":
      return "Daily cached live page data";
    case "fallback-error":
      return "Fallback data after fetch error";
    case "fallback":
      return "Bundled fallback data";
    default:
      return status || "Unknown source";
  }
}

function updateDataMeta() {
  const updatedAt = document.getElementById("data-updated-at");
  const sourceStatus = document.getElementById("data-source-status");

  updatedAt.textContent = formatUpdatedAt(state.dataset.fetchedAt);
  sourceStatus.textContent = formatSourceStatus(state.dataset.sourceStatus);
}

function renderHeroStats() {
  const container = document.getElementById("hero-stats");
  container.innerHTML = state.dataset.heroStats
    .map(
      (item) => `
        <article class="stat-card">
          <span class="panel-label">${item.label}</span>
          <strong>${item.value}</strong>
          <p>${item.detail}</p>
        </article>
      `
    )
    .join("");
}

function renderSpotlight() {
  const container = document.getElementById("spotlight-grid");
  container.innerHTML = state.dataset.spotlightItems
    .map(
      (item) => `
        <article class="spotlight-item">
          <span class="panel-label">${item.label}</span>
          <strong>${item.value}</strong>
          <p>${item.detail}</p>
        </article>
      `
    )
    .join("");
}

function renderButtons(containerId, items, activeValue, onClick) {
  const container = document.getElementById(containerId);
  container.innerHTML = "";

  items.forEach((item) => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = item;
    if (item === activeValue) {
      button.classList.add("is-active");
    }
    button.addEventListener("click", () => onClick(item));
    container.appendChild(button);
  });
}

function getFilteredRows() {
  let rows = [...state.dataset.economyRows];

  if (state.activeRegion !== "All regions") {
    rows = rows.filter((row) => row.region === state.activeRegion);
  }

  if (state.activeTableView === "Top economies") {
    rows = rows.slice(0, 4);
  }

  if (state.activeTableView === "Emerging markets") {
    rows = rows.filter((row) => ["India", "Brazil"].includes(row.country));
  }

  return rows;
}

function renderTable() {
  const tbody = document.getElementById("economy-table-body");
  const rows = getFilteredRows();

  tbody.innerHTML = rows
    .map(
      (row) => `
        <tr>
          <td>
            <div class="country-cell">
              <span class="flag-dot" style="background:${row.color}"></span>
              <div>
                <strong>${row.country}</strong>
                <div class="news-meta">${row.region}</div>
              </div>
            </div>
          </td>
          <td class="${row.gdp.startsWith("+") ? "metric-positive" : "metric-negative"}">${row.gdp}</td>
          <td>${row.inflation}</td>
          <td>${row.rate}</td>
          <td>${row.unemployment}</td>
          <td><span class="trend-pill ${row.trendTone}">${row.trend}</span></td>
        </tr>
      `
    )
    .join("");
}

function renderIndicators() {
  const container = document.getElementById("indicator-grid");
  container.innerHTML = state.dataset.indicators
    .map(
      (item) => `
        <article class="indicator-card">
          <span class="panel-label">${item.name}</span>
          <strong>${item.value}</strong>
          <div class="${item.change.startsWith("-") ? "metric-negative" : "metric-positive"}">${item.change}</div>
          <p>${item.summary}</p>
          <div class="mini-trend" style="width:${item.width}"></div>
        </article>
      `
    )
    .join("");
}

function renderCalendar() {
  const container = document.getElementById("calendar-list");
  container.innerHTML = state.dataset.calendarEvents
    .map(
      (item) => `
        <article class="calendar-item">
          <div>
            <time>${item.time}</time>
            <h4>${item.title}</h4>
            <p>${item.detail}</p>
          </div>
          <span class="trend-pill ${item.impact === "High impact" ? "negative" : "neutral"}">${item.impact}</span>
        </article>
      `
    )
    .join("");
}

function renderMovers() {
  const container = document.getElementById("movers-list");
  container.innerHTML = state.dataset.movers
    .map(
      (item) => `
        <article class="mover-item">
          <div>
            <span class="panel-label">${item.title}</span>
            <p>${item.detail}</p>
          </div>
          <strong>${item.value}</strong>
        </article>
      `
    )
    .join("");
}

function renderNews() {
  const container = document.getElementById("news-grid");
  container.innerHTML = state.dataset.newsItems
    .map(
      (item) => `
        <article class="news-card">
          <span class="news-tag">${item.tag}</span>
          <h3>${item.title}</h3>
          <div class="news-meta">${item.meta}</div>
          <p>${item.summary}</p>
        </article>
      `
    )
    .join("");
}

function renderIdeas() {
  const container = document.getElementById("ideas-grid");
  container.innerHTML = state.dataset.ideaItems
    .map(
      (item) => `
        <article class="idea-card">
          <span class="idea-tag">${item.tag}</span>
          <h3>${item.title}</h3>
          <div class="idea-meta">${item.meta}</div>
          <p>${item.summary}</p>
        </article>
      `
    )
    .join("");
}

function renderControls() {
  renderButtons("macro-tabs", macroTabs, state.activeMacroTab, (value) => {
    state.activeMacroTab = value;
    renderControls();
  });

  renderButtons("region-filters", regionFilters, state.activeRegion, (value) => {
    state.activeRegion = value;
    renderControls();
    renderTable();
  });

  renderButtons("table-view-tabs", tableViews, state.activeTableView, (value) => {
    state.activeTableView = value;
    renderControls();
    renderTable();
  });
}

function renderAll() {
  updateDataMeta();
  renderHeroStats();
  renderSpotlight();
  renderControls();
  renderTable();
  renderIndicators();
  renderCalendar();
  renderMovers();
  renderNews();
  renderIdeas();
}

async function loadDataset() {
  try {
    const response = await fetch("./data/economy-data.json", { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`Cache file unavailable: ${response.status}`);
    }

    const payload = await response.json();
    state.dataset = {
      ...fallbackData,
      ...payload
    };
  } catch (error) {
    state.dataset = {
      ...fallbackData,
      sourceStatus: "fallback-error",
      error: error.message
    };
  }
}

async function init() {
  await loadDataset();
  renderAll();
}

document.addEventListener("DOMContentLoaded", init);

// Made with Bob
