# 🚀 CodePen Pro Server v2.0.0

Полнофункциональный сервер для CodePen Pro с SQLite, rate limiting, автоочисткой и бэкапами.

## ✨ Возможности

### 🔒 Безопасность
- **Rate Limiting** - защита от спама (50 запросов/15 мин)
- **Валидация данных** - проверка размера и корректности
- **Логирование** - все запросы записываются в access.log

### 💾 Управление проектами
- **Создание** - POST /api/create
- **Обновление** - PUT /api/project/:id
- **Удаление** - DELETE /api/project/:id
- **Просмотр** - GET /:id (HTML) или GET /api/project/:id (JSON)
- **Поиск** - GET /api/search?query=название&tag=тег
- **Экспорт в ZIP** - GET /api/export/:id

### 📊 Дополнительно
- **Счётчик просмотров** - автоматически увеличивается
- **Теги** - категоризация проектов
- **Статистика** - GET /api/stats
- **Автоочистка** - удаление старых проектов (30+ дней, <10 просмотров)
- **Автобэкап** - ежедневное резервное копирование БД

## 🛠️ Установка

```bash
cd server
npm install
```

## 🚀 Запуск

### Продакшн
```bash
npm start
```

### Разработка (с автоперезагрузкой)
```bash
npm run dev
```

## 📡 API Endpoints

### Создание проекта
```http
POST /api/create
Content-Type: application/json

{
  "html": "<h1>Hello</h1>",
  "css": "h1 { color: blue; }",
  "js": "console.log('Hi');",
  "library": "https://code.jquery.com/jquery-3.6.0.min.js",
  "projectName": "My Project",
  "tags": "demo,test"
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

### Обновление проекта
```http
PUT /api/project/:id
Content-Type: application/json

{
  "html": "<h1>Updated</h1>",
  "css": "h1 { color: red; }",
  "projectName": "Updated Project"
}
```

### Удаление проекта
```http
DELETE /api/project/:id
```

### Поиск проектов
```http
GET /api/search?query=название
GET /api/search?tag=demo
GET /api/search?query=test&tag=demo
```

### Экспорт в ZIP
```http
GET /api/export/:id
```

### Статистика
```http
GET /api/stats
```

**Ответ:**
```json
{
  "success": true,
  "stats": {
    "totalProjects": 1234,
    "totalViews": 5678,
    "serverUptime": 86400,
    "version": "2.0.0"
  }
}
```

### Просмотр проекта
```http
GET /:id
```
Возвращает готовую HTML страницу.

## 🗄️ База данных

SQLite база `database.db` с таблицей:

```sql
CREATE TABLE projects (
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
)
```

## ⏰ Автоматические задачи

### Автоочистка (3:00 каждый день)
- Удаляет проекты старше 30 дней с менее чем 10 просмотрами
- Освобождает место в базе данных

### Автобэкап (4:00 каждый день)
- Создаёт резервную копию базы данных
- Удаляет бэкапы старше 7 дней
- Сохраняет в папку `./backups/`

## 📊 Логирование

Все запросы логируются в `access.log` в формате:
```
127.0.0.1 - - [28/Jan/2026:12:00:00 +0000] "POST /api/create HTTP/1.1" 200 123
```

## 🔒 Ограничения

- **Размер проекта**: максимум 1MB (HTML + CSS + JS)
- **Название проекта**: максимум 100 символов
- **Rate limit создания**: 50 запросов / 15 минут
- **Rate limit обновления**: 30 запросов / 15 минут

## 💾 Бэкапы

### Ручной бэкап
```http
GET /api/admin/backup
```

### Автоматические бэкапы
- Создаются каждый день в 4:00
- Хранятся 7 дней
- Находятся в папке `./backups/`

## 🐛 Отладка

### Просмотр логов
```bash
tail -f access.log
```

### Проверка базы данных
```bash
sqlite3 database.db "SELECT COUNT(*) FROM projects;"
```

### Просмотр бэкапов
```bash
ls -lh backups/
```

## 🚀 Деплой

### PM2 (рекомендуется)
```bash
npm install -g pm2
pm2 start server.js --name codepen-server
pm2 save
pm2 startup
```

### Systemd
Создайте файл `/etc/systemd/system/codepen.service`:
```ini
[Unit]
Description=CodePen Pro Server
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/root/codepen/server
ExecStart=/usr/bin/node server.js
Restart=always

[Install]
WantedBy=multi-user.target
```

Затем:
```bash
systemctl enable codepen
systemctl start codepen
```

## 📈 Мониторинг

### Статистика сервера
```bash
curl http://localhost:3061/api/stats
```

### Проверка здоровья
```bash
curl http://localhost:3061/api/stats | jq '.stats.serverUptime'
```

## 🆘 Поддержка

При возникновении проблем:
1. Проверьте логи: `tail -f access.log`
2. Проверьте базу данных: `ls -lh database.db`
3. Проверьте процесс: `ps aux | grep node`
4. Перезапустите сервер: `pm2 restart codepen-server`

---

**CodePen Pro Server v2.0.0** 🚀
