/**
 * combine-raw-data.mjs
 * Reads every CSV/DAT/TXT data file under  data/Raw data/
 * and writes them as separate sheets in a single Excel workbook.
 *
 * Usage:  node scripts/combine-raw-data.mjs
 * Output: data/NSE_Combined_25Aug2026.xlsx
 */

import * as XLSX from 'xlsx';
import * as fs   from 'fs';
import * as path from 'path';

const ROOT      = path.resolve('data/Raw data');
const OUT_FILE  = path.resolve('data/NSE_Combined_25Aug2026.xlsx');

// ── helpers ────────────────────────────────────────────────────────────────

/** Read a text file and return lines (skipping empty trailing lines) */
function readLines(filepath) {
  return fs.readFileSync(filepath, 'utf8')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .trimEnd()
    .split('\n');
}

/**
 * Parse a CSV text into array-of-arrays, handling quoted fields.
 * Strips leading/trailing spaces from each cell value.
 */
function parseCSV(text) {
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  const result = [];
  for (const line of lines) {
    if (line.trim() === '') continue;
    const row = [];
    let inQ = false, cell = '';
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') {
        if (inQ && line[i + 1] === '"') { cell += '"'; i++; }
        else inQ = !inQ;
      } else if (c === ',' && !inQ) {
        row.push(cell.trim());
        cell = '';
      } else {
        cell += c;
      }
    }
    row.push(cell.trim());
    result.push(row);
  }
  return result;
}

/** Convert array-of-arrays to an XLSX worksheet */
function aoaToSheet(aoa) {
  return XLSX.utils.aoa_to_sheet(aoa);
}

/** Sanitise a string to be a valid Excel sheet name (max 31 chars, no : \ / ? * [ ]) */
function sheetName(raw) {
  return raw.replace(/[:\\/?*\[\]]/g, '_').slice(0, 31);
}

/** Try to read a CSV file → array-of-arrays. Returns null on failure. */
function tryReadCSV(filepath) {
  try {
    const text = fs.readFileSync(filepath, 'utf8');
    const rows = parseCSV(text);
    return rows.length ? rows : null;
  } catch {
    return null;
  }
}

// ── sheet definitions ──────────────────────────────────────────────────────

const workbook = XLSX.utils.book_new();
const usedNames = new Set();

function addSheet(name, aoa) {
  if (!aoa || aoa.length === 0) return;
  let sn = sheetName(name);
  // de-duplicate
  if (usedNames.has(sn)) {
    let i = 2;
    while (usedNames.has(`${sn.slice(0, 28)}_${i}`)) i++;
    sn = `${sn.slice(0, 28)}_${i}`;
  }
  usedNames.add(sn);
  XLSX.utils.book_append_sheet(workbook, aoaToSheet(aoa), sn);
  console.log(`  ✓ ${sn}  (${aoa.length - 1} data rows)`);
}

// ── 1. Root-level CSVs ─────────────────────────────────────────────────────

console.log('\n── Root CSVs ──');
for (const fname of ['screener.csv', 'google-sheet-main.csv']) {
  const fp = path.join(ROOT, fname);
  if (!fs.existsSync(fp)) continue;
  const aoa = tryReadCSV(fp);
  addSheet(path.basename(fname, '.csv'), aoa);
}

// ── 2. Reports-Daily-Multiple flat CSVs ───────────────────────────────────

const RDM = path.join(ROOT, 'Reports-Daily-Multiple');

const flatFiles = [
  { file: 'sec_bhavdata_full_25082026.csv',   name: 'BhavData_Full' },
  { file: 'PE_250826.csv',                    name: 'PE_Ratios' },
  { file: 'bulk.csv',                         name: 'Bulk_Deals' },
  { file: 'block.csv',                        name: 'Block_Deals' },
  { file: 'CMVOLT_25082026.CSV',              name: 'Volatility' },
  { file: 'CM_52_wk_High_low_25082026.csv',   name: '52Wk_High_Low' },
  { file: 'shortselling_25082026.csv',        name: 'Short_Selling' },
  { file: 'sec_list_25082026.csv',            name: 'Security_List' },
  { file: 'REG_IND250826.csv',                name: 'Reg_Indicators' },
  { file: 'REG1_IND250826.csv',               name: 'Reg_Indicators_Detail' },
  { file: 'sme25082026.csv',                  name: 'SME_Bhavcopy' },
  { file: 'corpbond25082026.csv',             name: 'Corp_Bonds' },
  { file: 'MF_VAR_25082026.csv',              name: 'MF_VAR' },
  { file: 'APPSEC_COLLVAL_25082026.csv',      name: 'Collateral_Values' },
  { file: 'eq_band_changes_25082026.csv',     name: 'Band_Changes' },
  { file: 'sme_bands_complete_25082026.csv',  name: 'SME_Bands' },
  { file: 'series_change.csv',                name: 'Series_Changes' },
  { file: 'C_STT_25082026.csv',               name: 'STT_Securities' },
  { file: 'C_STT_IND_25082026.csv',           name: 'STT_Indicators' },
  { file: 'CM_Latency_stats24082026.csv',     name: 'Latency_Stats' },
];

// AUB – skip header lines (2 text lines before the actual CSV header)
const AUB_FILE = {
  file: 'AUB_2026159_25082026.csv',
  name: 'Auction_Securities',
  skipRows: 2,  // skip the 2 text preamble lines
};

// CSQR – no header row, add one
const CSQR_FILE = {
  file: 'CSQR_M2026159_25082026.csv',
  name: 'CSQR_Settlement',
  header: ['Symbol', 'Series', 'Market', 'Session', 'Settlement_Price'],
};

console.log('\n── Reports-Daily-Multiple (flat) ──');

for (const { file, name } of flatFiles) {
  const fp = path.join(RDM, file);
  if (!fs.existsSync(fp)) { console.log(`  ⚠ missing: ${file}`); continue; }
  let aoa = tryReadCSV(fp);
  if (!aoa) { console.log(`  ⚠ empty: ${file}`); continue; }
  // Remove disclaimer/metadata lines at top (lines without comma-separated structure)
  while (aoa.length > 1 && aoa[0].length === 1 && !aoa[0][0].includes(',')) {
    aoa.shift();
  }
  addSheet(name, aoa);
}

// AUB (skip 2 preamble text rows)
{
  const fp = path.join(RDM, AUB_FILE.file);
  if (fs.existsSync(fp)) {
    let aoa = tryReadCSV(fp);
    if (aoa) {
      // Remove blank rows and the 2 text preamble lines
      aoa = aoa.filter(r => r.join('').trim() !== '');
      // The third row is the real header ("Sr No, Symbol, ...")
      const headerIdx = aoa.findIndex(r => r[0].trim().toLowerCase() === 'sr no');
      if (headerIdx > 0) aoa = aoa.slice(headerIdx);
      addSheet(AUB_FILE.name, aoa);
    }
  }
}

// CSQR (no header — inject one)
{
  const fp = path.join(RDM, CSQR_FILE.file);
  if (fs.existsSync(fp)) {
    let aoa = tryReadCSV(fp);
    if (aoa) {
      aoa.unshift(CSQR_FILE.header);
      addSheet(CSQR_FILE.name, aoa);
    }
  }
}

// ── 3. BhavCopy (subfolder that acts like a directory) ────────────────────

console.log('\n── BhavCopy (New Format) ──');
{
  const subdir = path.join(RDM, 'BhavCopy_NSE_CM_0_0_0_20260825_F_0000.csv');
  const inner  = path.join(subdir, 'BhavCopy_NSE_CM_0_0_0_20260825_F_0000.csv');
  if (fs.existsSync(inner)) {
    const aoa = tryReadCSV(inner);
    addSheet('BhavCopy_New', aoa);
  }
}

// ── 4. NSE Security Master (subfolder) ───────────────────────────────────

console.log('\n── NSE Security Master ──');
{
  const subdir = path.join(RDM, 'NSE_CM_security_25082026.csv');
  const inner  = path.join(subdir, 'NSE_CM_security_25082026.csv');
  if (fs.existsSync(inner)) {
    const aoa = tryReadCSV(inner);
    addSheet('Security_Master', aoa);
  }
}

// ── 5. PR250826 sub-folder files ──────────────────────────────────────────

const PR = path.join(RDM, 'PR250826');

const prFiles = [
  { file: 'bc25082026.csv',       name: 'PR_Corp_Actions' },
  { file: 'bh25082026.csv',       name: 'PR_Band_Hit' },
  { file: 'etf25082026.csv',      name: 'PR_ETF' },
  { file: 'gl25082026.csv',       name: 'PR_Gainers_Losers' },
  { file: 'hl25082026.csv',       name: 'PR_52Wk_New_HL' },
  { file: 'mcap25082026.csv',     name: 'PR_Market_Cap' },
  { file: 'pd25082026.csv',       name: 'PR_Price_Data_Detail' },
  { file: 'pr25082026.csv',       name: 'PR_Price_Data' },
  { file: 'sme25082026.csv',      name: 'PR_SME' },
  { file: 'tt25082026.csv',       name: 'PR_Top25_Traded' },
  { file: 'corpbond25082026.csv', name: 'PR_Corp_Bonds' },
];

console.log('\n── PR250826 sub-folder ──');

for (const { file, name } of prFiles) {
  const fp = path.join(PR, file);
  if (!fs.existsSync(fp)) { console.log(`  ⚠ missing: ${file}`); continue; }
  let aoa = tryReadCSV(fp);
  if (!aoa) { console.log(`  ⚠ empty: ${file}`); continue; }
  // Remove blank/spacer rows that appear as section separators in some PR files
  aoa = aoa.filter(r => r.join('').trim() !== '');
  addSheet(name, aoa);
}

// ── 6. Write workbook ─────────────────────────────────────────────────────

console.log(`\n── Writing ${usedNames.size} sheets → ${OUT_FILE} ──`);
XLSX.writeFile(workbook, OUT_FILE);
console.log(`\n✅  Done! File saved to:\n   ${OUT_FILE}\n`);
