importScripts('./version.js');

const CACHE_NAME = self.BreathingApp.cacheName;
const urlsToCache = [
  './',
  './index.html',
  './styles.css',
  './version.js',
  './storage.js',
  './ui-utils.js',
  './voice.js',
  './model.js',
  './script.js',
  './manifest.json',
  './Favicon.ico',
  './favicon.svg',
  './icon-192.png',
  './icon-512.png',
  './icon-512-maskable.png',
  './apple-touch-icon.png',
  './audio/voice/en/Inhale.mp3',
  './audio/voice/en/Exhale.mp3',
  './audio/voice/en/Pause.mp3',
  './audio/voice/es/Inhale.mp3',
  './audio/voice/es/Exhale.mp3',
  './audio/voice/es/Pause.mp3',
  './audio/voice/fr/Inhale.mp3',
  './audio/voice/fr/Exhale.mp3',
  './audio/voice/fr/Pause.mp3',
  './audio/voice/ro/Inhale.mp3',
  './audio/voice/ro/Exhale.mp3',
  './audio/voice/ro/Pause.mp3',
  './vendor/bootstrap/bootstrap.min.css',
  './vendor/bootstrap/bootstrap.bundle.min.js',
  './vendor/fontawesome/css/fontawesome.min.css',
  './vendor/fontawesome/css/solid.min.css',
  './vendor/fontawesome/webfonts/fa-solid-900.woff2'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => caches.match('./index.html'))
    );
    return;
  }

  if (event.request.destination === 'script' || event.request.destination === 'style') {
    event.respondWith((async () => {
      const cached = await caches.match(event.request);
      try {
        const response = await fetch(event.request);
        if (response.ok && new URL(event.request.url).origin === self.location.origin) {
          const cache = await caches.open(CACHE_NAME);
          await cache.put(event.request, response.clone());
        }
        return response;
      } catch (error) {
        if (cached) return cached;
        throw error;
      }
    })());
    return;
  }

  event.respondWith((async () => {
    const cached = await caches.match(event.request);
    const refresh = fetch(event.request).then(async response => {
      if (response.ok && new URL(event.request.url).origin === self.location.origin) {
        const cache = await caches.open(CACHE_NAME);
        await cache.put(event.request, response.clone());
      }
      return response;
    });

    if (cached) {
      event.waitUntil(refresh.catch(() => undefined));
      return cached;
    }
    return refresh;
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => Promise.all(
      cacheNames
        .filter(name => name !== CACHE_NAME)
        .map(name => caches.delete(name))
    )).then(() => self.clients.claim())
  );
});
