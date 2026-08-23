# Financial Monitor - Project Structure (Best Practices)

## 📁 Recommended Folder Structure

```
financial-monitor/
│
├── frontend/                          # React Frontend Application
│   ├── public/                        # Static files
│   │   ├── index.html
│   │   ├── favicon.ico
│   │   └── assets/                    # Images, icons
│   │
│   ├── src/
│   │   ├── components/                # Reusable UI components
│   │   │   ├── common/                # Common components (Button, Card, etc.)
│   │   │   ├── dashboard/             # Dashboard specific components
│   │   │   ├── stock/                 # Stock related components
│   │   │   └── layout/                # Layout components (Header, Footer, Sidebar)
│   │   │
│   │   ├── pages/                     # Page components
│   │   │   ├── Dashboard.js
│   │   │   ├── StockDetail.js
│   │   │   ├── StockList.js
│   │   │   └── SectorView.js
│   │   │
│   │   ├── services/                  # API services
│   │   │   ├── api.js                 # API configuration
│   │   │   ├── stockService.js        # Stock API calls
│   │   │   └── dashboardService.js    # Dashboard API calls
│   │   │
│   │   ├── hooks/                     # Custom React hooks
│   │   │   ├── useStocks.js
│   │   │   └── useDashboard.js
│   │   │
│   │   ├── utils/                     # Utility functions
│   │   │   ├── formatters.js          # Number, date formatters
│   │   │   └── validators.js          # Input validators
│   │   │
│   │   ├── styles/                    # Global styles
│   │   │   ├── global.css
│   │   │   ├── variables.css          # CSS variables
│   │   │   └── themes.css             # Theme definitions
│   │   │
│   │   ├── constants/                 # Constants
│   │   │   └── index.js
│   │   │
│   │   ├── App.js                     # Main App component
│   │   ├── index.js                   # Entry point
│   │   └── routes.js                  # Route definitions
│   │
│   ├── package.json
│   ├── .env                           # Frontend environment variables
│   └── README.md
│
├── backend/                           # Node.js Backend Application
│   ├── src/
│   │   ├── config/                    # Configuration files
│   │   │   ├── database.js            # Database configuration
│   │   │   ├── server.js              # Server configuration
│   │   │   └── constants.js           # Backend constants
│   │   │
│   │   ├── controllers/               # Request handlers
│   │   │   ├── stockController.js
│   │   │   └── dashboardController.js
│   │   │
│   │   ├── models/                    # Data models
│   │   │   ├── Stock.js
│   │   │   ├── QuarterlyResult.js
│   │   │   └── FinancialRatio.js
│   │   │
│   │   ├── routes/                    # API routes
│   │   │   ├── index.js               # Main router
│   │   │   ├── stocks.js
│   │   │   └── dashboard.js
│   │   │
│   │   ├── services/                  # Business logic
│   │   │   ├── csvParser.js
│   │   │   ├── dataImporter.js
│   │   │   └── calculationService.js
│   │   │
│   │   ├── middleware/                # Express middleware
│   │   │   ├── errorHandler.js
│   │   │   ├── validator.js
│   │   │   └── auth.js (future)
│   │   │
│   │   ├── utils/                     # Utility functions
│   │   │   ├── logger.js
│   │   │   └── helpers.js
│   │   │
│   │   └── server.js                  # Main server file
│   │
│   ├── scripts/                       # Utility scripts
│   │   ├── importCSV.js
│   │   ├── seedDatabase.js
│   │   └── backup.js
│   │
│   ├── tests/                         # Backend tests
│   │   ├── unit/
│   │   └── integration/
│   │
│   ├── package.json
│   ├── .env                           # Backend environment variables
│   └── README.md
│
├── database/                          # Database files
│   ├── schema/                        # Database schemas
│   │   ├── schema.sql                 # Main schema
│   │   ├── indexes.sql                # Index definitions
│   │   └── triggers.sql               # Trigger definitions
│   │
│   ├── migrations/                    # Database migrations
│   │   ├── 001_initial_schema.sql
│   │   └── 002_add_indexes.sql
│   │
│   ├── seeds/                         # Seed data
│   │   └── sample_data.sql
│   │
│   ├── backups/                       # Database backups
│   │   └── .gitkeep
│   │
│   └── financial_monitor.db          # SQLite database file
│
├── data/                              # Data files
│   ├── csv/                           # CSV import files
│   │   ├── imports/                   # Files to import
│   │   └── processed/                 # Processed files
│   │
│   └── exports/                       # Exported data
│
├── logs/                              # Application logs
│   ├── app.log                        # Application logs
│   ├── error.log                      # Error logs
│   ├── access.log                     # Access logs
│   └── .gitkeep
│
├── docs/                              # Documentation
│   ├── api/                           # API documentation
│   │   ├── API-DOCUMENTATION.md
│   │   └── endpoints.md
│   │
│   ├── architecture/                  # Architecture docs
│   │   ├── architecture-overview.md
│   │   └── database-design.md
│   │
│   ├── guides/                        # User guides
│   │   ├── QUICK-START.md
│   │   ├── TESTING-GUIDE.md
│   │   └── csv-mapping-guide.md
│   │
│   └── planning/                      # Planning documents
│       ├── financial-monitor-plan.md
│       └── PLAN-SUMMARY.md
│
├── config/                            # Global configuration
│   ├── .env.example                   # Environment template
│   └── config.json                    # Global config
│
├── scripts/                           # Project-level scripts
│   ├── setup.sh                       # Setup script
│   ├── start-dev.sh                   # Start development
│   └── deploy.sh                      # Deployment script
│
├── .gitignore                         # Git ignore rules
├── .env                               # Root environment variables
├── package.json                       # Root package.json (for scripts)
├── README.md                          # Main README
├── PROJECT-STRUCTURE.md               # This file
└── LICENSE                            # License file

```

## 📋 Current vs Recommended Structure

### Current Structure Issues:
1. ❌ Backend files mixed in root `server/` folder
2. ❌ Frontend in `client/` (should be `frontend/`)
3. ❌ No dedicated `database/` folder
4. ❌ No `logs/` folder
5. ❌ Documentation scattered
6. ❌ No `data/` folder for CSV files

### Recommended Changes:
1. ✅ Rename `server/` → `backend/`
2. ✅ Rename `client/` → `frontend/`
3. ✅ Create `database/` folder with schema, migrations, backups
4. ✅ Create `logs/` folder for application logs
5. ✅ Organize `docs/` into subfolders
6. ✅ Create `data/` folder for CSV imports/exports
7. ✅ Add `scripts/` for utility scripts
8. ✅ Better organize frontend components

## 🎯 Benefits of New Structure

### 1. **Clear Separation of Concerns**
- Frontend, Backend, Database, Data, Docs all separate
- Easy to navigate and understand

### 2. **Scalability**
- Easy to add new features
- Clear where new files should go

### 3. **Team Collaboration**
- Frontend devs work in `frontend/`
- Backend devs work in `backend/`
- DBAs work in `database/`

### 4. **Deployment Ready**
- Frontend can be deployed separately
- Backend can be containerized easily
- Database migrations are organized

### 5. **Maintenance**
- Logs in dedicated folder
- Backups in dedicated folder
- Easy to find and fix issues

## 🔄 Migration Plan

### Phase 1: Rename Main Folders
```bash
# Rename client to frontend
mv client frontend

# Rename server to backend
mv server backend
```

### Phase 2: Create New Folders
```bash
mkdir -p database/{schema,migrations,seeds,backups}
mkdir -p data/{csv/imports,csv/processed,exports}
mkdir -p logs
mkdir -p scripts
```

### Phase 3: Reorganize Files
```bash
# Move database files
mv backend/database/schema.sql database/schema/
mv backend/database/init.js database/schema/

# Move documentation
mkdir -p docs/{api,architecture,guides,planning}
mv docs/*.md docs/guides/

# Move scripts
mv backend/scripts/* scripts/
```

### Phase 4: Update Paths
- Update import paths in code
- Update package.json scripts
- Update .env files
- Update documentation

## 📝 File Naming Conventions

### JavaScript/React Files
- Components: PascalCase (e.g., `Dashboard.js`, `StockCard.js`)
- Services: camelCase (e.g., `stockService.js`, `apiService.js`)
- Utils: camelCase (e.g., `formatters.js`, `validators.js`)

### CSS Files
- Component styles: Match component name (e.g., `Dashboard.css`)
- Global styles: lowercase (e.g., `global.css`, `variables.css`)

### Database Files
- Schema: lowercase with underscores (e.g., `schema.sql`, `create_tables.sql`)
- Migrations: numbered (e.g., `001_initial_schema.sql`)

### Documentation
- UPPERCASE for important docs (e.g., `README.md`, `LICENSE`)
- kebab-case for guides (e.g., `quick-start.md`, `api-documentation.md`)

## 🚀 Next Steps

1. **Review this structure** - Confirm it meets your needs
2. **Backup current project** - Safety first!
3. **Execute migration** - Reorganize folders
4. **Update configurations** - Fix all paths
5. **Test everything** - Ensure nothing breaks
6. **Update documentation** - Reflect new structure

---

**Would you like me to execute this reorganization?** 
I can create the new structure and move all files to their proper locations while maintaining functionality.