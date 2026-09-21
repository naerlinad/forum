const express = require('express');
const router = express.Router();
const { dbPromise } = require('../db');

//GET /threads - получить список тем
router.get('/', async (req, res) => {
	const db = await dbPromise;
	const threads = await db.all('SELECT * FROM threads ORDER BY id ASC');
	res.json(threads);
});

//POST /threads - создать новую тему
router.post('/', async (req, res) => {
	const db = await dbPromise;
	const { name, description } = req.body;
	
	if(!name) {
		return res.status(400).json({error: 'Название темы обязательно.'});
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
		//Если тема с таким именем есть (UNIQUE constraint)
		if(error.message.includes('UNIQUE constraint failed')) {
			return res.status(400).json({error: 'Тема с таким именем уже существует.'});
		}
		return res.status(500).json({error: 'Ошибка сервера'});
	}
});

router.put('/:id', async (req, res) => {
	const db = await dbPromise;
	const {id} = req.params;
	const {description} = req.body;
	
	if(!description) {
		return res.status(400).json({error: 'Поле описание пустое'});
	}
	
	const result = await db.run(
	    'UPDATE threads SET description = ? WHERE id = ?',
	    [description, id]
	);
	
	if(result.changes===0) {
		return res.status(404).json({error: 'Тема с таким ID не найдена.'});
	}
	
	res.json({
		message: `Описание темы с ID ${id} изменено`
	});
});

router.delete('/:id', async (req, res) => {
	const db = await dbPromise;
	const {id} = req.params;
	
	await db.run(
	    'DELETE FROM posts WHERE thread_id = ?', [id]
	);
	
	const result = await db.run(
	    'DELETE FROM threads WHERE id = ?', [id]
	);
	
	if(result.changes===0) {
		return res.status(404).json({error: 'Тема с таким ID не найдена '});
	}
	
	res.json({message: `Тема с ID ${id} и все сообщения в ней удалены.`});
});

module.exports = router;