const { open } = require('sqlite');
const sqlite3 = require('sqlite3');

// Создаем "обещание" открыть файл базы данных
const dbPromise = open({
    filename: './database.sqlite', 
    driver: sqlite3.Database
});

async function initDatabase() {
	const db = await dbPromise;

    await db.exec(
        `CREATE TABLE IF NOT EXISTS posts (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              author TEXT NOT NULL,
              text TEXT NOT NULL
          )`
     );
    
    /*Создаем список колонок уже имеющихся в базе. Делаем это для того, чтобы при добавлении
    новой колонки, избежать ошибки дублирования колонок выполнив проверку на их налие.
    Таким образом старые файлы бд на серверах обновяться,
    а сервера с обновленными файлами не упадут из-за указаной ошибки.*/
    const columns = await db.all('PRAGMA table_info(posts)');
    const columnNames = columns.map(col => col.name);
    
    if(!columnNames.includes('created_at')) {
    	await db.exec(
            `ALTER TABLE posts ADD COLUMN created_at DATETIME DEFAULT '2026-09-16 00:00:00'`
      );
        
      console.log('✅ Добавлена колонка created_at');
    }
    
    if(!columnNames.includes('updated_at')) {
    	await db.exec(`
            ALTER TABLE posts ADD COLUMN updated_at DATETIME DEFAULT '2026-09-16 00:00:00'
        `);
        console.log('✅ Добавлена колонка updated_at');
    }
    
    console.log('✅ База данных и таблица posts готовы!');
    return db;
}

module.exports = { dbPromise, initDatabase };