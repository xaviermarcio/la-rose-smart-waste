const CACHE_NAME = 'larose-v1.1';

const ASSETS_TO_CACHE = [
    '/',
    '/index.html',
    '/lancamento.html',
    '/dashboard.html',
    '/manifest.json',
    '/css/style.css?v=17.0',
    '/js/modal.js?v=1.0',
    '/js/app.js?v=17.0',
    '/js/data.js',
    '/js/firebase-config.js',
    '/assets/images/logo.png',
    '/assets/icons/icon-192.png',
    '/assets/icons/icon-512.png',
    'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap',
    'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js'
];

self.addEventListener('install', (event) => {
    // Força o novo SW a assumir imediatamente, sem esperar fechar o app
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS_TO_CACHE))
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys()
            .then((cacheNames) =>
                Promise.all(
                    cacheNames.map((cache) => {
                        if (cache !== CACHE_NAME) return caches.delete(cache);
                    })
                )
            )
            .then(() => self.clients.claim())
            .then(() => {
                // Avisa TODOS os clientes abertos (inclusive no celular em background)
                // para recarregar e pegar a nova versão
                return self.clients.matchAll({ type: 'window', includeUncontrolled: true });
            })
            .then((clients) => {
                clients.forEach((client) => {
                    // Envia mensagem para o app mostrar o modal de atualização
                    client.postMessage({ type: 'SW_ATUALIZADO' });
                });
            })
    );
});

self.addEventListener('fetch', (event) => {
    const request = event.request;
    if (request.method !== 'GET') return;

    // HTML: Network-first — sempre busca versão mais recente
    if (request.headers.get('accept')?.includes('text/html')) {
        event.respondWith(
            fetch(request)
                .then((response) => {
                    const clone = response.clone();
                    caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
                    return response;
                })
                .catch(() => caches.match(request).then((cached) => cached || caches.match('/index.html')))
        );
        return;
    }

    // Assets: Cache-first
    event.respondWith(
        caches.match(request).then((cached) => {
            if (cached) return cached;
            return fetch(request).then((response) => {
                const clone = response.clone();
                caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
                return response;
            });
        })
    );
});