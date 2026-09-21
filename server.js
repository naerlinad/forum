const express = require('express');
const cors = require('cors');
const { initDatabase } = require('./db');
const postsRouter = require('./routes/posts');

const app = express();
const PORT = 3000;

const path = require('path');

//Middleware
app.use(cors());
app.use(express.json());

//Подключаем раздачу статики
app.use(express.static(path.join(__dirname, 'public')));

//Подключаем все маршруты по адресу /posts
app.use('/posts', postsRouter);

// Асинхронный запуск сервера с инициализацией БД
async function startServer() {
    await initDatabase();
    
    app.listen(PORT, () => {
        console.log('✅ Сервер запущен.');
    });
}

startServer();
