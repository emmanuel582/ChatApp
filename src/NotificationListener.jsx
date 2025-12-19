import { useEffect } from 'react';
import { supabase } from './supabaseClient';

export default function NotificationListener() {
    useEffect(() => {
        // Explicitly request permission if not already granted or denied
        if (Notification.permission === 'default') {
            const askPermission = async () => {
                const permission = await Notification.requestPermission();
                console.log('Notification permission:', permission);
                if (permission === 'granted') {
                    // Test notification
                    new Notification("Notifications Enabled", { body: "You will now receive alerts for new messages." });
                }
            };
            askPermission();
        }

        const isUserOnChat = (senderId) => {
            const params = new URLSearchParams(window.location.search);
            const currentChatId = params.get('chat'); // User mode
            const path = window.location.pathname;    // Admin mode usually /admin/chat/ID or /chat/ID
            const pathParts = path.split('/');
            const adminChatId = path.includes('/chat/') ? pathParts[pathParts.length - 1] : null;
            const activeChatId = currentChatId || adminChatId;
            return activeChatId === senderId;
        };

        // Initial Load or Auth Change
        const init = async (user) => {
            if (!user) return;

            // Firebase Cloud Messaging (FCM) Registration
            console.log("Initializing Firebase Messaging...");
            if ('serviceWorker' in navigator) {
                try {
                    const { messaging, getToken, onMessage, VAPID_KEY } = await import('./firebaseClient');

                    // Register Service Worker first (VitePWA handles this, but we need the registration object)
                    const registration = await navigator.serviceWorker.ready;

                    // Get FCM Token
                    const currentToken = await getToken(messaging, {
                        vapidKey: VAPID_KEY,
                        serviceWorkerRegistration: registration
                    });

                    if (currentToken) {
                        console.log("FCM Token Received:", currentToken);

                        const subscriptionPayload = {
                            endpoint: currentToken,
                            type: 'fcm'
                        };

                        const { error } = await supabase
                            .from('push_subscriptions')
                            .insert({
                                user_id: user.id,
                                subscription: subscriptionPayload
                            });

                        if (!error && error?.code !== '23505') {
                            console.log("FCM Token saved to DB ✅");
                        }
                    }

                    // Handle Foreground Messages
                    onMessage(messaging, (payload) => {
                        console.log('Message received via FCM (Foreground): ', payload);

                        // ONLY show notification if user is NOT looking at this chat
                        const senderId = payload.data?.sender_id;
                        if (isUserOnChat(senderId)) {
                            console.log("User already on chat, skipping foreground notification.");
                            return;
                        }

                        const { title, body } = payload.notification || {};
                        const notification = new Notification(title || "New Message", {
                            body: body,
                            icon: '/pwa-192x192.png',
                            data: { url: payload.data?.url || '/' }
                        });

                        notification.onclick = () => {
                            window.focus();
                            if (payload.data?.url) window.location.href = payload.data.url;
                        };
                    });

                } catch (err) {
                    console.error('An error occurred while retrieving token or registering FCM:', err);
                }
            }
        };

        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            init(session?.user);
        });

        supabase.auth.getUser().then(({ data: { user } }) => {
            if (user) init(user);
        });

        return () => {
            subscription.unsubscribe();
        };
    }, []);

    return null;
}
