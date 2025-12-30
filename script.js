let editors = {};
let currentTab = 'html';
let currentProject = 'default';
let projects = {};
let isResizing = false;
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

function updateStatusBar() {
    const editor = editors[currentTab];
    if (!editor) return;
    
    const cursor = editor.getCursor();
    const content = editor.getValue();
    
    document.getElementById('cursor-info').textContent = `Ln ${cursor.line + 1}, Col ${cursor.ch + 1}`;
    document.getElementById('char-count').textContent = `${content.length} символов`;
}

function initializeEditors() {
    const commonOptions = {
        lineNumbers: true,
        theme: 'default',
        autoCloseBrackets: true,
        extraKeys: {
            "Ctrl-Space": "autocomplete",
            "Ctrl-/": "toggleComment",
            "Ctrl-S": function() { saveCurrentProject(); return false; },
            "Ctrl-Enter": function() { updatePreview(); return false; },
            "F11": function() { toggleFullscreen(); return false; }
        },
        hintOptions: {
            completeSingle: false
        }
    };

    editors.html = CodeMirror(document.getElementById('html-editor'), {
        ...commonOptions,
        mode: 'htmlmixed',
        autoCloseTags: true,
        value: '<div class="container">\n  <h1>Hello World!</h1>\n  <p>Добро пожаловать в CodePen Pro</p>\n</div>'
    });

    editors.css = CodeMirror(document.getElementById('css-editor'), {
        ...commonOptions,
        mode: 'css',
        value: '.container {\n  max-width: 800px;\n  margin: 0 auto;\n  padding: 20px;\n  text-align: center;\n}\n\nh1 {\n  color: #667eea;\n  font-size: 2.5em;\n}\n\np {\n  color: #64748b;\n  font-size: 1.2em;\n}'
    });

    editors.js = CodeMirror(document.getElementById('js-editor'), {
        ...commonOptions,
        mode: 'javascript',
        value: 'console.log("CodePen Pro загружен!");\n\n// Добавим интерактивности\ndocument.addEventListener("DOMContentLoaded", function() {\n  const h1 = document.querySelector("h1");\n  if (h1) {\n    h1.addEventListener("click", function() {\n      this.style.color = this.style.color === "red" ? "#667eea" : "red";\n    });\n  }\n});'
    });

    Object.values(editors).forEach(editor => {
        editor.on('change', () => {
            updatePreview();
            updateStatusBar();
        });
        
        editor.on('cursorActivity', updateStatusBar);
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
    
    document.getElementById('modal-theme-select').value = 
        themeSelect ? themeSelect.value : 'default';
    document.getElementById('modal-library-select').value = 
        librarySelect ? librarySelect.value : '';
    document.getElementById('modal-ignore-alerts').checked = 
        ignoreAlertsCheckbox ? ignoreAlertsCheckbox.checked : false;
    
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
        projects = {
            default: {
                name: 'Проект 1',
                html: editors.html.getValue(),
                css: editors.css.getValue(),
                js: editors.js.getValue(),
                library: ''
            }
        };
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
    
    const librarySelect = document.getElementById('library-select');
    if (librarySelect) {
        librarySelect.value = project.library || '';
    }
    
    updatePreview();
    updateProjectSelect();
    updateModalProjectSelect();
    showToast(`Переключено на "${project.name}"`, 'success');
}

function saveCurrentProject() {
    if (!projects[currentProject]) return;
    
    const librarySelect = document.getElementById('library-select');
    const libraryValue = librarySelect ? librarySelect.value : '';
    
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

function initializeResizer() {
    const resizer = document.getElementById('resizer');
    const editorContainer = document.querySelector('.editor-container');
    const previewContainer = document.querySelector('.preview-container');
    const main = document.querySelector('main');
    
    resizer.addEventListener('mousedown', (e) => {
        isResizing = true;
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
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
    
    document.addEventListener('mouseup', () => {
        if (isResizing) {
            isResizing = false;
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
            
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
    document.getElementById('exit-fullscreen').addEventListener('click', toggleFullscreen);
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
        showToast(`Тема изменена на ${theme}`, 'info');
    });

    document.getElementById('modal-library-select').addEventListener('change', (e) => {
        const librarySelect = document.getElementById('library-select');
        if (librarySelect) {
            librarySelect.value = e.target.value;
        }
        updatePreview();
    });

    document.getElementById('modal-ignore-alerts').addEventListener('change', (e) => {
        const ignoreAlertsCheckbox = document.getElementById('ignore-alerts');
        if (ignoreAlertsCheckbox) {
            ignoreAlertsCheckbox.checked = e.target.checked;
        }
        updatePreview();
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
    document.getElementById('modal-share-btn').addEventListener('click', () => {
        saveCurrentProject();
        const librarySelect = document.getElementById('library-select');
        const libraryValue = librarySelect ? librarySelect.value : '';
        
        const compressed = LZString.compressToEncodedURIComponent(JSON.stringify({
            h: editors.html.getValue(),
            c: editors.css.getValue(),
            j: editors.js.getValue(),
            l: libraryValue
        }));
        
        const url = `${window.location.origin}${window.location.pathname}?data=${compressed}`;
        navigator.clipboard.writeText(url)
            .then(() => showToast('Ссылка скопирована!', 'success'))
            .catch(() => showToast('Не удалось скопировать ссылку', 'error'));
    });

    document.getElementById('clear-console').addEventListener('click', () => {
        document.getElementById('console').innerHTML = '';
        showToast('Консоль очищена', 'info');
    });
    
    document.getElementById('refresh-preview').addEventListener('click', updatePreview);

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
}

document.addEventListener('DOMContentLoaded', () => {
    initializeEditors();
    initializeTabs();
    initializeProjects();
    initializeResizer();
    initializeEventListeners();
    loadFromURL();
    updatePreview();
    
    showToast('CodePen Pro готов к работе! 🚀', 'success');
});

window.addEventListener('beforeunload', () => {
    saveCurrentProject();
});