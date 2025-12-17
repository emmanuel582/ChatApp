
// Access the precache manifest injected by VitePWA
import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching';
import { clientsClaim } from 'workbox-core';

cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);

self.skipWaiting();
clientsClaim();

// Handle Push Notification
self.addEventListener('push', (event) => {
    const data = event.data ? event.data.json() : {};
    const title = data.title || 'New Message';
    const options = {
        body: data.body || 'You have a new message',
        icon: '/pwa-192x192.png',
        badge: '/pwa-192x192.png',
        tag: 'message-tag',
        data: { url: data.url || '/' }
    };

    event.waitUntil(
        self.registration.showNotification(title, options)
    );
});

// Handle Notification Click
self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
            // If already open, focus it
            for (const client of clientList) {
                if ('focus' in client) return client.focus();
            }
            // Otherwise open new
            if (clients.openWindow) return clients.openWindow(event.notification.data.url);
        })
    );
});
