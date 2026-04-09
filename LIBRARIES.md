# Локальные библиотеки

Все JavaScript и CSS библиотеки теперь загружаются локально из папки `lib/`.

## Структура папки lib/

```
lib/
├── codemirror/
│   ├── codemirror.min.js          # Основная библиотека CodeMirror
│   ├── codemirror.min.css         # Стили CodeMirror
│   ├── theme/                     # Темы редактора
│   │   ├── dracula.min.css
│   │   ├── monokai.min.css
│   │   ├── material.min.css
│   │   └── solarized.min.css
│   ├── mode/                      # Режимы подсветки синтаксиса
│   │   ├── xml.min.js
│   │   ├── htmlmixed.min.js
│   │   ├── css.min.js
│   │   └── javascript.min.js
│   └── addon/                     # Дополнения CodeMirror
│       ├── show-hint.min.js       # Автодополнение
│       ├── show-hint.min.css
│       ├── html-hint.min.js
│       ├── css-hint.min.js
│       ├── javascript-hint.min.js
│       ├── closebrackets.min.js   # Автозакрытие скобок
│       ├── closetag.min.js        # Автозакрытие тегов
│       ├── foldcode.min.js        # Сворачивание кода
│       ├── foldgutter.min.js
│       ├── foldgutter.min.css
│       ├── xml-fold.min.js
│       ├── indent-fold.min.js
│       ├── brace-fold.min.js
│       ├── comment-fold.min.js
│       ├── search.min.js          # Поиск
│       ├── searchcursor.min.js
│       ├── jump-to-line.min.js
│       ├── dialog.min.js
│       └── dialog.min.css
├── lz-string.min.js               # Сжатие данных
├── jszip.min.js                   # Работа с ZIP архивами
├── prettier-standalone.js         # Форматирование кода
├── prettier-parser-html.min.js
├── prettier-parser-postcss.min.js
└── prettier-parser-babel.min.js
```

## Преимущества локальных библиотек

1. **Работа офлайн** - приложение работает без интернета
2. **Быстрая загрузка** - нет задержек от CDN
3. **Стабильность** - не зависит от доступности внешних серверов
4. **Безопасность** - контроль над всеми зависимостями
5. **PWA готовность** - все ресурсы могут быть закешированы Service Worker

## Обновление библиотек

Если нужно обновить библиотеки:

1. Отредактируйте `download-libs.js` с новыми версиями
2. Запустите: `node download-libs.js`
3. Проверьте работоспособность приложения

## Версии библиотек

- **CodeMirror**: 5.65.2
- **LZ-String**: 1.4.4
- **JSZip**: 3.10.1
- **Prettier**: 2.8.0
