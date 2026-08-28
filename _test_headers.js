/**
 * Final NSE header inference test.
 * Tests: mistralai/mistral-small-3-1-24b-instruct-2503 (IBM-hosted, IBM-first)
 *        Gemini 2.5-flash (fallback)
 * All 9 headerless NSE sheets.
 */
require('dotenv').config();
const https = require('https');

async function getToken() {
  const key = process.env.WATSONX_API_KEY;
  const b = Buffer.from(`grant_type=urn:ibm:params:oauth:grant-type:apikey&apikey=${encodeURIComponent(key)}`);
  return new Promise((res, rej) => {
    const r = https.request({ hostname: 'iam.cloud.ibm.com', path: '/identity/token', method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': b.length }},
      re => { let d = ''; re.on('data', c => d += c); re.on('end', () => { try { res(JSON.parse(d).access_token); } catch(e) { rej(e); } }); });
    r.on('error', rej); r.write(b); r.end();
  });
}

async function askWatsonx(token, prompt) {
  const body = JSON.stringify({
    model_id: 'mistralai/mistral-small-3-1-24b-instruct-2503',
    input: `<s>[INST]${prompt}[/INST]`,
    parameters: { max_new_tokens: 200, temperature: 0 },
    project_id: process.env.WATSONX_PROJECT_ID
  });
  return new Promise((res, rej) => {
    const r = https.request({ hostname: 'us-south.ml.cloud.ibm.com',
      path: '/ml/v1/text/generation?version=2023-05-29', method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}`, 'Content-Length': Buffer.byteLength(body) }},
      re => { let d = ''; re.on('data', c => d += c); re.on('end', () => {
        const j = JSON.parse(d);
        if (j.errors) return rej(new Error(j.errors[0].message));
        res(j.results?.[0]?.generated_text?.trim() || '');
      }); });
    r.on('error', rej); r.setTimeout(30000, () => r.destroy(new Error('timeout')));
    r.write(body); r.end();
  });
}

async function askGemini(prompt) {
  const key = process.env.GEMINI_API_KEY;
  const body = JSON.stringify({
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: { maxOutputTokens: 300, temperature: 0 }
  });
  return new Promise((res, rej) => {
    const r = https.request({ hostname: 'generativelanguage.googleapis.com',
      path: `/v1/models/gemini-2.5-flash:generateContent?key=${key}`, method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }},
      re => { let d = ''; re.on('data', c => d += c); re.on('end', () => {
        const j = JSON.parse(d);
        if (j.error) return rej(new Error('Gemini: ' + j.error.message));
        res(j.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '');
      }); });
    r.on('error', rej); r.setTimeout(30000, () => r.destroy(new Error('timeout')));
    r.write(body); r.end();
  });
}

function extractJSON(text) {
  const m = text.match(/\[[\s\S]*?\]/);
  if (!m) return null;
  try { return JSON.parse(m[0]); } catch { return null; }
}

// All headerless NSE sheets
const SHEETS = [
  { name: 'APPSEC_COLLVAL_25082026',   cols: 5, sample: '1,ABLBL,INE14LE01019,85.13,11.99\n2,AARTIPHARM,INE0LRU01027,843.15,19.14',           desc: 'NSE Applicable Securities Collateral Value — serial no, symbol, ISIN, price, haircut%' },
  { name: 'CSQR_M2026159_25082026',    cols: 5, sample: 'INNOVANA,EQ,M,2026159,372.42\nMAFANG,EQ,M,2026159,248.33',                            desc: 'NSE Closing Squared-off Report — symbol, series, market type, auction session no, settlement price' },
  { name: 'AUB_2026159_25082026',      cols: 4, sample: '1,360ONE,EQ,3\n2,AARTIIND,EQ,1',                                                      desc: 'NSE Auction Buy report — serial no, symbol, series, total qty to be auctioned' },
  { name: 'circuit_25082026',          cols: 6, sample: '250826,260826,2433455,243345,365020,486690',                                           desc: 'NSE market circuit breaker statistics — date, next date, total turnover crores, total trades, total quantity, total securities' },
  { name: 'CM_Latency_stats24082026',  cols: 8, sample: '(see context)',                                                                        desc: 'NSE Capital Market latency stats — order type, order count, avg latency us, min latency us, max latency us, p50, p95, p99' },
  { name: 'PR_bm25082026',             cols: 6, sample: '(see context)',                                                                        desc: 'NSE bulk market report — symbol, security name, buy qty, sell qty, net qty, close price' },
];

(async () => {
  const token = await getToken();
  console.log('IAM OK | Testing mistral-small (IBM-first) → Gemini fallback\n' + '='.repeat(70));

  for (const s of SHEETS) {
    const prompt = `You are an expert in NSE India (National Stock Exchange) market data formats.\nFile: "${s.name}"\nContext: ${s.desc}\nSample rows (NO header row exists in this file):\n${s.sample}\n\nReturn ONLY a valid JSON array of exactly ${s.cols} short snake_case column header strings, in order.\nNo explanation, no markdown, just the raw JSON array like: ["col1","col2","col3"]`;

    process.stdout.write(`[${s.name}] `);
    let provider = '', text = '';
    try {
      text = await askWatsonx(token, prompt);
      provider = 'watsonx/mistral-small';
    } catch(e) {
      process.stdout.write(`watsonx fail(${e.message.slice(0,40)}) → Gemini... `);
      try { text = await askGemini(prompt); provider = 'gemini/2.5-flash'; }
      catch(e2) { console.log(`BOTH FAILED: ${e2.message}`); continue; }
    }
    const headers = extractJSON(text);
    console.log(`✅ ${provider}`);
    console.log(`  → ${JSON.stringify(headers || text.slice(0, 120))}\n`);
  }
})();
