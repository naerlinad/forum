const express = require('express');
const cors = require('cors');
const { open } = require('sqlite');
const sqlite3 = require('sqlite3');

const app = express();
const PORT = 3000;

// Создаем "обещание" открыть файл базы данных
const dbPromise = open({
    filename: './database.sqlite', 
    driver: sqlite3.Database
});

app.use(cors());
app.use(express.json());

// Временный маршрут (пока оставим его, чтобы проверить, что сервер жив)
app.get('/', (req, res) => {
    res.send('Сервер работает! 🚀');
});

// Получаем все посты из базы данных 
app.get('/posts', async (req, res) => {
	const db = await dbPromise;
	const posts = await db.all('SELECT * FROM posts');
	res.json(posts);
});

app.post('/posts', async (req, res) => {
	const db = await dbPromise;
	const result = await db.run(
	    'INSERT INTO posts (author, text) VALUES (?, ?)',
	    [req.body.author, req.body.text]
	 );
	res.status(201).json({
		id: result.lastID,
		author: req.body.author,
		text: req.body.text
	});
});

// Асинхронный запуск сервера с инициализацией БД
async function startServer() {
    const db = await dbPromise;

    await db.exec(`
        CREATE TABLE IF NOT EXISTS posts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            author TEXT NOT NULL,
            text TEXT NOT NULL
        )
    `);
    console.log('✅ База данных и таблица posts готовы!');

    app.listen(PORT, () => {
        console.log(`✅ Сервер запущен на http://localhost:${PORT}`);
    });
}

startServer();
