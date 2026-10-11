const fs = require('fs/promises'); // используем промисифицированную версию
const path = require('path');

const logPath = path.join(__dirname, '..', 'requests.log');

function logger(req, res, next) { // async здесь не нужен, так как мы не ждем ничего до next()
    const startDate = Date.now();
    
    // Делаем сам колбэк async, чтобы внутри работал await
    res.on('finish', async () => { 
        const duration = Date.now() - startDate;
        const date = new Date().toLocaleString('ru-RU');
        
        // Если req.ip вдруг окажется undefined, будет строка 'unknown'
        const ip = String(req.ip || 'unknown'); 
        
        const logEntry = `[${date}] | IP: ${ip.padEnd(15)} | ${req.method.padEnd(6)} | ${req.path.padEnd(20)} | Статус: ${res.statusCode} | ${duration} ms\n`;
        
        try {
            // Теперь это настоящий Promise, try...catch перехватит ошибку записи
            await fs.appendFile(logPath, logEntry);
        } catch (error) {
            console.error('Ошибка записи лог файла:', error);
        }
        
        // Вывод в консоль
        console.log(logEntry.trim());
    });
    
    next(); // Продолжаем обработку запроса немедленно, не дожидаясь записи лога
}

module.exports = logger;