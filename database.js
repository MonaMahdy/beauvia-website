const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// Use /data for Render persistent disk, fallback to local ./data
const DB_DIR = process.env.DB_PATH ? path.dirname(process.env.DB_PATH) : path.join(__dirname, 'data');
const DB_PATH = process.env.DB_PATH || path.join(DB_DIR, 'beauvia.db');

let db;

function getDb() {
    if (!db) {
        if (!fs.existsSync(DB_DIR)) {
            fs.mkdirSync(DB_DIR, { recursive: true });
        }
        db = new Database(DB_PATH);
        db.pragma('journal_mode = WAL');
        db.pragma('foreign_keys = ON');
    }
    return db;
}

function initDatabase() {
    const db = getDb();

    db.exec(`
        CREATE TABLE IF NOT EXISTS products (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            price REAL NOT NULL,
            description TEXT,
            badge TEXT DEFAULT 'DIRECTLY IMPORTED',
            tag TEXT DEFAULT '',
            image TEXT DEFAULT '',
            category TEXT DEFAULT '',
            in_stock INTEGER DEFAULT 1,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS orders (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            customer_name TEXT NOT NULL,
            customer_email TEXT,
            customer_phone TEXT NOT NULL,
            address TEXT NOT NULL,
            city TEXT,
            total REAL NOT NULL,
            status TEXT DEFAULT 'pending',
            paymob_order_id TEXT,
            payment_status TEXT DEFAULT 'unpaid',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS order_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            order_id INTEGER NOT NULL,
            product_id INTEGER NOT NULL,
            product_name TEXT NOT NULL,
            quantity INTEGER NOT NULL,
            price REAL NOT NULL,
            FOREIGN KEY (order_id) REFERENCES orders(id)
        );

        CREATE TABLE IF NOT EXISTS admins (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
    `);

    // Seed products if table is empty
    const count = db.prepare('SELECT COUNT(*) as count FROM products').get();
    if (count.count === 0) {
        seedProducts(db);
    }

    // Create default admin if none exists
    const adminCount = db.prepare('SELECT COUNT(*) as count FROM admins').get();
    if (adminCount.count === 0) {
        const bcrypt = require('bcryptjs');
        const hash = bcrypt.hashSync(process.env.ADMIN_PASSWORD || 'admin123', 10);
        db.prepare('INSERT INTO admins (username, password_hash) VALUES (?, ?)').run('admin', hash);
        console.log('Default admin created (username: admin)');
    }

    console.log('Database initialized at', DB_PATH);
}

function seedProducts(db) {
    const products = [
        { name: 'Hydrating Toner', price: 450, description: 'Multi-layer hydration with 7 types of hyaluronic acid. Plumps and prepares skin for serums.', category: 'hydrate', tag: '\u{1F4A7}', badge: 'DIRECTLY IMPORTED' },
        { name: 'Barrier Cream', price: 620, description: 'Rich ceramide complex strengthens skin barrier. Locks in moisture without heaviness.', category: 'repair', tag: '\u{1F6E1}', badge: 'DIRECTLY IMPORTED' },
        { name: 'Centella Serum', price: 580, description: 'Pure centella extract calms irritation and redness. Perfect for sensitive or stressed skin.', category: 'calm', tag: '\u{1F33F}', badge: 'DIRECTLY IMPORTED' },
        { name: 'Essence Mist', price: 380, description: 'Lightweight hydrating mist for instant refreshment. Layer or use throughout the day.', category: 'hydrate', tag: '\u{1F4A7}', badge: 'DIRECTLY IMPORTED' },
        { name: 'Glass Skin Serum', price: 690, description: 'Luminous glow serum with niacinamide and fermented extracts. Brightens and evens texture.', category: 'glow', tag: '\u{2728}', badge: 'DIRECTLY IMPORTED' },
        { name: 'Night Repair Mask', price: 520, description: 'Overnight treatment repairs while you sleep. Wake up to softer, smoother skin.', category: 'repair', tag: '\u{1F6E1}', badge: 'DIRECTLY IMPORTED' }
    ];

    const stmt = db.prepare('INSERT INTO products (name, price, description, category, tag, badge) VALUES (?, ?, ?, ?, ?, ?)');
    for (const p of products) {
        stmt.run(p.name, p.price, p.description, p.category, p.tag, p.badge);
    }
    console.log('Seeded 6 products');
}

module.exports = { getDb, initDatabase };
