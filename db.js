const { open } = require('sqlite');
const sqlite3 = require('sqlite3');

const dbPromise = open({
    filename: './database.sqlite', 
    driver: sqlite3.Database
});

async function initDatabase() {
	const db = await dbPromise;
	
	await db.exec(`
	    CREATE TABLE IF NOT EXISTS threads (
	        id INTEGER PRIMARY KEY AUTOINCREMENT,
	        name TEXT NOT NULL UNIQUE,
	        description TEXT,
	        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
	    )
	`);

    await db.exec(`
        CREATE TABLE IF NOT EXISTS posts (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              author TEXT NOT NULL,
              text TEXT NOT NULL,
              created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
              updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
              FOREIGN KEY (thread_id) REFERENCES threads(id)
          )
     `);
     
     //Создаем тему "Гостевая" по умолчанию.
     await db.exec(`
         INSERT OR IGNORE INTO threads (id, name, description)
         VALUES (1, 'Гостевая', 'Общие разговоры, тесты и флуд.')
     `)
    
    //Начало временного кода для миграции БД.
    const columns = await db.all('PRAGMA table_info(posts)');
    const columnNames = columns.map(col => col.name);
    
    if(!columnNames.includes('thread_id')) {
    	await db.exec(`
            ALTER TABLE posts ADD COLUMN thread_id INTEGER DEFAULT 1
      `);
      console.log('✅ Добавлена колонка thread_id');
    }
    //Конец временного кода.
    
    console.log('✅ База данных готова к работе.');
    return db;
}

module.exports = { dbPromise, initDatabase };