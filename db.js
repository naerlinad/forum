const { open } = require('sqlite');
const sqlite3 = require('sqlite3');
const bcrypt = require('bcrypt');

// Создаём подключение к базе данных.
const dbPromise = open({
    filename: './database.sqlite', 
    driver: sqlite3.Database
});

async function initDatabase() {
    const db = await dbPromise;
    
    // Включаем поддержку внешних ключей
    await db.run('PRAGMA foreign_keys = ON;');

    // Таблица пользователей (создаётся первой, так как на неё все ссылаются)
    await db.exec(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT NOT NULL UNIQUE,
            password_hash TEXT NOT NULL,
            role TEXT NOT NULL DEFAULT 'user',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            about TEXT DEFAULT '',
            status TEXT DEFAULT 'ok'
        )
    `);
    
    // Создание root (seeding)
    const existingRoot = await db.get('SELECT id FROM users WHERE role = ?', ['root']);
    
    if (!existingRoot) {
        const rootUsername = process.env.ROOT_USERNAME || 'root';
        const rootPassword = process.env.ROOT_PASSWORD || 'changeme';
        
        const passwordHash = await bcrypt.hash(rootPassword, 10);
        
        await db.run(
            'INSERT INTO users (id, username, password_hash, role) VALUES (?, ?, ?, ?)',
            [1, rootUsername, passwordHash, 'root']
        );
        
        console.log('✅ Root пользователь создан.');
    }

    // Таблица тем (ссылается на users)
    await db.exec(`
        CREATE TABLE IF NOT EXISTS threads (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE,
            description TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            creator_id INTEGER,
            status TEXT DEFAULT 'ok',
            FOREIGN KEY (creator_id) REFERENCES users(id) ON DELETE SET NULL
        )
    `);
    
    // Создание начальной темы
    await db.exec(`
        INSERT OR IGNORE INTO threads (id, name, description, creator_id)
        VALUES (1, 'Гостевая', 'Общие разговоры, тесты и флуд.', 1)
    `);

    // Таблица постов (ссылается на users и threads)
    await db.exec(`
        CREATE TABLE IF NOT EXISTS posts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            author_id INTEGER,
            text TEXT NOT NULL,
            thread_id INTEGER DEFAULT 1,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            status TEXT DEFAULT 'ok',
            FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE SET NULL,
            FOREIGN KEY (thread_id) REFERENCES threads(id) ON DELETE CASCADE
        )
    `);
    
    console.log('✅ База данных готова к работе.');
    return db;
}

module.exports = { dbPromise, initDatabase };