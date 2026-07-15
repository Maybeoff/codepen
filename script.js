let editors = {};
let currentTab = 'html';
let currentProject = 'default';
let projects = {};
let isResizing = false;
let globalTheme = 'light';
let injectThemeCSS = false;

// Theme CSS templates
const themeCSSTemplates = {
    light: `/* Начало глобальной светлой темы */
:root {
    --bg-color: #ffffff;
    --text-color: #333333;
    --border-color: #e0e0e0;
    --accent-color: #667eea;
}

body {
    background-color: var(--bg-color);
    color: var(--text-color);
}
/* Конец глобальной темы */`,
    
    dark: `/* Начало глобальной тёмной темы */
:root {
    --bg-color: #1a1a1a;
    --text-color: #e0e0e0;
    --border-color: #444444;
    --accent-color: #667eea;
}

body {
    background-color: var(--bg-color);
    color: var(--text-color);
}
/* Конец глобальной темы */`,
    
    blue: `/* Начало глобальной синей темы */
:root {
    --bg-color: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    --text-color: #ffffff;
    --border-color: rgba(255, 255, 255, 0.2);
    --accent-color: #ffffff;
}

body {
    background: var(--bg-color);
    color: var(--text-color);
}
/* Конец глобальной темы */`,
    
    purple: `/* Начало глобальной фиолетовой темы */
:root {
    --bg-color: linear-gradient(135deg, #8B5CF6 0%, #A855F7 50%, #C084FC 100%);
    --text-color: #ffffff;
    --border-color: rgba(255, 255, 255, 0.2);
    --accent-color: #ffffff;
}

body {
    background: var(--bg-color);
    color: var(--text-color);
}
/* Конец глобальной темы */`
};
function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    
    container.appendChild(toast);
    
    setTimeout(() => {
        toast.style.animation = 'slideOut 0.3s ease forwards';
        setTimeout(() => container.removeChild(toast), 300);
    }, 3000);
}

// Safe JSON parsing for API responses
async function safeJsonParse(response) {
    const contentType = response.headers.get('content-type');
    
    // Проверяем статус ответа
    if (!response.ok) {
        const text = await response.text();
        throw new Error(`HTTP ${response.status}: ${text.substring(0, 100)}`);
    }
    
    // Проверяем Content-Type
    if (!contentType || !contentType.includes('application/json')) {
        const text = await response.text();
        throw new Error(`Сервер вернул не JSON (${contentType}): ${text.substring(0, 100)}`);
    }
    
    return await response.json();
}

function applyGlobalTheme(theme) {
    // Удаляем все существующие классы тем
    document.body.classList.remove('theme-light', 'theme-dark', 'theme-blue', 'theme-purple');
    
    // Удаляем старый CSS файл темы
    const oldThemeLink = document.getElementById('theme-stylesheet');
    if (oldThemeLink) {
        oldThemeLink.remove();
    }
    
    // Применяем новую тему
    if (theme && theme !== 'light') {
        document.body.classList.add(`theme-${theme}`);
        
        // Загружаем CSS файл темы
        const link = document.createElement('link');
        link.id = 'theme-stylesheet';
        link.rel = 'stylesheet';
        link.href = `themes/${theme}.css`;
        document.head.appendChild(link);
    }
    
    globalTheme = theme;
    
    // Сохраняем настройку
    localStorage.setItem('codepen-global-theme', theme);
    
    // Если включена инъекция CSS темы, обновляем CSS редактор
    if (injectThemeCSS) {
        injectThemeCSSToEditor();
    }
}

function injectThemeCSSToEditor() {
    if (!injectThemeCSS || !themeCSSTemplates[globalTheme]) return;
    
    // Проверяем, что редактор CSS инициализирован
    if (!editors || !editors.css) {
        return;
    }
    
    const currentCSS = editors.css.getValue();
    const themeCSS = themeCSSTemplates[globalTheme];
    
    // Удаляем предыдущий код темы если есть (между маркерами)
    const cleanCSS = currentCSS.replace(/\/\* Начало глобальной [\wа-яё]+ темы \*\/[\s\S]*?\/\* Конец глобальной темы \*\/\n*/gi, '').trim();
    
    // Добавляем новый код темы в начало
    const newCSS = themeCSS + '\n\n' + cleanCSS;
    
    editors.css.setValue(newCSS);
    updatePreview();
}

function toggleThemeInjection(enabled) {
    injectThemeCSS = enabled;
    localStorage.setItem('codepen-inject-theme-css', enabled);
    
    if (enabled) {
        injectThemeCSSToEditor();
        showToast('CSS темы добавлен в редактор', 'success');
    } else {
        // Удаляем код темы из CSS только если редактор инициализирован
        if (editors && editors.css) {
            const currentCSS = editors.css.getValue();
            const cleanCSS = currentCSS.replace(/\/\* Начало глобальной [\wа-яё]+ темы \*\/[\s\S]*?\/\* Конец глобальной темы \*\/\n*/gi, '').trim();
            editors.css.setValue(cleanCSS);
            updatePreview();
        }
        showToast('CSS темы удален из редактора', 'info');
    }
}

function loadGlobalThemeSettings() {
    const savedTheme = localStorage.getItem('codepen-global-theme') || 'light';
    const savedInjectCSS = localStorage.getItem('codepen-inject-theme-css') === 'true';
    const savedEditorTheme = localStorage.getItem('codepen-editor-theme') || 'default';
    const savedLibrary = localStorage.getItem('codepen-library') || '';
    const savedIgnoreAlerts = localStorage.getItem('codepen-ignore-alerts') === 'true';
    
    globalTheme = savedTheme;
    injectThemeCSS = savedInjectCSS;
    
    // Применяем тему сразу
    applyGlobalTheme(savedTheme);
    
    // Применяем тему редактора если редакторы уже инициализированы
    if (editors && Object.keys(editors).length > 0) {
        Object.values(editors).forEach(editor => {
            editor.setOption('theme', savedEditorTheme);
        });
    }
    
    // Если включена инъекция CSS и редакторы уже инициализированы, применяем CSS тему
    if (savedInjectCSS && editors && editors.css) {
        injectThemeCSSToEditor();
    }
    
    // Устанавливаем значения в элементы (будет работать после загрузки DOM)
    setTimeout(() => {
        const globalThemeSelect = document.getElementById('global-theme-select');
        if (globalThemeSelect) {
            globalThemeSelect.value = savedTheme;
        }
        
        const modalGlobalThemeSelect = document.getElementById('modal-global-theme-select');
        if (modalGlobalThemeSelect) {
            modalGlobalThemeSelect.value = savedTheme;
        }
        
        const themeSelect = document.getElementById('theme-select');
        if (themeSelect) {
            themeSelect.value = savedEditorTheme;
        }
        
        const modalThemeSelect = document.getElementById('modal-theme-select');
        if (modalThemeSelect) {
            modalThemeSelect.value = savedEditorTheme;
        }
        
        const librarySelect = document.getElementById('library-select');
        if (librarySelect) {
            librarySelect.value = savedLibrary;
        }
        
        const modalLibrarySelect = document.getElementById('modal-library-select');
        if (modalLibrarySelect) {
            modalLibrarySelect.value = savedLibrary;
        }
        
        const ignoreAlertsCheckbox = document.getElementById('ignore-alerts');
        if (ignoreAlertsCheckbox) {
            ignoreAlertsCheckbox.checked = savedIgnoreAlerts;
        }
        
        const modalIgnoreAlertsCheckbox = document.getElementById('modal-ignore-alerts');
        if (modalIgnoreAlertsCheckbox) {
            modalIgnoreAlertsCheckbox.checked = savedIgnoreAlerts;
        }
        
        const injectCheckbox = document.getElementById('inject-theme-css');
        if (injectCheckbox) {
            injectCheckbox.checked = savedInjectCSS;
        }
        
        const modalInjectCheckbox = document.getElementById('modal-inject-theme-css');
        if (modalInjectCheckbox) {
            modalInjectCheckbox.checked = savedInjectCSS;
        }
    }, 100);
}

function updateStatusBar() {
    const editor = editors[currentTab];
    if (!editor) return;
    
    const cursor = editor.getCursor();
    const content = editor.getValue();
    
    document.getElementById('cursor-info').textContent = `Ln ${cursor.line + 1}, Col ${cursor.ch + 1}`;
    document.getElementById('char-count').textContent = `${content.length} символов`;
}

function initializeEditors() {
    const savedEditorTheme = localStorage.getItem('codepen-editor-theme') || 'default';
    
    const commonOptions = {
        lineNumbers: true,
        theme: savedEditorTheme,
        autoCloseBrackets: true,
        foldGutter: true,
        gutters: ["CodeMirror-linenumbers", "CodeMirror-foldgutter"],
        extraKeys: {
            "Ctrl-Space": "autocomplete",
            "Ctrl-/": "toggleComment",
            "Ctrl-Q": function(cm){ cm.foldCode(cm.getCursor()); },
            "Ctrl-S": function() { saveCurrentProject(); return false; },
            "Ctrl-Enter": function() { updatePreview(); return false; },
            "F11": function() { toggleFullscreen(); return false; },
            "Ctrl-F": "findPersistent",
            "Ctrl-H": "replace",
            "Ctrl-G": "jumpToLine"
        },
        hintOptions: {
            completeSingle: false
        }
    };

    editors.html = CodeMirror(document.getElementById('html-editor'), {
        ...commonOptions,
        mode: 'htmlmixed',
        autoCloseTags: true,
        foldGutter: true,
        gutters: ["CodeMirror-linenumbers", "CodeMirror-foldgutter"],
        extraKeys: {
            ...commonOptions.extraKeys,
            "Ctrl-Q": function(cm){ cm.foldCode(cm.getCursor()); }
        },
        value: '<div class="container">\n  <h1>Hello World!</h1>\n  <p>Добро пожаловать в CodePen Pro</p>\n</div>'
    });

    editors.css = CodeMirror(document.getElementById('css-editor'), {
        ...commonOptions,
        mode: 'css',
        foldGutter: true,
        gutters: ["CodeMirror-linenumbers", "CodeMirror-foldgutter"],
        extraKeys: {
            ...commonOptions.extraKeys,
            "Ctrl-Q": function(cm){ cm.foldCode(cm.getCursor()); }
        },
        value: '.container {\n  max-width: 800px;\n  margin: 0 auto;\n  padding: 20px;\n  text-align: center;\n}\n\nh1 {\n  color: #667eea;\n  font-size: 2.5em;\n}\n\np {\n  color: #64748b;\n  font-size: 1.2em;\n}'
    });

    editors.js = CodeMirror(document.getElementById('js-editor'), {
        ...commonOptions,
        mode: 'javascript',
        foldGutter: true,
        gutters: ["CodeMirror-linenumbers", "CodeMirror-foldgutter"],
        extraKeys: {
            ...commonOptions.extraKeys,
            "Ctrl-Q": function(cm){ cm.foldCode(cm.getCursor()); }
        },
        value: 'console.log("CodePen Pro загружен!");\n\n// Добавим интерактивности\ndocument.addEventListener("DOMContentLoaded", function() {\n  const h1 = document.querySelector("h1");\n  if (h1) {\n    h1.addEventListener("click", function() {\n      this.style.color = this.style.color === "red" ? "#667eea" : "red";\n    });\n  }\n});'
    });

    // Debounce для автосохранения
    let saveTimeout;
    
    Object.values(editors).forEach(editor => {
        editor.on('change', () => {
            updatePreview();
            updateStatusBar();
            
            // Автосохранение с задержкой 1 секунда
            clearTimeout(saveTimeout);
            saveTimeout = setTimeout(() => {
                saveCurrentProject();
            }, 1000);
        });
        
        editor.on('cursorActivity', updateStatusBar);
        
        // Улучшенная обработка скролла на мобильных устройствах
        if (window.innerWidth <= 768) {
            const scrollElement = editor.getScrollerElement();
            // Добавляем touch-action для правильного поведения скролла
            scrollElement.style.touchAction = 'pan-y';
        }
    });

    updateStatusBar();
}

function initializeTabs() {
    document.querySelectorAll('.tab').forEach(tab => {
        tab.addEventListener('click', () => {
            const targetTab = tab.dataset.tab;
            switchTab(targetTab);
        });
    });
}

function switchTab(targetTab) {
    const container = document.querySelector('.editor-container');
    
    document.querySelector('.tab.active').classList.remove('active');
    document.querySelector('.editor.active').classList.remove('active');
    
    document.querySelector(`[data-tab="${targetTab}"]`).classList.add('active');
    document.getElementById(targetTab + '-editor').classList.add('active');

    if (targetTab === 'js') {
        container.classList.add('js-active');
    } else {
        container.classList.remove('js-active');
    }

    currentTab = targetTab;
    editors[currentTab].refresh();
    updateStatusBar();
}

function updatePreview() {
    const html = editors.html.getValue();
    const css = editors.css.getValue();
    const js = editors.js.getValue();
    
    const librarySelect = document.getElementById('library-select');
    const library = librarySelect ? librarySelect.value : '';
    
    const ignoreAlertsCheckbox = document.getElementById('ignore-alerts');
    const shouldIgnoreAlerts = ignoreAlertsCheckbox ? ignoreAlertsCheckbox.checked : false;

    document.getElementById('console').innerHTML = '';

    let libTag = '';
    if (library) {
        if (library.includes('.css')) {
            libTag = `<link rel="stylesheet" href="${library}">`;
        } else {
            libTag = `<script src="${library}"></script>`;
        }
    }

    const srcdoc = `
        <html>
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            ${libTag}
            <style>${css}</style>
        </head>
        <body>
            ${html}
            <script>
                if (${shouldIgnoreAlerts}) {
                    window.alert = function(msg) { 
                        console.log("🚫 Alert заблокирован:", msg); 
                    };
                    window.confirm = function(msg) { 
                        console.log("🚫 Confirm заблокирован:", msg); 
                        return true; 
                    };
                    window.prompt = function(msg) { 
                        console.log("🚫 Prompt заблокирован:", msg); 
                        return null; 
                    };
                }

                const originalLog = console.log;
                const originalError = console.error;
                const originalWarn = console.warn;

                console.log = function(...args) {
                    window.parent.postMessage({
                        type: 'log', 
                        content: args.map(a => typeof a === 'object' ? JSON.stringify(a, null, 2) : a).join(' ')
                    }, '*');
                    originalLog.apply(console, args);
                };

                console.error = function(...args) {
                    window.parent.postMessage({
                        type: 'error', 
                        content: args.join(' ')
                    }, '*');
                    originalError.apply(console, args);
                };

                console.warn = function(...args) {
                    window.parent.postMessage({
                        type: 'warn', 
                        content: args.join(' ')
                    }, '*');
                    originalWarn.apply(console, args);
                };

                window.onerror = function(message, source, lineno, colno, error) {
                    window.parent.postMessage({
                        type: 'error', 
                        content: \`❌ \${message} (Строка: \${lineno})\`
                    }, '*');
                };

                window.addEventListener('unhandledrejection', function(event) {
                    window.parent.postMessage({
                        type: 'error', 
                        content: \`❌ Promise rejected: \${event.reason}\`
                    }, '*');
                });
            </script>
            <script>${js}</script>
        </body>
        </html>
    `;

    document.getElementById('preview').srcdoc = srcdoc;
    
    const fullscreenPreview = document.getElementById('fullscreen-preview');
    if (fullscreenPreview.srcdoc) {
        fullscreenPreview.srcdoc = srcdoc;
    }
}

function initializeProjects() {
    loadProjects();
    updateProjectSelect();
    
    // Загружаем сохранённый проект в редакторы
    const project = projects[currentProject];
    if (project) {
        editors.html.setValue(project.html);
        editors.css.setValue(project.css);
        editors.js.setValue(project.js);
        const librarySelect = document.getElementById('library-select');
        if (librarySelect) {
            librarySelect.value = project.library || '';
        }
    }
}

function openSettingsModal() {
    const modal = document.getElementById('settings-modal');
    
    // Синхронизируем значения с основными элементами
    const themeSelect = document.getElementById('theme-select');
    const librarySelect = document.getElementById('library-select');
    const ignoreAlertsCheckbox = document.getElementById('ignore-alerts');
    const globalThemeSelect = document.getElementById('global-theme-select');
    const injectThemeCSSCheckbox = document.getElementById('inject-theme-css');
    
    document.getElementById('modal-theme-select').value = 
        themeSelect ? themeSelect.value : 'default';
    document.getElementById('modal-library-select').value = 
        librarySelect ? librarySelect.value : '';
    document.getElementById('modal-ignore-alerts').checked = 
        ignoreAlertsCheckbox ? ignoreAlertsCheckbox.checked : false;
    document.getElementById('modal-global-theme-select').value = 
        globalTheme; // Используем глобальную переменную вместо элемента
    document.getElementById('modal-inject-theme-css').checked = 
        injectThemeCSS; // Используем глобальную переменную вместо элемента
    
    // Обновляем список проектов в модальном окне
    updateModalProjectSelect();
    
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeSettingsModal() {
    const modal = document.getElementById('settings-modal');
    modal.classList.remove('active');
    document.body.style.overflow = '';
}

function updateModalProjectSelect() {
    const select = document.getElementById('modal-project-select');
    select.innerHTML = '';
    
    Object.keys(projects).forEach(key => {
        const option = document.createElement('option');
        option.value = key;
        option.textContent = projects[key].name;
        if (key === currentProject) option.selected = true;
        select.appendChild(option);
    });
}

function loadProjects() {
    const saved = localStorage.getItem('codepen-projects');
    const savedCurrent = localStorage.getItem('codepen-current-project');
    
    if (saved) {
        projects = JSON.parse(saved);
        const keys = Object.keys(projects);
        
        // Восстанавливаем текущий проект или берём первый доступный
        if (savedCurrent && projects[savedCurrent]) {
            currentProject = savedCurrent;
        } else if (keys.length > 0) {
            currentProject = keys[0];
        }
    } else {
        // Дефолтный проект с начальными значениями
        projects = {
            default: {
                name: 'Проект 1',
                html: '<div class="container">\n  <h1>Hello World!</h1>\n  <p>Добро пожаловать в CodePen Pro</p>\n</div>',
                css: '.container {\n  max-width: 800px;\n  margin: 0 auto;\n  padding: 20px;\n  text-align: center;\n}\n\nh1 {\n  color: #667eea;\n  font-size: 2.5em;\n}\n\np {\n  color: #64748b;\n  font-size: 1.2em;\n}',
                js: 'console.log("CodePen Pro загружен!");\n\n// Добавим интерактивности\ndocument.addEventListener("DOMContentLoaded", function() {\n  const h1 = document.querySelector("h1");\n  if (h1) {\n    h1.addEventListener("click", function() {\n      this.style.color = this.style.color === "red" ? "#667eea" : "red";\n    });\n  }\n});',
                library: ''
            }
        };
        // Сохраняем дефолтный проект
        saveProjects();
    }
}

function saveProjects() {
    localStorage.setItem('codepen-projects', JSON.stringify(projects));
    localStorage.setItem('codepen-current-project', currentProject);
}

function updateProjectSelect() {
    const select = document.getElementById('project-select');
    if (select) {
        select.innerHTML = '';
        
        Object.keys(projects).forEach(key => {
            const option = document.createElement('option');
            option.value = key;
            option.textContent = projects[key].name;
            if (key === currentProject) option.selected = true;
            select.appendChild(option);
        });
    }
}

function switchProject(projectKey) {
    if (!projects[projectKey]) return;
    
    saveCurrentProject();
    currentProject = projectKey;
    const project = projects[projectKey];
    
    editors.html.setValue(project.html);
    editors.css.setValue(project.css);
    editors.js.setValue(project.js);
    
    // Сохраняем библиотеку в localStorage и синхронизируем с элементами
    const libraryValue = project.library || '';
    localStorage.setItem('codepen-library', libraryValue);
    
    const librarySelect = document.getElementById('library-select');
    if (librarySelect) {
        librarySelect.value = libraryValue;
    }
    
    const modalLibrarySelect = document.getElementById('modal-library-select');
    if (modalLibrarySelect) {
        modalLibrarySelect.value = libraryValue;
    }
    
    updatePreview();
    updateProjectSelect();
    updateModalProjectSelect();
    showToast(`Переключено на "${project.name}"`, 'success');
}

function saveCurrentProject() {
    if (!projects[currentProject]) return;
    if (!editors || !editors.html || !editors.css || !editors.js) return;
    
    const libraryValue = localStorage.getItem('codepen-library') || '';
    
    projects[currentProject] = {
        name: projects[currentProject].name,
        html: editors.html.getValue(),
        css: editors.css.getValue(),
        js: editors.js.getValue(),
        library: libraryValue
    };
    saveProjects();
}

function createNewProject() {
    const name = prompt('Название нового проекта:');
    if (!name) return;
    
    const key = 'project_' + Date.now();
    projects[key] = {
        name: name,
        html: '<h1>Новый проект</h1>',
        css: 'h1 { color: #333; }',
        js: 'console.log("Новый проект создан!");',
        library: ''
    };
    
    currentProject = key;
    saveProjects();
    updateProjectSelect();
    updateModalProjectSelect();
    
    // Загружаем новый проект в редакторы
    editors.html.setValue(projects[key].html);
    editors.css.setValue(projects[key].css);
    editors.js.setValue(projects[key].js);
    
    const librarySelect = document.getElementById('library-select');
    if (librarySelect) {
        librarySelect.value = '';
    }
    
    updatePreview();
    showToast(`Проект "${name}" создан`, 'success');
}

function deleteProject() {
    const projectKeys = Object.keys(projects);
    
    if (projectKeys.length <= 1) {
        showToast('Нельзя удалить последний проект!', 'error');
        return;
    }
    
    const projectName = projects[currentProject].name;
    if (!confirm(`Удалить проект "${projectName}"?`)) return;
    
    delete projects[currentProject];
    saveProjects();
    
    const remainingKeys = Object.keys(projects);
    currentProject = remainingKeys[0];
    
    // Загружаем новый проект напрямую, без вызова switchProject
    const project = projects[currentProject];
    editors.html.setValue(project.html);
    editors.css.setValue(project.css);
    editors.js.setValue(project.js);
    
    const librarySelect = document.getElementById('library-select');
    if (librarySelect) {
        librarySelect.value = project.library || '';
    }
    
    updateProjectSelect();
    updateModalProjectSelect();
    updatePreview();
    
    showToast(`Проект "${projectName}" удалён`, 'success');
}

function formatCode() {
    const editor = editors[currentTab];
    const code = editor.getValue();
    
    try {
        let formatted;
        
        switch (currentTab) {
            case 'html':
                formatted = prettier.format(code, {
                    parser: 'html',
                    plugins: [prettierPlugins.html],
                    tabWidth: 2,
                    useTabs: false
                });
                break;
            case 'css':
                formatted = prettier.format(code, {
                    parser: 'css',
                    plugins: [prettierPlugins.postcss],
                    tabWidth: 2,
                    useTabs: false
                });
                break;
            case 'js':
                formatted = prettier.format(code, {
                    parser: 'babel',
                    plugins: [prettierPlugins.babel],
                    tabWidth: 2,
                    useTabs: false,
                    semi: true,
                    singleQuote: true
                });
                break;
        }
        
        editor.setValue(formatted);
        showToast('Код отформатирован!', 'success');
    } catch (error) {
        showToast('Ошибка форматирования: ' + error.message, 'error');
    }
}

async function exportToZip() {
    const zip = new JSZip();
    
    const html = `<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${projects[currentProject].name}</title>
    <link rel="stylesheet" href="style.css">
</head>
<body>
    ${editors.html.getValue()}
    <script src="script.js"></script>
</body>
</html>`;

    zip.file("index.html", html);
    zip.file("style.css", editors.css.getValue());
    zip.file("script.js", editors.js.getValue());
    
    const readme = `# ${projects[currentProject].name}

Проект создан в CodePen Pro

## Файлы:
- index.html - основная HTML структура
- style.css - стили CSS
- script.js - JavaScript код

## Запуск:
Откройте index.html в браузере.
`;
    
    zip.file("README.md", readme);
    
    try {
        const content = await zip.generateAsync({type: "blob"});
        const url = URL.createObjectURL(content);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${projects[currentProject].name}.zip`;
        a.click();
        URL.revokeObjectURL(url);
        
        showToast('Проект экспортирован!', 'success');
    } catch (error) {
        showToast('Ошибка экспорта: ' + error.message, 'error');
    }
}

async function importFromZip(file) {
    try {
        const zip = await JSZip.loadAsync(file);
        
        let htmlContent = '';
        let cssContent = '';
        let jsContent = '';
        
        // Ищем файлы в архиве
        for (const [filename, zipEntry] of Object.entries(zip.files)) {
            if (zipEntry.dir) continue;
            
            const name = filename.toLowerCase();
            const content = await zipEntry.async('string');
            
            if (name.endsWith('.html') || name.endsWith('.htm')) {
                // Извлекаем только содержимое body
                const bodyMatch = content.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
                if (bodyMatch) {
                    // Убираем script теги из body
                    htmlContent = bodyMatch[1].replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '').trim();
                } else {
                    htmlContent = content;
                }
            } else if (name.endsWith('.css') && !name.includes('min.')) {
                cssContent = content;
            } else if (name.endsWith('.js') && !name.includes('min.')) {
                jsContent = content;
            }
        }
        
        // Создаём новый проект с импортированным содержимым
        const projectName = file.name.replace('.zip', '');
        const key = 'project_' + Date.now();
        
        projects[key] = {
            name: projectName,
            html: htmlContent || '<h1>Импортированный проект</h1>',
            css: cssContent || '/* CSS стили */',
            js: jsContent || '// JavaScript код',
            library: ''
        };
        
        currentProject = key;
        saveProjects();
        updateProjectSelect();
        updateModalProjectSelect();
        
        editors.html.setValue(projects[key].html);
        editors.css.setValue(projects[key].css);
        editors.js.setValue(projects[key].js);
        
        updatePreview();
        showToast(`Проект "${projectName}" импортирован!`, 'success');
        
    } catch (error) {
        showToast('Ошибка импорта: ' + error.message, 'error');
    }
}

function openImportDialog() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.zip';
    input.onchange = (e) => {
        const file = e.target.files[0];
        if (file) {
            importFromZip(file);
        }
    };
    input.click();
}

function toggleFullscreen() {
    const overlay = document.getElementById('fullscreen-overlay');
    const fullscreenPreview = document.getElementById('fullscreen-preview');
    
    if (overlay.classList.contains('active')) {
        overlay.classList.remove('active');
    } else {
        overlay.classList.add('active');
        fullscreenPreview.srcdoc = document.getElementById('preview').srcdoc;
    }
}

function openRawInNewTab() {
    // Сохраняем текущий проект
    saveCurrentProject();
    const libraryValue = localStorage.getItem('codepen-library') || '';
    
    // Генерируем Raw HTML
    const html = editors.html.getValue();
    const css = editors.css.getValue();
    const js = editors.js.getValue();
    
    let libTag = '';
    if (libraryValue) {
        if (libraryValue.includes('.css')) {
            libTag = `<link rel="stylesheet" href="${libraryValue}">`;
        } else {
            libTag = `<script src="${libraryValue}"></script>`;
        }
    }

    const rawHTML = `<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${projects[currentProject]?.name || 'CodePen Pro Project'}</title>
    ${libTag}
    <style>${css}</style>
</head>
<body>
    ${html}
    <script>${js}</script>
</body>
</html>`;

    // Создаем Blob с HTML содержимым
    const blob = new Blob([rawHTML], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    
    // Открываем в новой вкладке
    const newWindow = window.open(url, '_blank');
    
    // Освобождаем URL через некоторое время
    setTimeout(() => {
        URL.revokeObjectURL(url);
    }, 1000);
    
    showToast('Raw HTML открыт в новой вкладке', 'success');
}

function setPreviewSize(size) {
    const wrapper = document.querySelector('.preview-wrapper');
    const buttons = document.querySelectorAll('.preview-size-btn');
    
    // Убираем все классы размеров
    wrapper.classList.remove('desktop', 'tablet', 'mobile');
    
    // Добавляем нужный класс
    wrapper.classList.add(size);
    
    // Обновляем активную кнопку
    buttons.forEach(btn => btn.classList.remove('active'));
    document.getElementById(`preview-${size}`).classList.add('active');
    
    localStorage.setItem('codepen-preview-size', size);
}

function initializeResizer() {
    const resizer = document.getElementById('resizer');
    const editorContainer = document.querySelector('.editor-container');
    const previewContainer = document.querySelector('.preview-container');
    const main = document.querySelector('main');
    const previewIframe = document.getElementById('preview');
    
    resizer.addEventListener('mousedown', (e) => {
        isResizing = true;
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
        
        // ВАЖНО: Отключаем события мыши для фрейма, чтобы он не перехватывал курсор
        if (previewIframe) {
            previewIframe.style.pointerEvents = 'none';
        }
        
        // Также используем захват указателя (самый надежный способ)
        resizer.setPointerCapture(e.pointerId);
        
        e.preventDefault();
    });
    
    document.addEventListener('mousemove', (e) => {
        if (!isResizing) return;
        
        const mainRect = main.getBoundingClientRect();
        const newEditorWidth = ((e.clientX - mainRect.left) / mainRect.width) * 100;
        
        if (newEditorWidth >= 25 && newEditorWidth <= 75) {
            const previewWidth = 100 - newEditorWidth;
            
            editorContainer.style.flex = `0 0 ${newEditorWidth}%`;
            previewContainer.style.flex = `0 0 ${previewWidth}%`;
        }
    });
    
    document.addEventListener('mouseup', (e) => {
        if (isResizing) {
            isResizing = false;
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
            
            // Включаем события мыши обратно
            if (previewIframe) {
                previewIframe.style.pointerEvents = 'auto';
            }
            
            // Освобождаем указатель
            if (resizer.hasPointerCapture(e.pointerId)) {
                resizer.releasePointerCapture(e.pointerId);
            }
            
            setTimeout(() => {
                Object.values(editors).forEach(editor => editor.refresh());
            }, 100);
        }
    });
}

function initializeEventListeners() {
    document.getElementById('run-btn').addEventListener('click', updatePreview);
    document.getElementById('format-btn').addEventListener('click', formatCode);
    document.getElementById('fullscreen-btn').addEventListener('click', toggleFullscreen);
    document.getElementById('open-raw-btn').addEventListener('click', openRawInNewTab);
    document.getElementById('exit-fullscreen').addEventListener('click', toggleFullscreen);
    document.getElementById('snow-btn').addEventListener('click', toggleSnowfall);
    document.getElementById('settings-btn').addEventListener('click', openSettingsModal);

    // Settings modal events
    document.getElementById('close-settings').addEventListener('click', closeSettingsModal);
    document.getElementById('settings-modal').addEventListener('click', (e) => {
        if (e.target.id === 'settings-modal') closeSettingsModal();
    });

    // Settings controls
    document.getElementById('modal-theme-select').addEventListener('change', (e) => {
        const theme = e.target.value;
        Object.values(editors).forEach(editor => {
            editor.setOption('theme', theme);
        });
        
        // Сохраняем тему редактора
        localStorage.setItem('codepen-editor-theme', theme);
        
        // Синхронизируем со скрытым элементом
        const themeSelect = document.getElementById('theme-select');
        if (themeSelect) {
            themeSelect.value = theme;
        }
        
        showToast(`Тема редактора изменена на ${theme}`, 'info');
    });

    document.getElementById('modal-global-theme-select').addEventListener('change', (e) => {
        const theme = e.target.value;
        
        // Синхронизируем со скрытым элементом
        const globalThemeSelect = document.getElementById('global-theme-select');
        if (globalThemeSelect) {
            globalThemeSelect.value = theme;
        }
        
        applyGlobalTheme(theme);
        showToast(`Глобальная тема изменена на ${theme}`, 'success');
    });

    document.getElementById('modal-inject-theme-css').addEventListener('change', (e) => {
        // Синхронизируем со скрытым элементом
        const injectThemeCSSCheckbox = document.getElementById('inject-theme-css');
        if (injectThemeCSSCheckbox) {
            injectThemeCSSCheckbox.checked = e.target.checked;
        }
        
        toggleThemeInjection(e.target.checked);
    });

    document.getElementById('modal-library-select').addEventListener('change', (e) => {
        const library = e.target.value;
        
        // Синхронизируем со скрытым элементом
        const librarySelect = document.getElementById('library-select');
        if (librarySelect) {
            librarySelect.value = library;
        }
        
        // Сохраняем выбранную библиотеку
        localStorage.setItem('codepen-library', library);
        
        updatePreview();
        showToast(library ? `Библиотека подключена: ${library.split('/').pop()}` : 'Библиотека отключена', 'info');
    });

    document.getElementById('modal-ignore-alerts').addEventListener('change', (e) => {
        const ignoreAlerts = e.target.checked;
        
        // Синхронизируем со скрытым элементом
        const ignoreAlertsCheckbox = document.getElementById('ignore-alerts');
        if (ignoreAlertsCheckbox) {
            ignoreAlertsCheckbox.checked = ignoreAlerts;
        }
        
        // Сохраняем настройку
        localStorage.setItem('codepen-ignore-alerts', ignoreAlerts);
        
        updatePreview();
        showToast(ignoreAlerts ? 'Alert/Confirm/Prompt будут игнорироваться' : 'Alert/Confirm/Prompt включены', 'info');
    });

    document.getElementById('modal-project-select').addEventListener('change', (e) => {
        switchProject(e.target.value);
    });

    document.getElementById('modal-new-project-btn').addEventListener('click', createNewProject);
    document.getElementById('modal-delete-project-btn').addEventListener('click', deleteProject);
    document.getElementById('modal-save-btn').addEventListener('click', () => {
        saveCurrentProject();
        showToast('Проект сохранён!', 'success');
    });
    document.getElementById('modal-export-btn').addEventListener('click', exportToZip);
    document.getElementById('modal-import-btn').addEventListener('click', openImportDialog);
    document.getElementById('modal-share-btn').addEventListener('click', async () => {
        try {
            saveCurrentProject();
            const libraryValue = localStorage.getItem('codepen-library') || '';
            const projectData = {
                html: editors.html.getValue(),
                css: editors.css.getValue(),
                js: editors.js.getValue(),
                library: libraryValue,
                projectName: projects[currentProject]?.name || 'Project'
            };
            showToast('Saving project...', 'info');
            const response = await fetch('https://codepen-api.maybeyoou.workers.dev/api/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(projectData)
            });
            const result = await safeJsonParse(response);
            if (result.success) {
                const shareUrl = `https://codepen-api.maybeyoou.workers.dev/${result.id}`;
                navigator.clipboard.writeText(shareUrl)
                    .then(() => showToast('Link copied!', 'success'))
                    .catch(() => showToast('Link: ' + shareUrl, 'success'));
            } else {
                showToast('Error: ' + (result.error || 'Unknown error'), 'error');
            }
        } catch (error) {
            showToast('Network error: ' + error.message, 'error');
        }
    });

    document.getElementById('modal-share-fullscreen-btn').addEventListener('click', async () => {
        try {
            saveCurrentProject();
            const libraryValue = localStorage.getItem('codepen-library') || '';
            const projectData = {
                html: editors.html.getValue(),
                css: editors.css.getValue(),
                js: editors.js.getValue(),
                library: libraryValue,
                projectName: projects[currentProject]?.name || 'Project'
            };
            showToast('Saving project...', 'info');
            const response = await fetch('https://codepen-api.maybeyoou.workers.dev/api/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(projectData)
            });
            const result = await safeJsonParse(response);
            if (result.success) {
                const shareUrl = `https://codepen-api.maybeyoou.workers.dev/${result.id}?fullscreen`;
                navigator.clipboard.writeText(shareUrl)
                    .then(() => showToast('Link copied!', 'success'))
                    .catch(() => showToast('Link: ' + shareUrl, 'success'));
            } else {
                showToast('Error: ' + (result.error || 'Unknown error'), 'error');
            }
        } catch (error) {
            showToast('Network error: ' + error.message, 'error');
        }
    });

    document.getElementById('modal-share-raw-btn').addEventListener('click', async () => {
        try {
            saveCurrentProject();
            const libraryValue = localStorage.getItem('codepen-library') || '';
            const projectData = {
                html: editors.html.getValue(),
                css: editors.css.getValue(),
                js: editors.js.getValue(),
                library: libraryValue,
                projectName: projects[currentProject]?.name || 'Project'
            };
            showToast('Saving project...', 'info');
            const response = await fetch('https://codepen-api.maybeyoou.workers.dev/api/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(projectData)
            });
            const result = await safeJsonParse(response);
            if (result.success) {
                const rawUrl = `https://codepen-api.maybeyoou.workers.dev/${result.id}`;
                navigator.clipboard.writeText(rawUrl)
                    .then(() => showToast('Raw link copied!', 'success'))
                    .catch(() => showToast('Raw link: ' + rawUrl, 'success'));
            } else {
                showToast('Error: ' + (result.error || 'Unknown error'), 'error');
            }
        } catch (error) {
            showToast('Network error: ' + error.message, 'error');
        }
    });

    document.getElementById('modal-update-raw-btn').addEventListener('click', async () => {
        try {
            saveCurrentProject();
            const libraryValue = localStorage.getItem('codepen-library') || '';
            const projectData = {
                html: editors.html.getValue(),
                css: editors.css.getValue(),
                js: editors.js.getValue(),
                library: libraryValue,
                projectName: projects[currentProject]?.name || 'Project'
            };
            showToast('Updating project...', 'info');
            const response = await fetch('https://codepen-api.maybeyoou.workers.dev/api/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(projectData)
            });
            const result = await safeJsonParse(response);
            if (result.success) {
                const rawUrl = `https://codepen-api.maybeyoou.workers.dev/${result.id}`;
                navigator.clipboard.writeText(rawUrl)
                    .then(() => showToast('Raw link updated and copied!', 'success'))
                    .catch(() => showToast('Raw link: ' + rawUrl, 'success'));
            } else {
                showToast('Error: ' + (result.error || 'Unknown error'), 'error');
            }
        } catch (error) {
            showToast('Network error: ' + error.message, 'error');
        }
    });

    document.getElementById('modal-qr-btn').addEventListener('click', openQRModal);
    document.getElementById('close-qr-modal').addEventListener('click', closeQRModal);
    document.getElementById('qr-modal').addEventListener('click', (e) => {
        if (e.target.id === 'qr-modal') closeQRModal();
    });
    document.getElementById('download-qr-btn').addEventListener('click', downloadQRCode);

    document.getElementById('clear-console').addEventListener('click', () => {
        document.getElementById('console').innerHTML = '';
        showToast('Консоль очищена', 'info');
    });
    
    document.getElementById('refresh-preview').addEventListener('click', updatePreview);
    
    // Preview size buttons
    document.getElementById('preview-desktop').addEventListener('click', () => setPreviewSize('desktop'));
    document.getElementById('preview-tablet').addEventListener('click', () => setPreviewSize('tablet'));
    document.getElementById('preview-mobile').addEventListener('click', () => setPreviewSize('mobile'));
    
    // Восстанавливаем сохранённый размер превью
    const savedSize = localStorage.getItem('codepen-preview-size') || 'desktop';
    setPreviewSize(savedSize);

    window.addEventListener('message', (e) => {
        if (e.data.type) {
            const consoleDiv = document.getElementById('console');
            const line = document.createElement('div');
            
            switch (e.data.type) {
                case 'log':
                    line.style.color = '#a0aec0';
                    line.innerHTML = `<span style="color: #68d391;">▶</span> ${e.data.content}`;
                    break;
                case 'error':
                    line.style.color = '#fc8181';
                    line.innerHTML = `<span style="color: #fc8181;">✕</span> ${e.data.content}`;
                    break;
                case 'warn':
                    line.style.color = '#f6e05e';
                    line.innerHTML = `<span style="color: #f6e05e;">⚠</span> ${e.data.content}`;
                    break;
            }
            
            consoleDiv.appendChild(line);
            consoleDiv.scrollTop = consoleDiv.scrollHeight;
        }
    });

    document.addEventListener('keydown', (e) => {
        if (e.ctrlKey || e.metaKey) {
            switch (e.key) {
                case 's':
                    e.preventDefault();
                    saveCurrentProject();
                    showToast('Проект сохранён!', 'success');
                    break;
                case 'Enter':
                    e.preventDefault();
                    updatePreview();
                    break;
            }
        }
        
        if (e.key === 'F11') {
            e.preventDefault();
            toggleFullscreen();
        }

        if (e.key === 'Escape') {
            closeSettingsModal();
        }
    });
}

function loadFromURL() {
    const urlParams = new URLSearchParams(window.location.search);
    const compressedData = urlParams.get('data');
    const loadId = urlParams.get('load');
    const fullscreenMode = urlParams.has('fullscreen');

    if (loadId) {
        showToast('Загрузка проекта...', 'info');
        fetch('https://codepen-api.maybeyoou.workers.dev/api/project/' + loadId)
            .then(r => r.json())
            .then(result => {
                if (result.success && result.project) {
                    if (result.project.html) editors.html.setValue(result.project.html);
                    if (result.project.css) editors.css.setValue(result.project.css);
                    if (result.project.js) editors.js.setValue(result.project.js);
                    if (result.project.library) {
                        const ls = document.getElementById('library-select');
                        if (ls) ls.value = result.project.library;
                    }
                    showToast('Проект загружен!', 'success');
                } else {
                    showToast('Проект не найден', 'error');
                }
            })
            .catch(() => showToast('Ошибка загрузки проекта', 'error'));
    }

    if (compressedData) {
        try {
            const decompressed = LZString.decompressFromEncodedURIComponent(compressedData);
            const project = JSON.parse(decompressed);

            if (project.h !== undefined) editors.html.setValue(project.h);
            if (project.c !== undefined) editors.css.setValue(project.c);
            if (project.j !== undefined) editors.js.setValue(project.j);
            if (project.l !== undefined) {
                const librarySelect = document.getElementById('library-select');
                if (librarySelect) {
                    librarySelect.value = project.l;
                }
            }
            
            showToast('Проект загружен из ссылки!', 'success');
        } catch (e) {
            showToast('Ошибка при загрузке из ссылки', 'error');
        }
    }

    if (fullscreenMode) {
        setTimeout(() => {
            toggleFullscreen();
            showToast('Открыто в полноэкранном режиме 🖥️', 'info');
        }, 1000);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    initializeEditors();
    initializeTabs();
    initializeProjects();
    loadGlobalThemeSettings();
    initializeResizer();
    initializeEventListeners();
    loadFromURL();
    updatePreview();
    
    // Регистрация Service Worker для PWA
    if ('serviceWorker' in navigator && window.location.protocol === 'https:') {
        navigator.serviceWorker.register('./sw.js')
            .then((registration) => {
                console.log('Service Worker зарегистрирован:', registration.scope);
            })
            .catch((error) => {
                console.log('Ошибка регистрации SW:', error);
            });
    }
    
    // Исправление скролла на мобильных устройствах
    if (window.innerWidth <= 768) {
        // Обработка изменения ориентации
        window.addEventListener('orientationchange', function() {
            setTimeout(() => {
                Object.values(editors).forEach(editor => {
                    if (editor) editor.refresh();
                });
            }, 100);
        });
        
        // Улучшенная обработка touch событий для предотвращения конфликтов
        document.addEventListener('touchstart', function(e) {
            // Разрешаем touch события в iframe и preview-wrapper
            if (e.target.closest('iframe') || e.target.closest('.preview-wrapper')) {
                return;
            }
        }, { passive: true });
    }
    
    showToast('CodePen Pro готов к работе! 🚀', 'success');
});

window.addEventListener('beforeunload', () => {
    saveCurrentProject();
});

// Эффект снегопада
let snowfallActive = localStorage.getItem('codepen-snowfall') !== 'false'; // по умолчанию включен
let snowfallInterval = null;

function createSnowflake() {
    if (!snowfallActive) return;
    
    const snowflake = document.createElement('div');
    snowflake.classList.add('snowflake');
    
    // Разные типы снежинок
    const snowflakeTypes = ['❄', '❅', '❆', '✻', '✼', '❋'];
    snowflake.innerHTML = snowflakeTypes[Math.floor(Math.random() * snowflakeTypes.length)];
    
    // Случайная позиция по горизонтали
    snowflake.style.left = Math.random() * 100 + 'vw';
    
    // Случайный размер
    const size = Math.random() * 0.8 + 0.8; // от 0.8 до 1.6
    snowflake.style.fontSize = size + 'em';
    
    // Случайная продолжительность анимации
    const duration = Math.random() * 8 + 8; // от 8 до 16 секунд
    
    // Выбираем случайную анимацию
    const animationType = Math.random() > 0.5 ? 'snowfall' : 'snowfall-reverse';
    snowflake.style.animation = `${animationType} ${duration}s linear forwards`;
    
    // Случайная прозрачность
    const opacity = Math.random() * 0.6 + 0.4; // от 0.4 до 1.0
    snowflake.style.opacity = opacity;
    
    document.body.appendChild(snowflake);
    
    // Удаляем снежинку после завершения анимации
    setTimeout(() => {
        if (snowflake.parentNode) {
            snowflake.parentNode.removeChild(snowflake);
        }
    }, duration * 1000 + 1000); // добавляем 1 секунду запаса
}

function startSnowfall() {
    if (snowfallInterval) return;
    
    snowfallActive = true;
    snowfallInterval = setInterval(createSnowflake, 200); // уменьшили интервал
    
    // Создаем начальные снежинки
    for (let i = 0; i < 15; i++) {
        setTimeout(createSnowflake, i * 150);
    }
    
    // Обновляем кнопку
    const snowBtn = document.getElementById('snow-btn');
    if (snowBtn) {
        snowBtn.style.background = '#4CAF50';
        snowBtn.style.color = 'white';
        snowBtn.title = 'Выключить снегопад';
    }
}

function stopSnowfall() {
    snowfallActive = false;
    
    if (snowfallInterval) {
        clearInterval(snowfallInterval);
        snowfallInterval = null;
    }
    
    // Удаляем все существующие снежинки
    const snowflakes = document.querySelectorAll('.snowflake');
    snowflakes.forEach(snowflake => {
        if (snowflake.parentNode) {
            snowflake.parentNode.removeChild(snowflake);
        }
    });
    
    // Обновляем кнопку
    const snowBtn = document.getElementById('snow-btn');
    if (snowBtn) {
        snowBtn.style.background = '';
        snowBtn.style.color = '';
        snowBtn.title = 'Включить снегопад';
    }
}

function toggleSnowfall() {
    if (snowfallActive) {
        stopSnowfall();
        localStorage.setItem('codepen-snowfall', 'false');
        showToast('Снегопад выключен ❄️', 'info');
    } else {
        startSnowfall();
        localStorage.setItem('codepen-snowfall', 'true');
        showToast('Снегопад включен ❄️', 'success');
    }
}

// Запускаем снегопад после загрузки страницы, если он был включен
setTimeout(() => {
    if (snowfallActive) {
        startSnowfall();
    } else {
        // Обновляем кнопку для выключенного состояния
        const snowBtn = document.getElementById('snow-btn');
        if (snowBtn) {
            snowBtn.style.background = '';
            snowBtn.style.color = '';
            snowBtn.title = 'Включить снегопад';
        }
    }
}, 2000);

function openQRModal() {
    const modal = document.getElementById('qr-modal');
    const projectName = projects[currentProject]?.name || 'Project';
    document.getElementById('qr-project-name').value = projectName;
    document.getElementById('qr-project-url').value = 'Creating link...';
    document.getElementById('qr-code-display').innerHTML = '';
    document.getElementById('download-qr-btn').style.display = 'none';
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';

    saveCurrentProject();
    const libraryValue = localStorage.getItem('codepen-library') || '';
    const projectData = {
        html: editors.html.getValue(),
        css: editors.css.getValue(),
        js: editors.js.getValue(),
        library: libraryValue,
        projectName: projectName
    };

    fetch('https://codepen-api.maybeyoou.workers.dev/api/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(projectData)
    })
    .then(r => r.json())
    .then(result => {
        if (result.success) {
            const url = `https://codepen-api.maybeyoou.workers.dev/${result.id}`;
            document.getElementById('qr-project-url').value = url;
            return generateQRCodeFromUrl(url);
        } else {
            throw new Error(result.error || 'Failed to create link');
        }
    })
    .catch(err => {
        document.getElementById('qr-project-url').value = 'Error: ' + err.message;
        showToast('Error: ' + err.message, 'error');
    });
}

function closeQRModal() {
    const modal = document.getElementById('qr-modal');
    modal.classList.remove('active');
    document.body.style.overflow = '';
}

async function generateQRCodeFromUrl(url) {
    const qrDisplay = document.getElementById('qr-code-display');
    const qrLoading = document.getElementById('qr-loading');
    const downloadBtn = document.getElementById('download-qr-btn');

    try {
        qrDisplay.innerHTML = '';
        qrLoading.style.display = 'flex';
        const encodedUrl = encodeURIComponent(url);
        const qrApiUrl = `https://public-api.qr-code-generator.com/v1/create/free?image_format=SVG&image_width=500&foreground_color=%23000000&frame_color=%23000000&frame_name=no-frame&qr_code_logo=&qr_code_pattern=&qr_code_text=${encodedUrl}`;
        const response = await fetch(qrApiUrl);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const svgText = await response.text();
        qrLoading.style.display = 'none';
        qrDisplay.innerHTML = svgText;
        const svgElement = qrDisplay.querySelector('svg');
        if (svgElement) {
            svgElement.removeAttribute('width');
            svgElement.removeAttribute('height');
            if (!svgElement.getAttribute('viewBox')) {
                svgElement.setAttribute('viewBox', '0 0 500 500');
            }
            svgElement.style.width = '100%';
            svgElement.style.height = '100%';
            svgElement.style.display = 'block';
        }
        downloadBtn.style.display = 'inline-flex';
    } catch (error) {
        qrLoading.style.display = 'none';
        qrDisplay.innerHTML = '<p style="color:red;">Error generating QR code: ' + error.message + '</p>';
        showToast('QR error: ' + error.message, 'error');
    }
}

function downloadQRCode() {
    const qrDisplay = document.getElementById('qr-code-display');
    const svgElement = qrDisplay.querySelector('svg');
    if (!svgElement) {
        showToast('QR code not found', 'error');
        return;
    }
    const svgData = new XMLSerializer().serializeToString(svgElement);
    const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);
    const downloadLink = document.createElement('a');
    downloadLink.href = url;
    downloadLink.download = (projects[currentProject]?.name || 'project') + '-qr.svg';
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
    URL.revokeObjectURL(url);
    showToast('QR code downloaded!', 'success');
}

