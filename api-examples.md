# API для работы с ссылками

## Доступные endpoints:

### 1. Создать ссылку с префиксом code
```
POST /api/code
Content-Type: application/json
```

**Пример запроса:**
```bash
curl -X POST https://click.fem-boy.ru/api/code \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com"}'
```

**Ответ при успехе:**
```json
{
  "success": true,
  "message": "Ссылка успешно создана",
  "code": "code/abc123",
  "id": "abc123",
  "url": "https://example.com",
  "shortLink": "/code/abc123",
  "secretKey": "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6"
}
```

**⚠️ ВАЖНО:** Сохраните `secretKey` - он потребуется для изменения ссылки!

**Ответ при ошибке:**
```json
{
  "error": "Конфликт кодов, попробуйте еще раз"
}
```

### 2. Получить информацию о ссылке code/id
```
GET /api/links/code/:id
```

**Пример запроса:**
```bash
curl https://click.fem-boy.ru/api/links/code/abc123
```

**Ответ:**
```json
{
  "code": "code/abc123",
  "url": "https://example.com",
  "created_at": "2024-01-01 12:00:00",
  "hasSecretKey": true,
  "canEdit": true
}
```

### 3. Заменить ссылку code/id (требует секретный ключ)
```
PUT /api/links/code/:id
Content-Type: application/json
```

**Пример запроса:**
```bash
curl -X PUT https://click.fem-boy.ru/api/links/code/abc123 \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://new-example.com",
    "secretKey": "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6"
  }'
```

**Ответ при успехе:**
```json
{
  "success": true,
  "message": "Ссылка успешно обновлена",
  "code": "code/abc123",
  "url": "https://new-example.com"
}
```

**Ответ при ошибке (неверный ключ):**
```json
{
  "error": "Неверный секретный ключ"
}
```

**Ответ при ошибке (ключ не предоставлен):**
```json
{
  "error": "Требуется секретный ключ для изменения этой ссылки"
}
```

### 4. Получить информацию об обычной ссылке (только чтение)
```
GET /api/links/:code
```

**Пример запроса:**
```bash
curl https://click.fem-boy.ru/api/links/xyz789
```

**Ответ:**
```json
{
  "code": "xyz789",
  "url": "https://example.com",
  "created_at": "2024-01-01 12:00:00",
  "hasSecretKey": false,
  "canEdit": false
}
```

## Примеры использования в JavaScript:

### Создать ссылку с префиксом code:
```javascript
const response = await fetch('/api/code', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    url: 'https://example.com'
  })
});

const result = await response.json();
console.log('ID:', result.id);
console.log('Секретный ключ:', result.secretKey);
// ВАЖНО: Сохраните secretKey для будущих изменений!
// Ссылка будет доступна по адресу: /code/{result.id}
```

### Получить информацию о ссылке:
```javascript
// Для code ссылки
const response1 = await fetch('/api/links/code/abc123');
const data1 = await response1.json();
console.log('Можно редактировать:', data1.canEdit);

// Для обычной ссылки
const response2 = await fetch('/api/links/xyz789');
const data2 = await response2.json();
console.log('Можно редактировать:', data2.canEdit); // false
```

### Заменить ссылку code/id (с секретным ключом):
```javascript
const response = await fetch('/api/links/code/abc123', {
  method: 'PUT',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    url: 'https://new-example.com',
    secretKey: 'your-secret-key-here'
  })
});

const result = await response.json();
console.log(result);
```

## Система безопасности:

- **Секретный ключ**: При создании ссылки через API генерируется уникальный 64-символьный секретный ключ
- **Авторизация**: Для изменения ссылки, созданной через API, требуется предоставить правильный секретный ключ
- **Защита ключа**: Секретный ключ не возвращается в публичных запросах информации о ссылке
- **Ограничения**: Обычные ссылки (созданные через веб-интерфейс) НЕЛЬЗЯ изменять через API

## Ограничения API:

- **Создание**: Через API можно создавать только ссылки с префиксом `code/`
- **Изменение**: Через API можно изменять только ссылки, созданные через API (с секретным ключом)
- **Обычные ссылки**: Можно только просматривать информацию, изменение недоступно

## Особенности:

- **Автогенерация ID**: ID генерируется автоматически при создании ссылки через API
- **Уникальность**: Каждый ID гарантированно уникален
- **Формат ссылки**: Созданные ссылки имеют формат `/code/auto-generated-id`
- **Безопасность**: Ссылки, созданные через API, защищены секретным ключом