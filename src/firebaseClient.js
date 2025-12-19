import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getMessaging, getToken, onMessage } from "firebase/messaging";

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

// Analytics (optional)
const analytics = getAnalytics(app);

// FCM
const messaging = getMessaging(app);

// Web Push VAPID key (from Cloud Messaging > Web configuration)
const VAPID_KEY = "BPx595eVYVRtgy00DdnTyUFNsNujoFl5KEkckBmVgnsufUPPRQYSn6U6CjmGxBg7fsTDH_ywIJc4FfTH418lvKo";

export {
    app,
    analytics,
    messaging,
    getToken,
    onMessage,
    VAPID_KEY
};
