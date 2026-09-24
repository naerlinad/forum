const express = require('express');
const router = express.Router();
const { dbPromise } = require('../db');
const authenticateToken = require('../middleware/authenticate');

// Выносим проверку прав в отдельную асинхронную функцию
async function isAuthorized(id, user, db) {
    const post = await db.get(`
        SELECT p.id, p.author_id, u.role as author_role
        FROM posts p
        LEFT JOIN users u ON p.author_id = u.id
        WHERE p.id = ?`,
        [id]
    );
    
    if (!post) return null; // Пост не найден
	
    const isRoot = user.role === 'root';
    const isAuthor = user.id === post.author_id;
    const isAdminModeratingUser = user.role === 'admin' && post.author_role === 'user';
	
    if (!isRoot && !isAuthor && !isAdminModeratingUser) {
        return false; // Нет прав
    }
	
    return true; // Есть права
}

// GET /posts?thread_id=1&page=1&limit=10
router.get('/', async (req, res) => {
    const db = await dbPromise;
    
    const threadId = parseInt(req.query.thread_id) || 1;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit; 
    
    const posts = await db.all(
        'SELECT * FROM posts WHERE thread_id = ? ORDER BY created_at ASC LIMIT ? OFFSET ?',
        [threadId, limit, offset]
    );
    
    const total = await db.get(
        'SELECT COUNT(*) as count FROM posts WHERE thread_id = ?',
        [threadId]
    );
    
    res.json({
        posts,
        page,
        totalPages: Math.ceil(total.count / limit),
        totalPosts: total.count,
        thread_id: threadId
    });
});

// POST /posts — создание поста
router.post('/', authenticateToken, async (req, res) => {
    const db = await dbPromise;
    const { text } = req.body;
    const threadId = parseInt(req.body.thread_id) || 1;
    
    if (!text) {
        return res.status(400).json({ error: 'Поле текст обязательно.' });
    }
    
    try {
        const result = await db.run(
            `INSERT INTO posts (author_id, author_name, text, thread_id, created_at, updated_at)
            VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
            [req.user.id, req.user.username, text, threadId] // Передаём ID и имя из токена
        );
    
        res.status(201).json({
            message: "Новый пост создан",
            id: result.lastID,
            author: req.user.username,
            text: text,
            thread_id: threadId
        });
    } catch (error) {
        if (error.message.includes('FOREIGN KEY constraint failed')) {
            return res.status(400).json({ error: 'Темы с таким ID не существует.' });
        }
        return res.status(500).json({ error: 'Ошибка сервера.' });
    }
});

// PUT /posts/:id — редактирование поста
router.put('/:id', authenticateToken, async (req, res) => {
    const db = await dbPromise;
    const { id } = req.params;
    const { text } = req.body;
    
    if (!text) {
        return res.status(400).json({ error: 'Поле текст обязательно.' });
    }
    
    const authorized = await isAuthorized(id, req.user, db);
    
    if (authorized === false) {
        return res.status(403).json({ error: 'Недостаточно прав для редактирования этого поста.' });
    }
    
    if (authorized === null) {
        return res.status(404).json({ error: 'Пост не найден.' });
    }
    
    const result = await db.run(
        'UPDATE posts SET text = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [text, id]
    );
    
    res.json({ message: `Пост с ID ${id} изменён.` });
});

// DELETE /posts/:id — удаление поста
router.delete('/:id', authenticateToken, async (req, res) => {
    const db = await dbPromise;
    const { id } = req.params;
    
    const authorized = await isAuthorized(id, req.user, db);

    if (authorized === false) {
        return res.status(403).json({ error: 'Недостаточно прав для удаления этого поста.' });
    }
    
    if (authorized === null) {
        return res.status(404).json({ error: 'Пост не найден.' });
    }

    await db.run('DELETE FROM posts WHERE id = ?', [id]);
    
    res.json({ message: `Пост с ID ${id} удалён.` });
});

module.exports = router;