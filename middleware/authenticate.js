const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
    throw new Error('JWT_SECRET не задан в .env файле!');
}

function authenticateToken(req, res, next) {
    // Заголовок Authorization имеет формат: "Bearer <token>"
    const authHeader = req.headers['authorization'];
    
    // Разделяем строку по пробелу и берём вторую часть (сам токен)
    // Если authHeader равен "Bearer abc123", то split(' ')[1] === "abc123"
    const token = authHeader && authHeader.split(' ')[1];

    // 401 Unauthorized — "ты не представился"
    if (!token) {
        return res.status(401).json({ error: 'Токен не предоставлен.' });
    }

    // jwt.verify проверяет подпись и срок действия.
    // Если всё ок — в user попадают данные из payload токена (id, username, role)
    jwt.verify(token, JWT_SECRET, (err, user) => {
        // 403 Forbidden — "ты представился, но пропуск недействителен"
        if (err) {
            return res.status(403).json({ error: 'Недействительный или просроченный токен.' });
        }
        
        // Кладём пользователя в req — теперь любой следующий обработчик
        // может обратиться к req.user.id, req.user.username и т.д.
        req.user = user;
        next();
    });
}

module.exports = authenticateToken;