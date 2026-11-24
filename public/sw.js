// MUDE ESTE NÚMERO para forçar atualização do cache em todos os dispositivos
const CACHE_NAME = 'larose-v3.4';

const ASSETS_TO_CACHE = [
    '/','/index.html','/lancamento.html','/dashboard.html','/manifest.json',
    '/css/style.css?v=3.4','/js/modal.js?v=3.4','/js/app.js?v=3.4',
    '/js/data.js','/js/firebase-config.js',
    '/assets/images/logo.png','/assets/icons/icon-192.png','/assets/icons/icon-512.png'
];

// Origens externas que NUNCA devem ser interceptadas pelo SW
// (Firebase, Google Fonts, CDNs — usam streams que não podem ser clonados)
const SKIP_ORIGINS = [
    'firestore.googleapis.com',
    'firebase.googleapis.com',
    'identitytoolkit.googleapis.com',
    'securetoken.googleapis.com',
    'fonts.googleapis.com',
    'fonts.gstatic.com',
    'cdnjs.cloudflare.com',
    'www.gstatic.com'
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

    // Ignora requisições externas (Firebase, Fonts, CDNs)
    const url = new URL(r.url);
    if (SKIP_ORIGINS.some(origin => url.hostname.includes(origin))) return;

    // Páginas HTML: network-first (tenta buscar fresco, cai no cache se offline)
    if (r.headers.get('accept')?.includes('text/html')) {
        e.respondWith(
            fetch(r)
                .then(res => {
                    const clone = res.clone();
                    caches.open(CACHE_NAME).then(c => c.put(r, clone));
                    return res;
                })
                .catch(() => caches.match(r).then(c => c || caches.match('/index.html')))
        );
        return;
    }

    // Demais recursos da própria origem: cache-first
    e.respondWith(
        caches.match(r).then(cached => {
            if (cached) return cached;
            return fetch(r).then(res => {
                // Só cacheia respostas válidas da mesma origem
                if (res.ok && res.type === 'basic') {
                    const clone = res.clone();
                    caches.open(CACHE_NAME).then(c => c.put(r, clone));
                }
                return res;
            });
        })
    );
});
