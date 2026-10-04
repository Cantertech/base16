const CACHE_NAME = 'base16-pwa-v4';
const PRECACHE_ASSETS = [
    '/',
    '/index.html',
    '/manifest.json',
    '/favicon.png',
    '/orbit_pwa.png',
    '/orbit_transparent_white_logo.png',
    '/orbit_logo_new.png'
];

// 1. Install Event: Pre-cache core shell
self.addEventListener('install', event => {
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => {
            return cache.addAll(PRECACHE_ASSETS).catch(err => {
                console.warn('PWA Precache warning (non-fatal):', err);
            });
        })
    );
});

// 2. Activate Event: Clean up legacy caches
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(keys => {
            return Promise.all(
                keys.map(key => {
                    if (key !== CACHE_NAME) {
                        console.log('PWA: Removing old cache:', key);
                        return caches.delete(key);
                    }
                })
            );
        }).then(() => clients.claim())
    );
});

// 3. Fetch Event: Smart routing
self.addEventListener('fetch', event => {
    // Only handle GET requests
    if (event.request.method !== 'GET') return;

    const url = new URL(event.request.url);

    // Bypass external APIs and dynamic endpoints (Supabase, Hubtel, Paystack, Cloudinary, Google Analytics)
    if (
        url.origin !== self.location.origin ||
        url.pathname.startsWith('/rest/v1') ||
        url.pathname.startsWith('/auth/v1') ||
        url.pathname.startsWith('/functions/v1')
    ) {
        return;
    }

    // A. Navigation (HTML Pages): Network first, falling back to cached SPA shell
    if (event.request.mode === 'navigate') {
        event.respondWith(
            fetch(event.request)
                .catch(() => {
                    return caches.match('/index.html') || caches.match('/');
                })
        );
        return;
    }

    // B. Static Assets (JS, CSS, Images, Fonts): Stale-While-Revalidate
    event.respondWith(
        caches.match(event.request).then(cachedResponse => {
            const fetchPromise = fetch(event.request)
                .then(networkResponse => {
                    if (networkResponse && networkResponse.status === 200) {
                        const responseClone = networkResponse.clone();
                        caches.open(CACHE_NAME).then(cache => {
                            cache.put(event.request, responseClone);
                        });
                    }
                    return networkResponse;
                })
                .catch(() => cachedResponse);

            return cachedResponse || fetchPromise;
        })
    );
});
