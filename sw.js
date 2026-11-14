/* Versioned cache-first service worker. Personal data stays in IndexedDB, outside Cache Storage. */
const CACHE_NAME = 'personal-training-diary-v1.1.4';
const BASE = new URL('./', self.registration.scope);
const PRECACHE = [
  './', './index.html', './manifest.webmanifest', './css/styles.css',
  './js/db.js', './js/utils.js', './js/charts.js', './js/xlsx.js', './js/backup.js', './js/app.js?v=1.1.4',
  './icons/icon-192.svg', './icons/icon-512.svg', './icons/icon-maskable.svg', './icons/apple-touch-icon.svg',
  './README.md', './COACH_AI_MANUAL.md', './coach-plan-template.json'
].map(path => new URL(path, BASE).href);

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(PRECACHE)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key.startsWith('personal-training-diary-') && key !== CACHE_NAME).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});
self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  event.respondWith(caches.match(request).then(cached => {
    if (cached) return cached;
    return fetch(request).then(response => {
      if (response && response.ok) {
        const copy = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
      }
      return response;
    }).catch(() => {
      if (request.mode === 'navigate') return caches.match(new URL('./index.html', BASE).href);
      return new Response('', { status: 504, statusText: 'Offline' });
    });
  }));
});
self.addEventListener('message', event => { if (event.data === 'SKIP_WAITING') self.skipWaiting(); });
