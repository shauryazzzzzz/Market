/**
 * server/services/watsonx.js  — financial-monitor
 * IBM watsonx → Gemini → Dummy fallback chain
 */
require('dotenv').config();
const path = require('path');
const { askAI, classifyAI, summarizeAI, healthCheck } = require(path.join(__dirname, '..', '..', '..', '..', 'shared', 'watsonx'));

async function analyzeStock(stockData) {
  const { name, symbol, pe, pb, roe, debtEquity, revenueGrowth } = stockData;
  const prompt = `Analyze fundamentally:\nCompany: ${name} (${symbol})\nP/E: ${pe}, P/B: ${pb}, ROE: ${roe}%, Debt/Equity: ${debtEquity}, Revenue Growth: ${revenueGrowth}%\n\n2-sentence analysis + BUY/HOLD/SELL.`;
  return askAI(prompt, { maxTokens: 150, temperature: 0.3, fallbackKey: 'financial' });
}

async function summarizeQuarterlyResults(resultsText) {
  return askAI(`Summarize quarterly results in 3 bullets:\n\n${resultsText}`,
    { maxTokens: 200, temperature: 0.2, fallbackKey: 'summarize' });
}

async function classifySector(description) {
  const sectors = ['IT', 'Banking & Finance', 'FMCG', 'Pharma', 'Auto', 'Energy', 'Metals', 'Infra', 'Telecom', 'Other'];
  return classifyAI(description, sectors, { fallbackKey: 'classify' });
}

async function getMarketSentiment(headlines) {
  const prompt = `Market headlines:\n${headlines.slice(0, 10).join('\n')}\n\nOverall sentiment: BULLISH, BEARISH, or NEUTRAL? Reply with the word + one sentence.`;
  return askAI(prompt, { maxTokens: 100, temperature: 0, fallbackKey: 'sentiment' });
}

module.exports = { analyzeStock, summarizeQuarterlyResults, classifySector, getMarketSentiment, askAI, healthCheck };
