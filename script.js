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

// Share via URL
document.getElementById('share-btn').addEventListener('click', () => {
    console.log('Share button clicked');
    const html = encodeURIComponent(htmlEditor.getValue());
    const css = encodeURIComponent(cssEditor.getValue());
    const js = encodeURIComponent(jsEditor.getValue());
    const library = encodeURIComponent(document.getElementById('library-select').value);
    const url = `${window.location.origin}${window.location.pathname}?html=${html}&css=${css}&js=${js}&lib=${library}`;
    navigator.clipboard.writeText(url).then(() => alert('Share link copied to clipboard!')).catch(err => console.error('Clipboard error:', err));
});

// Load from URL
const urlParams = new URLSearchParams(window.location.search);
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
