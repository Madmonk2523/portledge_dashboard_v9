// Service Worker for Offline Functionality
const CACHE_NAME = 'portledge-dashboard-v2';
const urlsToCache = [
  '/',
  '/index.html',
  '/main/index.html',
  '/main/api.js',
  '/pantherbot/pantherbot.js',
  '/pantherbot/handbook.js',
  '/pantherbot/athleticsHandbook.js',
  '/pantherbot/apiKey.js',
  '/manifest.json',
  '/portledge_crest.png',
  '/portledge_crest.svg',
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;700;900&display=swap'
];

// Install event - cache resources
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Service Worker: Caching files');
        return cache.addAll(urlsToCache).catch(err => {
          console.log('Service Worker: Cache failed for some resources', err);
        });
      })
      .then(() => self.skipWaiting())
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cache => {
          if (cache !== CACHE_NAME) {
            console.log('Service Worker: Clearing old cache');
            return caches.delete(cache);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', event => {
  const req = event.request;

  // Offline fallback for AI endpoint
  if (req.method === 'POST' && new URL(req.url).pathname.startsWith('/api/chat')) {
    event.respondWith(
      fetch(req.clone()).catch(() => new Response(JSON.stringify({
        error: 'offline',
        message: 'Offline: PantherBot is unavailable without internet.'
      }), { status: 503, headers: { 'Content-Type': 'application/json' } }))
    );
    return;
  }

  event.respondWith(
    caches.match(req).then(cached => {
      if (cached) return cached;
      return fetch(req.clone()).then(res => {
        // Only cache same-origin GET successful responses
        if (req.method === 'GET' && res && res.status === 200) {
          const url = new URL(req.url);
          if (url.origin === location.origin) {
            const copy = res.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(req, copy)).catch(()=>{});
          }
        }
        return res;
      }).catch(() => caches.match('/main/index.html'));
    })
  );
});
