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
    
    // Включаем внешние ключи
    await db.run('PRAGMA foreign_keys = ON;');
    
    // Включаем WAL-режим и оптимизации
    await db.run('PRAGMA journal_mode = WAL;');
    await db.run('PRAGMA synchronous = NORMAL;');
    await db.run('PRAGMA wal_autocheckpoint = 1000;');
    await db.run('PRAGMA busy_timeout = 5000;');
    await db.run('PRAGMA cache_size = -8000;');
    
    // Таблица пользователей
    await db.exec(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT NOT NULL UNIQUE,
            email TEXT NOT NULL UNIQUE,
            password_hash TEXT NOT NULL,
            role TEXT NOT NULL DEFAULT 'user',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            about TEXT DEFAULT '',
            suspended BOOLEAN DEFAULT 0
        )
    `);

    // Таблица тем
    await db.exec(`
        CREATE TABLE IF NOT EXISTS threads (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE,
            description TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            creator_id INTEGER,
            hidden BOOLEAN DEFAULT 0,
            FOREIGN KEY (creator_id) REFERENCES users(id) ON DELETE SET NULL
        )
    `);
    
    // Seeding: Создание пользователя root и первой темы
    const existingRoot = await db.get('SELECT id FROM users WHERE role = ?', ['root']);
    
    if (!existingRoot) {
        const rootUsername = process.env.ROOT_USERNAME;
        const rootPassword = process.env.ROOT_PASSWORD;
        const rootEmail = process.env.ROOT_EMAIL;
        
        if (!rootUsername || !rootPassword || !rootEmail) {
            throw new Error('Отсутствуют переменные окружения ROOT_USERNAME, ROOT_PASSWORD или ROOT_EMAIL в файле .env');
        }
        const passwordHash = await bcrypt.hash(rootPassword, 10);
        
        const result = await db.run(
            'INSERT INTO users (username, password_hash, email, role) VALUES (?, ?, ?, ?)',
            [rootUsername, passwordHash, rootEmail, 'root']
        );
        
        await db.run(`
            INSERT OR IGNORE INTO threads (name, description, creator_id)
            VALUES ('Гостевая', 'Общие разговоры, тесты, флуд.', ?)`, [result.lastID]
        );
        
        console.log('✅ Root пользователь и первая тема созданы.');
    }
    
    // Таблица постов
    await db.exec(`
        CREATE TABLE IF NOT EXISTS posts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            author_id INTEGER,
            text TEXT NOT NULL,
            thread_id INTEGER NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            hidden BOOLEAN DEFAULT 0,
            FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE SET NULL,
            FOREIGN KEY (thread_id) REFERENCES threads(id) ON DELETE CASCADE
        )
    `);
    
    // Таблица пользователей которым
    // нужно пройти верификацию почты для завершения регистрации
    await db.exec(`
        CREATE TABLE IF NOT EXISTS pending_users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT NOT NULL UNIQUE,
            email TEXT NOT NULL UNIQUE,
            password_hash TEXT NOT NULL,
            about TEXT DEFAULT '',
            code TEXT NOT NULL,
            expires_at DATETIME DEFAULT (datetime('now', '+15 minutes'))
        )
    `);
    
    console.log('✅ База данных инициализирована и готова к работе.');
    return db;
}

module.exports = { dbPromise, initDatabase };
