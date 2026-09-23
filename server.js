// ПЕРВАЯ СТРОКА — загружаем переменные из .env в process.env.
// Должна быть до всех остальных require.
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');
const { initDatabase } = require('./db');
const postsRouter = require('./routes/posts');
const threadsRouter = require('./routes/threads');
const authRouter = require('./routes/auth');

const app = express();

// Берём порт из .env. Если там нет — используем 3000.
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Раздача статических файлов (HTML, CSS, JS для фронтенда)
app.use(express.static(path.join(__dirname, 'public')));

// Подключаем маршруты
app.use('/auth', authRouter);
app.use('/posts', postsRouter);
app.use('/threads', threadsRouter);

// Асинхронный запуск сервера с инициализацией БД
async function startServer() {
    await initDatabase();
    
    app.listen(PORT, () => {
        console.log(`✅ Сервер запущен на порту ${PORT}.`);
    });
}

startServer();