const express = require('express');
const router = express.Router();
const { dbPromise } = require('../db');


// GET /posts?thread_id=1&page=1&limit=10
router.get('/', async (req, res) => {
	const db = await dbPromise;
	
	const threadId = parseInt(req.query.thread_id) || 1;
	const page = parseInt(req.query.page) || 1;
	const limit = parseInt(req.query.limit) || 10;
	
    const offset = (page -1) * limit; 
	
	/*Делаем выборку постов. LIMIT в SQL запросе указывает какое
    максимальное количество записей база должна выдать, a
    OFFSET сколько элементов от начала пропустить.*/
	const posts = await db.all(
        'SELECT * FROM posts WHERE thread_id = ? ORDER BY created_at ASC LIMIT ? OFFSET ?',
        [threadId, limit, offset]
    );
    
    //Считаем общее количество постов
    const total = await db.get(
        'SELECT COUNT (*) as count FROM posts WHERE thread_id = ?',
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

// POST /posts
router.post('/', async (req, res) => {
	const db = await dbPromise;
	const threadId = parseInt(req.body.thread_id) || 1;
	
	const result = await db.run(
	    `INSERT INTO posts (author, text, thread_id, created_at, updated_at)
        VALUES (?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
	    [req.body.author, req.body.text, threadId]
	 );
	
	res.status(201).json({
		message: "Новый пост создан",
		id: result.lastID,
		author: req.body.author,
		text: req.body.text,
		thread_id: threadId
	});
});

//  PUT /posts/:id
router.put('/:id', async (req, res) => {
    const db = await dbPromise;
    const {id} = req.params; //берем id из url
    const {text} = req.body; //берем новые данные из тела запроса
    
    //проверяем нет ли пустых полей
    if(!text) {
    	return res.status(400).json({error: 'Поле текст обязательно'});
    }
    
    //Делаем Update
    const result = await db.run(
        'UPDATE posts SET text = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [text, id]
    );
    
    //result.changes показывает количество изменненых строк
    if(result.changes===0) {
    	return res.status(404).json({error: 'Пост с таким ID не найден'});
    }
    
    res.json({
        message: `Пост с ID ${id} изменен.`
    });

});

// DELETE /posts/:id
router.delete('/:id', async (req, res) => {
	const db = await dbPromise;
	const {id} = req.params;
	
	const result = await db.run(
	    'DELETE FROM posts WHERE id = ?', [id]
	);
	
	if(result.changes===0) {
		return res.status(404).json({error: 'Пост с таким ID не найден'});
    }
    
    res.json({message: `Пост с ID ${id} удален`});
});

module.exports = router;
