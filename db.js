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

    // 1. ТАБЛИЦА ПОЛЬЗОВАТЕЛЕЙ (создаём первой, так как на неё все ссылаются)
    await db.exec(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT NOT NULL UNIQUE,
            password_hash TEXT NOT NULL,
            role TEXT NOT NULL DEFAULT 'user',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);
    
    // Создание root (seeding)
    const existingRoot = await db.get('SELECT id FROM users WHERE role = ?', ['root']);
    
    if (!existingRoot) {
        const rootUsername = process.env.ROOT_USERNAME || 'root';
        const rootPassword = process.env.ROOT_PASSWORD || 'changeme';
        
        const passwordHash = await bcrypt.hash(rootPassword, 10);
        
        await db.run(
            'INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)',
            [rootUsername, passwordHash, 'root']
        );
        
        console.log('✅ Root пользователь создан.');
    }

    // 2. ТАБЛИЦА ТЕМ (ссылается на users)
    await db.exec(`
        CREATE TABLE IF NOT EXISTS threads (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE,
            description TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            creator_id INTEGER,
            creator_name TEXT NOT NULL,
            FOREIGN KEY (creator_id) REFERENCES users(id) ON DELETE SET NULL
        )
    `);
    
    // Создаём системную тему. creator_id = NULL, поэтому FK не нарушается.
    await db.exec(`
        INSERT OR IGNORE INTO threads (id, name, description, creator_id, creator_name)
        VALUES (1, 'Гостевая', 'Общие разговоры, тесты и флуд.', null, 'system')
    `);

    // 3. ТАБЛИЦА ПОСТОВ (ссылается на users и threads)
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