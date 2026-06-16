// MUDE ESTE NÚMERO para forçar atualização do cache em todos os dispositivos
const CACHE_NAME = 'larose-v3.0';

const ASSETS_TO_CACHE = [
    '/','/index.html','/lancamento.html','/dashboard.html','/manifest.json',
    '/css/style.css?v=3.0','/js/modal.js?v=3.0','/js/app.js?v=3.0',
    '/js/data.js','/js/firebase-config.js',
    '/assets/images/logo.png','/assets/icons/icon-192.png','/assets/icons/icon-512.png',
    'https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700;900&family=Inter:wght@300;400;500;600;700;800;900&display=swap',
    'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js'
];

self.addEventListener('install', e => {
    self.skipWaiting();
    e.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(ASSETS_TO_CACHE)));
});

self.addEventListener('activate', e => {
    e.waitUntil(
        caches.keys()
            .then(names => Promise.all(names.map(n => n !== CACHE_NAME && caches.delete(n))))
            .then(() => self.clients.claim())
            .then(() => self.clients.matchAll({ type: 'window', includeUncontrolled: true }))
            .then(clients => clients.forEach(c => c.postMessage({ type: 'SW_ATUALIZADO' })))
    );
});

self.addEventListener('fetch', e => {
    const r = e.request;
    if (r.method !== 'GET') return;
    if (r.headers.get('accept')?.includes('text/html')) {
        e.respondWith(fetch(r).then(res => { caches.open(CACHE_NAME).then(c => c.put(r, res.clone())); return res; })
            .catch(() => caches.match(r).then(c => c || caches.match('/index.html'))));
        return;
    }
    e.respondWith(caches.match(r).then(c => c || fetch(r).then(res => {
        caches.open(CACHE_NAME).then(ca => ca.put(r, res.clone())); return res;
    })));
});
