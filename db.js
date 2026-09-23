const { open } = require('sqlite');
const sqlite3 = require('sqlite3');

// Создаём подключение к базе данных.
const dbPromise = open({
    filename: './database.sqlite', 
    driver: sqlite3.Database
});

async function initDatabase() {
    const db = await dbPromise;
    
    // Включаем поддержку внешних ключей
    await db.run('PRAGMA foreign_keys = ON;');

    // Таблица тем
    await db.exec(`
        CREATE TABLE IF NOT EXISTS threads (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE,
            description TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            creator_id INTEGER NOT NULL,
            creator_name TEXT NOT NULL
        )
    `);
    
    await db.exec(`
        INSERT OR IGNORE INTO threads (id, name, description, creator_id, creator_name)
        VALUES (1, 'Гостевая', 'Общие разговоры, тесты и флуд.', 1, 'system')
    `);

    // Таблица пользователей
    await db.exec(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT NOT NULL UNIQUE,
            password_hash TEXT NOT NULL,
            role TEXT NOT NULL DEFAULT 'user',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // Таблица постов
    await db.exec(`
        CREATE TABLE IF NOT EXISTS posts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            author_id INTEGER NOT NULL,
            author_name TEXT NOT NULL,
            text TEXT NOT NULL,
            thread_id INTEGER DEFAULT 1,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY (thread_id) REFERENCES threads(id) ON DELETE CASCADE
        )
    `);
    
    console.log('✅ База данных готова к работе.');
    return db;
}

module.exports = { dbPromise, initDatabase };