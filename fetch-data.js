const fs = require("fs");
const path = require("path");

const SOURCE_URL = "https://in.tradingview.com/markets/#economy";
const OUTPUT_DIR = path.join(__dirname, "data");
const OUTPUT_FILE = path.join(OUTPUT_DIR, "economy-data.json");

const fallbackPayload = {
  fetchedAt: new Date().toISOString(),
  sourceUrl: SOURCE_URL,
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

function ensureOutputDir() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

function writePayload(payload) {
  ensureOutputDir();
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(payload, null, 2), "utf8");
}

function extractJsonCandidates(html) {
  const candidates = [];
  const scriptRegex = /<script[^>]*>([\s\S]*?)<\/script>/gi;
  let match;

  while ((match = scriptRegex.exec(html)) !== null) {
    const content = match[1];
    if (content.includes("econom") || content.includes("GDP") || content.includes("inflation")) {
      candidates.push(content);
    }
  }

  return candidates;
}

function normalizeNumber(value) {
  if (typeof value !== "string") {
    return null;
  }

  const cleaned = value.replace(/,/g, "").match(/-?\d+(\.\d+)?/);
  return cleaned ? Number(cleaned[0]) : null;
}

function inferTrendTone(gdpValue) {
  const numeric = normalizeNumber(gdpValue);
  if (numeric === null) {
    return "neutral";
  }
  if (numeric > 1.5) {
    return "positive";
  }
  if (numeric < 0.8) {
    return "negative";
  }
  return "neutral";
}

function buildLivePayload(html) {
  const candidates = extractJsonCandidates(html);
  const payload = {
    ...fallbackPayload,
    fetchedAt: new Date().toISOString(),
    sourceUrl: SOURCE_URL,
    sourceStatus: candidates.length ? "live-page-scan" : "fallback"
  };

  const text = html.replace(/\s+/g, " ");

  const headlineMatches = [
    { label: "Tracked economies", regex: /econom(?:y|ies)[^0-9]{0,20}(\d{1,3})/i, suffix: "" },
    { label: "Indicators monitored", regex: /indicator[s]?[^0-9]{0,20}(\d{1,3}\+?)/i, suffix: "" },
    { label: "Upcoming events", regex: /event[s]?[^0-9]{0,20}(\d{1,3})/i, suffix: "" }
  ];

  payload.heroStats = payload.heroStats.map((item, index) => {
    const match = text.match(headlineMatches[index].regex);
    if (!match) {
      return item;
    }

    return {
      ...item,
      value: `${match[1]}${headlineMatches[index].suffix}`
    };
  });

  const countryPatterns = [
    { country: "United States", region: "North America", color: "#2962ff" },
    { country: "Euro Area", region: "Europe", color: "#0ea5e9" },
    { country: "United Kingdom", region: "Europe", color: "#7c3aed" },
    { country: "India", region: "Asia", color: "#f59e0b" },
    { country: "Japan", region: "Asia", color: "#ef4444" },
    { country: "Brazil", region: "Latin America", color: "#22ab94" }
  ];

  payload.economyRows = countryPatterns.map((countryConfig, index) => {
    const fallbackRow = fallbackPayload.economyRows[index];
    const countryRegex = new RegExp(`${countryConfig.country}[\\s\\S]{0,220}?(-?\\d+(?:\\.\\d+)?%)[\\s\\S]{0,120}?(-?\\d+(?:\\.\\d+)?%)[\\s\\S]{0,120}?(-?\\d+(?:\\.\\d+)?%)[\\s\\S]{0,120}?(-?\\d+(?:\\.\\d+)?%)`, "i");
    const match = html.match(countryRegex);

    if (!match) {
      return fallbackRow;
    }

    const gdp = match[1].startsWith("-") ? match[1] : `+${match[1].replace(/^\+/, "")}`;
    const inflation = match[2];
    const rate = match[3];
    const unemployment = match[4];

    return {
      country: countryConfig.country,
      color: countryConfig.color,
      region: countryConfig.region,
      gdp,
      inflation,
      rate,
      unemployment,
      trend: inferTrendTone(gdp) === "positive" ? "Expanding" : inferTrendTone(gdp) === "negative" ? "Cooling" : "Stabilizing",
      trendTone: inferTrendTone(gdp)
    };
  });

  const averageInflation = payload.economyRows
    .map((row) => normalizeNumber(row.inflation))
    .filter((value) => value !== null)
    .reduce((sum, value, _, arr) => sum + value / arr.length, 0);

  if (!Number.isNaN(averageInflation) && averageInflation > 0) {
    payload.spotlightItems = [
      {
        label: "Global CPI trend",
        value: `${averageInflation.toFixed(1)}%`,
        tone: averageInflation < 4 ? "positive" : "negative",
        detail: "Derived from the latest cached country inflation values"
      },
      ...payload.spotlightItems.slice(1)
    ];

    payload.indicators = payload.indicators.map((indicator) => {
      if (indicator.name === "Consumer Price Index") {
        return {
          ...indicator,
          value: `${averageInflation.toFixed(1)}%`,
          summary: "Calculated from the latest cached economy table values."
        };
      }
      return indicator;
    });
  }

  return payload;
}

async function fetchSourceHtml() {
  const response = await fetch(SOURCE_URL, {
    headers: {
      "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36",
      "accept-language": "en-IN,en;q=0.9"
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch source page: ${response.status} ${response.statusText}`);
  }

  return response.text();
}

async function main() {
  try {
    const html = await fetchSourceHtml();
    const payload = buildLivePayload(html);
    writePayload(payload);
    console.log(`Saved economy data to ${OUTPUT_FILE}`);
    console.log(`Source status: ${payload.sourceStatus}`);
  } catch (error) {
    const payload = {
      ...fallbackPayload,
      fetchedAt: new Date().toISOString(),
      sourceStatus: "fallback-error",
      error: error.message
    };
    writePayload(payload);
    console.error(`Using fallback payload because live fetch failed: ${error.message}`);
  }
}

main();

// Made with Bob
