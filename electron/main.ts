import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import Database from 'better-sqlite3';

// Simple password hashing using SHA-256 + salt (no native deps needed)
function hashPassword(password: string): string {
  const salt = 'amdjarass_pharmacy_salt_2025';
  return crypto.createHash('sha256').update(salt + password).digest('hex');
}

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
try { if (require('electron-squirrel-startup')) { app.quit(); } } catch (_) {}

let mainWindow: BrowserWindow | null = null;
let db: Database.Database | null = null;

// ──────────────────────────────────────────────────────────────────────────────
// AUTO-BACKUP: runs silently on each app start, keeps 7 rolling daily backups
// ──────────────────────────────────────────────────────────────────────────────
async function autoBackup(): Promise<void> {
  if (!db) return;
  // Only run in production (not dev) to avoid polluting dev env with backups
  if (process.env.VITE_DEV_SERVER_URL) return;

  try {
    const backupDir = path.join(app.getPath('userData'), 'backups');
    if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });

    // Check if a backup was already done today
    const today = new Date().toISOString().split('T')[0]; // e.g. "2026-08-08"
    const todayFile = path.join(backupDir, `auto_backup_${today}.db`);

    if (fs.existsSync(todayFile)) {
      console.log('[AutoBackup] Backup already exists for today:', today);
      return; // Already backed up today — skip
    }

    console.log('[AutoBackup] Creating automatic backup for', today, '...');

    // Flush WAL before backup so backup is fully consistent
    db.pragma('wal_checkpoint(RESTART)');

    // Use better-sqlite3's built-in online backup API (safe while DB is open)
    await db.backup(todayFile);

    console.log('[AutoBackup] Backup saved to:', todayFile);

    // Rotate: keep only the 7 most recent backups
    const allBackups = fs.readdirSync(backupDir)
      .filter(f => f.startsWith('auto_backup_') && f.endsWith('.db'))
      .sort() // ISO date strings sort chronologically
      .reverse(); // newest first

    if (allBackups.length > 7) {
      const toDelete = allBackups.slice(7); // files beyond the 7 newest
      for (const old of toDelete) {
        try {
          fs.unlinkSync(path.join(backupDir, old));
          console.log('[AutoBackup] Removed old backup:', old);
        } catch (_) {}
      }
    }
  } catch (err) {
    // Backup failure must NEVER crash or block the app
    console.error('[AutoBackup] Failed (non-critical):', err);
  }
}

const createWindow = () => {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
    title: 'Pharmacie Amdjarass',
    icon: path.join(__dirname, '../public/logo.png'),
    show: false
  });

  mainWindow.maximize();
  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
    // mainWindow.webContents.openDevTools(); // Disabled for cleaner UI
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  // Remove menu for production feel, or create custom one
  mainWindow.setMenuBarVisibility(false);
};

app.on('ready', () => {
  // Initialize Database
  try {
    const dbPath = process.env.VITE_DEV_SERVER_URL
      ? path.join(app.getPath('userData'), 'pharmacy-dev.db')
      : path.join(app.getPath('userData'), 'pharmacy.db');

    console.log('Database path:', dbPath);
    db = new Database(dbPath);
    db.pragma('journal_mode = WAL');
    db.pragma('busy_timeout = 3000');
    db.pragma('foreign_keys = ON');

    // Create tables if not exist
    createTables();

    // Run migration: deduplicate + enforce UNIQUE constraint
    migrateDatabase();

    // Seed default admin if empty
    seedDatabase();

    // Only create window if DB initialized successfully
    createWindow();

    // Run auto-backup AFTER window is shown (non-blocking, runs in background)
    // Keeps 7 daily rolling backups in: userData/backups/auto_backup_YYYY-MM-DD.db
    setTimeout(() => autoBackup(), 5000);

  } catch (err) {
    console.error('Failed to initialize database:', err);
    // Still create window so user sees error state
    createWindow();
  }
});

// Close DB properly on quit
app.on('will-quit', () => {
  if (db) {
    try { db.close(); } catch (_) {}
    db = null;
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// --- Database Schema & Helpers ---

function createTables() {
  if (!db) return;

  // Users
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT CHECK(role IN ('admin', 'employee')) NOT NULL DEFAULT 'employee',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Products
  db.exec(`
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      dosage TEXT,
      barcode TEXT,
      stock_quantity INTEGER NOT NULL DEFAULT 0,
      expiry_date DATE NOT NULL,
      min_stock_threshold INTEGER DEFAULT 10,
      price REAL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Sales
  db.exec(`
    CREATE TABLE IF NOT EXISTS sales (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      total_amount REAL NOT NULL,
      sale_date DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id)
    )
  `);

  // Sale Items
  db.exec(`
    CREATE TABLE IF NOT EXISTS sale_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sale_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      quantity INTEGER NOT NULL,
      price_at_sale REAL NOT NULL,
      FOREIGN KEY(sale_id) REFERENCES sales(id),
      FOREIGN KEY(product_id) REFERENCES products(id)
    )
  `);

  // Performance Indices
  db.exec(`CREATE INDEX IF NOT EXISTS idx_sales_date ON sales(sale_date)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_sales_user ON sales(user_id)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_sale_items_sale ON sale_items(sale_id)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_sale_items_product ON sale_items(product_id)`);
  // New optimizations
  db.exec(`CREATE INDEX IF NOT EXISTS idx_products_name ON products(name)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode)`);
}

function seedDatabase() {
  if (!db) return;
  const stmt = db.prepare('SELECT count(*) as count FROM users');
  const result = stmt.get() as { count: number };

  if (result.count === 0) {
    console.log('Seeding default admin user with hashed passwords...');
    db.prepare('INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)').run('bahar', hashPassword('yeskoy65'), 'admin');
    db.prepare('INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)').run('zakaria', hashPassword('yeskoy_em'), 'employee');
  } else {
    // Migration: rehash any users still storing plaintext passwords
    // A hashed password is always 64 hex chars; plaintext is shorter
    const allUsers = db.prepare('SELECT id, password_hash FROM users').all() as { id: number; password_hash: string }[];
    for (const u of allUsers) {
      if (u.password_hash.length !== 64) {
        const hashed = hashPassword(u.password_hash);
        db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hashed, u.id);
        console.log(`[Migration] Rehashed password for user id=${u.id}`);
      }
    }
  }
}


// ---------------------------------------------------------------
// MIGRATION: Auto-heal duplicates + enforce UNIQUE at DB level
// This runs on every app start. Safe to run multiple times.
// ---------------------------------------------------------------
function migrateDatabase() {
  if (!db) return;

  try {
    // Step 1 — Check if UNIQUE index already exists
    const indexExists = db.prepare(`
      SELECT name FROM sqlite_master
      WHERE type = 'index' AND name = 'idx_products_name_unique'
    `).get();

    if (!indexExists) {
      console.log('[Migration] UNIQUE index missing — deduplicating products first...');

      // Step 2 — Find and merge all duplicate product names
      const duplicateGroups = db.prepare(`
        SELECT LOWER(name) as lower_name
        FROM products
        GROUP BY LOWER(name)
        HAVING COUNT(*) > 1
      `).all() as { lower_name: string }[];

      if (duplicateGroups.length > 0) {
        console.log(`[Migration] Found ${duplicateGroups.length} duplicate group(s). Deduplicating (keeping highest stock)...`);

        const dedup = db.transaction(() => {
          for (const group of duplicateGroups) {
            // The product with the HIGHEST stock survives
            // In case of tie, keep the one with the lowest ID (oldest)
            const items = db!.prepare(
              `SELECT id, stock_quantity FROM products WHERE LOWER(name) = ? ORDER BY stock_quantity DESC, id ASC`
            ).all(group.lower_name) as { id: number; stock_quantity: number }[];

            const survivor = items[0]; // Highest stock
            const duplicates = items.slice(1);

            // Sum all stocks into survivor (cohérent avec le bouton dédupliquer)
            const totalStock = items.reduce((sum: number, p: { id: number; stock_quantity: number }) => sum + p.stock_quantity, 0);
            db!.prepare('UPDATE products SET stock_quantity = ? WHERE id = ?').run(totalStock, survivor.id);
            for (const dup of duplicates) {
              // Re-link any sales to the survivor
              db!.prepare(`UPDATE sale_items SET product_id = ? WHERE product_id = ?`)
                .run(survivor.id, dup.id);
              // Delete the duplicate
              db!.prepare(`DELETE FROM products WHERE id = ?`).run(dup.id);
            }
          }
        });

        dedup();
        console.log('[Migration] Deduplication complete (stocks summed into survivor).');
      }

      // Step 3 — Now safe to create the UNIQUE index
      // This makes it PHYSICALLY IMPOSSIBLE for duplicate product names to exist in DB
      db.exec(`
        CREATE UNIQUE INDEX IF NOT EXISTS idx_products_name_unique
        ON products (LOWER(name))
      `);
      console.log('[Migration] UNIQUE constraint on products.name applied successfully.');
    }
  } catch (err) {
    console.error('[Migration] Error:', err);
  }
}


// --- IPC Handlers ---

ipcMain.handle('print-receipt', async (_, htmlContent) => {
  return new Promise((resolve) => {
    let workerWindow: BrowserWindow | null = new BrowserWindow({
      show: false,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true
      }
    });

    workerWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(htmlContent)}`);

    workerWindow.webContents.once('did-finish-load', () => {
      workerWindow?.webContents.print({ silent: false, printBackground: true, margins: { marginType: 'none' } }, (success, failureReason) => {
        if (!success) {
          console.error('Print failed:', failureReason);
          resolve({ success: false, error: failureReason });
        } else {
          resolve({ success: true });
        }
        workerWindow?.close();
        workerWindow = null;
      });
    });
  });
});

ipcMain.handle('login', (_, { username, password }) => {
  if (!db) throw new Error('Database not initialized');
  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username) as any;
  if (user && user.password_hash === hashPassword(password)) {
    return { success: true, user: { id: user.id, username: user.username, role: user.role } };
  }
  return { success: false, message: 'Invalid credentials' };
});

ipcMain.handle('get-dashboard-stats', () => {
  if (!db) throw new Error('Database not initialized');

  const totalProducts = (db.prepare('SELECT COUNT(*) as count FROM products').get() as any).count;
  const lowStock = (db.prepare('SELECT COUNT(*) as count FROM products WHERE stock_quantity <= min_stock_threshold').get() as any).count;

  // Expired or expiring soon (within 30 days)
  const today = new Date().toISOString().split('T')[0];
  const expired = (db.prepare('SELECT COUNT(*) as count FROM products WHERE expiry_date <= ?').get(today) as any).count;

  // Total Revenue
  const totalRevenue = (db.prepare('SELECT SUM(total_amount) as total FROM sales').get() as any).total || 0;

  return { totalProducts, lowStock, expired, totalRevenue };
});

ipcMain.handle('get-sales-chart', () => {
  if (!db) throw new Error('Database not initialized');
  // Last 7 days
  return db.prepare(`
        SELECT strftime('%Y-%m-%d', sale_date) as date, SUM(total_amount) as total
        FROM sales
        WHERE sale_date >= date('now', '-7 days')
        GROUP BY date
        ORDER BY date ASC
    `).all();
});

ipcMain.handle('get-top-products', () => {
  if (!db) throw new Error('Database not initialized');
  // Top 5 selling products — limited to last 365 days to stay fast after years of data
  return db.prepare(`
        SELECT p.name, SUM(si.quantity) as total_sold
        FROM sale_items si
        JOIN products p ON si.product_id = p.id
        WHERE si.sale_id IN (SELECT id FROM sales WHERE sale_date >= date('now', '-365 days'))
        GROUP BY si.product_id
        ORDER BY total_sold DESC
        LIMIT 5
    `).all();
});

ipcMain.handle('get-products', (_, { search, filter, limit = -1, offset = 0 } = {}) => {
  if (!db) throw new Error('Database not initialized');
  let query = 'SELECT * FROM products';
  const params = [];
  const conditions = [];

  if (search) {
    // Split search terms by space for multi-keyword search (e.g., "doli 500")
    const terms = search.trim().split(/\s+/);
    const termConditions = terms.map((_: string) => '(name LIKE ? OR barcode LIKE ?)');

    // Combine conditions with AND so all terms must be present
    conditions.push('(' + termConditions.join(' AND ') + ')');

    terms.forEach((term: string) => {
      params.push(`%${term}%`, `%${term}%`);
    });
  }

  if (filter === 'expired') {
    const today = new Date().toISOString().split('T')[0];
    conditions.push('expiry_date <= ?');
    params.push(today);
  } else if (filter === 'lowStock') {
    conditions.push('stock_quantity <= min_stock_threshold');
  }

  if (conditions.length > 0) {
    query += ' WHERE ' + conditions.join(' AND ');
  }

  // Get total count for this query without limit
  const countQuery = `SELECT COUNT(*) as total FROM products ${conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : ''}`;
  const totalResult = db.prepare(countQuery).get(...params) as { total: number };
  const total = totalResult.total;

  query += ' ORDER BY name ASC';

  // Apply pagination if limit is positive
  if (limit > 0) {
    query += ' LIMIT ? OFFSET ?';
    params.push(limit, offset);
  }

  const products = db.prepare(query).all(...params);

  // Return wrapper object with data and total count
  return { products, total };
});

ipcMain.handle('add-product', (_, product) => {
  if (!db) throw new Error('Database not initialized');

  // Check for duplicate name strictly (case-insensitive)
  if (product.name) {
    const existingName = db.prepare('SELECT id, stock_quantity FROM products WHERE LOWER(name) = LOWER(?)').get(product.name) as any;
    if (existingName) {
      throw new Error(`Un produit portant ce nom existe déjà (Stock actuel: ${existingName.stock_quantity}). Veuillez plutôt ajouter ce stock au produit existant.`);
    }
  }

  // Check for duplicate barcode
  if (product.barcode) {
    const existing = db.prepare('SELECT id FROM products WHERE barcode = ?').get(product.barcode);
    if (existing) {
      throw new Error('Un produit avec ce code-barre existe déjà.');
    }
  }

  const stmt = db.prepare(`
        INSERT INTO products (name, barcode, stock_quantity, expiry_date, min_stock_threshold, price)
        VALUES (@name, @barcode, @stock_quantity, @expiry_date, @min_stock_threshold, @price)
    `);

  const info = stmt.run(product);
  return { id: info.lastInsertRowid };
});

ipcMain.handle('update-product', (_, product) => {
  if (!db) throw new Error('Database not initialized');

  // Check for duplicate name
  if (product.name) {
    const existingName = db.prepare('SELECT id FROM products WHERE LOWER(name) = LOWER(?) AND id != ?').get(product.name, product.id);
    if (existingName) {
      throw new Error('Un autre produit portant ce nom exact existe déjà. Évitez de créer des doublons de noms.');
    }
  }

  const stmt = db.prepare(`
        UPDATE products 
        SET name = @name, barcode = @barcode,
    stock_quantity = @stock_quantity, expiry_date = @expiry_date,
    min_stock_threshold = @min_stock_threshold, price = @price
        WHERE id = @id
    `);

  // Check for duplicate barcode if changed
  if (product.barcode) {
    const existing = db.prepare('SELECT id FROM products WHERE barcode = ? AND id != ?').get(product.barcode, product.id);
    if (existing) {
      throw new Error('Un produit avec ce code-barre existe déjà.');
    }
  }

  const info = stmt.run(product);
  return { changes: info.changes };
});

ipcMain.handle('delete-product', (_, id) => {
  if (!db) throw new Error('Database not initialized');

  try {
    const stmt = db.prepare('DELETE FROM products WHERE id = ?');
    const info = stmt.run(id);
    return { changes: info.changes };
  } catch (err: any) {
    if (err.message && err.message.includes('FOREIGN KEY constraint failed')) {
      throw new Error('Impossible de supprimer ce médicament : il a déjà été vendu et fait partie de l\'historique comptable. Veuillez plutôt mettre son stock à 0.');
    }
    throw err;
  }
});

// --- Deduplicate Products IPC ---
// Merges products with the same name (case-insensitive) into one.
// The product with the lowest ID survives; others are deleted after merging.
ipcMain.handle('deduplicate-products', () => {
  if (!db) throw new Error('Database not initialized');

  // Find groups of duplicate names
  const duplicateGroups = db.prepare(`
    SELECT LOWER(name) as lower_name, COUNT(*) as cnt
    FROM products
    GROUP BY LOWER(name)
    HAVING cnt > 1
  `).all() as { lower_name: string; cnt: number }[];

  if (duplicateGroups.length === 0) {
    return { success: true, merged: 0, message: 'Aucun doublon détecté.' };
  }

  let mergedCount = 0;

  const deduplication = db.transaction(() => {
    for (const group of duplicateGroups) {
      // Get all products in this group, ordered by id ASC (lowest id = survivor)
      const items = db!.prepare(
        `SELECT id, stock_quantity FROM products WHERE LOWER(name) = ? ORDER BY id ASC`
      ).all(group.lower_name) as { id: number; stock_quantity: number }[];

      const survivor = items[0];
      const duplicates = items.slice(1);

      // Sum up all stock quantities
      const totalStock = items.reduce((sum, p) => sum + p.stock_quantity, 0);

      // Update survivor stock
      db!.prepare(`UPDATE products SET stock_quantity = ? WHERE id = ?`)
        .run(totalStock, survivor.id);

      for (const dup of duplicates) {
        // Re-point all sale_items referencing the duplicate to the survivor
        db!.prepare(`UPDATE sale_items SET product_id = ? WHERE product_id = ?`)
          .run(survivor.id, dup.id);

        // Now safe to delete the duplicate
        db!.prepare(`DELETE FROM products WHERE id = ?`).run(dup.id);

        mergedCount++;
      }
    }
  });

  deduplication();

  return {
    success: true,
    merged: mergedCount,
    message: `${mergedCount} doublon(s) supprimé(s) et fusionné(s) avec succès.`
  };
});

ipcMain.handle('create-sale', (_, { userId, items, total }) => {
  if (!db) throw new Error('Database not initialized');

  if (!items || items.length === 0) {
    throw new Error('Le panier est vide.');
  }

  const transaction = db.transaction(() => {
    // Verify Stock and Calculate Total
    let calculatedTotal = 0;
    const productInfoMap = new Map();

    for (const item of items) {
      if (!item.productId || !item.quantity || item.quantity <= 0) {
        throw new Error(`Article invalide dans le panier.`);
      }

      const product = db!.prepare('SELECT id, name, price, stock_quantity FROM products WHERE id = ?').get(item.productId) as any;
      if (!product) throw new Error(`Produit ID ${item.productId} introuvable.`);

      // CRITICAL: Verify stock availability
      if (product.stock_quantity < item.quantity) {
        throw new Error(`Stock insuffisant pour "${product.name}": disponible ${product.stock_quantity}, demandé ${item.quantity}.`);
      }

      productInfoMap.set(item.productId, product);
      // Round to avoid IEEE 754 floating-point drift (FCFA is integer currency)
      calculatedTotal += product.price * item.quantity;
    }

    // Round once at the end to avoid cumulative drift
    calculatedTotal = Math.round(calculatedTotal * 100) / 100;
    const result = db!.prepare('INSERT INTO sales (user_id, total_amount) VALUES (?, ?)').run(userId, calculatedTotal);
    const saleId = result.lastInsertRowid;

    const insertItem = db!.prepare('INSERT INTO sale_items (sale_id, product_id, quantity, price_at_sale) VALUES (?, ?, ?, ?)');
    const updateStock = db!.prepare('UPDATE products SET stock_quantity = stock_quantity - ? WHERE id = ?');

    for (const item of items) {
      const product = productInfoMap.get(item.productId);
      insertItem.run(saleId, item.productId, item.quantity, product.price);
      updateStock.run(item.quantity, item.productId);
    }
    return saleId;
  });

  return transaction();
});

ipcMain.handle('get-sales-history', (_, { startDate, endDate, limit = 50, offset = 0 } = {}) => {
  if (!db) throw new Error('Database not initialized');

  let query = `
      SELECT s.id, s.sale_date, s.total_amount, u.username as cashier_name 
      FROM sales s 
      LEFT JOIN users u ON s.user_id = u.id 
  `;

  const params = [];
  const conditions = [];

  if (startDate) {
    conditions.push('s.sale_date >= ?');
    params.push(startDate + ' 00:00:00');
  }

  if (endDate) {
    conditions.push('s.sale_date <= ?');
    params.push(endDate + ' 23:59:59');
  }

  if (conditions.length > 0) {
    query += ' WHERE ' + conditions.join(' AND ');
  }

  query += ' ORDER BY s.sale_date DESC LIMIT ? OFFSET ?';
  params.push(limit, offset);

  const sales = db.prepare(query).all(...params) as any[];

  if (sales.length > 0) {
    const saleIds = sales.map(s => s.id);
    const placeholders = saleIds.map(() => '?').join(',');

    const allItems = db.prepare(`
      SELECT si.sale_id, si.product_id, p.name, p.dosage, si.quantity, si.price_at_sale
      FROM sale_items si
      JOIN products p ON si.product_id = p.id
      WHERE si.sale_id IN (${placeholders})
    `).all(...saleIds) as any[];

    // Group items by sale_id
    const itemsBySale = new Map<number, any[]>();
    for (const item of allItems) {
      if (!itemsBySale.has(item.sale_id)) {
        itemsBySale.set(item.sale_id, []);
      }
      itemsBySale.get(item.sale_id)?.push({
        product_id: item.product_id,
        name: item.name,
        dosage: item.dosage,
        quantity: item.quantity,
        price_at_sale: item.price_at_sale
      });
    }

    // Assign items to sales
    for (const sale of sales) {
      sale.items = itemsBySale.get(sale.id) || [];
    }
  } else {
    // Ensure structure consistency even if empty
    for (const sale of sales) {
      sale.items = [];
    }
  }

  return sales;
});

// Streaming Export Handler

ipcMain.handle('export-sales-history', async (_, { startDate, endDate } = {}) => {
  if (!db) throw new Error('Database not initialized');

  // 1. Open Save Dialog
  const { canceled, filePath } = await dialog.showSaveDialog(mainWindow!, {
    title: 'Exporter le Journal des Ventes',
    defaultPath: `ventes_export_${new Date().toISOString().split('T')[0]}.csv`,
    filters: [{ name: 'CSV File', extensions: ['csv'] }]
  });

  if (canceled || !filePath) return { success: false, reason: 'canceled' };

  try {
    const writeStream = fs.createWriteStream(filePath, { encoding: 'utf8' });

    // Write BOM for Excel
    writeStream.write('\uFEFF');
    // Write Header
    writeStream.write('Date,Heure,Vendeur,Produit,Dosage,Code-barre,Quantité,Prix Unitaire,Total Ligne,Total Vente\n');

    // Prepare Query
    let sql = `
      SELECT s.id, s.sale_date, s.total_amount, u.username as cashier_name 
      FROM sales s 
      LEFT JOIN users u ON s.user_id = u.id 
    `;

    const params = [];
    const conditions = [];

    if (startDate) {
      conditions.push('s.sale_date >= ?');
      params.push(startDate + ' 00:00:00');
    }
    if (endDate) {
      conditions.push('s.sale_date <= ?');
      params.push(endDate + ' 23:59:59');
    }

    if (conditions.length > 0) {
      sql += ' WHERE ' + conditions.join(' AND ');
    }
    sql += ' ORDER BY s.sale_date DESC';

    // Prepare Item Query (Pre-prepared statement for reuse)
    const itemStmt = db.prepare(`
      SELECT p.name, p.dosage, p.barcode, si.quantity, si.price_at_sale
      FROM sale_items si
      JOIN products p ON si.product_id = p.id
      WHERE si.sale_id = ?
    `);

    // Iterate using better-sqlite3 iterator for memory efficiency
    const salesIter = db.prepare(sql).iterate(...params);

    for (const sale of salesIter) {
      const saleDateParts = (sale as any).sale_date.split(' ');
      const datePart = saleDateParts[0];
      const timePart = saleDateParts[1] ? saleDateParts[1].substring(0, 5) : '00:00';
      const cashier = (sale as any).cashier_name || 'Inconnu';
      const saleTotal = (sale as any).total_amount;

      const items = itemStmt.all((sale as any).id) as any[];

      for (const item of items) {
        // Escape quotes in name
        const cleanName = item.name.replace(/"/g, '""');
        const line = [
          datePart,
          timePart,
          cashier,
          `"${cleanName}"`,
          item.dosage || '',
          item.barcode || '',
          item.quantity,
          item.price_at_sale,
          item.quantity * item.price_at_sale,
          saleTotal
        ].join(',') + '\n';

        // Write directly to disk — handle backpressure for very large exports (millions of rows)
        if (!writeStream.write(line)) {
          await new Promise<void>(resolve => writeStream.once('drain', () => resolve()));
        }
      }
    }

    writeStream.end();

    // Wait for finish
    await new Promise((resolve, reject) => {
      writeStream.on('finish', () => resolve(true));
      writeStream.on('error', reject);
    });

    return { success: true, filePath };

  } catch (err: any) {
    console.error('Export error:', err);
    return { success: false, error: err.message };
  }
});

ipcMain.handle('get-sales-total', (_, { startDate, endDate }) => {
  if (!db) throw new Error('Database not initialized');

  let query = 'SELECT SUM(total_amount) as total FROM sales';
  const params = [];
  const conditions = [];

  if (startDate) {
    conditions.push('sale_date >= ?');
    params.push(startDate + ' 00:00:00');
  }

  if (endDate) {
    conditions.push('sale_date <= ?');
    params.push(endDate + ' 23:59:59');
  }

  if (conditions.length > 0) {
    query += ' WHERE ' + conditions.join(' AND ');
  }

  const result = db.prepare(query).get(...params) as any;
  return result.total || 0;
});

// --- Update Sale (Admin only — role check done on frontend, but we process safely) ---
ipcMain.handle('update-sale', (_, { saleId, items }: { saleId: number; items: { product_id: number; quantity: number }[] }) => {
  if (!db) throw new Error('Database not initialized');

  if (!saleId || typeof saleId !== 'number') {
    throw new Error('ID de vente invalide.');
  }

  // Verify sale exists and check if it is within 24h (86400 seconds)
  const sale = db.prepare(`
    SELECT id, (strftime('%s', 'now') - strftime('%s', sale_date)) as age_seconds 
    FROM sales 
    WHERE id = ?
  `).get(saleId) as any;

  if (!sale) {
    throw new Error('Vente introuvable.');
  }

  if (sale.age_seconds > 86400) {
    throw new Error('Cette vente a été effectuée il y a plus de 24 heures et ne peut plus être modifiée.');
  }

  const transaction = db.transaction(() => {
    // Get current sale items from DB
    const currentItems = db!.prepare(
      'SELECT si.id, si.product_id, si.quantity, si.price_at_sale FROM sale_items si WHERE si.sale_id = ?'
    ).all(saleId) as { id: number; product_id: number; quantity: number; price_at_sale: number }[];

    // Build a map of current items by product_id
    const currentMap = new Map<number, { id: number; quantity: number; price_at_sale: number }>();
    for (const item of currentItems) {
      currentMap.set(item.product_id, { id: item.id, quantity: item.quantity, price_at_sale: item.price_at_sale });
    }

    // Build a map of new items by product_id
    const newMap = new Map<number, number>();
    for (const item of items) {
      if (item.quantity > 0) {
        newMap.set(item.product_id, item.quantity);
      }
    }

    // 1. Process removals: items in current but not in new (or quantity 0)
    for (const [productId, current] of currentMap) {
      if (!newMap.has(productId)) {
        // Item removed — restore stock
        db!.prepare('UPDATE products SET stock_quantity = stock_quantity + ? WHERE id = ?')
          .run(current.quantity, productId);
        db!.prepare('DELETE FROM sale_items WHERE id = ?').run(current.id);
      }
    }

    // 2. Process updates: items in both current and new
    for (const [productId, newQty] of newMap) {
      const current = currentMap.get(productId);
      if (!current) {
        // This shouldn't happen in normal flow (adding new items to existing sale is not supported)
        continue;
      }

      const diff = newQty - current.quantity;
      if (diff === 0) continue; // No change

      if (diff > 0) {
        // Quantity increased — need more stock
        const product = db!.prepare('SELECT stock_quantity, name FROM products WHERE id = ?').get(productId) as any;
        if (!product) {
          throw new Error(`Produit ID ${productId} introuvable.`);
        }
        if (product.stock_quantity < diff) {
          throw new Error(`Stock insuffisant pour "${product.name}": disponible ${product.stock_quantity}, besoin de ${diff} de plus.`);
        }
        db!.prepare('UPDATE products SET stock_quantity = stock_quantity - ? WHERE id = ?').run(diff, productId);
      } else {
        // Quantity decreased — restore stock
        db!.prepare('UPDATE products SET stock_quantity = stock_quantity + ? WHERE id = ?').run(Math.abs(diff), productId);
      }

      db!.prepare('UPDATE sale_items SET quantity = ? WHERE id = ?').run(newQty, current.id);
    }

    // 3. Recalculate sale total
    const remainingItems = db!.prepare(
      'SELECT quantity, price_at_sale FROM sale_items WHERE sale_id = ?'
    ).all(saleId) as { quantity: number; price_at_sale: number }[];

    if (remainingItems.length === 0) {
      // All items removed — delete the sale entirely
      db!.prepare('DELETE FROM sales WHERE id = ?').run(saleId);
      return { success: true, message: 'Vente supprimée (tous les articles ont été retirés).' };
    }

    // Round to avoid floating-point drift on recalculated totals
    const newTotal = Math.round(remainingItems.reduce((sum, item) => sum + (item.quantity * item.price_at_sale), 0) * 100) / 100;
    db!.prepare('UPDATE sales SET total_amount = ? WHERE id = ?').run(newTotal, saleId);

    return { success: true, message: 'Vente modifiée avec succès.' };
  });

  return transaction();
});

// --- Delete Sale (Admin only) ---
ipcMain.handle('delete-sale', (_, saleId: number) => {
  if (!db) throw new Error('Database not initialized');

  if (!saleId || typeof saleId !== 'number') {
    throw new Error('ID de vente invalide.');
  }

  // Verify sale exists and check if it is within 24h (86400 seconds)
  const sale = db.prepare(`
    SELECT id, (strftime('%s', 'now') - strftime('%s', sale_date)) as age_seconds 
    FROM sales 
    WHERE id = ?
  `).get(saleId) as any;

  if (!sale) {
    throw new Error('Vente introuvable.');
  }

  if (sale.age_seconds > 86400) {
    throw new Error('Cette vente a été effectuée il y a plus de 24 heures et ne peut plus être supprimée.');
  }

  const transaction = db.transaction(() => {
    // Get all items for this sale
    const saleItems = db!.prepare(
      'SELECT product_id, quantity FROM sale_items WHERE sale_id = ?'
    ).all(saleId) as { product_id: number; quantity: number }[];

    // Restore stock for each item
    for (const item of saleItems) {
      db!.prepare('UPDATE products SET stock_quantity = stock_quantity + ? WHERE id = ?')
        .run(item.quantity, item.product_id);
    }

    // Delete sale items
    db!.prepare('DELETE FROM sale_items WHERE sale_id = ?').run(saleId);

    // Delete the sale
    db!.prepare('DELETE FROM sales WHERE id = ?').run(saleId);

    return { success: true, message: 'Vente supprimée et stock restauré.' };
  });

  return transaction();
});

// --- Backup & Restore IPC ---

ipcMain.handle('backup-db', async () => {
  if (!db) throw new Error('Database not initialized');

  const { canceled, filePath } = await dialog.showSaveDialog(mainWindow ?? BrowserWindow.getAllWindows()[0], {
    title: 'Sauvegarder la Base de Données',
    defaultPath: `backup_pharmacie_${new Date().toISOString().split('T')[0]}.db`,
    filters: [{ name: 'SQLite Database', extensions: ['db'] }]
  });

  if (canceled || !filePath) return { success: false, reason: 'canceled' };

  try {
    // Current DB Path
    const dbPath = process.env.VITE_DEV_SERVER_URL
      ? path.join(app.getPath('userData'), 'pharmacy-dev.db')
      : path.join(app.getPath('userData'), 'pharmacy.db');

    // Flush WAL to ensure main DB file is up to date (checkpoint)
    db.pragma('wal_checkpoint(RESTART)');

    // Use built-in backup API of better-sqlite3 or just copy file?
    // Copying file is risky if active. better-sqlite3 has .backup() method!
    await db.backup(filePath);

    return { success: true, filePath };
  } catch (err: any) {
    console.error('Backup failed:', err);
    return { success: false, error: err.message };
  }
});

ipcMain.handle('restore-db', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow ?? BrowserWindow.getAllWindows()[0], {
    title: 'Restaurer une Sauvegarde',
    properties: ['openFile'],
    filters: [{ name: 'SQLite Database', extensions: ['db'] }]
  });

  if (canceled || !filePaths[0]) return { success: false, reason: 'canceled' };
  const backupPath = filePaths[0];

  try {
    // 1. Close current DB
    if (db) {
      db.close();
      db = null;
    }

    // 2. Define Target Path
    const dbPath = process.env.VITE_DEV_SERVER_URL
      ? path.join(app.getPath('userData'), 'pharmacy-dev.db')
      : path.join(app.getPath('userData'), 'pharmacy.db');

    // 3. Overwrite current DB with backup
    fs.copyFileSync(backupPath, dbPath);

    // 4. Re-initialize DB with all required pragmas
    db = new Database(dbPath);
    db.pragma('journal_mode = WAL');
    db.pragma('busy_timeout = 3000');
    db.pragma('foreign_keys = ON');

    // 5. Reload Window to refresh UI with new data
    mainWindow?.reload();

    return { success: true };
  } catch (err: any) {
    console.error('Restore failed:', err);
    // Attempt to re-open DB if failed
    try {
      const dbPath = process.env.VITE_DEV_SERVER_URL
        ? path.join(app.getPath('userData'), 'pharmacy-dev.db')
        : path.join(app.getPath('userData'), 'pharmacy.db');
      db = new Database(dbPath);
      db.pragma('journal_mode = WAL');
    } catch (e) { console.error("Critical: Could not reopen DB", e) }

    return { success: false, error: err.message };
  }
});

// --- Backup Status IPC ---
// Returns the list of automatic daily backups for display in the admin panel
ipcMain.handle('get-backup-status', () => {
  try {
    const backupDir = path.join(app.getPath('userData'), 'backups');
    if (!fs.existsSync(backupDir)) {
      return { backups: [], backupDir };
    }

    const backupFiles = fs.readdirSync(backupDir)
      .filter(f => f.startsWith('auto_backup_') && f.endsWith('.db'))
      .sort()
      .reverse() // newest first
      .slice(0, 7)
      .map(f => {
        const fullPath = path.join(backupDir, f);
        const stat = fs.statSync(fullPath);
        // Extract date from filename: auto_backup_2026-08-08.db
        const dateStr = f.replace('auto_backup_', '').replace('.db', '');
        return {
          filename: f,
          date: dateStr,
          sizeKb: Math.round(stat.size / 1024),
          createdAt: stat.birthtime.toISOString()
        };
      });

    return { backups: backupFiles, backupDir };
  } catch (err: any) {
    return { backups: [], backupDir: '', error: err.message };
  }
});


// --- Import Products IPC ---

ipcMain.handle('import-products', async () => {
  if (!db) throw new Error('Database not initialized');

  const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow!, {
    title: 'Importer des Médicaments (CSV)',
    properties: ['openFile'],
    filters: [{ name: 'Fichier CSV', extensions: ['csv'] }]
  });

  if (canceled || !filePaths[0]) return { success: false, reason: 'canceled' };
  const filePath = filePaths[0];

  try {
    const fileContent = fs.readFileSync(filePath, 'utf8');
    // Handle different line endings
    const lines = fileContent.split(/\r?\n/).filter(line => line.trim() !== '');

    if (lines.length === 0) throw new Error('Le fichier est vide.');

    let successCount = 0;
    let errorCount = 0;
    let errors: string[] = [];
    let skippedHeaders = 0;

    const transaction = db.transaction(() => {
      // 1. Detect Header and Delimiter
      const firstLine = lines[0];
      const delimiter = firstLine.includes(';') ? ';' : ',';

      // Helper to split CSV line respecting quotes
      const parseLine = (text: string, delim: string): string[] => {
        const result: string[] = [];
        let current = '';
        let inQuotes = false;

        for (let i = 0; i < text.length; i++) {
          const char = text[i];
          if (char === '"') {
            if (i + 1 < text.length && text[i + 1] === '"') {
              current += '"';
              i++; // skip escaped quote
            } else {
              inQuotes = !inQuotes;
            }
          } else if (char === delim && !inQuotes) {
            result.push(current.trim());
            current = '';
          } else {
            current += char;
          }
        }
        result.push(current.trim());
        return result;
      };

      const headers = parseLine(firstLine, delimiter).map(h => h.toLowerCase().replace(/[\(\)]/g, '').trim());

      // 2. Map Column Indices
      /*
         User Request: "Désignation, Stock, Prix (unitaire), Code-barre, Date de péremption" 
         Plus potential "Status" and "Modification" to be ignored.
      */
      const mapIdx: any = {
        name: -1,
        dosage: -1,
        barcode: -1,
        price: -1,
        stock: -1,
        expiry: -1
      };

      headers.forEach((h, idx) => {
        if (h.includes('désignation') || h.includes('nom') || h.includes('produit')) mapIdx.name = idx;
        else if (h.includes('dosage')) mapIdx.dosage = idx;
        else if (h.includes('code') || h.includes('barre') || h.includes('barcode')) mapIdx.barcode = idx;
        else if (h.includes('prix') || h.includes('unitaire') || h.includes('p.u')) mapIdx.price = idx;
        else if (h.includes('stock') || h.includes('qté') || h.includes('quantité')) mapIdx.stock = idx;
        else if (h.includes('date') || h.includes('péremption') || h.includes('expir')) mapIdx.expiry = idx;
      });

      // Default fallback if headers missing or not matched
      if (mapIdx.name === -1) {
        // Fallback to specific user order: 
        // 0: Désignation, 1: Stock, 2: Prix, 3: Code-barre, 4: Expiry
        mapIdx.name = 0;
        mapIdx.stock = 1;
        mapIdx.price = 2;
        mapIdx.barcode = 3;
        mapIdx.expiry = 4;

        // If first line actually looks like a header (contains "Désignation" etc), skip it
        if (firstLine.toLowerCase().includes('désignation') || firstLine.toLowerCase().includes('nom')) {
          skippedHeaders = 1;
        } else {
          skippedHeaders = 0;
        }
      } else {
        skippedHeaders = 1;
      }

      const insertStmt = db!.prepare(`
                INSERT INTO products (name, barcode, stock_quantity, expiry_date, min_stock_threshold, price)
                VALUES (@name, @barcode, @stock_quantity, @expiry_date, 10, @price)
            `);

      // When a product already exists by barcode: update price/expiry only (no stock change during import)
      const updateByBarcodeStmt = db!.prepare(`
                UPDATE products 
                SET name = @name, price = @price, expiry_date = @expiry_date
                WHERE barcode = @barcode
            `);

      // When a product already exists by name: update price/expiry only (no stock change, no duplicate)
      const updateByNameStmt = db!.prepare(`
                UPDATE products 
                SET price = @price, expiry_date = @expiry_date
                WHERE LOWER(name) = LOWER(@name)
            `);

      // When product found by name but barcode is new: update barcode, price, expiry only
      const updateNameAndBarcodeStmt = db!.prepare(`
                UPDATE products 
                SET price = @price, expiry_date = @expiry_date, barcode = @barcode
                WHERE id = @id
            `);

      const checkBarcodeStmt = db!.prepare('SELECT id FROM products WHERE barcode = ?');
      const checkNameStmt = db!.prepare('SELECT id FROM products WHERE LOWER(name) = LOWER(?)');

      for (let i = skippedHeaders; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        const cols = parseLine(line, delimiter);

        // Map content
        let name = mapIdx.name > -1 ? cols[mapIdx.name] : '';
        const stockStr = mapIdx.stock > -1 ? cols[mapIdx.stock] : '0';
        const priceStr = mapIdx.price > -1 ? cols[mapIdx.price] : '0';
        const barcode = mapIdx.barcode > -1 ? cols[mapIdx.barcode] : '';
        let expiry = mapIdx.expiry > -1 ? cols[mapIdx.expiry] : '';

        // Handle Dosage if separate (merge into name)
        if (mapIdx.dosage > -1 && cols[mapIdx.dosage]) {
          name = `${name} ${cols[mapIdx.dosage]}`;
        }

        if (!name) {
          if (cols.length < 3) continue;
          errorCount++;
          errors.push(`Ligne ${i + 1}: Nom manquant`);
          continue;
        }

        // Clean data
        const stock = parseInt(stockStr.replace(/\s/g, '')) || 0;
        const price = parseFloat(priceStr.replace(/\s/g, '').replace(',', '.')) || 0;

        // Expiry parsing fallback
        if (!expiry || expiry.length < 8) {
          const d = new Date();
          d.setFullYear(d.getFullYear() + 1);
          expiry = d.toISOString().split('T')[0];
        }

        const productData = {
          name: name.trim(),
          barcode: barcode ? barcode.trim() : '',
          stock_quantity: stock,
          price,
          expiry_date: expiry
        };

        try {
          if (productData.barcode) {
            const existingByBarcode = checkBarcodeStmt.get(productData.barcode) as any;
            if (existingByBarcode) {
              // Product found by barcode: update info only, no stock change
              updateByBarcodeStmt.run(productData);
            } else {
              const existingByName = checkNameStmt.get(productData.name) as any;
              if (existingByName) {
                // Product found by name: update barcode + info, no stock change
                updateNameAndBarcodeStmt.run({ ...productData, id: existingByName.id });
              } else {
                // New product: insert with its stock
                insertStmt.run(productData);
              }
            }
          } else {
            const existingByName = checkNameStmt.get(productData.name) as any;
            if (existingByName) {
              // Product found by name: update price/expiry only, do NOT touch stock
              updateByNameStmt.run(productData);
            } else {
              // New product: insert with its stock
              insertStmt.run(productData);
            }
          }
          successCount++;
        } catch (err: any) {
          errorCount++;
          errors.push(`Ligne ${i + 1} (${name}): ${err.message}`);
        }
      }
    });

    transaction();

    return { success: true, added: successCount, errors: errorCount > 0 ? errors : undefined };

  } catch (err: any) {
    console.error('Import failed:', err);
    return { success: false, error: err.message };
  }
});


ipcMain.handle('download-template', async () => {
  const { canceled, filePath } = await dialog.showSaveDialog(mainWindow!, {
    title: 'Télécharger le Modèle d\'Import',
    defaultPath: 'modele_medicaments.csv',
    filters: [{ name: 'CSV File', extensions: ['csv'] }]
  });

  if (canceled || !filePath) return { success: false, reason: 'canceled' };

  try {
    const content = 'Nom du Produit,Code-barre,Quantité Stock,Prix Unitaire,Montant Total,Date Péremption (AAAA-MM-JJ)\nParacétamol 500mg,123456789,100,500,50000,2026-12-31\nAmoxicilline 1g,,50,1500,75000,2025-06-30';
    // Write BOM for Excel
    fs.writeFileSync(filePath, '\uFEFF' + content, 'utf8');
    return { success: true, filePath };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('export-products', async () => {
  if (!db) throw new Error('Database not initialized');

  const { canceled, filePath } = await dialog.showSaveDialog(mainWindow!, {
    title: 'Exporter les Médicaments',
    // Filename per user request or standard? Included .csv
    defaultPath: `stock_pharmacie_${new Date().toISOString().split('T')[0]}.csv`,
    filters: [{ name: 'CSV File', extensions: ['csv'] }]
  });

  if (canceled || !filePath) return { success: false, reason: 'canceled' };

  try {
    const products = db.prepare('SELECT name, barcode, stock_quantity, price, expiry_date, min_stock_threshold FROM products ORDER BY name ASC').all() as any[];
    const writeStream = fs.createWriteStream(filePath, { encoding: 'utf8' });

    // Write BOM for Excel
    writeStream.write('\uFEFF');
    // Write Header matching user request EXACTLY
    // "Désignation, Stock, Prix (unitaire), Code-barre, Date de péremption, Status, Modification"
    // Using semicolon for Excel compatibility in some regions, or comma?
    // User sample had semicolon in one snippet but comma in another.
    // User request: "Désignation, Stock, Prix (unitaire),Code-barre Date de péremption, Status et Modification."
    // And "fait le comme le fichier .csv à importer et à exporter"
    // The previous import file showed semicolons in line 1 of view_file (step 5).
    // "1: Désignation;Stock;Prix (unitaire);Code-barre;Date de péremption"
    // So I will use semicolon ';' as delimiter.
    const delimiter = ';';
    const headers = ['Désignation', 'Stock', 'Prix (unitaire)', 'Code-barre', 'Date de péremption', 'Status', 'Modification'];
    writeStream.write(headers.join(delimiter) + '\n');

    for (const p of products) {
      // Logic for Status
      const isExpired = p.expiry_date && new Date(p.expiry_date) <= new Date();
      const isLowStock = p.stock_quantity <= p.min_stock_threshold;
      let status = 'OK';
      if (isExpired) status = 'Périmé';
      else if (isLowStock) status = 'Stock Bas';

      // Escape quotes for CSV
      const escape = (val: any) => {
        if (typeof val !== 'string') return val;
        if (val.includes(delimiter) || val.includes('"') || val.includes('\n')) {
          return `"${val.replace(/"/g, '""')}"`;
        }
        return val;
      };

      const line = [
        escape(p.name),
        p.stock_quantity,
        p.price,
        escape(p.barcode || ''),
        p.expiry_date || '',
        status,
        '' // Modification (empty)
      ].join(delimiter) + '\n';

      writeStream.write(line);
    }

    writeStream.end();

    await new Promise<void>((resolve, reject) => {
      writeStream.on('finish', () => resolve());
      writeStream.on('error', reject);
    });

    return { success: true, filePath };
  } catch (err: any) {
    console.error('Export products failed:', err);
    return { success: false, error: err.message };
  }
});

// --- User Management IPC ---

ipcMain.handle('get-users', () => {
  if (!db) throw new Error('Database not initialized');
  return db.prepare('SELECT id, username, role, created_at FROM users ORDER BY username ASC').all();
});

ipcMain.handle('add-user', (_, { username, password, role }) => {
  if (!db) throw new Error('Database not initialized');
  if (!username || !username.trim()) throw new Error('Le nom d\'utilisateur est obligatoire.');
  if (!password || !password.trim()) throw new Error('Le mot de passe est obligatoire.');
  if (!['admin', 'employee'].includes(role)) throw new Error('Rôle invalide.');

  // Check if user exists
  const exists = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
  if (exists) throw new Error('Ce nom d\'utilisateur existe déjà.');

  const stmt = db.prepare('INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)');
  const info = stmt.run(username, hashPassword(password), role);
  return { id: info.lastInsertRowid };
});

ipcMain.handle('update-user', (_, { id, username, password, role }) => {
  if (!db) throw new Error('Database not initialized');

  // Validate uniqueness if username changed
  const current = db.prepare('SELECT username FROM users WHERE id = ?').get(id) as any;
  if (!current) throw new Error('Utilisateur introuvable.');
  if (current.username !== username) {
    const exists = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
    if (exists) throw new Error('Ce nom d\'utilisateur existe déjà.');
  }

  let query = 'UPDATE users SET username = ?, role = ?';
  const params: any[] = [username, role];

  if (password && password.trim() !== '') {
    query += ', password_hash = ?';
    params.push(hashPassword(password));
  }

  query += ' WHERE id = ?';
  params.push(id);

  const stmt = db.prepare(query);
  const info = stmt.run(...params);
  return { changes: info.changes };
});

ipcMain.handle('delete-user', (_, id) => {
  if (!db) throw new Error('Database not initialized');

  // Prevent deleting the last admin
  const userToDelete = db.prepare('SELECT role FROM users WHERE id = ?').get(id) as any;
  if (userToDelete?.role === 'admin') {
    const adminCount = (db.prepare('SELECT COUNT(*) as count FROM users WHERE role = ?').get('admin') as any).count;
    if (adminCount <= 1) {
      throw new Error('Impossible de supprimer le dernier administrateur. Veuillez d\'abord créer un autre administrateur.');
    }
  }

  const stmt = db.prepare('DELETE FROM users WHERE id = ?');
  const info = stmt.run(id);
  return { changes: info.changes };
});
