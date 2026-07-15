import { Hono } from 'hono';
import { cors } from 'hono/cors';

type Bindings = {
  DB: D1Database;
  FILES: KVNamespace;
  ENVIRONMENT: string;
};

const app = new Hono<{ Bindings: Bindings }>();

app.use('/*', cors());

const MAX_SIZE = 1024 * 1024;
const MAX_PROJECT_NAME_LENGTH = 100;

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
      const editorUrl = `https://maybe.su/codepen/?load=${id}${fullscreen ? '&fullscreen' : ''}`;
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
