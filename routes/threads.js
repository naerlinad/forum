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
        
        const thread = await db.get(
            'SELECT hidden FROM threads WHERE id = ?', [id]
        );
        
        if(!thread) {
            return res.status(404).json({error: 'Темы не существует.'});
        }
        
        if(thread.hidden === 0) {
            await db.run(
                'UPDATE threads SET hidden = 1 WHERE id = ?', [id]
            );
            res.json({message: 'Тема скрыта.'});
        } else {
            await db.run(
                'UPDATE threads SET hidden = 0 WHERE id = ?', [id]
            );
            res.json({message: 'Тема возвращена.'});
        }
    } catch (error) {
        res.status(500).json({error: 'Ошибка сервера.'});
    }
});

// GET /threads – получение списка тем
router.get('/', async (req, res) => {
	try {
        const db = await dbPromise;
        let page = Number(req.query.page) || 1;
        page = Math.max(page, 1);
        let limit = Number(req.query.limit) || 10;
        limit = Math.min(Math.max(limit, 1), 100);
        const offset = (page - 1) * limit;
    
        const threads = await db.all(`
            SELECT t.id, t.name, t.description, t.created_at,
            u.username as creator
            FROM threads t
            LEFT JOIN users u ON t.creator_id = u.id AND u.suspended = 0
            WHERE t.hidden = 0
            ORDER BY t.id ASC
            LIMIT ? OFFSET ?`,
            [limit, offset]
        );
     
        const total = await db.get(`
            SELECT COUNT(*) as count FROM threads
            WHERE hidden = 0
        `);
    
        res.json({
            threads,
            page,
            totalPages: Math.ceil((total?.count || 0 ) / limit),
            totalThreads: total?.count || 0
        });
    } catch (error) {
    	res.status(500).json({error: 'Ошибка сервера.'});
    }
});

// POST /threads – создание темы
router.post('/', authenticateToken, async (req, res) => {
    try {
        const { name, description } = req.body; 
        if (!name || name.length > 100) {
            return res.status(400).json({ error: 'Название темы обязательно. И оно не должно превышать 100 символов.'});
        }
        if(description && description.length > 400) {
            return res.status(400).json({ error: 'Описание не должно превышать 400 символов.'});
        }
         
    	const db = await dbPromise;
        const result = await db.run(
            'INSERT INTO threads (name, description, creator_id) VALUES (?, ?, ?)',
            [name, description || '', req.user.id]
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
        res.status(500).json({ error: 'Ошибка сервера.' });
    }
});

// PUT /threads/:id – редактирование темы
router.put('/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const authorized = await checkAccess(id, req.user);
        if (!authorized) {
            return res.status(403).json({ error: 'Нет прав доступа.' });
        }
        const { name, description } = req.body;
        if (name === undefined && description === undefined) {
            return res.status(400).json({ error: 'Не указано ни одного поля для обновления.'});
        }
        
        if (name && name.length > 100) {
            return res.status(400).json({ error: 'Название не должно превышать 100 символов.'});
        }
        if(description && description.length > 400) {
            return res.status(400).json({ error: 'Описание не должно превышать 400 символов.'});
        }
        
        const db = await dbPromise;
        
        // Формируем запрос динамически, чтобы обновить всё за один раз
        let query = 'UPDATE threads SET ';
        const params = [];
        
        if (name !== undefined) {
            query += 'name = ?, ';
            params.push(name);
        }
        if (description !== undefined) {
            query += 'description = ?, ';
            params.push(description);
        }
        
        // Убираем последнюю запятую и добавляем условие
        query = query.slice(0, -2) + ' WHERE id = ?';
        params.push(id);

        const result = await db.run(query, params);
        
        if (result.changes === 0) {
            return res.status(404).json({ error: 'Темы с таким ID не существует.' });
        }
        
        res.json({ message: 'Тема успешно обновлена.' });
        
    } catch (error) {
        if (error.message.includes('UNIQUE constraint failed')) {
            return res.status(400).json({ error: 'Тема с таким именем уже существует.' });
        }
        res.status(500).json({ error: 'Ошибка сервера.' });
    }
});


// DELETE /threads/:id – удаление темы
router.delete('/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const authorized = await checkAccess(id, req.user);
        if(!authorized) {
            return res.status(403).json({error: 'Нет прав доступа.'});
        }
        const db = await dbPromise;
        await db.run('DELETE FROM threads WHERE id = ?', [id]);
        res.json({ message: 'Тема и все сообщения в ней удалены.'});
    } catch (error) {
         res.status(500).json({ error: 'Ошибка сервера'});
    }
});

async function checkAccess(thread_id, user) {
	const db = await dbPromise;
	const thread = await db.get(`
	    SELECT t.creator_id, u.role as creator_role
	    FROM threads t
	    LEFT JOIN users u ON t.creator_id = u.id
        WHERE t.id = ?`, [thread_id]
	);
	if(!thread) return false;
	
	const isRoot = user.role === 'root';
	const isCreator = thread.creator_id === user.id;
	const isModerator = user.role === 'moder' &&
        (thread.creator_role === 'user' || thread.creator_role === null);
    
    return isRoot || isCreator || isModerator;
}

module.exports = router;
