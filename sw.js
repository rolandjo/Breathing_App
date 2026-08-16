importScripts('./version.js');

const CACHE_NAME = self.BreathingApp.cacheName;
const urlsToCache = [
  './',
  './index.html',
  './styles.css',
  './version.js',
  './storage.js',
  './ui-utils.js',
  './translations/english.js',
  './translations/spanish.js',
  './translations/french.js',
  './translations/romanian.js',
  './translation-manager.js',
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
  './audio/tibetan-singing-bowl-54400.mp3',
  './audio/voice/en/In.mp3',
  './audio/voice/en/Out.mp3',
  './audio/voice/en/Hold.mp3',
  './audio/voice/en/Pause.mp3',
  './audio/voice/es/In.mp3',
  './audio/voice/es/Out.mp3',
  './audio/voice/es/Hold.mp3',
  './audio/voice/es/Pause.mp3',
  './audio/voice/fr/In.mp3',
  './audio/voice/fr/Out.mp3',
  './audio/voice/fr/Hold.mp3',
  './audio/voice/fr/Pause.mp3',
  './audio/voice/ro/In.mp3',
  './audio/voice/ro/Out.mp3',
  './audio/voice/ro/Hold.mp3',
  './audio/voice/ro/Pause.mp3',
  './vendor/bootstrap/bootstrap.min.css',
  './vendor/bootstrap/bootstrap.bundle.min.js',
  './vendor/howler/howler.core.min.js',
  './vendor/fontawesome/css/fontawesome.min.css',
  './vendor/fontawesome/css/solid.min.css',
  './vendor/fontawesome/webfonts/fa-solid-900.woff2'
];

/**
 * Parses the single byte range used by HTML media elements.
 * Cached responses contain the complete file, so the service worker must
 * reconstruct the server's 206 response instead of returning that cached 200
 * response directly. Android rejects a media source when this contract is
 * broken even though some desktop browsers tolerate it.
 *
 * @param {string} rangeHeader - HTTP Range header value
 * @param {number} totalLength - complete response body length in bytes
 * @returns {{start: number, end: number}|null} normalized inclusive range
 */
function parseByteRange(rangeHeader, totalLength) {
  if (!Number.isSafeInteger(totalLength) || totalLength <= 0) return null;

  const match = /^bytes=(\d*)-(\d*)$/.exec(String(rangeHeader).trim());
  if (!match || (!match[1] && !match[2])) return null;

  if (!match[1]) {
    const suffixLength = Number(match[2]);
    if (!Number.isSafeInteger(suffixLength) || suffixLength <= 0) return null;
    return {
      start: Math.max(totalLength - suffixLength, 0),
      end: totalLength - 1
    };
  }

  const start = Number(match[1]);
  const requestedEnd = match[2] ? Number(match[2]) : totalLength - 1;
  if (
    !Number.isSafeInteger(start)
    || !Number.isSafeInteger(requestedEnd)
    || start >= totalLength
    || requestedEnd < start
  ) {
    return null;
  }

  return { start, end: Math.min(requestedEnd, totalLength - 1) };
}

/**
 * Builds a standards-compliant partial response from a complete cached asset.
 * Cache Storage does not vary media entries by Range reliably, so partial
 * responses are generated in memory and are never written back to the cache.
 *
 * @param {Response} fullResponse - complete status-200 media response
 * @param {string} rangeHeader - requested byte range
 * @returns {Promise<Response>} 206 response, or 416 for an invalid range
 */
async function createPartialResponse(fullResponse, rangeHeader) {
  const body = await fullResponse.arrayBuffer();
  const totalLength = body.byteLength;
  const range = parseByteRange(rangeHeader, totalLength);

  if (!range) {
    return new Response(null, {
      status: 416,
      statusText: 'Range Not Satisfiable',
      headers: {
        'Accept-Ranges': 'bytes',
        'Content-Range': `bytes */${totalLength}`,
        'Content-Length': '0'
      }
    });
  }

  const headers = new Headers();
  const contentType = fullResponse.headers.get('Content-Type');
  const cacheControl = fullResponse.headers.get('Cache-Control');
  if (contentType) headers.set('Content-Type', contentType);
  if (cacheControl) headers.set('Cache-Control', cacheControl);
  headers.set('Accept-Ranges', 'bytes');
  headers.set('Content-Range', `bytes ${range.start}-${range.end}/${totalLength}`);
  headers.set('Content-Length', String(range.end - range.start + 1));

  return new Response(body.slice(range.start, range.end + 1), {
    status: 206,
    statusText: 'Partial Content',
    headers
  });
}

/**
 * Serves a media Range request from a complete cached response. When the asset
 * is not cached yet, it deliberately fetches the complete file first so the
 * same path remains available to future installed/offline sessions.
 *
 * @param {Request} request - incoming request containing a Range header
 * @returns {Promise<Response>} partial media response
 */
async function handleRangeRequest(request) {
  const rangeHeader = request.headers.get('Range');
  let fullResponse = await caches.match(request.url);

  if (!fullResponse || fullResponse.status !== 200) {
    const headers = new Headers(request.headers);
    headers.delete('Range');
    const fullRequest = new Request(request, { headers });
    fullResponse = await fetch(fullRequest);

    if (!fullResponse.ok || fullResponse.status !== 200) return fullResponse;
    if (new URL(request.url).origin === self.location.origin) {
      const cache = await caches.open(CACHE_NAME);
      await cache.put(fullRequest, fullResponse.clone());
    }
  }

  return createPartialResponse(fullResponse, rangeHeader);
}

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  if (event.request.headers.has('Range')) {
    event.respondWith(handleRangeRequest(event.request));
    return;
  }

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
