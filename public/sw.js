const CACHE_NAME = 'larose-v3.6';

const ASSETS_TO_CACHE = [
    '/','/index.html','/lancamento.html','/dashboard.html','/manifest.json',
    '/css/style.css?v=3.4','/js/modal.js?v=3.4','/js/app.js?v=3.4',
    '/js/data.js','/js/firebase-config.js',
    '/assets/images/logo.png','/assets/icons/icon-192.png','/assets/icons/icon-512.png'
];

// Nunca interceptar essas origens (Firebase, Fonts, CDNs)
function deveIgnorar(url) {
    return (
        url.origin !== self.location.origin ||
        url.pathname.startsWith('/__/') // Firebase hosting internals
    );
}

self.addEventListener('install', e => {
    self.skipWaiting();
    e.waitUntil(
        caches.open(CACHE_NAME).then(c => c.addAll(ASSETS_TO_CACHE)).catch(() => {})
    );
});

self.addEventListener('activate', e => {
    e.waitUntil(
        caches.keys()
            .then(names => Promise.all(
                names.filter(n => n !== CACHE_NAME).map(n => caches.delete(n))
            ))
            .then(() => self.clients.claim())
            .then(() => self.clients.matchAll({ type: 'window', includeUncontrolled: true }))
            .then(clients => clients.forEach(c => c.postMessage({ type: 'SW_ATUALIZADO' })))
    );
});

self.addEventListener('fetch', e => {
    const r = e.request;

    // Só intercepta GET da própria origem
    if (r.method !== 'GET') return;

    let url;
    try { url = new URL(r.url); } catch { return; }

    if (deveIgnorar(url)) return;

    // HTML: network-first
    if (r.headers.get('accept')?.includes('text/html')) {
        e.respondWith(
            fetch(r.url, { credentials: 'same-origin' })
                .then(res => {
                    if (res.ok) {
                        const clone = res.clone();
                        caches.open(CACHE_NAME).then(c => c.put(r, clone)).catch(() => {});
                    }
                    return res;
                })
                .catch(() => caches.match(r).then(c => c || caches.match('/index.html')))
        );
        return;
    }

    // Demais recursos: cache-first
    e.respondWith(
        caches.match(r).then(cached => {
            if (cached) return cached;
            return fetch(r.url, { credentials: 'same-origin' })
                .then(res => {
                    if (res.ok && res.status < 400) {
                        const clone = res.clone();
                        caches.open(CACHE_NAME).then(c => c.put(r, clone)).catch(() => {});
                    }
                    return res;
                })
                .catch(() => new Response('Offline', { status: 503 }));
        })
    );
});
