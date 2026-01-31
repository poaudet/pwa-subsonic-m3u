// sw.js
self.addEventListener('install', event => {
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(self.clients.claim());
});

// Pass-through fetch, but catch errors
self.addEventListener('fetch', event => {
  event.respondWith(
    fetch(event.request).catch(() => {
      // fallback: if request fails, just return a blank response
      return new Response('', { status: 200, statusText: 'OK' });
    })
  );
});
