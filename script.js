// Initialize editors
const htmlEditor = CodeMirror(document.getElementById('html-editor'), {
    mode: 'htmlmixed',
    lineNumbers: true,
    theme: 'default',
    autoCloseBrackets: true,
    autoCloseTags: true,
    value: '<h1>Hello World</h1>'
});

const cssEditor = CodeMirror(document.getElementById('css-editor'), {
    mode: 'css',
    lineNumbers: true,
    theme: 'default',
    autoCloseBrackets: true,
    value: 'body { background-color: #f0f0f0; }'
});

const jsEditor = CodeMirror(document.getElementById('js-editor'), {
    mode: 'javascript',
    lineNumbers: true,
    theme: 'default',
    autoCloseBrackets: true,
    value: 'document.body.innerHTML += "<p>JS executed</p>";'
});

const editors = { html: htmlEditor, css: cssEditor, js: jsEditor };
let currentTab = 'html';

// Tab switching
document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
        console.log('Tab clicked:', tab.dataset.tab);
        document.querySelector('.tab.active').classList.remove('active');
        document.querySelector('.editor.active').classList.remove('active');
        tab.classList.add('active');
        document.getElementById(tab.dataset.tab + '-editor').classList.add('active');
        currentTab = tab.dataset.tab;
        editors[currentTab].refresh();
    });
});

// Update preview
function updatePreview() {
    console.log('Updating preview');
    const html = htmlEditor.getValue();
    const css = cssEditor.getValue();
    const js = jsEditor.getValue();
    const library = document.getElementById('library-select').value;
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
            ${libTag}
            <style>${css}</style>
        </head>
        <body>
            ${html}
            <script>${js}</script>
            <script>
                window.addEventListener('error', function(e) {
                    parent.postMessage({type: 'error', message: e.message, filename: e.filename, lineno: e.lineno}, '*');
                });
                window.addEventListener('unhandledrejection', function(e) {
                    parent.postMessage({type: 'error', message: e.reason}, '*');
                });
            </script>
        </body>
        </html>
    `;
    document.getElementById('preview').srcdoc = srcdoc;
    // Clear console
    document.getElementById('console').innerHTML = '';
}

// Event listeners for changes
htmlEditor.on('change', updatePreview);
cssEditor.on('change', updatePreview);
jsEditor.on('change', updatePreview);

// Run button
document.getElementById('run-btn').addEventListener('click', () => {
    console.log('Run button clicked');
    updatePreview();
});

// Initial preview
updatePreview();

// Theme switching
document.getElementById('theme-select').addEventListener('change', (e) => {
    console.log('Theme changed to', e.target.value);
    const theme = e.target.value;
    Object.values(editors).forEach(editor => {
        editor.setOption('theme', theme);
    });
});

// Library selection
document.getElementById('library-select').addEventListener('change', () => {
    console.log('Library changed');
    updatePreview();
});

// Save to localStorage
document.getElementById('save-btn').addEventListener('click', () => {
    console.log('Save button clicked');
    const project = {
        html: htmlEditor.getValue(),
        css: cssEditor.getValue(),
        js: jsEditor.getValue(),
        library: document.getElementById('library-select').value
    };
    localStorage.setItem('codepen-project', JSON.stringify(project));
    alert('Project saved!');
});

// Load from localStorage
const saved = localStorage.getItem('codepen-project');
if (saved) {
    const project = JSON.parse(saved);
    htmlEditor.setValue(project.html);
    cssEditor.setValue(project.css);
    jsEditor.setValue(project.js);
    document.getElementById('library-select').value = project.library || '';
    updatePreview();
}

// Share via URL (Сжатый формат)
document.getElementById('share-btn').addEventListener('click', () => {
    console.log('Share button clicked');
    
    // Собираем данные в один компактный объект
    const projectData = {
        h: htmlEditor.getValue(),
        c: cssEditor.getValue(),
        j: jsEditor.getValue(),
        l: document.getElementById('library-select').value
    };

    // Сжимаем объект в одну строку
    const compressed = LZString.compressToEncodedURIComponent(JSON.stringify(projectData));
    
    // Формируем URL с одним параметром data
    const url = `${window.location.origin}${window.location.pathname}?data=${compressed}`;

    navigator.clipboard.writeText(url)
        .then(() => alert('Короткая ссылка скопирована!'))
        .catch(err => {
            console.error('Clipboard error:', err);
            alert('Не удалось скопировать ссылку');
        });
});

// Load from URL (Универсальный загрузчик)
const urlParams = new URLSearchParams(window.location.search);
const compressedData = urlParams.get('data');

if (compressedData) {
    // Если есть сжатые данные (новый формат)
    try {
        const decompressed = LZString.decompressFromEncodedURIComponent(compressedData);
        const project = JSON.parse(decompressed);

        if (project.h !== undefined) htmlEditor.setValue(project.h);
        if (project.c !== undefined) cssEditor.setValue(project.c);
        if (project.j !== undefined) jsEditor.setValue(project.j);
        if (project.l !== undefined) {
            document.getElementById('library-select').value = project.l;
        }
        console.log("Загружено из сжатого формата");
    } catch (e) {
        console.error('Ошибка при чтении сжатых данных:', e);
    }
} else {
    // Если сжатых данных нет, проверяем старые параметры (обратная совместимость)
    if (urlParams.has('html')) {
        htmlEditor.setValue(decodeURIComponent(urlParams.get('html')));
    }
    if (urlParams.has('css')) {
        cssEditor.setValue(decodeURIComponent(urlParams.get('css')));
    }
    if (urlParams.has('js')) {
        jsEditor.setValue(decodeURIComponent(urlParams.get('js')));
    }
    if (urlParams.has('lib')) {
        document.getElementById('library-select').value = decodeURIComponent(urlParams.get('lib'));
    }
}

// Сразу после загрузки обновляем окно просмотра
updatePreview();

// Copy code
document.getElementById('copy-btn').addEventListener('click', () => {
    console.log('Copy button clicked');
    const code = editors[currentTab].getValue();
    navigator.clipboard.writeText(code).then(() => alert('Code copied to clipboard!')).catch(err => console.error('Clipboard error:', err));
});

// Console for errors
window.addEventListener('message', (e) => {
    if (e.data.type === 'error') {
        const consoleDiv = document.getElementById('console');
        const errorMsg = document.createElement('div');
        errorMsg.textContent = `Error: ${e.data.message}`;
        consoleDiv.appendChild(errorMsg);
        consoleDiv.scrollTop = consoleDiv.scrollHeight;
    }
});

// ... (ваши переменные инициализации редакторов остаются теми же)

// Обновленное переключение вкладок
document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
        const targetTab = tab.dataset.tab;
        const container = document.querySelector('.editor-container');

        // Переключение активных классов для кнопок и окон
        document.querySelector('.tab.active').classList.remove('active');
        document.querySelector('.editor.active').classList.remove('active');
        
        tab.classList.add('active');
        document.getElementById(targetTab + '-editor').classList.add('active');

        // НОВОЕ: Показываем консоль только на вкладке JS
        if (targetTab === 'js') {
            container.classList.add('js-active');
        } else {
            container.classList.remove('js-active');
        }

        currentTab = targetTab;
        editors[currentTab].refresh();
    });
});

// Обновленное обновление превью с перехватом логов
function updatePreview() {
    const html = htmlEditor.getValue();
    const css = cssEditor.getValue();
    const js = jsEditor.getValue();
    
    // Очищаем консоль перед каждым запуском
    document.getElementById('console').innerHTML = '';

    const srcdoc = `
        <html>
        <head>
            <style>${css}</style>
        </head>
        <body>
            ${html}
            <script>
                // Перехват функций консоли
                const originalLog = console.log;
                const originalError = console.error;

                console.log = function(...args) {
                    window.parent.postMessage({type: 'log', content: args.join(' ')}, '*');
                    originalLog.apply(console, args);
                };

                console.error = function(...args) {
                    window.parent.postMessage({type: 'error', content: args.join(' ')}, '*');
                    originalError.apply(console, args);
                };

                // Ошибки синтаксиса или выполнения
                window.onerror = function(message, source, lineno) {
                    window.parent.postMessage({type: 'error', content: message + " (Линия: " + lineno + ")"}, '*');
                };
            <\/script>
            <script>${js}<\/script>
        </body>
        </html>
    `;
    document.getElementById('preview').srcdoc = srcdoc;
}

// НОВОЕ: Слушатель для вывода сообщений в консоль
window.addEventListener('message', (e) => {
    if (e.data.type === 'log' || e.data.type === 'error') {
        const consoleDiv = document.getElementById('console');
        const line = document.createElement('div');
        
        // Стилизуем строку (ошибки — красным, логи — белым/зеленым)
        line.style.color = e.data.type === 'error' ? '#ff5555' : '#f8f8f2';
        line.style.borderBottom = '1px solid #333';
        line.style.padding = '2px 0';
        line.textContent = `> ${e.data.content}`;
        
        consoleDiv.appendChild(line);
        consoleDiv.scrollTop = consoleDiv.scrollHeight; // Прокрутка вниз
    }
});


function updatePreview() {
    const html = htmlEditor.getValue();
    const css = cssEditor.getValue();
    const js = jsEditor.getValue();
    
    // Получаем состояние чекбокса
    const shouldIgnoreAlerts = document.getElementById('ignore-alerts').checked;

    // Очищаем консоль
    document.getElementById('console').innerHTML = '';

    const srcdoc = `
        <html>
        <head>
            <style>${css}</style>
        </head>
        <body>
            ${html}
            <script>
                // --- БЛОК ПОДАВЛЕНИЯ ALERT ---
                if (${shouldIgnoreAlerts}) {
                    window.alert = function() { console.log("Alert заблокирован вывод AlertЖ", arguments[0]); };
                    window.confirm = function() { console.log("Confirm заблокирован"); return true; };
                    window.prompt = function() { console.log("Prompt заблокирован"); return null; };
                }

                // Перехват функций консоли (ваш существующий код)
                const originalLog = console.log;
                const originalError = console.error;

                console.log = function(...args) {
                    window.parent.postMessage({type: 'log', content: args.map(a => 
                        typeof a === 'object' ? JSON.stringify(a) : a
                    ).join(' ')}, '*');
                    originalLog.apply(console, args);
                };

                console.error = function(...args) {
                    window.parent.postMessage({type: 'error', content: args.join(' ')}, '*');
                    originalError.apply(console, args);
                };

                window.onerror = function(message, source, lineno) {
                    window.parent.postMessage({type: 'error', content: message + " (Линия: " + lineno + ")"}, '*');
                };
            <\/script>
            <script>${js}<\/script>
        </body>
        </html>
    `;
    document.getElementById('preview').srcdoc = srcdoc;
}

document.getElementById('ignore-alerts').addEventListener('change', updatePreview);