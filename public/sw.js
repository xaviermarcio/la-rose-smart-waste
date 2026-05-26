const CACHE_NAME = 'larose-v1.7';

const ASSETS_TO_CACHE = [
    '/','/index.html','/lancamento.html','/dashboard.html','/manifest.json',
    '/css/style.css?v=21.0','/js/modal.js?v=1.0','/js/app.js?v=21.0',
    '/js/data.js','/js/firebase-config.js',
    '/assets/images/logo.png','/assets/icons/icon-192.png','/assets/icons/icon-512.png',
    'https://fonts.googleapis.com/css2?family=Syne:wght@700;800;900&family=Inter:wght@300;400;500;600;700;800;900&display=swap',
    'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js'
];

self.addEventListener('install', (event) => {
    self.skipWaiting();
    event.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(ASSETS_TO_CACHE)));
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys()
            .then(names => Promise.all(names.map(n => n !== CACHE_NAME && caches.delete(n))))
            .then(() => self.clients.claim())
            .then(() => self.clients.matchAll({ type: 'window', includeUncontrolled: true }))
            .then(clients => clients.forEach(c => c.postMessage({ type: 'SW_ATUALIZADO' })))
    );
});

self.addEventListener('fetch', (event) => {
    const req = event.request;
    if (req.method !== 'GET') return;
    if (req.headers.get('accept')?.includes('text/html')) {
        event.respondWith(
            fetch(req).then(r => { caches.open(CACHE_NAME).then(c => c.put(req, r.clone())); return r; })
                .catch(() => caches.match(req).then(c => c || caches.match('/index.html')))
        );
        return;
    }
    event.respondWith(
        caches.match(req).then(c => c || fetch(req).then(r => {
            caches.open(CACHE_NAME).then(cache => cache.put(req, r.clone())); return r;
        }))
    );
});