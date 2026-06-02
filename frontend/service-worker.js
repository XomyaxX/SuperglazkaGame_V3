const CACHE_NAME = 'superglazka-v46';

const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/app.html',
  '/parents.html',
  '/privacy.html',
  '/blog.html',
  '/blog-post.html',
  '/faq.html',
  '/checklist.html',
  '/about.html',
  '/favicon.svg',
  '/manifest.json',
  '/css/style.css',
  '/css/landing.css',
  '/js/app.js',
  '/js/player.js',
  '/js/game-difficulty.js',
  '/js/game_blink.js',
  '/js/game_gymnastics.js',
  '/js/game_runner.js',
  '/js/game_peripheral.js',
  '/js/game_scrollshoter.js',
  '/js/scrollshoter_game.js',
  '/js/scrollshoter_shaders.js',
  '/js/error-reporter.js',
  '/js/mood-detector.js',
  '/js/background-music.js',
  '/js/tone.min.js',
  '/js/auth.js',
  '/js/i18n.js',
  '/js/blog-data.js',
  '/js/analytics.js',
  '/js/landing-main.js',
  '/js/landing-games.js',
  '/js/achievements.js',
  '/js/daily-reward.js',
  '/js/haptic.js',
  '/js/leaderboard.js',
  '/js/navigation-sounds.js',
  '/js/tutorial.js',
  '/locales/ru.json',
  '/locales/en.json',
  '/locales/kz.json',
  '/locales/zh.json',
  '/assets/shared/characters/lenivus.png',
  '/assets/shared/characters/lenivus.webp',
  '/assets/shared/characters/superglazka.png',
  '/assets/shared/characters/superglazka.webp',
  '/assets/shared/characters/vanya.png',
  '/assets/shared/characters/vanya.webp',
  '/assets/shared/characters/wise-crystal.png',
  '/assets/shared/characters/wise-crystal.webp',
  '/assets/shared/games/runner-jump.png',
  '/assets/shared/games/runner-jump.webp',
  '/assets/shared/games/runner-run.png',
  '/assets/shared/games/runner-run.webp',
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

// Fetch: stale-while-revalidate for JS/CSS, cache-first for everything else
self.addEventListener('fetch', (event) => {
  // Skip non-GET requests and external resources
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  const path = url.pathname.toLowerCase();

  // Skip API routes — never cache dynamic data
  if (path.startsWith('/api/')) return;

  // Skip video/audio files — too large for cache
  if (path.endsWith('.mp4') || path.endsWith('.mp3') || path.endsWith('.webm') || path.endsWith('.wav')) return;

  // Skip admin panel — always fresh
  if (path === '/admin.html') return;

  const isJsOrCss = path.endsWith('.js') || path.endsWith('.css');

  if (isJsOrCss) {
    // Stale-while-revalidate: serve from cache immediately, but update in background
    event.respondWith(
      caches.match(event.request).then((cached) => {
        const fetchPromise = fetch(event.request)
          .then((response) => {
            if (response && response.status === 200 && response.type === 'basic') {
              const clone = response.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
            }
            return response;
          })
          .catch(() => cached); // fallback to cache if network fails

        return cached || fetchPromise || new Response('Offline', { status: 503, statusText: 'Service Unavailable' });
      })
    );
  } else {
    // Cache-first for images, fonts, and other static assets
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) return cached;
        return fetch(event.request)
          .then((response) => {
            if (response && response.status === 200 && response.type === 'basic') {
              const clone = response.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
            }
            return response;
          })
          .catch(() => {
            if (event.request.mode === 'navigate') {
              return caches.match('/app.html');
            }
            return new Response('Offline', { status: 503, statusText: 'Service Unavailable' });
          });
      })
    );
  }
});
