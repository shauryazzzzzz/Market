# Installation Notes - better-sqlite3 Issue

## Problem Identified

The `better-sqlite3` package requires Visual Studio Build Tools to compile native C++ modules on Windows. This is causing the npm install to fail.

**Error:**
```
gyp ERR! find VS You need to install the latest version of Visual Studio
gyp ERR! find VS including the "Desktop development with C++" workload.
```

## Solutions

### Option 1: Install Visual Studio Build Tools (Recommended for Production)

1. Download Visual Studio Build Tools:
   https://visualstudio.microsoft.com/downloads/#build-tools-for-visual-studio-2022

2. Install with "Desktop development with C++" workload

3. Restart terminal and run:
   ```bash
   npm install better-sqlite3
   ```

### Option 2: Use Prebuilt Binaries (Quick Solution)

Install better-sqlite3 with prebuilt binaries:
```bash
npm install better-sqlite3@9.2.2 --build-from-source=false
```

Or try an older version with prebuilt binaries:
```bash
npm install better-sqlite3@8.7.0
```

### Option 3: Use Alternative Database (Temporary Workaround)

For development/testing, we could temporarily use:
- `sqlite3` (pure JavaScript, slower but no compilation needed)
- JSON file storage
- In-memory storage

## Current Status

✅ Installing all other dependencies (without better-sqlite3)  
⏸️ better-sqlite3 installation pending  

## Packages Successfully Installing

- express
- cors
- dotenv
- multer
- papaparse
- axios
- express-validator
- morgan
- helmet
- express-rate-limit
- nodemon
- concurrently

## Next Steps

1. Wait for current installation to complete
2. Try Option 2 (prebuilt binaries)
3. If that fails, install Visual Studio Build Tools (Option 1)
4. Proceed with database initialization

## Alternative: Use sqlite3 Package

If better-sqlite3 continues to fail, we can modify the code to use the `sqlite3` package instead:

```bash
npm install sqlite3
```

This would require minor code changes in:
- `server/config/database.js`
- `server/database/init.js`
- `server/services/dataImporter.js`

## Impact

**Without better-sqlite3:**
- ❌ Cannot initialize database
- ❌ Cannot import CSV data
- ❌ Cannot start backend server
- ✅ Frontend can still be developed
- ✅ UI components are ready

**With better-sqlite3:**
- ✅ Full functionality
- ✅ Fast database operations
- ✅ Complete application

## Recommendation

Try Option 2 first (prebuilt binaries). If that doesn't work within 5 minutes, proceed with Option 1 (Visual Studio Build Tools installation).

---

**Created:** May 28, 2026  
**Status:** Investigating solutions