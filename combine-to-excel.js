/**
 * Combines all CSV/data files from "data/Raw data" into a single Excel workbook.
 * Each source file becomes its own named sheet.
 * Run: node combine-to-excel.js
 */
const XLSX = require('xlsx');
const fs   = require('fs');
const path = require('path');

const BASE = path.join(__dirname, 'data', 'Raw data');
const OUT  = path.join(__dirname, 'data', 'Combined_Raw_Data.xlsx');

const wb = XLSX.utils.book_new();

// ─── helpers ──────────────────────────────────────────────────────────────────

/** Sanitise a string so it can be used as an Excel sheet name (max 31 chars, no special chars) */
function sheetName(raw) {
  return raw.replace(/[\\\/\*\?\[\]:]/g, '_').substring(0, 31);
}

/** Parse CSV text → worksheet. Handles quoted fields, BOM, leading metadata rows. */
function csvToSheet(text) {
  // strip BOM
  const clean = text.replace(/^\uFEFF/, '');
  const ws = XLSX.read(clean, { type: 'string', raw: false }).Sheets['Sheet1']
          || XLSX.utils.aoa_to_sheet(parseCsv(clean));
  return ws;
}

/** Simple but robust CSV parser that handles quoted fields with commas/newlines */
function parseCsv(text) {
  const rows = [];
  const lines = text.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    rows.push(splitCsvLine(trimmed));
  }
  return rows;
}

function splitCsvLine(line) {
  const cells = [];
  let cur = '';
  let inQuote = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuote && line[i + 1] === '"') { cur += '"'; i++; }
      else inQuote = !inQuote;
    } else if (ch === ',' && !inQuote) {
      cells.push(cur.trim()); cur = '';
    } else {
      cur += ch;
    }
  }
  cells.push(cur.trim());
  return cells;
}

/** Read a file and return a worksheet, or null if unreadable/unsupported */
function fileToSheet(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (!['.csv', '.txt'].includes(ext)) return null; // skip .dat .doc etc.

  let text;
  try { text = fs.readFileSync(filePath, 'utf-8'); }
  catch (_) { return null; }

  if (!text.trim()) return null;

  try {
    // Use XLSX native CSV reader for best robustness
    const workbook = XLSX.read(text.replace(/^\uFEFF/, ''), { type: 'string', raw: false });
    const firstSheet = workbook.SheetNames[0];
    return workbook.Sheets[firstSheet] || null;
  } catch (_) {
    return null;
  }
}

// ─── file list ────────────────────────────────────────────────────────────────

/**
 * Returns { label, filePath } for every CSV/TXT we want to include.
 * label becomes the sheet name.
 */
function collectFiles() {
  const entries = [];

  // Root level CSVs
  for (const f of fs.readdirSync(BASE)) {
    const full = path.join(BASE, f);
    const ext = path.extname(f).toLowerCase();
    if (fs.statSync(full).isFile() && ['.csv', '.txt'].includes(ext)) {
      entries.push({ label: path.basename(f, ext), filePath: full });
    }
  }

  // Reports-Daily-Multiple root CSVs
  const rdm = path.join(BASE, 'Reports-Daily-Multiple');
  for (const f of fs.readdirSync(rdm)) {
    const full = path.join(rdm, f);
    const ext = path.extname(f).toLowerCase();
    if (fs.statSync(full).isFile() && ['.csv', '.txt'].includes(ext)) {
      entries.push({ label: path.basename(f, ext), filePath: full });
    }
  }

  // Reports-Daily-Multiple sub-folders that are actually .csv folders
  // (BhavCopy_NSE_CM…csv\ and NSE_CM_security…csv\)
  for (const d of ['BhavCopy_NSE_CM_0_0_0_20260825_F_0000.csv', 'NSE_CM_security_25082026.csv']) {
    const dir = path.join(rdm, d);
    if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) continue;
    for (const f of fs.readdirSync(dir)) {
      const full = path.join(dir, f);
      const ext  = path.extname(f).toLowerCase();
      if (fs.statSync(full).isFile() && ['.csv', '.txt'].includes(ext)) {
        entries.push({ label: path.basename(f, ext), filePath: full });
      }
    }
  }

  // PR250826 sub-folder
  const pr = path.join(rdm, 'PR250826');
  if (fs.existsSync(pr)) {
    for (const f of fs.readdirSync(pr)) {
      const full = path.join(pr, f);
      const ext  = path.extname(f).toLowerCase();
      if (fs.statSync(full).isFile() && ['.csv', '.txt'].includes(ext)) {
        entries.push({ label: 'PR_' + path.basename(f, ext), filePath: full });
      }
    }
  }

  return entries;
}

// ─── main ─────────────────────────────────────────────────────────────────────

const files = collectFiles();
const usedNames = new Map(); // track sheet name collisions

let added = 0;
let skipped = 0;

for (const { label, filePath } of files) {
  const ws = fileToSheet(filePath);
  if (!ws) {
    console.warn(`  SKIP (empty/unreadable): ${path.basename(filePath)}`);
    skipped++;
    continue;
  }

  // Deduplicate sheet names
  let name = sheetName(label);
  if (usedNames.has(name)) {
    const count = usedNames.get(name) + 1;
    usedNames.set(name, count);
    name = sheetName(`${label}_${count}`);
  } else {
    usedNames.set(name, 1);
  }

  XLSX.utils.book_append_sheet(wb, ws, name);
  console.log(`  ADD sheet: "${name}" ← ${path.relative(BASE, filePath)}`);
  added++;
}

// Write out
XLSX.writeFile(wb, OUT);
console.log(`\n✅ Done — ${added} sheets written, ${skipped} skipped.`);
console.log(`📁 Output: ${OUT}`);
