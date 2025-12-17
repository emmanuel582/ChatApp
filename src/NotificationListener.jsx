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
                const notification = new Notification(title, {
                    body: body,
                    icon: '/vite.svg',
                    tag: 'message-notification', // Overwrite old if needed, or unique per sender? 
                    // Let's use unique tag per sender so they stack if from different people, but replace if same person
                    tag: `msg-${msg.sender_id}`,
                    renotify: true, // Vibrate/sound again even if replacing
                    requireInteraction: false
                });

                notification.onclick = () => {
                    window.focus();
                    notification.close();
                };
            } catch (e) {
                console.error("Error creating notification object:", e);
            }
        };

        // Listen for Auth Changes to subscribe/unsubscribe
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            if (session?.user) {
                subscribe(session.user);
            } else {
                if (channel) supabase.removeChannel(channel);
                channel = null;
            }
        });

        // Initial Load
        supabase.auth.getUser().then(({ data: { user } }) => {
            if (user) subscribe(user);
        });

        return () => {
            subscription.unsubscribe();
            if (channel) supabase.removeChannel(channel);
        };
    }, []);

    return null;
}
