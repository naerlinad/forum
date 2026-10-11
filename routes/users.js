const express = require('express');
const { dbPromise } = require('../db');
const authenticateToken = require('../middleware/authenticate');

const router = express.Router();

router.put('/moderate/:id', authenticateToken, async (req, res) => {
    try {
        if (req.user.role !== 'moder' && req.user.role !== 'root') {
            return res.status(403).json({ error: 'Доступ закрыт.' });
        }
        
        const db = await dbPromise;
        
        const { id } = req.params;
        const targetUser = await db.get('SELECT role, suspended FROM users WHERE id = ?', [id]);
        
        if (!targetUser) { 
            return res.status(404).json({ error: 'Пользователя не существует.' });
        }
        
        // Защита от эскалации привилегий
        if (targetUser.role === 'root') {
            return res.status(403).json({ error: 'Попытка обречена.' });
        }
        if (targetUser.role === 'moder' && req.user.role !== 'root') {
            return res.status(403).json({ error: 'Нет прав доступа.' });
        }
        
        if(targetUser.suspended === 0) {
            await db.run('UPDATE users SET suspended = 1 WHERE id = ?', [id]);
            res.json({ message: 'Аккаунт пользователя ограничен.' });
        } else {
            await db.run('UPDATE users SET suspended = 0 WHERE id = ?', [id]);
            res.json({ message: 'С аккаунта пользователя сняты ограничения.' });
        }
    } catch (error) {
        console.error("Ошибка при модерации пользователя:", error);
        res.status(500).json({ error: 'Ошибка сервера.' });
    }
});

// PUT /users/setrole/:id - Смена роли пользователей (доступна только для root)
router.put('/setrole/:id', authenticateToken, async (req, res) => {
    try {
        if (req.user.role !== 'root') {
            return res.status(403).json({ error: 'Доступ закрыт.' });
        }
        
        const { role } = req.body;
        const { id } = req.params;
        
        const allowedRoles = ['user', 'moder', 'root'];
        if (!role || !allowedRoles.includes(role)) {
            return res.status(400).json({ error: 'Некорректная роль.' });
        }
        
        const db = await dbPromise;
        const result = await db.run('UPDATE users SET role = ? WHERE id = ?', [role, id]);
        
        if (result.changes === 0) {
            return res.status(404).json({ error: 'Пользователя с таким ID нет.' });
        }
        res.json({ message: `Роль пользователя изменена на ${role}` });
    } catch (error) {
        res.status(500).json({ error: 'Ошибка сервера.' });
    }
});

// GET /users - Публичный список пользователей
router.get('/', async (req, res) => {
    try {
        const db = await dbPromise;
        const page = Math.max(Number(req.query.page) || 1, 1);
        let limit = Number(req.query.limit) || 20;
        limit = Math.min(Math.max(limit, 1), 100);
        const offset = (page - 1) * limit;

        const users = await db.all(`
            SELECT u.id, u.username, u.role, u.about, u.created_at 
            FROM users u
            WHERE u.suspended = 0
            ORDER BY id ASC
            LIMIT ? OFFSET ?`, [limit, offset]
        );

        const total = await db.get('SELECT COUNT(*) as count FROM users WHERE suspended = 0');
        
        res.json({
            users,
            page,
            total_pages: Math.ceil((total?.count || 0) / limit),
            total_users: total?.count || 0
        });
    } catch (error) {
        console.error('Ошибка получения списка пользователей:', error);
        res.status(500).json({ error: 'Ошибка сервера.' });
    }
});

// PUT /users/:id - Изменение профиля
router.put('/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        if (req.user.id !== Number(id) && req.user.role !== 'root') {
            return res.status(403).json({ error: 'Нет прав доступа.' });
        }
        
        const { username, about } = req.body;
        if (username === undefined && about === undefined) {
            return res.status(400).json({ error: 'Не указано ни одного поля для обновления.' });
        }
        
        if (username !== undefined) {
            const usernameRegex = /^[a-zA-Z0-9_]{6,30}$/;
            if (!usernameRegex.test(username)) {
                return res.status(400).json({
                    error: 'Имя пользователя должно быть от 6 до 30 символов и содержать только латинские буквы, цифры и _ .' 
                });
            }
        }
     
        if (about !== undefined && about.length > 500) {
            return res.status(400).json({
                error: 'Поле "О себе" может содержать максимум 500 символов.' 
            });
        }
        
        const db = await dbPromise;
    
        let query = 'UPDATE users SET ';
        const params = [];
        
        if (username !== undefined) {
            query += 'username = ?, ';
            params.push(username);
        }
        
        if (about !== undefined) {
            query += 'about = ?, ';
            params.push(about);
        }
        
        query = query.slice(0, -2) + ' WHERE id = ?';
        params.push(id);
        
        const result = await db.run(query, params);
        
        if (result.changes === 0) {
            return res.status(404).json({ error: 'Пользователя с таким ID нет.' });
        }
        res.json({ message: 'Профиль обновлён.' });
    } catch (error) {
        if (error.message.includes('UNIQUE constraint failed: users.username')) {
            return res.status(400).json({ error: 'Такое имя пользователя уже занято.' });
        }
        console.error('Ошибка обновления профиля:', error);
        res.status(500).json({ error: 'Ошибка сервера.' });
    }
});

// DELETE /users/:id - Удаление аккаунта
router.delete('/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        if (req.user.id !== Number(id) && req.user.role !== 'root') {
            return res.status(403).json({ error: 'Нет прав доступа.' });
        }
        const db = await dbPromise;
        const result = await db.run('DELETE FROM users WHERE id = ?', [id]);
        
        if (result.changes === 0) {
            return res.status(404).json({ error: 'Пользователь не найден.' });
        }
        
        res.json({ message: 'Пользователь удалён.' });
    } catch (error) {
        console.error('Ошибка удаления пользователя:', error);
        res.status(500).json({ error: 'Ошибка сервера.' });
    }
});

module.exports = router;
