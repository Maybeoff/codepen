const CACHE_NAME = 'codepen-pro-v2';
const urlsToCache = [
    './',
    './index.html',
    './styles.css',
    './script.js',
    './themes/dark.css',
    './themes/blue.css',
    './themes/purple.css',
    './manifest.json',
    './sw.js',
    'https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.2/codemirror.min.css',
    'https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.2/codemirror.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.2/mode/htmlmixed/htmlmixed.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.2/mode/css/css.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.2/mode/javascript/javascript.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/lz-string/1.4.4/lz-string.min.js'
];

// Установка Service Worker
self.addEventListener('install', (event) => {
    // Принудительно активируем новый SW сразу
    self.skipWaiting();
    
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('Кэширование файлов');
                return cache.addAll(urlsToCache);
            })
            .catch((error) => {
                console.log('Ошибка кэширования:', error);
            })
    );
});

// Активация и очистка старых кэшей
self.addEventListener('activate', (event) => {
    // Берем контроль над всеми клиентами сразу
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('Удаление старого кэша:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => {
            return self.clients.claim();
        })
    );
});

// Перехват запросов - NETWORK FIRST стратегия
self.addEventListener('fetch', (event) => {
    event.respondWith(
        // Сначала пытаемся загрузить из сети
        fetch(event.request)
            .then((response) => {
                // Если успешно - кешируем и возвращаем
                if (response && response.status === 200) {
                    const responseToCache = response.clone();
                    
                    caches.open(CACHE_NAME)
                        .then((cache) => {
                            cache.put(event.request, responseToCache);
                        });
                }
                
                return response;
            })
            .catch(() => {
                // Если сеть недоступна - берем из кеша
                return caches.match(event.request)
                    .then((response) => {
                        if (response) {
                            return response;
                        }
                        // Офлайн fallback
                        return caches.match('./index.html');
                    });
            })
    );
});
