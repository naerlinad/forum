const rateLimit = require('express-rate-limit');

const globalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: 'Превышен лимит запросов. Повторите позже.',
    standardHeaders: true
});

const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    message: 'Превышен лимит запросов. Повторите позже.',
    standardHeaders: true
});

module.exports = { globalLimiter, authLimiter };