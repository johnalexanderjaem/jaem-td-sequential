// JAEM TD Sequential - Service Worker
// Maneja push notifications en background y el cacheo básico de la PWA.

const CACHE_NAME = 'jaem-td-v1';
const CORE_ASSETS = ['/', '/index.html', '/manifest.json'];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE_ASSETS).catch(() => {}))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// --- Push notifications ---
self.addEventListener('push', (event) => {
  let payload = { title: 'JAEM · TD Sequential', body: 'Nueva señal detectada.' };
  try {
    if (event.data) payload = event.data.json();
  } catch (e) {
    if (event.data) payload.body = event.data.text();
  }

  const options = {
    body: payload.body,
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    vibrate: payload.signal === 'BUY' ? [80, 40, 80] : [180],
    tag: payload.tag || 'jaem-td-signal',
    renotify: true,
    data: { url: payload.url || '/' }
  };

  // Chrome en Android requiere ServiceWorkerRegistration.showNotification()
  event.waitUntil(self.registration.showNotification(payload.title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url.includes(url) && 'focus' in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});
