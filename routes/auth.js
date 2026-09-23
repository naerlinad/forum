const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { dbPromise } = require('../db');

// Берём секрет из переменных окружения
// Если его там нет — падаем с ошибкой при старте (fail fast)
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
    throw new Error('JWT_SECRET не задан в .env файле.');
}

// POST /auth/register — регистрация
router.post('/register', async (req, res) => {
    const db = await dbPromise;
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ error: 'Имя и пароль обязательны.' });
    }

    if (password.length < 6) {
        return res.status(400).json({ error: 'Пароль должен быть не короче 6 символов.' });
    }

    // Проверка имени пользователя по регулярному выражению
    // Разрешены только латинские буквы, цифры и нижнее подчеркивание. Длина от 6 до 30 символов.
    const usernameRegex = /^[a-zA-Z0-9_]{6,30}$/;
    
    if (!usernameRegex.test(username)) {
        return res.status(400).json({ 
            error: 'Имя пользователя должно быть от 6 до 30 символов и содержать только латинские буквы, цифры и "_".' 
        });
    }

    try {
        // bcrypt.hash — асинхронный, не блокирует сервер
        // 10 — "стоимость": 2^10 итераций. Баланс скорости и безопасности
        const passwordHash = await bcrypt.hash(password, 10);

        const result = await db.run(
            'INSERT INTO users (username, password_hash) VALUES (?, ?)',
            [username, passwordHash]
        );

        res.status(201).json({
            message: 'Пользователь зарегистрирован.',
            id: result.lastID,
            username
        });
    } catch (error) {
        if (error.message.includes('UNIQUE constraint failed')) {
            return res.status(400).json({ error: 'Такой пользователь уже существует.' });
        }
        return res.status(500).json({ error: 'Ошибка сервера.' });
    }
});

// POST /auth/login — вход
router.post('/login', async (req, res) => {
    const db = await dbPromise;
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ error: 'Имя и пароль обязательны.' });
    }

    const user = await db.get(
        'SELECT * FROM users WHERE username = ?',
        [username]
    );

    // ВАЖНО: не раскрываем, что именно неверно — имя или пароль.
    // Это защита от перебора пользователей (user enumeration attack).
    if (!user) {
        return res.status(401).json({ error: 'Неверное имя или пароль.' });
    }

    // bcrypt.compare сам извлекает "соль" из хэша и сравнивает
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);

    if (!isPasswordValid) {
        return res.status(401).json({ error: 'Неверное имя или пароль.' });
    }

    // jwt.sign создаёт токен. 
    // Payload (первый аргумент) — данные внутри токена.
    const token = jwt.sign(
        { id: user.id, username: user.username, role: user.role },
        JWT_SECRET,
        { expiresIn: '7d' } // токен живёт 7 дней
    );

    res.json({
        message: 'Вход выполнен.',
        token,
        user: {
            id: user.id,
            username: user.username,
            role: user.role
        }
    });
});

module.exports = router;