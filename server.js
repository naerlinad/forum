const express = require('express');
const cors = require('cors');
const { initDatabase } = require('./db');
const postsRouter = require('./routes/posts');

const app = express();
const PORT = 3000;

//Middleware
app.use(cors());
app.use(express.json());

// Временный маршрут (пока оставим его, чтобы проверить, что сервер жив)
app.get('/', (req, res) => {
    res.send('Сервер работает! 🚀');
});

//Подключаем все маршруты по адресу /posts
app.use('/posts', postsRouter);

// Асинхронный запуск сервера с инициализацией БД
async function startServer() {
    await initDatabase();
    
    app.listen(PORT, () => {
        console.log(`✅ Сервер запущен на http://localhost:${PORT}`);
    });
}

startServer();
