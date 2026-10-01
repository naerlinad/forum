const fs = require('fs');
const path = require('path');

const logPath = path.join(__dirname, '..', 'server.log');

function logger(req, res, next) {
    const startDate = Date.now();
    
    //вешаем "слушетеля" события завершения ответа.
    res.on('finish', () => {
        const duration = Date.now() - startDate;
        
        const date = new Date().toLocaleString('ru-RU');
        
        //Код записан в одну строку, так как между `` сахраняються все пробелы и символы переноса строк.
        const logEntry = `[${date}] | IP: ${req.ip.padEnd(15)} | ${req.method.padEnd(6)} | ${req.path.padEnd(20)} | Статус: ${res.statusCode} | ${duration} ms\n`;
        
        try {
            fs.appendFileSync(logPath, logEntry);
        } catch (error) {
            console.log('Ошибка записи лог файла.', error);
        }
        
        //Вывод в консоль
        console.log(logEntry.trim());
        
    });
    
    next();
}

module.exports = logger;