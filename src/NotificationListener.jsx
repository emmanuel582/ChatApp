import { useEffect } from 'react';
import { supabase } from './supabaseClient';

export default function NotificationListener() {
    useEffect(() => {
        // Request permission on mount
        if (Notification.permission === 'default') {
            Notification.requestPermission();
        }

        let channel = null;

        const subscribe = async (user) => {
            if (!user) return;

            // Clean up existing subscription if any
            if (channel) await supabase.removeChannel(channel);

            channel = supabase
                .channel(`notifications:${user.id}`)
                .on(
                    'postgres_changes',
                    {
                        event: 'INSERT',
                        schema: 'public',
                        table: 'messages',
                        filter: `recipient_id=eq.${user.id}`
                    },
                    (payload) => {
                        handleNewMessage(payload.new);
                    }
                )
                .subscribe();
        };

        const handleNewMessage = async (msg) => {
            // 1. If tab is hidden (minimized or background tab), definitely notify
            if (document.hidden) {
                showNotification(msg);
                return;
            }

            // 2. If tab is visible, check if we are currently looking at this chat
            // Check query param used in BeginConversation
            const params = new URLSearchParams(window.location.search);
            const currentChatId = params.get('chat');
            const path = window.location.pathname;

            // Assumption: User is "chatting with sender" if they are on /dashboard AND the chat param matches sender
            const isChattingWithSender = (path === '/dashboard' || path.startsWith('/admin/chat')) && currentChatId === msg.sender_id;

            if (!isChattingWithSender) {
                showNotification(msg);
            }
        };

        const showNotification = async (msg) => {
            if (Notification.permission !== 'granted') return;

            // Fetch sender info for a better title
            // We use maybeSingle to avoid errors if user deleted/ghost
            const { data } = await supabase
                .from('profiles')
                .select('full_name, username')
                .eq('id', msg.sender_id)
                .maybeSingle();

            const senderName = data ? (data.full_name || data.username) : 'New Message';

            // Create notification
            const notification = new Notification(senderName, {
                body: msg.content || 'Sent a photo',
                icon: '/vite.svg', // Fallback icon
                tag: msg.sender_id, // Group updates from same sender
                requireInteraction: false // Don't keep it open forever
            });

            notification.onclick = () => {
                window.focus();
                // We could try to navigate to the chat, but that requires access to router
                // For now just focusing the window is good
            };
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
