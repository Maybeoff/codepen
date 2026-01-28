// server.js — CodePen Pro с SQLite и всеми улучшениями
const express = require('express');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const sqlite3 = require('sqlite3').verbose();
const rateLimit = require('express-rate-limit');
const morgan = require('morgan');
const fs = require('fs');
const path = require('path');
const archiver = require('archiver');
const cron = require('node-cron');

const app = express();

// Middleware
app.use(cors());
app.use(express.json({ limit: '2mb' }));

// Логирование
const accessLogStream = fs.createWriteStream(path.join(__dirname, 'access.log'), { flags: 'a' });
app.use(morgan('combined', { stream: accessLogStream }));
app.use(morgan('dev')); // Консольное логирование

// Rate Limiting
const createLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 минут
    max: 50, // максимум 50 запросов
    message: { success: false, error: 'Слишком много запросов, попробуйте позже' }
});

const updateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 30,
    message: { success: false, error: 'Слишком много обновлений, попробуйте позже' }
});

// Подключение к SQLite
const db = new sqlite3.Database('./database.db', (err) => {
    if (err) console.error('Ошибка SQLite:', err);
    else console.log('🚀 Подключено к SQLite (database.db)');
});

// Создаём таблицу с дополнительными полями
db.run(`CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    html TEXT DEFAULT '',
    css TEXT DEFAULT '',
    js TEXT DEFAULT '',
    library TEXT DEFAULT '',
    projectName TEXT DEFAULT 'Untitled Project',
    tags TEXT DEFAULT '',
    views INTEGER DEFAULT 0,
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL
)`);

// Создаём папку для бэкапов
if (!fs.existsSync('./backups')) {
    fs.mkdirSync('./backups');
}

// Константы
const MAX_SIZE = 1024 * 1024; // 1MB
const MAX_PROJECT_NAME_LENGTH = 100;

// Валидация данных
function validateProject(data) {
    const { html, css, js, projectName } = data;
    
    if (!html && !css && !js) {
        return { valid: false, error: 'Проект не может быть пустым' };
    }
    
    const totalSize = (html?.length || 0) + (css?.length || 0) + (js?.length || 0);
    if (totalSize > MAX_SIZE) {
        return { valid: false, error: 'Проект слишком большой (макс 1MB)' };
    }
    
    if (projectName && projectName.length > MAX_PROJECT_NAME_LENGTH) {
        return { valid: false, error: 'Название проекта слишком длинное (макс 100 символов)' };
    }
    
    return { valid: true };
}

// 1. Создание проекта
app.post('/api/create', createLimiter, (req, res) => {
    try {
        const { html, css, js, library, projectName, tags } = req.body;
        
        // Валидация
        const validation = validateProject({ html, css, js, projectName });
        if (!validation.valid) {
            return res.status(400).json({ success: false, error: validation.error });
        }
        
        const id = uuidv4().replace(/-/g, '').substring(0, 12);
        const now = new Date().toISOString();
        
        db.run(
            `INSERT INTO projects (id, html, css, js, library, projectName, tags, createdAt, updatedAt)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                id,
                html || '',
                css || '',
                js || '',
                library || '',
                projectName || 'Untitled Project',
                tags || '',
                now,
                now
            ],
            function(err) {
                if (err) {
                    console.error('Ошибка создания проекта:', err);
                    return res.status(500).json({ success: false, error: 'Ошибка сохранения' });
                }
                
                console.log(`✅ Создан проект: ${id} - ${projectName || 'Untitled'}`);
                res.json({
                    success: true,
                    id: id,
                    url: `https://codepen.fem-boy.ru/${id}`
                });
            }
        );
    } catch (error) {
        console.error('Ошибка в /api/create:', error);
        res.status(500).json({ success: false, error: 'Внутренняя ошибка сервера' });
    }
});

// 2. Получение информации о проекте (JSON)
app.get('/api/project/:id', (req, res) => {
    try {
        const { id } = req.params;
        
        db.get(`SELECT * FROM projects WHERE id = ?`, [id], (err, project) => {
            if (err || !project) {
                return res.status(404).json({ success: false, error: 'Проект не найден' });
            }
            
            res.json({
                success: true,
                project: {
                    id: project.id,
                    projectName: project.projectName,
                    tags: project.tags,
                    views: project.views,
                    createdAt: project.createdAt,
                    updatedAt: project.updatedAt,
                    hasHtml: !!project.html,
                    hasCss: !!project.css,
                    hasJs: !!project.js,
                    hasLibrary: !!project.library
                }
            });
        });
    } catch (error) {
        console.error('Ошибка в /api/project/:id:', error);
        res.status(500).json({ success: false, error: 'Внутренняя ошибка сервера' });
    }
});

// 3. Обновление проекта
app.put('/api/project/:id', updateLimiter, (req, res) => {
    try {
        const { id } = req.params;
        const { html, css, js, library, projectName, tags } = req.body;
        
        // Валидация
        const validation = validateProject({ html, css, js, projectName });
        if (!validation.valid) {
            return res.status(400).json({ success: false, error: validation.error });
        }
        
        db.get(`SELECT * FROM projects WHERE id = ?`, [id], (err, project) => {
            if (err || !project) {
                return res.status(404).json({ success: false, error: 'Проект не найден' });
            }
            
            const updates = [];
            const values = [];
            
            if (html !== undefined) { updates.push('html = ?'); values.push(html); }
            if (css !== undefined) { updates.push('css = ?'); values.push(css); }
            if (js !== undefined) { updates.push('js = ?'); values.push(js); }
            if (library !== undefined) { updates.push('library = ?'); values.push(library); }
            if (projectName !== undefined) { updates.push('projectName = ?'); values.push(projectName); }
            if (tags !== undefined) { updates.push('tags = ?'); values.push(tags); }
            
            updates.push('updatedAt = ?');
            values.push(new Date().toISOString());
            values.push(id);
            
            const sql = `UPDATE projects SET ${updates.join(', ')} WHERE id = ?`;
            
            db.run(sql, values, function(err) {
                if (err) {
                    console.error('Ошибка обновления:', err);
                    return res.status(500).json({ success: false, error: 'Ошибка обновления' });
                }
                
                console.log(`🔄 Обновлён проект: ${id}`);
                res.json({ success: true, message: 'Проект обновлён' });
            });
        });
    } catch (error) {
        console.error('Ошибка в /api/project/:id PUT:', error);
        res.status(500).json({ success: false, error: 'Внутренняя ошибка сервера' });
    }
});

// 4. Удаление проекта
app.delete('/api/project/:id', (req, res) => {
    try {
        const { id } = req.params;
        
        db.run(`DELETE FROM projects WHERE id = ?`, [id], function(err) {
            if (err) {
                console.error('Ошибка удаления:', err);
                return res.status(500).json({ success: false, error: 'Ошибка удаления' });
            }
            
            if (this.changes === 0) {
                return res.status(404).json({ success: false, error: 'Проект не найден' });
            }
            
            console.log(`🗑️ Удалён проект: ${id}`);
            res.json({ success: true, message: 'Проект удалён' });
        });
    } catch (error) {
        console.error('Ошибка в /api/project/:id DELETE:', error);
        res.status(500).json({ success: false, error: 'Внутренняя ошибка сервера' });
    }
});

// 5. Поиск проектов
app.get('/api/search', (req, res) => {
    try {
        const { query, tag } = req.query;
        let sql = 'SELECT id, projectName, tags, views, createdAt FROM projects WHERE 1=1';
        const params = [];
        
        if (query) {
            sql += ' AND projectName LIKE ?';
            params.push(`%${query}%`);
        }
        
        if (tag) {
            sql += ' AND tags LIKE ?';
            params.push(`%${tag}%`);
        }
        
        sql += ' ORDER BY createdAt DESC LIMIT 20';
        
        db.all(sql, params, (err, projects) => {
            if (err) {
                console.error('Ошибка поиска:', err);
                return res.status(500).json({ success: false, error: 'Ошибка поиска' });
            }
            
            res.json({ success: true, projects });
        });
    } catch (error) {
        console.error('Ошибка в /api/search:', error);
        res.status(500).json({ success: false, error: 'Внутренняя ошибка сервера' });
    }
});

// 6. Экспорт проекта в ZIP
app.get('/api/export/:id', (req, res) => {
    try {
        const { id } = req.params;
        
        db.get(`SELECT * FROM projects WHERE id = ?`, [id], (err, project) => {
            if (err || !project) {
                return res.status(404).json({ success: false, error: 'Проект не найден' });
            }
            
            const archive = archiver('zip', { zlib: { level: 9 } });
            
            res.attachment(`${project.projectName || 'project'}.zip`);
            archive.pipe(res);
            
            // Создаём полный HTML файл
            let libTag = '';
            if (project.library) {
                if (project.library.includes('.css')) {
                    libTag = `<link rel="stylesheet" href="${project.library}">`;
                } else {
                    libTag = `<script src="${project.library}"></script>`;
                }
            }
            
            const fullHtml = `<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${project.projectName}</title>
    ${libTag}
    <link rel="stylesheet" href="style.css">
</head>
<body>
    ${project.html}
    <script src="script.js"></script>
</body>
</html>`;
            
            archive.append(fullHtml, { name: 'index.html' });
            archive.append(project.css, { name: 'style.css' });
            archive.append(project.js, { name: 'script.js' });
            archive.append(`# ${project.projectName}\n\nСоздано в CodePen Pro\nID: ${project.id}\nURL: https://codepen.fem-boy.ru/${project.id}`, { name: 'README.md' });
            
            archive.finalize();
            
            console.log(`📦 Экспорт проекта: ${id}`);
        });
    } catch (error) {
        console.error('Ошибка в /api/export/:id:', error);
        res.status(500).send('Ошибка экспорта');
    }
});

// 7. Статистика
app.get('/api/stats', (req, res) => {
    try {
        db.get(`SELECT COUNT(*) as total, SUM(views) as totalViews FROM projects`, (err, row) => {
            if (err) {
                console.error('Ошибка статистики:', err);
                return res.status(500).json({ success: false, error: 'Ошибка' });
            }
            
            res.json({
                success: true,
                stats: {
                    totalProjects: row.total || 0,
                    totalViews: row.totalViews || 0,
                    serverUptime: Math.floor(process.uptime()),
                    version: '2.0.0'
                }
            });
        });
    } catch (error) {
        console.error('Ошибка в /api/stats:', error);
        res.status(500).json({ success: false, error: 'Внутренняя ошибка сервера' });
    }
});

// 8. Backup базы данных (защищённый endpoint)
app.get('/api/admin/backup', (req, res) => {
    try {
        const backupPath = path.join(__dirname, 'backups', `database-${Date.now()}.db`);
        fs.copyFileSync('./database.db', backupPath);
        
        console.log(`💾 Создан бэкап: ${backupPath}`);
        res.json({ success: true, backup: path.basename(backupPath) });
    } catch (error) {
        console.error('Ошибка бэкапа:', error);
        res.status(500).json({ success: false, error: 'Ошибка создания бэкапа' });
    }
});

// 9. Просмотр проекта (HTML страница) - ПОСЛЕДНИЙ РОУТ!
app.get('/:id', (req, res) => {
    try {
        const { id } = req.params;
        
        // Защита: если ID не 12 символов — не обрабатываем
        if (!/^[a-zA-Z0-9]{12}$/.test(id)) {
            return res.status(404).send('Not found');
        }
        
        db.get(`SELECT * FROM projects WHERE id = ?`, [id], (err, project) => {
            if (err || !project) {
                return res.status(404).send(`<!DOCTYPE html>
<html>
<head>
    <title>Проект не найден</title>
    <meta charset="UTF-8">
    <style>
        body{font-family:Arial;text-align:center;padding:50px;background:#f5f5f5;}
        .error{background:white;padding:30px;border-radius:10px;box-shadow:0 2px 10px rgba(0,0,0,0.1);max-width:400px;margin:auto;}
    </style>
</head>
<body>
    <div class="error">
        <h1>404</h1>
        <p>Проект не найден</p>
        <p>ID: ${id}</p>
    </div>
</body>
</html>`);
            }
            
            // Увеличиваем счётчик просмотров
            db.run(`UPDATE projects SET views = views + 1 WHERE id = ?`, [id]);
            
            let libTag = '';
            if (project.library) {
                if (project.library.includes('.css')) {
                    libTag = `<link rel="stylesheet" href="${project.library}">`;
                } else {
                    libTag = `<script src="${project.library}"></script>`;
                }
            }
            
            const htmlPage = `<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${project.projectName} - CodePen Pro</title>
    <meta name="description" content="Проект создан в CodePen Pro">
    <meta property="og:title" content="${project.projectName}">
    <meta property="og:description" content="Проект создан в CodePen Pro">
    ${libTag}
    <style>${project.css}</style>
</head>
<body>
    ${project.html}
    <script>${project.js}</script>
    <script>
        console.log('🚀 Создано в CodePen Pro');
        console.log('📊 Просмотров: ${project.views + 1}');
        console.log('🔗 https://codepen.fem-boy.ru/${project.id}');
    </script>
</body>
</html>`;
            
            res.send(htmlPage);
        });
    } catch (error) {
        console.error('Ошибка в /:id:', error);
        res.status(500).send('Внутренняя ошибка сервера');
    }
});

// Автоочистка старых проектов (каждый день в 3:00)
cron.schedule('0 3 * * *', () => {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    
    db.run(`DELETE FROM projects WHERE createdAt < ? AND views < 10`, [thirtyDaysAgo], function(err) {
        if (err) {
            console.error('Ошибка автоочистки:', err);
        } else {
            console.log(`🗑️ Автоочистка: удалено ${this.changes} старых проектов`);
        }
    });
});

// Автоматический бэкап (каждый день в 4:00)
cron.schedule('0 4 * * *', () => {
    try {
        const backupPath = path.join(__dirname, 'backups', `auto-backup-${Date.now()}.db`);
        fs.copyFileSync('./database.db', backupPath);
        console.log(`💾 Автобэкап создан: ${path.basename(backupPath)}`);
        
        // Удаляем старые бэкапы (старше 7 дней)
        const backupFiles = fs.readdirSync('./backups');
        const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
        
        backupFiles.forEach(file => {
            const filePath = path.join(__dirname, 'backups', file);
            const stats = fs.statSync(filePath);
            if (stats.mtimeMs < sevenDaysAgo) {
                fs.unlinkSync(filePath);
                console.log(`🗑️ Удалён старый бэкап: ${file}`);
            }
        });
    } catch (error) {
        console.error('Ошибка автобэкапа:', error);
    }
});

const PORT = process.env.PORT || 3061;
app.listen(PORT, () => {
    console.log(`🚀 CodePen Pro Server v2.0.0`);
    console.log(`📡 Сервер запущен на порту ${PORT}`);
    console.log(`💾 База данных: database.db`);
    console.log(`📊 Логи: access.log`);
    console.log(`💾 Бэкапы: ./backups/`);
    console.log(`⏰ Автоочистка: каждый день в 3:00`);
    console.log(`💾 Автобэкап: каждый день в 4:00`);
});

module.exports = app;
