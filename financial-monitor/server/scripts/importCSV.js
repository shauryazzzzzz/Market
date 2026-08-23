const path = require('path');
const fs = require('fs');
const { importFromCSV } = require('../services/dataImporter');
require('dotenv').config();

/**
 * Import CSV file into database
 * Usage: node server/scripts/importCSV.js <path-to-csv-file>
 */
const main = async () => {
    try {
        // Get CSV file path from command line argument
        const csvPath = process.argv[2];

        if (!csvPath) {
            console.error('❌ Error: Please provide CSV file path');
            console.log('\nUsage:');
            console.log('  node server/scripts/importCSV.js <path-to-csv-file>');
            console.log('\nExample:');
            console.log('  node server/scripts/importCSV.js "C:/Users/SaurabhSolanki/OneDrive - IBM/Documents/Personal documents/Investment/Screener 21 May.csv"');
            process.exit(1);
        }

        // Check if file exists
        if (!fs.existsSync(csvPath)) {
            console.error(`❌ Error: File not found: ${csvPath}`);
            process.exit(1);
        }

        console.log('🚀 Starting CSV import...');
        console.log(`📁 File: ${csvPath}\n`);

        // Import CSV
        const result = await importFromCSV(csvPath);

        // Display results
        console.log('\n' + '='.repeat(60));
        console.log('📊 IMPORT SUMMARY');
        console.log('='.repeat(60));
        console.log(`✅ Total Stocks: ${result.summary.totalStocks}`);
        console.log(`   - New: ${result.summary.newStocks}`);
        console.log(`   - Updated: ${result.summary.updatedStocks}`);
        console.log(`\n📈 Data Imported:`);
        console.log(`   - Quarterly Results: ${result.results.quarterlyResults.inserted}`);
        console.log(`   - Latest Quarter: ${result.results.quarterlyResultsLatest.inserted}`);
        console.log(`   - Trading Data: ${result.results.tradingData.inserted}`);
        console.log(`   - Cash Flow: ${result.results.cashFlow.inserted}`);
        console.log(`   - Financial Ratios: ${result.results.financialRatios.inserted}`);
        console.log(`   - Shareholding: ${result.results.shareholdingPattern.inserted}`);
        console.log(`   - Growth Metrics: ${result.results.growthMetrics.inserted}`);

        if (result.results.errors.length > 0) {
            console.log(`\n⚠️  Errors: ${result.results.errors.length}`);
            console.log('\nFirst 5 errors:');
            result.results.errors.slice(0, 5).forEach(err => {
                console.log(`   Row ${err.row}: ${err.error} (${err.action})`);
            });
        }

        console.log('\n' + '='.repeat(60));
        console.log('✅ Import completed successfully!');
        console.log('='.repeat(60) + '\n');

        process.exit(0);
    } catch (error) {
        console.error('\n❌ Import failed:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
};

// Run the script
main();

// Made with Bob
