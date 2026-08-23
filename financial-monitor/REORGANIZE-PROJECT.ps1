# Financial Monitor - Project Reorganization Script
# Run this script AFTER stopping all running servers (frontend and backend)

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Financial Monitor - Project Reorganization" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check if servers are running
Write-Host "⚠️  IMPORTANT: Please stop all running servers before continuing!" -ForegroundColor Yellow
Write-Host "   - Stop React dev server (Ctrl+C in frontend terminal)" -ForegroundColor Yellow
Write-Host "   - Stop Node.js backend server (Ctrl+C in backend terminal)" -ForegroundColor Yellow
Write-Host ""
$continue = Read-Host "Have you stopped all servers? (yes/no)"

if ($continue -ne "yes") {
    Write-Host "❌ Reorganization cancelled. Please stop servers and run again." -ForegroundColor Red
    exit
}

Write-Host ""
Write-Host "Starting reorganization..." -ForegroundColor Green
Write-Host ""

# Set location
Set-Location "C:\Users\SaurabhSolanki\financial-monitor"

# Step 1: Rename main folders
Write-Host "📁 Step 1: Renaming main folders..." -ForegroundColor Cyan
try {
    if (Test-Path "client") {
        Rename-Item -Path "client" -NewName "frontend" -ErrorAction Stop
        Write-Host "   ✅ Renamed: client → frontend" -ForegroundColor Green
    }
    if (Test-Path "server") {
        Rename-Item -Path "server" -NewName "backend" -ErrorAction Stop
        Write-Host "   ✅ Renamed: server → backend" -ForegroundColor Green
    }
} catch {
    Write-Host "   ❌ Error renaming folders: $_" -ForegroundColor Red
    Write-Host "   Please close VS Code and any file explorers, then try again." -ForegroundColor Yellow
    exit
}

# Step 2: Move database files
Write-Host ""
Write-Host "📁 Step 2: Moving database files..." -ForegroundColor Cyan
if (Test-Path "backend\database\schema.sql") {
    Move-Item -Path "backend\database\schema.sql" -Destination "database\schema\" -Force
    Write-Host "   ✅ Moved: schema.sql → database/schema/" -ForegroundColor Green
}
if (Test-Path "backend\database\init.js") {
    Move-Item -Path "backend\database\init.js" -Destination "database\schema\" -Force
    Write-Host "   ✅ Moved: init.js → database/schema/" -ForegroundColor Green
}

# Step 3: Move scripts
Write-Host ""
Write-Host "📁 Step 3: Moving scripts..." -ForegroundColor Cyan
if (Test-Path "backend\scripts") {
    Get-ChildItem "backend\scripts\*" | Move-Item -Destination "scripts\" -Force
    Write-Host "   ✅ Moved: backend/scripts/* → scripts/" -ForegroundColor Green
}

# Step 4: Organize documentation
Write-Host ""
Write-Host "📁 Step 4: Organizing documentation..." -ForegroundColor Cyan

# Create docs subfolders
New-Item -ItemType Directory -Path "docs\api" -Force | Out-Null
New-Item -ItemType Directory -Path "docs\architecture" -Force | Out-Null
New-Item -ItemType Directory -Path "docs\guides" -Force | Out-Null
New-Item -ItemType Directory -Path "docs\planning" -Force | Out-Null

# Move API docs
if (Test-Path "docs\API-DOCUMENTATION.md") {
    Move-Item -Path "docs\API-DOCUMENTATION.md" -Destination "docs\api\" -Force
}

# Move architecture docs
if (Test-Path "docs\architecture-overview.md") {
    Move-Item -Path "docs\architecture-overview.md" -Destination "docs\architecture\" -Force
}

# Move guides
$guides = @("QUICK-START.md", "TESTING-GUIDE.md", "csv-mapping-guide.md", "FRONTEND-GUIDE.md")
foreach ($guide in $guides) {
    if (Test-Path $guide) {
        Move-Item -Path $guide -Destination "docs\guides\" -Force
    }
}

# Move planning docs
$planning = @("financial-monitor-plan.md", "PLAN-SUMMARY.md")
foreach ($plan in $planning) {
    if (Test-Path "docs\$plan") {
        Move-Item -Path "docs\$plan" -Destination "docs\planning\" -Force
    }
}

Write-Host "   ✅ Documentation organized" -ForegroundColor Green

# Step 5: Move CSV file to data folder
Write-Host ""
Write-Host "📁 Step 5: Moving CSV files..." -ForegroundColor Cyan
if (Test-Path "Screener 21 May.csv") {
    Move-Item -Path "Screener 21 May.csv" -Destination "data\csv\imports\" -Force
    Write-Host "   ✅ Moved: Screener 21 May.csv → data/csv/imports/" -ForegroundColor Green
}

# Step 6: Move config files
Write-Host ""
Write-Host "📁 Step 6: Moving config files..." -ForegroundColor Cyan
if (Test-Path ".env.example") {
    Copy-Item -Path ".env.example" -Destination "config\" -Force
    Write-Host "   ✅ Copied: .env.example → config/" -ForegroundColor Green
}

# Step 7: Create .gitkeep files for empty folders
Write-Host ""
Write-Host "📁 Step 7: Creating .gitkeep files..." -ForegroundColor Cyan
$emptyFolders = @(
    "database\backups",
    "data\csv\processed",
    "data\exports",
    "logs"
)
foreach ($folder in $emptyFolders) {
    New-Item -ItemType File -Path "$folder\.gitkeep" -Force | Out-Null
}
Write-Host "   ✅ Created .gitkeep files" -ForegroundColor Green

# Step 8: Create README files
Write-Host ""
Write-Host "📁 Step 8: Creating README files..." -ForegroundColor Cyan

# Database README
@"
# Database

This folder contains all database-related files.

## Structure

- **schema/** - Database schema definitions
- **migrations/** - Database migration scripts
- **seeds/** - Seed data for testing
- **backups/** - Database backup files

## Files

- `financial_monitor.db` - Main SQLite database file (created after initialization)
"@ | Out-File -FilePath "database\README.md" -Encoding UTF8

# Data README
@"
# Data

This folder contains all data files.

## Structure

- **csv/imports/** - CSV files to be imported
- **csv/processed/** - Processed CSV files
- **exports/** - Exported data files

## Usage

Place your Screener.in CSV files in `csv/imports/` folder for importing.
"@ | Out-File -FilePath "data\README.md" -Encoding UTF8

# Logs README
@"
# Logs

This folder contains application logs.

## Log Files

- `app.log` - General application logs
- `error.log` - Error logs
- `access.log` - API access logs

Logs are automatically created when the application runs.
"@ | Out-File -FilePath "logs\README.md" -Encoding UTF8

Write-Host "   ✅ Created README files" -ForegroundColor Green

# Summary
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "✅ Reorganization Complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "📁 New Structure:" -ForegroundColor Cyan
Write-Host "   ✅ frontend/     (renamed from client/)" -ForegroundColor Green
Write-Host "   ✅ backend/      (renamed from server/)" -ForegroundColor Green
Write-Host "   ✅ database/     (schema, migrations, backups)" -ForegroundColor Green
Write-Host "   ✅ data/         (CSV imports/exports)" -ForegroundColor Green
Write-Host "   ✅ logs/         (application logs)" -ForegroundColor Green
Write-Host "   ✅ scripts/      (utility scripts)" -ForegroundColor Green
Write-Host "   ✅ config/       (configuration files)" -ForegroundColor Green
Write-Host "   ✅ docs/         (organized documentation)" -ForegroundColor Green
Write-Host ""
Write-Host "⚠️  IMPORTANT NEXT STEPS:" -ForegroundColor Yellow
Write-Host "   1. Update import paths in backend code" -ForegroundColor Yellow
Write-Host "   2. Update package.json scripts" -ForegroundColor Yellow
Write-Host "   3. Test backend server: cd backend && npm start" -ForegroundColor Yellow
Write-Host "   4. Test frontend: cd frontend && npm start" -ForegroundColor Yellow
Write-Host ""
Write-Host "📄 See PROJECT-STRUCTURE.md for complete details" -ForegroundColor Cyan
Write-Host ""

# Pause
Read-Host "Press Enter to exit"

# Made with Bob
