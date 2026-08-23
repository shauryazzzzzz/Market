/**
 * services/watsonx.js  — tradingview-economy
 * IBM watsonx → Gemini → Dummy fallback chain
 */
require('dotenv').config();
const path = require('path');
// Shared module is 3 levels up: tradingview-economy → Bob Projects → (root) → shared
const { askAI, classifyAI, summarizeAI, healthCheck } = require(path.join(__dirname, '..', '..', 'shared', 'watsonx'));

async function analyzeStockData(stockInfo) {
  const prompt = `Provide a brief analysis for ${stockInfo.name || stockInfo.symbol}:\nPrice: ₹${stockInfo.price || 'N/A'}, 52W High: ₹${stockInfo.high52 || 'N/A'}, P/E: ${stockInfo.pe || 'N/A'}, Market Cap: ₹${stockInfo.marketCap || 'N/A'} Cr\n\nGive 2 sentences: valuation + momentum. End with BUY/HOLD/SELL.`;
  return askAI(prompt, { maxTokens: 120, temperature: 0.3, fallbackKey: 'financial' });
}

async function summarizeIPO(ipoData) {
  const prompt = `Summarize this IPO in 3 bullet points for a retail investor:\nCompany: ${ipoData.company}\nIssue Size: ₹${ipoData.issueSize} Cr, Price Band: ₹${ipoData.priceBand}, GMP: ₹${ipoData.gmp || 'N/A'}`;
  return askAI(prompt, { maxTokens: 150, temperature: 0.2, fallbackKey: 'financial' });
}

async function commentOnIndicator(name, value, change) {
  const prompt = `In one sentence, explain what ${name} = ${value} (${change > 0 ? '+' : ''}${change}% change) means for India's economy.`;
  return askAI(prompt, { maxTokens: 80, temperature: 0.2, fallbackKey: 'financial' });
}

async function classifyNewsImpact(headline) {
  const sectors = ['Banking', 'IT', 'Auto', 'FMCG', 'Pharma', 'Energy', 'Metal', 'Realty', 'Telecom', 'Market-wide'];
  return classifyAI(headline, sectors, { fallbackKey: 'classify' });
}

module.exports = { analyzeStockData, summarizeIPO, commentOnIndicator, classifyNewsImpact, askAI, healthCheck };
