const express = require('express');
const router = express.Router();
const { dbPromise } = require('../db');


// GET /posts
router.get('/', async (req, res) => {
	const db = await dbPromise;
	const posts = await db.all('SELECT * FROM posts');
	res.json(posts);
});

// POST /posts
router.post('/', async (req, res) => {
	const db = await dbPromise;
	const result = await db.run(
	    'INSERT INTO posts (author, text, created_at, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)',
	    [req.body.author, req.body.text]
	 );
	
	res.status(201).json({
		message: "Новый пост создан",
		id: result.lastID,
		author: req.body.author,
		text: req.body.text
	});
});

//  PUT /posts/:id
router.put('/:id', async (req, res) => {
    const db = await dbPromise;
    const {id} = req.params; //берем id из url
    const {text} = req.body; //берем новые данные из тела запроса
    
    //проверяем нет ли пустых полей
    if(!text) {
    	return res.status(400).json({error: 'Поле text обязательно'});
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
        message: `Пост с ID ${id} успешно изменен`
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
    
    res.json({message: `Пост с ID ${id} успешно удален`});
});

module.exports = router;
