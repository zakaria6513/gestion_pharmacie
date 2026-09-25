const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const CSV_PATH = String.raw`d:\gest_phar\release\deli_pr_virg2.csv`;
const APPDATA = process.env.APPDATA;
const DB_DIR = path.join(APPDATA, 'Pharmacie Amdjarass');

// Check potentially multiple locations
const PATHS_TO_CHECK = [
    path.join(APPDATA, 'Pharmacie Amdjarass', 'pharmacy.db'),
    path.join(APPDATA, 'Pharmacie Amdjarass', 'pharmacy-dev.db'),
    path.join(APPDATA, 'gest_phar', 'pharmacy-dev.db'),
    path.join(APPDATA, 'gest_phar', 'pharmacy.db'),
];

function getDbPath() {
    for (const p of PATHS_TO_CHECK) {
        console.log(`Checking for DB at: ${p}`);
        if (fs.existsSync(p)) return p;
    }
    return null;
}

function importData() {
    const targetDb = getDbPath();
    if (!targetDb) {
        console.error(`Database not found in ${DB_DIR}`);
        console.error('Please run the app once to initialize the database.');
        process.exit(1);
    }

    console.log(`Using database: ${targetDb}`);
    const db = new Database(targetDb);

    console.log(`Reading CSV from: ${CSV_PATH}`);
    if (!fs.existsSync(CSV_PATH)) {
        console.error('CSV file not found!');
        process.exit(1);
    }

    const content = fs.readFileSync(CSV_PATH, 'latin1'); // Excel CSV often latin1 or check utf8?
    // User file looked like normal chars. UTF8 default should be fine, but sometimes Excel CSVs are tricky.
    // The previous view_file output showed correct chars. Assuming UTF8.
    // Actually, let's try reading as utf8.

    const lines = content.split(/\r?\n/);
    console.log(`Found ${lines.length} lines.`);

    let added = 0;
    let errors = 0;

    const insert = db.prepare(`
        INSERT INTO products (name, stock_quantity, price, expiry_date, min_stock_threshold)
        VALUES (?, ?, ?, ?, 10)
    `);

    const run = db.transaction(() => {
        // Find header index
        let startIndex = 0;
        if (lines[0].toLowerCase().startsWith('nom')) startIndex = 1;

        for (let i = startIndex; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;

            // Handle semicolon separator
            const cols = line.split(';');

            // Format: Nom;Stock;Prix unit;;
            const name = cols[0]?.trim();
            if (!name) continue;

            const stock = parseInt(cols[1]) || 0;
            const price = parseFloat(cols[2]) || 0;

            // Default expiry: 2026-12-31
            const expiryStr = '2026-12-31';

            try {
                insert.run(name, stock, price, expiryStr);
                added++;
            } catch (e) {
                console.error(`Error line ${i}: ${e.message}`);
                errors++;
            }
        }
    });

    try {
        run();
        console.log(`Import completed.`);
        console.log(`Added: ${added}`);
        console.log(`Errors: ${errors}`);
    } catch (e) {
        console.error(`Transaction failed: ${e.message}`);
    }
}

importData();
