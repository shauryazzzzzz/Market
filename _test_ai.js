require('dotenv').config();
const path = require('path');
// Override model to the working IBM-first instruct model
process.env.WATSONX_TEXT_MODEL = 'ibm/granite-4-h-small';

const { askAI } = require(path.join('..', 'shared', 'watsonx'));

const tests = [
  {
    sheet: 'APPSEC_COLLVAL_25082026',
    desc: 'Applicable Securities Collateral Value report',
    sample: '1,ABLBL,INE14LE01019,85.13,11.99\n2,AARTIPHARM,INE0LRU01027,843.15,19.14\n3,DEEPAKNTR,INE288B01029,1730.3,12.15',
    cols: 5,
  },
  {
    sheet: 'CSQR_M2026159_25082026',
    desc: 'Closing Squared-off report for auction market session',
    sample: 'INNOVANA,EQ,M,2026159,372.42\nMAFANG,EQ,M,2026159,248.33',
    cols: 5,
  },
];

(async () => {
  for (const t of tests) {
    const prompt = `You are an expert in NSE India market data file formats.\nFile: "${t.sheet}" — ${t.desc}\nSample data rows (NO header row present in file):\n${t.sample}\n\nReturn ONLY a valid JSON array of exactly ${t.cols} short column name strings, one per column, in order. No explanation, no markdown.`;
    const r = await askAI(prompt, { maxTokens: 120, temperature: 0 });
    console.log(`\n[${t.sheet}]\nProvider: ${r.provider} | Model: ${r.model}\nHeaders: ${r.text}`);
  }
})();
