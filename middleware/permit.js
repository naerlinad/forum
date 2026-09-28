const { dbPromise } = require('../db');

async function permitAccess(req, res, next) {
    const db = await dbPromise;
    
    const data = await db.get(
        'SELECT status FROM users WHERE id = ?',
        [req.user.id]
    );
    
    // Проверка на существование записи
    if (!data) {
        return res.status(403).json({ error: 'Пользователь не найден.' });
    }
    
    if (data.status === 'banned') {
        return res.status(403).json({ error: 'Аккаунт в бане.' });
    }
    
    next();
}

module.exports = permitAccess;