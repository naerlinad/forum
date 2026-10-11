const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { dbPromise } = require('../db');
const { registrationLimiter, loginLimiter } = require('../middleware/rateLimiter');
const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
    throw new Error('JWT_SECRET не задан в .env файле.');
}


router.post('/register', registrationLimiter, async (req, res) => {
    try{
        const { username, password, email } = req.body;
        if (!username || !password || !email) {
            return res.status(400).json({ error: 'Не заполнены обязательные поля.' });
        }
        
        const usernameRegex = /^[a-zA-Z0-9_]{6,30}$/;
        if (!usernameRegex.test(username)) {
            return res.status(400).json({
                error: 'Имя пользователя должно быть от 6 до 30 символов и содержать только латинские буквы, цифры и _ .'
            });
        }
        
        const emailRegex = /^[a-zA-Z0-9_.-]{1,30}@[a-zA-Z0-9_.-]{1,30}\.[a-z]{2,10}$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({
                error: 'Неверный формат адреса электронной почты.'
            });
        }
    
        if (password.length < 6) {
            return res.status(400).json({ error: 'Пароль должен быть не короче 6 символов.' });
        }
        
        const db = await dbPromise;
        
        const existingName = await db.get('SELECT id FROM users WHERE username = ?', [username]);
        if (existingName) {
            return res.status(403).json({ error: 'Данное имя пользователя занято. Выберите другое.' });
        }
        const existingEmail = await db.get('SELECT id FROM users WHERE email = ?', [email]);
        if (existingEmail) {
            return res.status(403).json({ error: 'Данный адрес почты уже используется. Укажите другой.' });
        }
        
        // Ленивая очистка просроченных заявок
        await db.run(`DELETE FROM pending_users WHERE expires_at < datetime('now')`);
        
        const pendingName = await db.get('SELECT id FROM pending_users WHERE username = ?', [username]);
        if (pendingName) {
            return res.status(403).json({ error: 'Данное имя пользователя временно занято. Можете попробовать позже или выбрать другое.' });
        }
        const pendingEmail = await db.get('SELECT id FROM pending_users WHERE email = ?', [email]);
        if (pendingEmail) {
            return res.status(403).json({ error: 'Данный адрес почты уже используется. Укажите другой.' });
        }
        
        const passwordHash = await bcrypt.hash(password, 10);
        const code = crypto.randomInt(0, 1_000_000).toString().padStart(6, '0');
        
        const result = await db.run(
            'INSERT INTO pending_users (username, password_hash, email, code) VALUES (?, ?, ?, ?)',
            [username, passwordHash, email, code]
        );
        
        //TODO отправка кода верификации по почте. Сейчас для тестов вывод в консоль.
        console.log(`Код верификации: ${code}`);
        
        res.status(201).json({
            message: 'Заявка сохранена. На указанный адрес почты отправлено письмо с кодом подтверждения для завершения регистрации.',
            id: result.lastID,
            username
        });
    } catch (error) {
        console.error('Ошибка регистрации:', error);
        return res.status(500).json({ error: 'Ошибка сервера.' });
    }
});

// TODO реализовать вверификацию по email. Держим в голове
// что данный кусок будущего кода также будет использоваться
// при изменении email действующим пользователем.

router.post('/login', loginLimiter, async (req, res) => {
    try {
        const db = await dbPromise;
        const { username, password } = req.body;
        
        if (!username || !password) {
            return res.status(400).json({ error: 'Имя и пароль обязательны.' });
        }
        
        const user = await db.get(
            'SELECT id, username, password_hash, role, suspended FROM users WHERE username = ?',
            [username]
        );
        
        if (!user) {
            return res.status(401).json({ error: 'Неверное имя или пароль.' });
        }
        
        if (user.suspended === 1) {
            return res.status(403).json({ error: 'Аккаунт временно ограничен.' });
        }
        
        const isPasswordValid = await bcrypt.compare(password, user.password_hash);
        if (!isPasswordValid) {
            return res.status(401).json({ error: 'Неверное имя или пароль.' });
        }
        
        // Кладем в payload id пользователя
        const token = jwt.sign(
            { id: user.id },
            JWT_SECRET,
            { expiresIn: '7d' }
        );
        
        res.json({
            message: 'Вход выполнен.',
            token,
            user: {
                id: user.id,
                username: user.username,
            }
        });
    } catch (error) {
        console.error('Ошибка входа:', error);
        return res.status(500).json({ error: 'Ошибка сервера.' });
    }
});

module.exports = router;
