const express = require('express');
const router = express.Router();
const { dbPromise } = require('../db');
const authenticateToken = require('../middleware/authenticate');

async function isAuthorized(id, user, db) {
    const thread = await db.get(
        `SELECT t.id, t.creator_id, u.role as creator_role
         FROM threads t
         LEFT JOIN users u ON t.creator_id = u.id
         WHERE t.id = ?`,
        [id]
    );
    
    if (!thread) return null; // Тема не найдена
    
    const isRoot = user.role === 'root';
    const isCreator = user.id === thread.creator_id;
    const isAdminModeratingUser = user.role === 'admin' && thread.creator_role === 'user';
    
    if (!isRoot && !isCreator && !isAdminModeratingUser) {
        return false; // Нет прав
    }
    
    return true; // Есть права
}

// GET /threads — публичный
router.get('/', async (req, res) => {
    const db = await dbPromise;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;
    
    const threads = await db.all(
        'SELECT * FROM threads ORDER BY id ASC LIMIT ? OFFSET ?',
        [limit, offset]
    );
     
    const total = await db.get('SELECT COUNT(*) as count FROM threads');
    
    res.json({
        threads,
        page,
        totalPages: Math.ceil(total.count / limit),
        totalThreads: total.count
    });
});

// POST /threads
router.post('/', authenticateToken, async (req, res) => {
    const db = await dbPromise;
    const { name, description } = req.body;
    
    if (!name) {
        return res.status(400).json({ error: 'Название темы обязательно.' });
    }
    
    try {
        const result = await db.run(
            'INSERT INTO threads (name, description, creator_id, creator_name) VALUES (?, ?, ?, ?)',
            // Микро-улучшение: description || '' на случай, если клиент не отправил это поле
            [name, description || '', req.user.id, req.user.username]
        );
        res.status(201).json({
            id: result.lastID,
            name,
            description: description || '',
            message: 'Тема создана.'
        });
    } catch (error) {
        if (error.message.includes('UNIQUE constraint failed')) {
            return res.status(400).json({ error: 'Тема с таким именем уже существует.' });
        }
        return res.status(500).json({ error: 'Ошибка сервера.' });
    }
});

// PUT /threads/:id
router.put('/:id', authenticateToken, async (req, res) => {
    const db = await dbPromise;
    const { id } = req.params;
    const { description } = req.body;
    
    const authorized = await isAuthorized(id, req.user, db);
    
    if (authorized === false) {
        return res.status(403).json({ error: 'Нет прав доступа.' });
    }
    
    if (authorized === null) {
        return res.status(404).json({ error: 'Тема не найдена.' });
    }
    
    if (!description) {
        return res.status(400).json({ error: 'Поле описание пустое.' });
    }
    
    await db.run(
        'UPDATE threads SET description = ? WHERE id = ?',
        [description, id]
    );
    
    res.json({ message: `Описание темы с ID ${id} изменено.` });
});

// DELETE /threads/:id
router.delete('/:id', authenticateToken, async (req, res) => {
    const db = await dbPromise;
    const { id } = req.params;
    
    const authorized = await isAuthorized(id, req.user, db);
    
    if (authorized === false) {
        return res.status(403).json({ error: 'Нет прав доступа.' });
    }
    
    if (authorized === null) {
        return res.status(404).json({ error: 'Тема не найдена.' });
    }
    
    await db.run('DELETE FROM threads WHERE id = ?', [id]);
    
    res.json({ message: `Тема с ID ${id} и все сообщения в ней удалены.` });
});

module.exports = router;