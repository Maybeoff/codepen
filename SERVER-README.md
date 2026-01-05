# 🚀 CodePen Pro Server API

Серверная часть для CodePen Pro, обеспечивающая создание и хранение Raw ссылок на домене `codepen.fem-boy.ru`.

## 📋 Возможности

- 🔗 **Создание Raw ссылок** - постоянные ссылки вида `codepen.fem-boy.ru/unique-id`
- 💾 **Хранение проектов** - безопасное хранение HTML/CSS/JS кода
- 🌐 **SEO-оптимизация** - метатеги для социальных сетей
- 📱 **Адаптивность** - поддержка всех устройств
- 🔒 **Безопасность** - валидация данных и защита от XSS

## 🛠️ Установка и запуск

### Требования
- Node.js >= 14.0.0
- npm или yarn

### Установка зависимостей
```bash
npm install
```

### Запуск в режиме разработки
```bash
npm run dev
```

### Запуск в продакшене
```bash
npm start
```

Сервер будет доступен по адресу `http://localhost:3000`

## 📡 API Endpoints

### POST /api/create
Создание нового проекта

**Запрос:**
```json
{
  "html": "<h1>Hello World</h1>",
  "css": "h1 { color: blue; }",
  "js": "console.log('Hello');",
  "library": "https://code.jquery.com/jquery-3.6.0.min.js",
  "projectName": "My Project"
}
```

**Ответ:**
```json
{
  "success": true,
  "id": "abc123def456",
  "url": "https://codepen.fem-boy.ru/abc123def456"
}
```

### GET /:id
Получение HTML страницы проекта

**Пример:** `GET /abc123def456`

Возвращает готовую HTML страницу с проектом.

### GET /api/project/:id
Получение метаданных проекта

**Ответ:**
```json
{
  "success": true,
  "project": {
    "id": "abc123def456",
    "projectName": "My Project",
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z",
    "hasHtml": true,
    "hasCss": true,
    "hasJs": true,
    "hasLibrary": true
  }
}
```

### PUT /api/project/:id
Обновление существующего проекта (опционально)

**Запрос:**
```json
{
  "html": "<h1>Updated</h1>",
  "css": "h1 { color: red; }",
  "js": "console.log('Updated');",
  "library": "",
  "projectName": "Updated Project",
  "secretKey": "secret-key-for-updates"
}
```

### GET /api/stats
Получение статистики сервера

**Ответ:**
```json
{
  "success": true,
  "stats": {
    "totalProjects": 1234,
    "serverUptime": 86400,
    "version": "1.0.0"
  }
}
```

## 🗄️ Структура данных

### Проект
```javascript
{
  id: String,           // Уникальный идентификатор
  html: String,         // HTML код
  css: String,          // CSS стили
  js: String,           // JavaScript код
  library: String,      // URL внешней библиотеки
  projectName: String,  // Название проекта
  createdAt: String,    // Дата создания (ISO)
  updatedAt: String     // Дата обновления (ISO)
}
```

## 🔒 Безопасность

### Валидация данных
- Проверка наличия контента (HTML, CSS или JS)
- Ограничение размера данных
- Санитизация входных данных

### Защита от атак
- CORS настройки
- Rate limiting (рекомендуется)
- Валидация Content-Type
- Защита от XSS в метатегах

### Рекомендации для продакшена
```javascript
// Добавьте rate limiting
const rateLimit = require('express-rate-limit');
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 минут
  max: 100 // максимум 100 запросов с одного IP
});
app.use('/api/', limiter);

// Добавьте helmet для безопасности
const helmet = require('helmet');
app.use(helmet());

// Добавьте логирование
const morgan = require('morgan');
app.use(morgan('combined'));
```

## 🗃️ База данных

В примере используется Map для хранения в памяти. Для продакшена рекомендуется:

### MongoDB
```javascript
const mongoose = require('mongoose');

const projectSchema = new mongoose.Schema({
  id: { type: String, unique: true, required: true },
  html: String,
  css: String,
  js: String,
  library: String,
  projectName: String,
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

const Project = mongoose.model('Project', projectSchema);
```

### PostgreSQL
```javascript
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

// Создание таблицы
const createTable = `
  CREATE TABLE IF NOT EXISTS projects (
    id VARCHAR(12) PRIMARY KEY,
    html TEXT,
    css TEXT,
    js TEXT,
    library TEXT,
    project_name VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );
`;
```

## 🚀 Деплой

### Heroku
```bash
# Создание приложения
heroku create codepen-pro-api

# Установка переменных окружения
heroku config:set NODE_ENV=production

# Деплой
git push heroku main
```

### Vercel
```json
// vercel.json
{
  "version": 2,
  "builds": [
    {
      "src": "server-api-example.js",
      "use": "@vercel/node"
    }
  ],
  "routes": [
    {
      "src": "/(.*)",
      "dest": "/server-api-example.js"
    }
  ]
}
```

### Docker
```dockerfile
FROM node:16-alpine

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

COPY . .

EXPOSE 3000
CMD ["npm", "start"]
```

## 📊 Мониторинг

### Логирование
```javascript
const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' })
  ]
});
```

### Метрики
- Количество созданных проектов
- Время ответа API
- Использование памяти
- Количество запросов в секунду

## 🔧 Настройка

### Переменные окружения
```bash
PORT=3000                    # Порт сервера
NODE_ENV=production         # Режим работы
DATABASE_URL=mongodb://...  # URL базы данных
CORS_ORIGIN=https://...     # Разрешённые домены для CORS
MAX_PROJECT_SIZE=1048576    # Максимальный размер проекта (1MB)
```

## 🧪 Тестирование

### Запуск тестов
```bash
npm test
```

### Пример теста
```javascript
const request = require('supertest');
const app = require('./server-api-example');

describe('POST /api/create', () => {
  it('should create a new project', async () => {
    const response = await request(app)
      .post('/api/create')
      .send({
        html: '<h1>Test</h1>',
        css: 'h1 { color: red; }',
        js: 'console.log("test");',
        projectName: 'Test Project'
      });
    
    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.id).toBeDefined();
  });
});
```

## 📈 Производительность

### Кэширование
```javascript
const NodeCache = require('node-cache');
const cache = new NodeCache({ stdTTL: 600 }); // 10 минут

// Кэширование проектов
app.get('/:id', (req, res) => {
  const cached = cache.get(req.params.id);
  if (cached) {
    return res.send(cached);
  }
  
  // Получение из базы данных...
  cache.set(req.params.id, html);
  res.send(html);
});
```

### Сжатие
```javascript
const compression = require('compression');
app.use(compression());
```

## 🆘 Поддержка

При возникновении проблем:
1. Проверьте логи сервера
2. Убедитесь в доступности базы данных
3. Проверьте переменные окружения
4. Создайте issue в репозитории

---

**CodePen Pro Server API** 🚀