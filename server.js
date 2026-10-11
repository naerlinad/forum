// Берем данные окружения. 
require('dotenv').config();

const express = require('express');
const path = require('path');
const { initDatabase } = require('./db');
const postsRouter = require('./routes/posts');
const threadsRouter = require('./routes/threads');
const authRouter = require('./routes/auth');
const usersRouter = require('./routes/users');
const logger = require('./middleware/logger');
const { frontlineLimiter, burstLimiter } = require('./middleware/rateLimiter');

const app = express();

const PORT = process.env.PORT || 3000;

// Пока что доверяем только прокси, расположенным на localhost. Nginx или др.
app.set('trust proxy', 'loopback');

// Middleware. Порядок подключения важен.
app.use(logger); // Логируем запросы (даже отклоненные)
app.use(express.json({limit: '33kb'})); // Парсим JSON тело запросов

// ЛИМИТЕРЫ (до статики для полной защиты)
app.use(frontlineLimiter);
app.use(burstLimiter);

// Раздача статики
app.use(express.static(path.join(__dirname, 'public')));

// Подключаем маршруты
app.use('/auth', authRouter);
app.use('/posts', postsRouter);
app.use('/threads', threadsRouter);
app.use('/users', usersRouter);

// Обработчик 404 для несуществующих маршрутов
app.use((req, res) => {
    res.status(404).json({ error: 'Маршрут не найден.' });
});

// Глобальный обработчик ошибок
app.use((err, req, res, next) => {
    console.error('Необработанная ошибка:', err);
    res.status(500).json({ error: 'Внутренняя ошибка сервера.' });
});

// Асинхронный запуск сервера с инициализацией БД
async function startServer() {
    try {
        await initDatabase();
        
        // Слушаем обращения к порту только с localhost
        app.listen(PORT, '127.0.0.1', () => {
            console.log(`✅ Сервер запущен на localhost:${PORT}.`);
        });
    } catch (error) {
        console.error('❌ Ошибка инициализации базы данных:', error);
        process.exit(1); // Завершаем процесс если БД не работает.
    }
}

startServer();
