const express = require('express');
const { dbPromise } = require('../db');
const authenticateToken = require('../middleware/authenticate');
const permitAccess = require('../middleware/permit');

const router = express.Router();

// GET /users
router.get('/', async (req, res) => {
    try {
        const db = await dbPromise;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const offset = (page - 1) * limit;

        const users = await db.all(`
            SELECT u.id, u.username, u.role,
            u.about, u.created_at FROM users u
            WHERE u.status != 'banned'
            ORDER BY id ASC
            LIMIT ? OFFSET ?`, [limit, offset]
        );

        const total = await db.get(`
            SELECT COUNT(*) as count FROM users
            WHERE status != 'banned'
        `);
        
        res.json({
            users,
            page,
            total_pages: Math.ceil((total?.count || 0) / limit),
            total_users: total?.count || 0
        });
    } catch (error) {
        res.status(500).json({ error: 'Ошибка сервера.' });
    }
});

// PUT /users/:id - Изменение данных профиля пользователя
// доступно для него свмого и рут.
router.put('/:id', authenticateToken, permitAccess, async (req, res) => {
    const { id } = req.params;
    if (req.user.id !== parseInt(id) && req.user.role !== 'root') {
        return res.status(403).json({ error: 'Нет прав доступа.' });
    }
    const { username, about } = req.body;
    
    if (username === undefined && about === undefined) {
        return res.status(400).json({ error: 'Не указано ни одного поля для обновления.' });
    }
    
    try {
    	const db = await dbPromise;
    
        let query = 'UPDATE users SET '
        const params = [];
        
        if(username !== undefined) {
            query += 'username = ?, ';
            params.push(username);
        }
        
        if(about !== undefined) {
            query += 'about = ?, ';
            params.push(about);
        }
        
        query = query.slice(0, -2) + ' WHERE id = ?'
        params.push(id);
        
        const result = await db.run(query, params);
        
        if(result.changes === 0) {
            return res.status(404).json({error: 'Пользователя с таким ID нет.'});
        }
        res.json({message: 'Профиль обновлён.'});
    } catch (error) {
        if (error.message.includes('UNIQUE constraint failed')) {
            return res.status(400).json({ error: 'Такое имя занято.' });
        }
        res.status(500).json({ error: 'Ошибка сервера.' });
    }
});

// DELETE /users/:id
router.delete('/:id', authenticateToken, permitAccess, async (req, res) => {
    const { id } = req.params;
    
    // Пользователя может удалить либо он себя сам, либо рут.
    if (req.user.id !== parseInt(id) && req.user.role !== 'root') {
        return res.status(403).json({ error: 'Нет прав доступа.' });
    }

    try {
        const db = await dbPromise;
        await db.run('DELETE FROM users WHERE id = ?', [id]);
        res.json({ message: 'Пользователь удалён.' });
    } catch (error) {
        res.status(500).json({ error: 'Ошибка сервера.' });
    }
});

router.put('/moderate/:id', authenticateToken, permitAccess, async (req, res) => {
	if(req.user.role !== 'moder' && req.user.role !== 'root') {
		return res.status(403).json({error: 'Доступ закрыт.'});
	}
	const { id }= req.params;
	const { status } = req.body;
	const db = await dbPromise;
	const targetUser = await db.get(
	    'SELECT role FROM users WHERE id = ?', [id]
	);
	if(!targetUser) { 
        return res.status(404).json({error: 'Пользователя с таким ID нет.'});
    }
	
	if(!status) return res.status(400).json({error: 'Поле статус пустое.'});
	
	if(targetUser.role === 'root' && req.user.role !== 'root') {
	    return res.status(403).json({error: 'Попытка была обречена.'});
	}
	
    if(targetUser.role === 'moder' && req.user.role !== 'root') {
	    return res.status(403).json({error: 'Нет прав доступа.'});
	}
	
	try {
		await db.run(
		    'UPDATE users SET status = ? WHERE id = ?', [status, id]
		);
		res.json({message: 'Данные обновлены.'});
	} catch (error) {
		res.status(500).json({error: 'Ошибка сервера.'});
	}
});

// Изменение роли пользователя доступно только для рут.
router.put('/setrole/:id', authenticateToken, async (req, res) => {
	if(req.user.role !== 'root') {
		return res.status(403).json({error: 'Доступ закрыт.'});
	}
	try {
		const { role } = req.body;
		const { id } = req.params;
		
		const allowedRoles = ['user', 'moder', 'root'];
		if(!role || !allowedRoles.includes(role)) {
	        return res.status(400).json({error: 'Некорректная роль.'});
		}
		
		const db = await dbPromise;
		const result = await db.run(
		    'UPDATE users SET role = ? WHERE id = ?', [role, id]
		);
		
		if(result.changes === 0) {
	        return res.status(404).json({error: 'Пользователя с таким ID нет.'});
		}
		res.json({message: `Роль пользователя изменена на ${role}`});
	} catch (error) {
		res.status(500).json({error: 'Ошибка сервера.'});
	}
});

module.exports = router;