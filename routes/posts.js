const express = require('express');
const { dbPromise } = require('../db');
const authenticateToken = require('../middleware/authenticate');

const router = express.Router();

router.put('/moderate/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
    
        if(req.user.role !== 'moder' && req.user.role !== 'root') {
            return res.status(403).json({error: 'Доступ закрыт.'});
        }
        const authorized = await checkAccess(id, req.user);
        if(!authorized) {
            return res.status(403).json({error: 'Нет прав доступа.'});
        }
        
        const db = await dbPromise;
        const post = await db.get(
            'SELECT hidden FROM posts WHERE id = ?', [id]
        );
        
        if(!post){
            return res.status(404).json({error: 'Поста не существует.'});
        }
        
        if(post.hidden === 0) {
            await db.run(
                'UPDATE posts SET hidden = 1 WHERE id = ?', [id]
            );
            res.json({message: 'Пост скрыт.'});
        } else {
            await db.run(
                'UPDATE posts SET hidden = 0 WHERE id = ?', [id]
            );
            res.json({message: 'Пост возвращен.'});
        }
    } catch (error) {
        res.status(500).json({error: 'Ошибка сервера.'});
    }
});

// GET /posts?thread_id=1&page=1&limit=10 – получение списка постов
router.get('/', async (req, res) => {
	try {
        const db = await dbPromise;
        const threadId = Number(req.query.thread_id);
        let page = Number(req.query.page) || 1;
        page = Math.max(page, 1);
        let limit = Number(req.query.limit) || 10;
        limit = Math.min(Math.max(limit, 1), 100);
        const offset = (page - 1) * limit;
    
        if(!threadId) {
        	return res.status(400).json({error: 'ID темы не указано.'});
        }
        const thread = await db.get(
            'SELECT id FROM threads WHERE id = ? AND hidden = 0',
            [threadId]
        );
        if(!thread) {
            return res.status(404).json({error: 'Тема не найдена.'});
        }
        
        const posts = await db.all(`
            SELECT p.id, p.text, u.username as author, p.created_at, p.updated_at
            FROM posts p
            LEFT JOIN users u ON p.author_id = u.id AND u.suspended = 0
            WHERE p.thread_id = ? AND p.hidden = 0
            ORDER BY p.created_at ASC
            LIMIT ? OFFSET ?`,
            [threadId, limit, offset]
        );
    
        const total = await db.get(`
            SELECT COUNT(*) as count FROM posts WHERE thread_id = ?
            AND hidden = 0`,
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
router.post('/', authenticateToken, async (req, res) => {
    try {
        const { threadId, text } = req.body;
    
        // Не даем возможность создать пост в воздухе
        if(!threadId) {
    	    return res.status(400).json({ error: 'ID темы должно быть указано.' });
        }
        if (!text || text.length > 10000) {
            return res.status(400).json({ error: 'Поле текст не должно быть пустым или содержать более 10 000 символов.' });
        }
        
        const db = await dbPromise;
        const thread = await db.get(
            'SELECT id FROM threads WHERE id = ? AND hidden = 0', [threadId]
        );
        if(!thread) {
            return res.status(400).json({error: 'Тема не найдена.'});
        }
        const result = await db.run(`
            INSERT INTO posts (thread_id, text, author_id)
            VALUES (?, ?, ?)`,
            [threadId, text, req.user.id]
        );
    
        res.status(201).json({
            message: "Новый пост создан",
            id: result.lastID,
            author: req.user.username,
            text: text,
            thread_id: threadId
        });
    } catch (error) {
        res.status(500).json({ error: 'Ошибка сервера.' });
    }
});

// PUT /posts/:id — редактирование поста
router.put('/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { text } = req.body;
        const authorized = await checkAccess(id, req.user);
    
        if(!authorized) {
            return res.status(403).json({error: 'Нет прав доступа.'});
        }
        
        if (!text || text.length > 10000) {
            return res.status(400).json({ error: 'Поле текст не должно быть пустым и не должно содержать более 10 000 символов.' });
        }
        
    	const db = await dbPromise;
        const result = await db.run(
            'UPDATE posts SET text = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            [text, id]
        );
        if(result.changes === 0) {
            return res.status(404).json({ error: 'Пост не существует.'});
        }
        res.json({ message: 'Пост отредактирован.'});
    } catch (error) {
        return res.status(500).json({ error: 'Ошибка сервера.' });
    }
    
});

// DELETE /posts/:id — удаление поста
router.delete('/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const authorized = await checkAccess(id, req.user);
        if(!authorized) {
    	    return res.status(403).json({error: 'Нет прав доступа.'});
        }
        
        const db = await dbPromise;
        await db.run('DELETE FROM posts WHERE id = ?', [id]);
        res.json({ message: 'Пост удалён.'});
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
