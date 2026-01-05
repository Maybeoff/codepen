// Пример серверного API для codepen.fem-boy.ru
// Этот файл показывает структуру API, которую нужно реализовать на сервере

const express = require('express');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');

const app = express();
app.use(cors());
app.use(express.json());

// Хранилище проектов (в реальном проекте используйте базу данных)
const projects = new Map();

// API для создания нового проекта
app.post('/api/create', (req, res) => {
    try {
        const { html, css, js, library, projectName } = req.body;
        
        // Валидация данных
        if (!html && !css && !js) {
            return res.status(400).json({
                success: false,
                error: 'Проект не может быть пустым'
            });
        }
        
        // Генерируем уникальный ID
        const id = uuidv4().replace(/-/g, '').substring(0, 12);
        
        // Сохраняем проект
        const project = {
            id,
            html: html || '',
            css: css || '',
            js: js || '',
            library: library || '',
            projectName: projectName || 'Untitled Project',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        
        projects.set(id, project);
        
        res.json({
            success: true,
            id: id,
            url: `https://codepen.fem-boy.ru/${id}`
        });
        
    } catch (error) {
        console.error('Ошибка создания проекта:', error);
        res.status(500).json({
            success: false,
            error: 'Внутренняя ошибка сервера'
        });
    }
});

// API для получения проекта по ID
app.get('/:id', (req, res) => {
    try {
        const { id } = req.params;
        const project = projects.get(id);
        
        if (!project) {
            return res.status(404).send(`
                <!DOCTYPE html>
                <html>
                <head>
                    <title>Проект не найден</title>
                    <meta charset="UTF-8">
                    <style>
                        body { 
                            font-family: Arial, sans-serif; 
                            text-align: center; 
                            padding: 50px;
                            background: #f5f5f5;
                        }
                        .error { 
                            background: white; 
                            padding: 30px; 
                            border-radius: 10px; 
                            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
                            max-width: 400px;
                            margin: 0 auto;
                        }
                    </style>
                </head>
                <body>
                    <div class="error">
                        <h1>404</h1>
                        <p>Проект не найден</p>
                        <p>ID: ${id}</p>
                    </div>
                </body>
                </html>
            `);
        }
        
        // Генерируем HTML страницу с проектом
        let libTag = '';
        if (project.library) {
            if (project.library.includes('.css')) {
                libTag = `<link rel="stylesheet" href="${project.library}">`;
            } else {
                libTag = `<script src="${project.library}"></script>`;
            }
        }
        
        const html = `<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${project.projectName} - CodePen Pro</title>
    <meta name="description" content="Проект создан в CodePen Pro">
    <meta property="og:title" content="${project.projectName}">
    <meta property="og:description" content="Проект создан в CodePen Pro">
    <meta property="og:type" content="website">
    ${libTag}
    <style>${project.css}</style>
</head>
<body>
    ${project.html}
    <script>${project.js}</script>
    
    <!-- CodePen Pro Attribution -->
    <script>
        console.log('🚀 Создано в CodePen Pro');
        console.log('📅 Дата создания: ${project.createdAt}');
        console.log('🔗 Ссылка: https://codepen.fem-boy.ru/${project.id}');
    </script>
</body>
</html>`;
        
        res.send(html);
        
    } catch (error) {
        console.error('Ошибка получения проекта:', error);
        res.status(500).send('Внутренняя ошибка сервера');
    }
});

// API для получения информации о проекте (JSON)
app.get('/api/project/:id', (req, res) => {
    try {
        const { id } = req.params;
        const project = projects.get(id);
        
        if (!project) {
            return res.status(404).json({
                success: false,
                error: 'Проект не найден'
            });
        }
        
        res.json({
            success: true,
            project: {
                id: project.id,
                projectName: project.projectName,
                createdAt: project.createdAt,
                updatedAt: project.updatedAt,
                // Не отдаём код для безопасности
                hasHtml: !!project.html,
                hasCss: !!project.css,
                hasJs: !!project.js,
                hasLibrary: !!project.library
            }
        });
        
    } catch (error) {
        console.error('Ошибка получения информации о проекте:', error);
        res.status(500).json({
            success: false,
            error: 'Внутренняя ошибка сервера'
        });
    }
});

// API для обновления проекта (опционально)
app.put('/api/project/:id', (req, res) => {
    try {
        const { id } = req.params;
        const { html, css, js, library, projectName, secretKey } = req.body;
        
        const project = projects.get(id);
        
        if (!project) {
            return res.status(404).json({
                success: false,
                error: 'Проект не найден'
            });
        }
        
        // В реальном проекте здесь должна быть проверка secretKey
        
        // Обновляем проект
        const updatedProject = {
            ...project,
            html: html !== undefined ? html : project.html,
            css: css !== undefined ? css : project.css,
            js: js !== undefined ? js : project.js,
            library: library !== undefined ? library : project.library,
            projectName: projectName !== undefined ? projectName : project.projectName,
            updatedAt: new Date().toISOString()
        };
        
        projects.set(id, updatedProject);
        
        res.json({
            success: true,
            message: 'Проект обновлён'
        });
        
    } catch (error) {
        console.error('Ошибка обновления проекта:', error);
        res.status(500).json({
            success: false,
            error: 'Внутренняя ошибка сервера'
        });
    }
});

// Статистика (опционально)
app.get('/api/stats', (req, res) => {
    res.json({
        success: true,
        stats: {
            totalProjects: projects.size,
            serverUptime: process.uptime(),
            version: '1.0.0'
        }
    });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 CodePen Pro API запущен на порту ${PORT}`);
    console.log(`📡 Доступен по адресу: http://localhost:${PORT}`);
});

module.exports = app;