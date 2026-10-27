// sw.js
self.addEventListener('install', event => {
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(self.clients.claim());
});

// No respondWith: the browser handles requests normally, so network errors
// reach the page and the DAP upload fallback works.
self.addEventListener('fetch', () => {});
