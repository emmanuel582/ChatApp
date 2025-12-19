import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching';
import { clientsClaim } from 'workbox-core';
import { initializeApp } from "firebase/app";
import { getMessaging, onBackgroundMessage } from "firebase/messaging/sw";

cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);

self.skipWaiting();
clientsClaim();

const firebaseConfig = {
    apiKey: "AIzaSyDMhDMYDwjCFFpp-oU8Ci01d679opvx3o8",
    authDomain: "chatapp-7addc.firebaseapp.com",
    projectId: "chatapp-7addc",
    storageBucket: "chatapp-7addc.firebasestorage.app",
    messagingSenderId: "437414071934",
    appId: "1:437414071934:web:e427a62499e101f674122f",
    measurementId: "G-0E93E3QBX2"
};

const app = initializeApp(firebaseConfig);
const messaging = getMessaging(app);

onBackgroundMessage(messaging, (payload) => {
    console.log('[firebase-messaging-sw.js] Received background message ', payload);
    const notificationTitle = payload.notification.title;
    const notificationOptions = {
        body: payload.notification.body,
        icon: '/pwa-192x192.png'
    };

    self.registration.showNotification(notificationTitle, notificationOptions);
});
