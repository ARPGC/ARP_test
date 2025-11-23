const CACHE_NAME = 'ecocampus-v1';
const ASSETS_TO_CACHE = [
    '/',
    '/index.html',
    '/style.css',
    '/app.js',
    '/utils.js',
    '/state.js',
    '/supabase-client.js',
    '/dashboard.js',
    '/store.js',
    '/events.js',
    '/challenges.js',
    '/social.js',
    '/realtime.js',
    '/chatbot.js',
    '/login.html',
    '/login.js',
    'https://cdn.tailwindcss.com',
    'https://unpkg.com/lucide@latest',
    'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2',
    'https://cdn.jsdelivr.net/npm/localforage@1.10.0/dist/localforage.min.js'
];

// Install Event: Cache App Shells
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(ASSETS_TO_CACHE);
        })
    );
    self.skipWaiting();
});

// Activate Event: Cleanup Old Caches
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(
                keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
            );
        })
    );
    self.clients.claim();
});

// Fetch Event: Stale-While-Revalidate for Static, Network-First for APIs
self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // Supabase API requests: Network First, falling back to offline handling if needed
    // (Note: The app logic uses localForage for data, so we mainly let JS handle API caching)
    if (url.hostname.includes('supabase.co')) {
        return; // Let the browser/app handle API caching strategy
    }

    // Static Assets: Stale-While-Revalidate
    event.respondWith(
        caches.match(event.request).then((cachedResponse) => {
            const fetchPromise = fetch(event.request).then((networkResponse) => {
                // Update cache with new version
                if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
                    const responseToCache = networkResponse.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(event.request, responseToCache);
                    });
                }
                return networkResponse;
            });
            return cachedResponse || fetchPromise;
        })
    );
});
