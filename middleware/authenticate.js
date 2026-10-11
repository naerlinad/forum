const jwt = require('jsonwebtoken');
const { dbPromise } = require('../db');

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
    throw new Error('JWT_SECRET не задан в .env файле!');
}

function authenticateToken(req, res, next) {
    
    // Заголовок Authorization имеет формат: "Bearer <token>"
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.startsWith('Bearer ') 
        ? authHeader.substring(7) 
        : null;

    if (!token) {
        return res.status(401).json({ error: 'Токен не предоставлен.' });
    }

    jwt.verify(token, JWT_SECRET, async (err, decodedPayload) => {
        try{
            if (err) {
                return res.status(403).json({ error: 'Недействительный или просроченный токен.' });
            }
            
            const db = await dbPromise;
            const user = await db.get(`
                SELECT id, username, role, suspended FROM users
                WHERE id = ?`, [decodedPayload.id]
            );
            if(!user) {
                return res.status(403).json({error:'Пользователь не найден.'});
            }
            if(user.suspended === 1) {
                return res.status(403).json({error: 'Аккаунт ограничен.'});
            }
         
            req.user = user;
            next();
        } catch (error) {
            console.error('Ошибка аутентификатора.', error);
            res.status(500).json({error: ' Ошибка сервера.'});
        }
    });
}

module.exports = authenticateToken;
