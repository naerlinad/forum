const express = require('express');
const router = express.Router();
const { dbPromise } = require('../db');
const authenticateToken = require('../middleware/authenticate');

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

// POST /threads — ТОЛЬКО admin и root
router.post('/', authenticateToken, async (req, res) => {
	const userRole = req.user.role;
	if (!userRole === 'admin' || 'root') {
		return res.status(400).json({error: 'Недостаточно прав'});
	}
	
    const db = await dbPromise;
    const { name, description } = req.body;
    
    if (!name) {
        return res.status(400).json({ error: 'Название темы обязательно.' });
    }
    
    try {
        const result = await db.run(
            'INSERT INTO threads (name, description) VALUES (?, ?)',
            [name, description || '']
        );
        res.status(201).json({
            id: result.lastID,
            name,
            description: description || '',
            message: 'Тема создана'
        });
    } catch (error) {
        if (error.message.includes('UNIQUE constraint failed')) {
            return res.status(403).json({ error: 'Тема с таким именем уже существует.' });
        }
        return res.status(500).json({ error: 'Ошибка сервера.' });
    }
});

// PUT /threads/:id — ТОЛЬКО admin и root
router.put('/:id', authenticateToken, async (req, res) => {
    const db = await dbPromise;
    const { id } = req.params;
    const { description } = req.body;
    
    if (!description) {
        return res.status(400).json({ error: 'Поле описание пустое.' });
    }
    
    const result = await db.run(
        'UPDATE threads SET description = ? WHERE id = ?',
        [description, id]
    );
    
    if (result.changes === 0) {
        return res.status(404).json({ error: 'Тема с таким ID не найдена.' });
    }
    
    res.json({ message: `Описание темы с ID ${id} изменено.` });
});

// DELETE /threads/:id — ТОЛЬКО admin и root
router.delete('/:id', authenticateToken, async (req, res) => {
    const db = await dbPromise;
    const { id } = req.params;
    
    const result = await db.run(
        'DELETE FROM threads WHERE id = ?', [id]
    );
    
    if (result.changes === 0) {
        return res.status(404).json({ error: 'Тема с таким ID не найдена.' });
    }
    
    res.json({ message: `Тема с ID ${id} и все сообщения в ней удалены.` });
});

module.exports = router;