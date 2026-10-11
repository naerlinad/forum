const rateLimit = require('express-rate-limit');

/* 
  600 запросов/минуту хватит с головой для одного человека на одном IP, 
  либо это будет 6 запросов/мин для каждого из условных 100 человек за NAT, 
  что будет не комфортно, но все же не критически. 
  Главное, лимит достаточно защитит от прикладных атак и агрессивных ботов.
*/
const frontlineLimiter = rateLimit({
    windowMs: 60000, // одна минута
    max: 600,
    message: { error: 'Слишком много запросов с вашего IP-адреса. Попробуйте через минуту.' },
    standardHeaders: true,
    legacyHeaders: false
});

/* 
  990 запросов / с. Это значение очень близкое к потолку общего числа всех запросов, 
  что текущий сервер способен обработать за одну секунду. 
  Данный лимитер защитит систему от краша.
*/
const burstLimiter = rateLimit({
    windowMs: 1000, // одна секунда
    max: 990,
    message: {
        // ИСПРАВЛЕНО: используем обратные кавычки (`) для многострочного текста
        error: `Здравствуйте! Вы 990-первый посетитель на эту секунду! Это круто! 
Но приношу искренние извинения за то, что не могу обработать ваш запрос прямо сейчас. 
Я всего лишь скромный одноядерный сервер с малыми вычислительными возможностями для учебных проектов, 
и на данный момент нахожусь под большой нагрузкой. Пожалуйста, попробуйте обратиться ко мне позже.`       
    },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: () => 'global'
});

// Регистрация.  для подбора уникального username)
const registrationLimiter = rateLimit({
    windowMs: 60000,
    max: 30,
    message: { error: 'Слишком много попыток регистрации. Попробуйте через минуту.' },
    standardHeaders: true,
    legacyHeaders: false
});

// Минимальная защита от brute force
const loginLimiter = rateLimit({
    windowMs: 12 * 60000,
    max: 6,
    message: { error: 'Слишком много попыток входа. Попробуйте через 12 минут.' },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => req.body.username
});

module.exports = {
    frontlineLimiter,
    burstLimiter,
    registrationLimiter,
    loginLimiter
};
