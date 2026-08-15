const CACHE_NAME = 'breathing-timer-v20';
const urlsToCache = [
  './',
  './index.html',
  './styles.css',
  './model.js',
  './script.js',
  './manifest.json',
  './Favicon.ico',
  './favicon.svg',
  './icon-192.png',
  './icon-512.png',
  './icon-512-maskable.png',
  './apple-touch-icon.png',
  './vendor/bootstrap/bootstrap.min.css',
  './vendor/bootstrap/bootstrap.bundle.min.js',
  './vendor/fontawesome/css/fontawesome.min.css',
  './vendor/fontawesome/css/solid.min.css',
  './vendor/fontawesome/webfonts/fa-solid-900.woff2',
  './tibetan-singing-bowl-54400.mp3'
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

  event.respondWith(
    caches.match(event.request)
      .then(response => {
        if (response) {
          return response;
        }
        return fetch(event.request);
      })
  );
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
