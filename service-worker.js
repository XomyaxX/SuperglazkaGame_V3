const CACHE_NAME = 'superglazka-v10';

const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/app.html',
  '/parents.html',
  '/privacy.html',
  '/blog.html',
  '/checklist.html',
  '/favicon.svg',
  '/manifest.json',
  '/css/style.css',
  '/css/landing.css',
  '/js/app.js',
  '/js/player.js',
  '/js/game_blink.js',
  '/js/game_gymnastics.js',
  '/js/game_runner.js',
  '/js/game_tracker.js',
  '/js/error-reporter.js',
  '/js/episodes/assets.js',
  '/js/episodes/index.js',
  '/js/episodes/episode-01.js',
  '/js/episodes/episode-02.js',
  '/assets/shared/characters/lenivus.png',
  '/assets/shared/characters/superglazka.png',
  '/assets/shared/characters/vanya.png',
  '/assets/shared/characters/wise-crystal.png',
  '/assets/shared/games/runner-jump.png',
  '/assets/shared/games/runner-run.png',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png'
];

// Install: cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  );
});

// Activate: clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) =>
      Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      )
    ).then(() => self.clients.claim())
  );
});

// Fetch: cache-first strategy
self.addEventListener('fetch', (event) => {
  // Skip non-GET requests and external resources (Google Fonts, analytics, etc.)
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  // Skip video/audio files — too large for cache
  const path = url.pathname.toLowerCase();
  if (path.endsWith('.mp4') || path.endsWith('.mp3') || path.endsWith('.webm') || path.endsWith('.wav')) return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request)
        .then((response) => {
          // Cache successful responses for future offline use
          if (response && response.status === 200 && response.type === 'basic') {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => {
          // Fallback for navigation requests
          if (event.request.mode === 'navigate') {
            return caches.match('/app.html');
          }
          return new Response('Offline', { status: 503, statusText: 'Service Unavailable' });
        });
    })
  );
});
