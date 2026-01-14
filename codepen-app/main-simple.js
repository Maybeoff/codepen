const { app, BrowserWindow, Menu } = require('electron');
const path = require('path');

console.log('Запуск CodePen Pro Desktop...');

app.disableHardwareAcceleration();

// Игнорируем SSL ошибки (просроченные сертификаты)
app.commandLine.appendSwitch('ignore-certificate-errors');
app.commandLine.appendSwitch('allow-insecure-localhost', 'true');

let mainWindow;

function createWindow() {
  console.log('Создание главного окна...');
  
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    show: true,
    icon: path.join(__dirname, 'icons', 'icon-512.ico'), // Нормальная ICO иконка 512x512
    autoHideMenuBar: true, // Скрываем меню
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      webSecurity: false
    }
  });

  mainWindow.loadFile('index.html').then(() => {
    console.log('CodePen Pro загружен успешно!');
    // createMenu(); // Убираем создание меню
  }).catch(err => {
    console.error('Ошибка загрузки:', err);
  });

  // Открываем DevTools в режиме разработки
  if (process.argv.includes('--dev')) {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function createMenu() {
  const template = [
    {
      label: 'Файл',
      submenu: [
        {
          label: 'Новый проект',
          accelerator: 'CmdOrCtrl+N',
          click: () => {
            if (mainWindow) {
              mainWindow.webContents.executeJavaScript('if(typeof createNewProject === "function") createNewProject();').catch(console.error);
            }
          }
        },
        {
          label: 'Сохранить проект',
          accelerator: 'CmdOrCtrl+S',
          click: () => {
            if (mainWindow) {
              mainWindow.webContents.executeJavaScript('if(typeof saveCurrentProject === "function") { saveCurrentProject(); showToast("Проект сохранён!", "success"); }').catch(console.error);
            }
          }
        },
        { type: 'separator' },
        {
          label: 'Экспорт в ZIP',
          click: () => {
            if (mainWindow) {
              mainWindow.webContents.executeJavaScript('if(typeof exportToZip === "function") exportToZip();').catch(console.error);
            }
          }
        },
        {
          label: 'Импорт из ZIP',
          click: () => {
            if (mainWindow) {
              mainWindow.webContents.executeJavaScript('if(typeof openImportDialog === "function") openImportDialog();').catch(console.error);
            }
          }
        },
        { type: 'separator' },
        {
          label: 'Выход',
          accelerator: process.platform === 'darwin' ? 'Cmd+Q' : 'Ctrl+Q',
          click: () => {
            app.quit();
          }
        }
      ]
    },
    {
      label: 'Правка',
      submenu: [
        {
          label: 'Форматировать код',
          accelerator: 'CmdOrCtrl+Shift+F',
          click: () => {
            if (mainWindow) {
              mainWindow.webContents.executeJavaScript('if(typeof formatCode === "function") formatCode();').catch(console.error);
            }
          }
        },
        { type: 'separator' },
        { role: 'undo', label: 'Отменить' },
        { role: 'redo', label: 'Повторить' },
        { type: 'separator' },
        { role: 'cut', label: 'Вырезать' },
        { role: 'copy', label: 'Копировать' },
        { role: 'paste', label: 'Вставить' },
        { role: 'selectall', label: 'Выделить всё' }
      ]
    },
    {
      label: 'Вид',
      submenu: [
        {
          label: 'Запустить код',
          accelerator: 'CmdOrCtrl+Enter',
          click: () => {
            if (mainWindow) {
              mainWindow.webContents.executeJavaScript('if(typeof updatePreview === "function") updatePreview();').catch(console.error);
            }
          }
        },
        {
          label: 'Полноэкранный превью',
          accelerator: 'F11',
          click: () => {
            if (mainWindow) {
              mainWindow.webContents.executeJavaScript('if(typeof toggleFullscreen === "function") toggleFullscreen();').catch(console.error);
            }
          }
        },
        { type: 'separator' },
        { role: 'reload', label: 'Перезагрузить' },
        { role: 'toggleDevTools', label: 'Инструменты разработчика' },
        { type: 'separator' },
        { role: 'resetZoom', label: 'Сбросить масштаб' },
        { role: 'zoomIn', label: 'Увеличить' },
        { role: 'zoomOut', label: 'Уменьшить' },
        { type: 'separator' },
        { role: 'togglefullscreen', label: 'Полный экран' }
      ]
    },
    {
      label: 'Настройки',
      submenu: [
        {
          label: 'Открыть настройки',
          accelerator: 'CmdOrCtrl+,',
          click: () => {
            if (mainWindow) {
              mainWindow.webContents.executeJavaScript('if(typeof openSettingsModal === "function") openSettingsModal();').catch(console.error);
            }
          }
        },
        { type: 'separator' },
        {
          label: 'Включить/выключить снегопад ❄️',
          click: () => {
            if (mainWindow) {
              mainWindow.webContents.executeJavaScript('if(typeof toggleSnowfall === "function") toggleSnowfall();').catch(console.error);
            }
          }
        }
      ]
    },
    {
      label: 'Справка',
      submenu: [
        {
          label: 'О программе',
          click: () => {
            if (mainWindow) {
              mainWindow.webContents.executeJavaScript(`
                if(typeof showToast === "function") {
                  showToast('CodePen Pro Desktop v1.0.0 - Мощный редактор кода для HTML, CSS и JavaScript', 'info');
                }
              `).catch(console.error);
            }
          }
        },
        {
          label: 'Горячие клавиши',
          click: () => {
            if (mainWindow) {
              mainWindow.webContents.executeJavaScript(`
                if(typeof showToast === "function") {
                  showToast('Ctrl+N - Новый проект, Ctrl+S - Сохранить, Ctrl+Enter - Запустить код, F11 - Полноэкранный превью', 'info');
                }
              `).catch(console.error);
            }
          }
        }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

app.whenReady().then(() => {
  console.log('Electron готов, создаем окно...');
  createWindow();
});

app.on('window-all-closed', () => {
  console.log('Все окна закрыты');
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  console.log('Активация приложения');
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

console.log('CodePen Pro Desktop main загружен');