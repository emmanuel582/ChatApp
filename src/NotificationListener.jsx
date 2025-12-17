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

        let channel = null;

        const subscribe = async (user) => {
            if (!user) return;

            // Clean up existing subscription if any
            if (channel) await supabase.removeChannel(channel);

            console.log("Subscribing to notifications for user:", user.id);

            channel = supabase
                .channel(`notifications:global:${user.id}`)
                .on(
                    'postgres_changes',
                    {
                        event: 'INSERT',
                        schema: 'public',
                        table: 'messages',
                        filter: `recipient_id=eq.${user.id}`
                    },
                    (payload) => {
                        console.log("New message received in background listener:", payload.new);
                        handleNewMessage(payload.new);
                    }
                )
                .subscribe((status) => {
                    console.log("Notification subscription status:", status);
                });
        };

        const handleNewMessage = async (msg) => {
            // 1. If tab is hidden (minimized or background tab), definitely notify
            if (document.hidden) {
                console.log("Document hidden, showing notification.");
                showNotification(msg);
                return;
            }

            // 2. If tab is visible, we still check URL path
            // The user might be on the dashboard but reading a totally different chat.
            // We need to be careful: URL might be /dashboard?chat=ID or /admin/chat/ID
            // Let's parse robustly.
            const params = new URLSearchParams(window.location.search);
            const currentChatId = params.get('chat'); // User mode
            const path = window.location.pathname;    // Admin mode usually /admin/chat/ID or /chat/ID

            // Extract ID from path for admin mode
            const pathParts = path.split('/');
            const adminChatId = path.includes('/chat/') ? pathParts[pathParts.length - 1] : null;

            const activeChatId = currentChatId || adminChatId;

            console.log("Active Chat ID:", activeChatId, "Incoming Sender:", msg.sender_id);

            const isChattingWithSender = activeChatId === msg.sender_id;

            if (!isChattingWithSender) {
                console.log("User is active but on different chat (or no chat), showing notification.");
                showNotification(msg);
            } else {
                console.log("User is currently chatting with sender, suppressing notification.");
            }
        };

        const showNotification = async (msg) => {
            if (Notification.permission !== 'granted') {
                console.warn("Notifications strictly not granted.");
                return;
            }

            // Fetch sender info for a better title
            const { data } = await supabase
                .from('profiles')
                .select('full_name, username')
                .eq('id', msg.sender_id)
                .maybeSingle();

            const senderName = data ? (data.full_name || data.username) : 'New Message';
            const title = `New message from ${senderName}`;
            const body = msg.type === 'image' ? 'Sent a photo' : (msg.type === 'audio' ? 'Sent a voice note' : msg.content);

            try {
                // Create notification
                const notification = new Notification(senderName, {
                    body: msg.content || 'Sent a photo',
                    icon: '/vite.svg', // Fallback icon
                    tag: msg.sender_id, // Group updates from same sender
                    requireInteraction: false // Don't keep it open forever
                });

                // Play Sound
                try {
                    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
                    const oscillator = audioContext.createOscillator();
                    const gainNode = audioContext.createGain();

                    oscillator.connect(gainNode);
                    gainNode.connect(audioContext.destination);

                    oscillator.type = 'sine';
                    oscillator.frequency.setValueAtTime(500, audioContext.currentTime);
                    oscillator.frequency.exponentialRampToValueAtTime(1000, audioContext.currentTime + 0.1);

                    gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
                    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);

                    oscillator.start();
                    oscillator.stop(audioContext.currentTime + 0.5);
                } catch (e) {
                    console.error("Audio play failed", e);
                }

                // Vibrate (Mobile)
                if (navigator.vibrate) {
                    navigator.vibrate([200, 100, 200]);
                }

                notification.onclick = () => {
                    window.focus();
                    // We could try to navigate to the chat, but that requires access to router
                    // For now just focusing the window is good
                };
            } catch (e) {
                console.error("Error creating notification object:", e);
            }
        };

        // Initial Load or Auth Change
        const init = async (user) => {
            if (!user) {
                if (channel) supabase.removeChannel(channel);
                channel = null;
                return;
            }

            // 1. Subscribe to Realtime (In-App)
            subscribe(user);

            // 2. Register SW & Subscribe to Push (Background)
            console.log("Attempting to Initialize Push...");
            if ('serviceWorker' in navigator && 'PushManager' in window) {
                try {
                    // Check local storage to avoid spamming subscribe on every refresh
                    const isPushSubscribed = localStorage.getItem('push_subscribed_user') === user.id;
                    if (isPushSubscribed) return;

                    const registration = await Promise.race([
                        navigator.serviceWorker.ready,
                        new Promise((_, reject) => setTimeout(() => reject(new Error("Service Worker Ready Timed Out")), 5000))
                    ]);
                    console.log("Service Worker Ready:", registration);

                    const subscription = await registration.pushManager.subscribe({
                        userVisibleOnly: true,
                        applicationServerKey: 'BBZYM5uX9RvLdWH0ATTNjLVlV2Rs7tEuYWpCp-wcbyVFFDqz26hhfGytGaxH5ZqA48eIYOLWvoEaEhyFkEIkHH0'
                    });

                    console.log("Got Push Subscription:", subscription);

                    // Save to Supabase
                    const { error } = await supabase
                        .from('push_subscriptions')
                        .insert({
                            user_id: user.id,
                            subscription: subscription
                        });

                    if (!error) {
                        console.log('Push Subscription Saved to Database ✅');
                        localStorage.setItem('push_subscribed_user', user.id);
                    } else {
                        // Ignore duplicate key error, otherwise log
                        if (error.code !== '23505') console.error('Push Save Error ❌:', error);
                        else console.log('Push Subscription already exists in DB');
                    }

                } catch (err) {
                    console.error('Push Registration Error ❌:', err);
                }
            } else {
                console.log("Service Worker or Push Manager not supported");
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
            if (channel) supabase.removeChannel(channel);
        };
    }, []);

    return null;
}
