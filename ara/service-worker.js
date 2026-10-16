/* Offline application shell only. Forecast responses must NEVER be served from cache as if current. */
const CACHE_NAME = 'ara-weather-shell-v2-20261016';
const SHELL = ['./','./index.html','./app.js','./manifest.webmanifest','./assets/ara-hero.jpg','./assets/icon-192.png','./assets/icon-512.png','./assets/icon-180.png'];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k=>k!==CACHE_NAME).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin) return;
  if (event.request.mode === 'navigate') {
    event.respondWith(fetch(event.request).catch(()=>caches.match('./index.html')));
    return;
  }
  if (SHELL.some(item => new URL(item,self.registration.scope).pathname === url.pathname)) {
    event.respondWith(caches.match(event.request).then(hit=>hit||fetch(event.request)));
  }
});
