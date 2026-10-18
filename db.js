const path = require('path');
const Database = require('better-sqlite3');

// DB_PATH gör att databasen kan ligga på en volym (t.ex. /data/recept.db i Docker)
const dbPath = process.env.DB_PATH || path.join(__dirname, 'recept.db');
const db = new Database(dbPath);

db.exec(`
    CREATE TABLE IF NOT EXISTS recipes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        image TEXT,
        source TEXT,
        url TEXT,
        in_cookbook INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS ingredients (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        recipe_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        amount REAL,
        unit TEXT,
        FOREIGN KEY (recipe_id) REFERENCES recipes(id)
    );

    CREATE TABLE IF NOT EXISTS shopping_list (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        amount REAL,
        unit TEXT,
        category TEXT,
        checked INTEGER DEFAULT 0
    );
`);

// Nya kolumner läggs till i efterhand så att en befintlig recept.db inte behöver raderas
const newRecipeColumns = {
    description: 'TEXT',
    instructions: 'TEXT',   // JSON-array med steg
    servings: 'TEXT',
    total_time: 'INTEGER',  // minuter
    created_at: 'TEXT',
    in_week: 'INTEGER DEFAULT 1', // med i veckans recept (oberoende av kokboken)
    url_key: 'TEXT',              // normaliserad URL, för dubblettkontroll
    last_in_week: 'TEXT'          // senast receptet lades till i / togs bort från veckomenyn
};

const existingColumns = db.prepare('PRAGMA table_info(recipes)').all().map(col => col.name);
for (const [column, type] of Object.entries(newRecipeColumns)) {
    if (!existingColumns.includes(column)) {
        db.exec(`ALTER TABLE recipes ADD COLUMN ${column} ${type}`);
    }
}

// Samma recept kan länkas på flera sätt: med/utan www, avslutande snedstreck, #hash eller ?utm_source=...
function normalizeUrl(url) {
    try {
        const parsed = new URL(url);
        for (const param of [...parsed.searchParams.keys()]) {
            if (/^(utm_|fbclid|gclid|ref$)/i.test(param)) parsed.searchParams.delete(param);
        }
        const host = parsed.hostname.toLowerCase().replace(/^www\./, '');
        const pathname = parsed.pathname.replace(/\/+$/, '');
        return `${host}${pathname}${parsed.search}`;
    } catch {
        return null;
    }
}

// Fyll i url_key för recept som sparades innan kolumnen fanns
const missingKeys = db.prepare("SELECT id, url FROM recipes WHERE url_key IS NULL AND url != ''").all();
const setKey = db.prepare('UPDATE recipes SET url_key = ? WHERE id = ?');
for (const row of missingKeys) setKey.run(normalizeUrl(row.url), row.id);

try {
    db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_recipes_url_key ON recipes(url_key) WHERE url_key IS NOT NULL');
} catch {
    // finns det redan dubbletter i databasen går indexet inte att skapa – servern kollar ändå i koden
    console.warn('Databasen innehåller dubbletter av recept, unikt index skapades inte');
}

// Butiker och deras gångordning (kategorierna i den ordning man går genom butiken)
db.exec(`
    CREATE TABLE IF NOT EXISTS stores (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        categories TEXT NOT NULL  -- JSON-array med kategorinamn
    );

    CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT
    );
`);

// Första gången: skapa butikerna från storeLayouts.js, så att den inlästa planlösningen följer med
if (db.prepare('SELECT COUNT(*) AS count FROM stores').get().count === 0) {
    const storeLayouts = require('./storeLayouts');
    const insertStore = db.prepare('INSERT INTO stores (name, categories) VALUES (?, ?)');
    for (const [key, categories] of Object.entries(storeLayouts)) {
        // 'ica-maxi-valsviken' -> 'ICA Maxi Valsviken'
        const name = key.split('-')
            .map(word => word === 'ica' ? 'ICA' : word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
        insertStore.run(name, JSON.stringify(categories));
    }
}

module.exports = db;
module.exports.normalizeUrl = normalizeUrl;
