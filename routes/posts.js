const express = require('express');
const { dbPromise } = require('../db');
const authenticateToken = require('../middleware/authenticate');
const permitAccess = require('../middleware/permit');

const router = express.Router();

// GET /posts?thread_id=1&page=1&limit=10 – получение списка постов
router.get('/', async (req, res) => {
	try {
        const db = await dbPromise;
        const threadId = parseInt(req.query.thread_id);
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const offset = (page - 1) * limit;
    
        if(!threadId) {
        	return res.status(400).json({error: 'ID темы не указано.'});
        }
    
        const posts = await db.all(`
            SELECT p.id, p.text, u.username as author, p.thread_id,
            p.created_at, p.updated_at FROM posts p
            LEFT JOIN users u ON p.author_id = u.id AND u.status != 'banned'
            WHERE p.thread_id = ? AND p.status != 'moderated'
            ORDER BY p.created_at ASC
            LIMIT ? OFFSET ?`,
            [threadId, limit, offset]
        );
    
        const total = await db.get(`
            SELECT COUNT(*) as count FROM posts WHERE thread_id = ?
            AND status != 'moderated'`,
            [threadId]
        );
    
        res.json({
            posts,
            page,
            total_pages: Math.ceil((total?.count || 0) / limit),
            total_posts: total?.count || 0,
            thread_id: threadId
        });
    } catch (error) {
    	res.status(500).json({error: 'Ошибка сервера.'});
    }
});

// POST /posts — создание поста
router.post('/', authenticateToken, permitAccess, async (req, res) => {
    const { text } = req.body;
    const threadId = parseInt(req.body.thread_id);
    
    // Не даем возможность создать пост в воздухе
    if(!threadId) {
    	return res.status(400).json({ error: 'ID темы должно быть указано.' });
    }
    if (!text) {
        return res.status(400).json({ error: 'Поле текст не должно быть пустым.' });
    }
    
    try {
    	const db = await dbPromise;
        const result = await db.run(`
            INSERT INTO posts (author_id, text, thread_id)
            VALUES (?, ?, ?)`,
            [req.user.id, text, threadId] // Передаём ID из токена
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
            return res.status(400).json({ error: `Тема с ID ${threadId} не существует.` });
        }
        res.status(500).json({ error: 'Ошибка сервера.' });
    }
});

// PUT /posts/:id — редактирование поста
router.put('/:id', authenticateToken, permitAccess, async (req, res) => {
    const { id } = req.params;
    const authorized = await checkAccess(id, req.user);
    
    if(!authorized) {
    	return res.status(403).json({error: 'Нет прав доступа.'});
    }
    
    const { text } = req.body;
    
    if (!text) {
        return res.status(400).json({ error: 'Поле текст не должно быть пустым.' });
    }
    
    try {
    	const db = await dbPromise;
        const result = await db.run(
            'UPDATE posts SET text = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            [text, id]
        );
        if(result.changes === 0) {
            return res.status(404).json({ error: `Пост с ID ${id} не существует.` });
        }
        res.json({ message: `Пост с ID ${id} изменён.` });
    } catch (error) {
        return res.status(500).json({ error: 'Ошибка сервера.' });
    }
    
});

// DELETE /posts/:id — удаление поста
router.delete('/:id', authenticateToken, permitAccess, async (req, res) => {
    const { id } = req.params;
    const authorized = await checkAccess(id, req.user);
    
    if(!authorized) {
    	return res.status(403).json({error: 'Нет прав доступа.'});
    }
    
    try {
        const db = await dbPromise;
        await db.run('DELETE FROM posts WHERE id = ?', [id]);
        res.json({ message: `Пост с ID ${id} удалён.` });
    } catch (error) {
        res.status(500).json({error: 'Ошибка сервера.'});
    }
});

router.put('/moderate/:id', authenticateToken, permitAccess, async (req, res) => {
    if(req.user.role !== 'moder' && req.user.role !== 'root') {
        return res.status(403).json({error: 'Доступ закрыт.'});
    }
    const { id } = req.params;
    const { status } = req.body;
    
    const authorized = await checkAccess(id, req.user);
    if(!authorized) {
        return res.status(403).json({error: 'Нет прав доступа.'});
    }
    
    if(!status) {
        return res.status(400).json({error: 'Поле status пустое.'});
    }
    
    try {
        const db = await dbPromise;
        await db.run(
            'UPDATE posts SET status = ? WHERE id = ?', [status, id]
        );
        res.json({message: 'Данные обновлены.'});
    } catch (error) {
        res.status(500).json({error: 'Ошибка сервера.'});
    }
});

async function checkAccess(post_id, user) {
	const db = await dbPromise;
	const post = await db.get(`
	    SELECT p.author_id, u.role as author_role
	    FROM posts p
	    LEFT JOIN users u ON p.author_id = u.id
        WHERE p.id = ?`, [post_id]
	);
	
	if(!post) return false;
	
	const isRoot = user.role === 'root';
	const isAuthor = post.author_id === user.id;
	const isModerator = user.role === 'moder' &&
        (post.author_role === 'user' || post.author_role === null);
    
    return isRoot || isAuthor || isModerator;
}

module.exports = router;