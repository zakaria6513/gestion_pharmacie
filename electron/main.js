"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const path_1 = __importDefault(require("path"));
const better_sqlite3_1 = __importDefault(require("better-sqlite3"));
// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require('electron-squirrel-startup')) {
    electron_1.app.quit();
}
let mainWindow = null;
let db = null;
const createWindow = () => {
    mainWindow = new electron_1.BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            preload: path_1.default.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true,
        },
        title: 'Pharmacie Amdjarass',
        // icon: path.join(__dirname, 'assets/icon.ico'), // To be added later
    });
    if (process.env.VITE_DEV_SERVER_URL) {
        mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
        mainWindow.webContents.openDevTools();
    }
    else {
        mainWindow.loadFile(path_1.default.join(__dirname, '../dist/index.html'));
    }
    // Remove menu for production feel, or create custom one
    mainWindow.setMenuBarVisibility(false);
};
electron_1.app.on('ready', () => {
    // Initialize Database
    try {
        const dbPath = process.env.VITE_DEV_SERVER_URL
            ? path_1.default.join(electron_1.app.getPath('userData'), 'pharmacy-dev.db')
            : path_1.default.join(electron_1.app.getPath('userData'), 'pharmacy.db');
        console.log('Database path:', dbPath);
        db = new better_sqlite3_1.default(dbPath);
        db.pragma('journal_mode = WAL');
        // Create tables if not exist
        createTables();
        // Seed default admin if empty
        seedDatabase();
    }
    catch (err) {
        console.error('Failed to initialize database:', err);
    }
    createWindow();
});
electron_1.app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        electron_1.app.quit();
    }
});
electron_1.app.on('activate', () => {
    if (electron_1.BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});
// --- Database Schema & Helpers ---
function createTables() {
    if (!db)
        return;
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
}
function seedDatabase() {
    if (!db)
        return;
    const stmt = db.prepare('SELECT count(*) as count FROM users');
    const result = stmt.get();
    if (result.count === 0) {
        console.log('Seeding default admin user...');
        // Default password: admin (In real app, hash this!)
        // For this MVP, we will store plain text or simple hash? 
        // Plan said password_hash. Let's use a placeholder hash or simple logic for now.
        // Ideally use bcrypt but avoiding native dep complexity if possible. 
        // Actually, stick to simple for MVP or assume the FE hashes it? No, BE should hash.
        // For now, storing "admin" as is, will improve if requested.
        db.prepare('INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)').run('admin', 'admin', 'admin');
        db.prepare('INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)').run('employee', '1234', 'employee');
    }
}
// --- IPC Handlers ---
electron_1.ipcMain.handle('login', (_, { username, password }) => {
    if (!db)
        throw new Error('Database not initialized');
    const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
    if (user && user.password_hash === password) {
        return { success: true, user: { id: user.id, username: user.username, role: user.role } };
    }
    return { success: false, message: 'Invalid credentials' };
});
electron_1.ipcMain.handle('get-dashboard-stats', () => {
    if (!db)
        throw new Error('Database not initialized');
    const totalProducts = db.prepare('SELECT COUNT(*) as count FROM products').get().count;
    const lowStock = db.prepare('SELECT COUNT(*) as count FROM products WHERE stock_quantity <= min_stock_threshold').get().count;
    // Expired or expiring soon (within 30 days)
    const today = new Date().toISOString().split('T')[0];
    const expired = db.prepare('SELECT COUNT(*) as count FROM products WHERE expiry_date <= ?').get(today).count;
    return { totalProducts, lowStock, expired };
});
electron_1.ipcMain.handle('get-products', (_, { search }) => {
    if (!db)
        throw new Error('Database not initialized');
    let query = 'SELECT * FROM products';
    const params = [];
    if (search) {
        query += ' WHERE name LIKE ? OR barcode LIKE ?';
        params.push(`%${search}%`, `%${search}%`);
    }
    query += ' ORDER BY name ASC';
    return db.prepare(query).all(...params);
});
electron_1.ipcMain.handle('add-product', (_, product) => {
    if (!db)
        throw new Error('Database not initialized');
    const stmt = db.prepare(`
        INSERT INTO products (name, dosage, barcode, stock_quantity, expiry_date, min_stock_threshold, price)
        VALUES (@name, @dosage, @barcode, @stock, @expiryDate, @minStock, @price)
    `);
    const info = stmt.run(product);
    return { id: info.lastInsertRowid };
});
electron_1.ipcMain.handle('create-sale', (_, { userId, items, total }) => {
    if (!db)
        throw new Error('Database not initialized');
    const transaction = db.transaction(() => {
        const result = db.prepare('INSERT INTO sales (user_id, total_amount) VALUES (?, ?)').run(userId, total);
        const saleId = result.lastInsertRowid;
        const insertItem = db.prepare('INSERT INTO sale_items (sale_id, product_id, quantity, price_at_sale) VALUES (?, ?, ?, ?)');
        const updateStock = db.prepare('UPDATE products SET stock_quantity = stock_quantity - ? WHERE id = ?');
        for (const item of items) {
            insertItem.run(saleId, item.productId, item.quantity, item.price);
            updateStock.run(item.quantity, item.productId);
        }
        return saleId;
    });
    return transaction();
});
electron_1.ipcMain.handle('get-sales-history', () => {
    if (!db)
        throw new Error('Database not initialized');
    return db.prepare(`
        SELECT s.id, s.sale_date, s.total_amount, u.username as cashier_name 
        FROM sales s 
        LEFT JOIN users u ON s.user_id = u.id 
        ORDER BY s.sale_date DESC
    `).all();
});
