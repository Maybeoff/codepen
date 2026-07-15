import { Hono } from 'hono';
import { cors } from 'hono/cors';

type Bindings = {
  DB: D1Database;
  FILES: KVNamespace;
  ENVIRONMENT: string;
  JWT_SECRET: string;
};

const app = new Hono<{ Bindings: Bindings }>();

app.use('/*', cors());

const MAX_SIZE = 1024 * 1024;
const MAX_PROJECT_NAME_LENGTH = 100;

async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + 'codepen_pro_salt_v1');
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function verifyPassword(password: string, hash: string): Promise<boolean> {
  const passwordHash = await hashPassword(password);
  return passwordHash === hash;
}

function generateToken(userId: number, secret: string): string {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = btoa(JSON.stringify({ userId, exp: Date.now() + 30 * 24 * 60 * 60 * 1000 }));
  const data = `${header}.${payload}`;
  const encoder = new TextEncoder();
  return `${data}`;
}

function verifyToken(token: string): { userId: number } | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 2) return null;
    const payload = JSON.parse(atob(parts[1]));
    if (payload.exp < Date.now()) return null;
    return { userId: payload.userId };
  } catch {
    return null;
  }
}

async function getUser(c: any): Promise<{ userId: number } | null> {
  const auth = c.req.header('Authorization');
  if (!auth || !auth.startsWith('Bearer ')) return null;
  return verifyToken(auth.slice(7));
}

function generateId(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let id = '';
  for (let i = 0; i < 12; i++) {
    id += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return id;
}

function validateProject(data: { html?: string; css?: string; js?: string; projectName?: string }) {
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

// ==================== AUTH ====================

// Регистрация
app.post('/api/auth/register', async (c) => {
  try {
    const { username, email, password } = await c.req.json();

    if (!username || !email || !password) {
      return c.json({ success: false, error: 'Заполните все поля' }, 400);
    }

    if (username.length < 3 || username.length > 30) {
      return c.json({ success: false, error: 'Логин: 3-30 символов' }, 400);
    }

    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      return c.json({ success: false, error: 'Логин: только латиница, цифры и _' }, 400);
    }

    if (!email.includes('@') || email.length > 100) {
      return c.json({ success: false, error: 'Некорректный email' }, 400);
    }

    if (password.length < 6) {
      return c.json({ success: false, error: 'Пароль: минимум 6 символов' }, 400);
    }

    const existing = await c.env.DB.prepare(
      `SELECT id FROM users WHERE username = ? OR email = ?`
    ).bind(username, email).first();

    if (existing) {
      return c.json({ success: false, error: 'Логин или email уже заняты' }, 400);
    }

    const passwordHash = await hashPassword(password);
    const now = new Date().toISOString();

    const result = await c.env.DB.prepare(
      `INSERT INTO users (username, email, password_hash, created_at) VALUES (?, ?, ?, ?)`
    ).bind(username, email, passwordHash, now).run();

    const userId = result.meta.last_row_id;
    const token = generateToken(userId as number, c.env.JWT_SECRET);

    return c.json({
      success: true,
      token,
      user: { id: userId, username, email }
    });
  } catch (error) {
    console.error('Ошибка регистрации:', error);
    return c.json({ success: false, error: 'Внутренняя ошибка сервера' }, 500);
  }
});

// Вход
app.post('/api/auth/login', async (c) => {
  try {
    const { login, password } = await c.req.json();

    if (!login || !password) {
      return c.json({ success: false, error: 'Заполните все поля' }, 400);
    }

    const user = await c.env.DB.prepare(
      `SELECT * FROM users WHERE username = ? OR email = ?`
    ).bind(login, login).first();

    if (!user) {
      return c.json({ success: false, error: 'Неверный логин/email или пароль' }, 400);
    }

    const valid = await verifyPassword(password, user.password_hash as string);
    if (!valid) {
      return c.json({ success: false, error: 'Неверный логин/email или пароль' }, 400);
    }

    const token = generateToken(user.id as number, c.env.JWT_SECRET);

    return c.json({
      success: true,
      token,
      user: { id: user.id, username: user.username, email: user.email }
    });
  } catch (error) {
    console.error('Ошибка входа:', error);
    return c.json({ success: false, error: 'Внутренняя ошибка сервера' }, 500);
  }
});

// Текущий пользователь
app.get('/api/auth/me', async (c) => {
  const authUser = await getUser(c);
  if (!authUser) {
    return c.json({ success: false, error: 'Не авторизован' }, 401);
  }

  const user = await c.env.DB.prepare(
    `SELECT id, username, email, created_at FROM users WHERE id = ?`
  ).bind(authUser.userId).first();

  if (!user) {
    return c.json({ success: false, error: 'Пользователь не найден' }, 404);
  }

  return c.json({ success: true, user });
});

// Смена пароля
app.put('/api/auth/password', async (c) => {
  const authUser = await getUser(c);
  if (!authUser) {
    return c.json({ success: false, error: 'Не авторизован' }, 401);
  }

  const { currentPassword, newPassword } = await c.req.json();

  if (!currentPassword || !newPassword) {
    return c.json({ success: false, error: 'Заполните оба поля' }, 400);
  }

  if (newPassword.length < 6) {
    return c.json({ success: false, error: 'Новый пароль: минимум 6 символов' }, 400);
  }

  const user = await c.env.DB.prepare(
    `SELECT password_hash FROM users WHERE id = ?`
  ).bind(authUser.userId).first();

  if (!user) {
    return c.json({ success: false, error: 'Пользователь не найден' }, 404);
  }

  const valid = await verifyPassword(currentPassword, user.password_hash as string);
  if (!valid) {
    return c.json({ success: false, error: 'Неверный текущий пароль' }, 400);
  }

  const newHash = await hashPassword(newPassword);
  await c.env.DB.prepare(
    `UPDATE users SET password_hash = ? WHERE id = ?`
  ).bind(newHash, authUser.userId).run();

  return c.json({ success: true, message: 'Пароль изменён' });
});

// ==================== USER PROJECTS ====================

// Список проектов пользователя
app.get('/api/user/projects', async (c) => {
  const authUser = await getUser(c);
  if (!authUser) {
    return c.json({ success: false, error: 'Не авторизован' }, 401);
  }

  const projects = await c.env.DB.prepare(
    `SELECT id, name, created_at, updated_at FROM user_projects WHERE user_id = ? ORDER BY updated_at DESC`
  ).bind(authUser.userId).all();

  return c.json({ success: true, projects: projects.results });
});

// Создание проекта
app.post('/api/user/projects', async (c) => {
  const authUser = await getUser(c);
  if (!authUser) {
    return c.json({ success: false, error: 'Не авторизован' }, 401);
  }

  const { name, html, css, js, library } = await c.req.json();

  if (!name) {
    return c.json({ success: false, error: 'Укажите название' }, 400);
  }

  const now = new Date().toISOString();

  const result = await c.env.DB.prepare(
    `INSERT INTO user_projects (user_id, name, html, css, js, library, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(authUser.userId, name, html || '', css || '', js || '', library || '', now, now).run();

  return c.json({ success: true, id: result.meta.last_row_id });
});

// Обновление проекта
app.put('/api/user/projects/:id', async (c) => {
  const authUser = await getUser(c);
  if (!authUser) {
    return c.json({ success: false, error: 'Не авторизован' }, 401);
  }

  const projectId = c.req.param('id');
  const { name, html, css, js, library } = await c.req.json();

  const existing = await c.env.DB.prepare(
    `SELECT id FROM user_projects WHERE id = ? AND user_id = ?`
  ).bind(projectId, authUser.userId).first();

  if (!existing) {
    return c.json({ success: false, error: 'Проект не найден' }, 404);
  }

  const updates: string[] = [];
  const values: any[] = [];

  if (name !== undefined) { updates.push('name = ?'); values.push(name); }
  if (html !== undefined) { updates.push('html = ?'); values.push(html); }
  if (css !== undefined) { updates.push('css = ?'); values.push(css); }
  if (js !== undefined) { updates.push('js = ?'); values.push(js); }
  if (library !== undefined) { updates.push('library = ?'); values.push(library); }

  if (updates.length === 0) {
    return c.json({ success: false, error: 'Нечего обновлять' }, 400);
  }

  updates.push('updated_at = ?');
  values.push(new Date().toISOString());
  values.push(projectId);

  await c.env.DB.prepare(
    `UPDATE user_projects SET ${updates.join(', ')} WHERE id = ?`
  ).bind(...values).run();

  return c.json({ success: true });
});

// Получение проекта
app.get('/api/user/projects/:id', async (c) => {
  const authUser = await getUser(c);
  if (!authUser) {
    return c.json({ success: false, error: 'Не авторизован' }, 401);
  }

  const projectId = c.req.param('id');

  const project = await c.env.DB.prepare(
    `SELECT * FROM user_projects WHERE id = ? AND user_id = ?`
  ).bind(projectId, authUser.userId).first();

  if (!project) {
    return c.json({ success: false, error: 'Проект не найден' }, 404);
  }

  return c.json({ success: true, project });
});

// Удаление проекта
app.delete('/api/user/projects/:id', async (c) => {
  const authUser = await getUser(c);
  if (!authUser) {
    return c.json({ success: false, error: 'Не авторизован' }, 401);
  }

  const projectId = c.req.param('id');

  const result = await c.env.DB.prepare(
    `DELETE FROM user_projects WHERE id = ? AND user_id = ?`
  ).bind(projectId, authUser.userId).run();

  if (result.meta.changes === 0) {
    return c.json({ success: false, error: 'Проект не найден' }, 404);
  }

  return c.json({ success: true });
});

// ==================== PUBLIC API ====================

// 1. Создание проекта
app.post('/api/create', async (c) => {
  try {
    const body = await c.req.json();
    const { html, css, js, library, projectName, tags } = body;

    const validation = validateProject({ html, css, js, projectName });
    if (!validation.valid) {
      return c.json({ success: false, error: validation.error }, 400);
    }

    const id = generateId();
    const now = new Date().toISOString();

    await c.env.DB.prepare(
      `INSERT INTO projects (id, html, css, js, library, projectName, tags, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      id,
      html || '',
      css || '',
      js || '',
      library || '',
      projectName || 'Untitled Project',
      tags || '',
      now,
      now
    ).run();

    // Store code files in KV
    await c.env.FILES.put(`project:${id}:html`, html || '');
    await c.env.FILES.put(`project:${id}:css`, css || '');
    await c.env.FILES.put(`project:${id}:js`, js || '');
    await c.env.FILES.put(`project:${id}:library`, library || '');

    return c.json({
      success: true,
      id: id,
      url: `https://codepen-api.maybeyoou.workers.dev/${id}`
    });
  } catch (error) {
    console.error('Ошибка создания проекта:', error);
    return c.json({ success: false, error: 'Внутренняя ошибка сервера' }, 500);
  }
});

// 2. Получение полных данных проекта (для редактора)
app.get('/api/project/:id', async (c) => {
  try {
    const id = c.req.param('id');

    const project = await c.env.DB.prepare(
      `SELECT * FROM projects WHERE id = ?`
    ).bind(id).first();

    if (!project) {
      return c.json({ success: false, error: 'Проект не найден' }, 404);
    }

    const html = await c.env.FILES.get(`project:${id}:html`) || '';
    const css = await c.env.FILES.get(`project:${id}:css`) || '';
    const js = await c.env.FILES.get(`project:${id}:js`) || '';
    const library = await c.env.FILES.get(`project:${id}:library`) || '';

    return c.json({
      success: true,
      project: {
        id: project.id,
        projectName: project.projectName,
        tags: project.tags,
        views: project.views,
        createdAt: project.createdAt,
        updatedAt: project.updatedAt,
        html, css, js, library
      }
    });
  } catch (error) {
    console.error('Ошибка в /api/project/:id:', error);
    return c.json({ success: false, error: 'Внутренняя ошибка сервера' }, 500);
  }
});

// 3. Обновление проекта
app.put('/api/project/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const body = await c.req.json();
    const { html, css, js, library, projectName, tags } = body;

    const validation = validateProject({ html, css, js, projectName });
    if (!validation.valid) {
      return c.json({ success: false, error: validation.error }, 400);
    }

    const existing = await c.env.DB.prepare(
      `SELECT * FROM projects WHERE id = ?`
    ).bind(id).first();

    if (!existing) {
      return c.json({ success: false, error: 'Проект не найден' }, 404);
    }

    const updates: string[] = [];
    const values: any[] = [];

    if (html !== undefined) { updates.push('html = ?'); values.push(html); }
    if (css !== undefined) { updates.push('css = ?'); values.push(css); }
    if (js !== undefined) { updates.push('js = ?'); values.push(js); }
    if (library !== undefined) { updates.push('library = ?'); values.push(library); }
    if (projectName !== undefined) { updates.push('projectName = ?'); values.push(projectName); }
    if (tags !== undefined) { updates.push('tags = ?'); values.push(tags); }

    updates.push('updatedAt = ?');
    values.push(new Date().toISOString());
    values.push(id);

    await c.env.DB.prepare(
      `UPDATE projects SET ${updates.join(', ')} WHERE id = ?`
    ).bind(...values).run();

    // Update KV
    if (html !== undefined) await c.env.FILES.put(`project:${id}:html`, html);
    if (css !== undefined) await c.env.FILES.put(`project:${id}:css`, css);
    if (js !== undefined) await c.env.FILES.put(`project:${id}:js`, js);
    if (library !== undefined) await c.env.FILES.put(`project:${id}:library`, library);

    return c.json({ success: true, message: 'Проект обновлён' });
  } catch (error) {
    console.error('Ошибка обновления:', error);
    return c.json({ success: false, error: 'Ошибка обновления' }, 500);
  }
});

// 4. Удаление проекта
app.delete('/api/project/:id', async (c) => {
  try {
    const id = c.req.param('id');

    const result = await c.env.DB.prepare(
      `DELETE FROM projects WHERE id = ?`
    ).bind(id).run();

    if (result.meta.changes === 0) {
      return c.json({ success: false, error: 'Проект не найден' }, 404);
    }

    // Delete from KV
    await c.env.FILES.delete(`project:${id}:html`);
    await c.env.FILES.delete(`project:${id}:css`);
    await c.env.FILES.delete(`project:${id}:js`);
    await c.env.FILES.delete(`project:${id}:library`);

    return c.json({ success: true, message: 'Проект удалён' });
  } catch (error) {
    console.error('Ошибка удаления:', error);
    return c.json({ success: false, error: 'Ошибка удаления' }, 500);
  }
});

// 5. Поиск проектов
app.get('/api/search', async (c) => {
  try {
    const query = c.req.query('query');
    const tag = c.req.query('tag');

    let sql = 'SELECT id, projectName, tags, views, createdAt FROM projects WHERE 1=1';
    const params: any[] = [];

    if (query) {
      sql += ' AND projectName LIKE ?';
      params.push(`%${query}%`);
    }

    if (tag) {
      sql += ' AND tags LIKE ?';
      params.push(`%${tag}%`);
    }

    sql += ' ORDER BY createdAt DESC LIMIT 20';

    const projects = await c.env.DB.prepare(sql).bind(...params).all();

    return c.json({ success: true, projects: projects.results });
  } catch (error) {
    console.error('Ошибка поиска:', error);
    return c.json({ success: false, error: 'Ошибка поиска' }, 500);
  }
});

// 6. Экспорт проекта в ZIP
app.get('/api/export/:id', async (c) => {
  try {
    const id = c.req.param('id');

    const project = await c.env.DB.prepare(
      `SELECT * FROM projects WHERE id = ?`
    ).bind(id).first();

    if (!project) {
      return c.json({ success: false, error: 'Проект не найден' }, 404);
    }

    let libTag = '';
    if (project.library) {
      if ((project.library as string).includes('.css')) {
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

    const readme = `# ${project.projectName}\n\nСоздано в CodePen Pro\nID: ${project.id}\nURL: https://codepen-api.maybeyoou.workers.dev/${project.id}`;

    // For Workers, we return a simple JSON with files
    // ZIP creation needs to be done client-side or with a different approach
    return c.json({
      success: true,
      files: {
        'index.html': fullHtml,
        'style.css': project.css,
        'script.js': project.js,
        'README.md': readme
      }
    });
  } catch (error) {
    console.error('Ошибка экспорта:', error);
    return c.json({ success: false, error: 'Ошибка экспорта' }, 500);
  }
});

// 7. Статистика
app.get('/api/stats', async (c) => {
  try {
    const stats = await c.env.DB.prepare(
      `SELECT COUNT(*) as total, SUM(views) as totalViews FROM projects`
    ).first();

    return c.json({
      success: true,
      stats: {
        totalProjects: stats?.total || 0,
        totalViews: stats?.totalViews || 0,
        version: '3.0.0'
      }
    });
  } catch (error) {
    console.error('Ошибка статистики:', error);
    return c.json({ success: false, error: 'Внутренняя ошибка сервера' }, 500);
  }
});

// 8. Просмотр проекта — HTML страница или редирект в редактор
app.get('/:id', async (c) => {
  try {
    const id = c.req.param('id');

    if (!/^[a-zA-Z0-9]{12}$/.test(id)) {
      return c.text('Not found', 404);
    }

    const project = await c.env.DB.prepare(
      `SELECT * FROM projects WHERE id = ?`
    ).bind(id).first();

    if (!project) {
      return c.text(`<!DOCTYPE html>
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
</html>`, 404);
    }

    // Если ?edit — редирект в редактор
    if (c.req.query('edit')) {
      const fullscreen = c.req.query('fullscreen');
      const referer = c.req.header('referer') || c.req.header('origin') || '';
      let origin = 'https://maybe.su';
      if (referer) {
        try { origin = new URL(referer).origin; } catch {}
      }
      const editorUrl = `${origin}/codepen/?load=${id}${fullscreen ? '&fullscreen' : ''}`;
      return c.redirect(editorUrl, 302);
    }

    // Иначе — рендерим HTML страницу
    await c.env.DB.prepare(
      `UPDATE projects SET views = views + 1 WHERE id = ?`
    ).bind(id).run();

    const html = await c.env.FILES.get(`project:${id}:html`) || '';
    const css = await c.env.FILES.get(`project:${id}:css`) || '';
    const js = await c.env.FILES.get(`project:${id}:js`) || '';
    const library = await c.env.FILES.get(`project:${id}:library`) || '';

    let libTag = '';
    if (library) {
      if (library.includes('.css')) {
        libTag = `<link rel="stylesheet" href="${library}">`;
      } else {
        libTag = `<script src="${library}"></script>`;
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
    <style>${css}</style>
</head>
<body>
    ${html}
    <script>${js}</script>
    <script>
        console.log('Создано в CodePen Pro');
        console.log('Просмотров: ${(project.views as number) + 1}');
    </script>
</body>
</html>`;

    return c.html(htmlPage);
  } catch (error) {
    console.error('Ошибка в /:id:', error);
    return c.text('Внутренняя ошибка сервера', 500);
  }
});

export default app;
