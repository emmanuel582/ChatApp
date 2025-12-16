import React, { useEffect, useState, useRef } from 'react';
import {
    Menu,
    MoreVertical,
    Smile,
    Send,
    Home,
    Repeat,
    MessageCircle,
    Download,
    User,
    ChevronDown,
    Paperclip,
    Mic,
    Image as ImageIcon,
    Reply,
    X,
    Shield,
    Check,
    EyeOff
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from './supabaseClient';
import EmojiPicker, { Theme } from 'emoji-picker-react';

export default function ChatScreen({ recipientId, impersonatedUser = null, isGhostMode = false }) {
    const navigate = useNavigate();
    const [recipient, setRecipient] = useState(null);
    const [currentUser, setCurrentUser] = useState(null);
    const [currentUserProfile, setCurrentUserProfile] = useState(null);
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const [isTyping, setIsTyping] = useState(false);
    const [isOnline, setIsOnline] = useState(false);
    const [showSessionEnded, setShowSessionEnded] = useState(false);
    const [showSessionStarted, setShowSessionStarted] = useState(false);

    // Reply State
    const [replyingTo, setReplyingTo] = useState(null);

    // Image Preview State
    const [previewImage, setPreviewImage] = useState(null);

    // Authorization State
    const [isAuthorized, setIsAuthorized] = useState(false);
    const [authChecked, setAuthChecked] = useState(false);

    // Refs
    const messagesEndRef = useRef(null);
    const audioRef = useRef(new Audio('/keyboard-typing-sound-effect-335503.mp3'));
    const fileInputRef = useRef(null);

    // Swipe Refs
    const touchStart = useRef(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages, isTyping, replyingTo]);

    const handleBack = () => {
        if (isGhostMode) {
            navigate(`/admin/chat/${currentUser.id}`); // Return to inbox list
        } else {
            navigate('/dashboard');
        }
    };

    // 0. Verify Chat Authorization
    useEffect(() => {
        const verifyChatAuth = async () => {
            if (!recipientId) {
                setAuthChecked(true);
                return;
            }

            let userId;
            if (isGhostMode && impersonatedUser) {
                userId = impersonatedUser.id;
            } else {
                const { data: { user } } = await supabase.auth.getUser();
                userId = user?.id;
            }

            if (!userId) {
                setAuthChecked(true);
                navigate('/login');
                return;
            }

            // Allow access to start a conversation.
            setIsAuthorized(true);
            setAuthChecked(true);
        };

        verifyChatAuth();
    }, [recipientId, isGhostMode, impersonatedUser, navigate]);

    // 1. Fetch Current User, User Profile & Recipient & Initial Presence
    useEffect(() => {
        const fetchUserAndRecipient = async () => {
            if (isGhostMode && impersonatedUser) {
                // Impersonation Mode
                console.log('[ChatScreen] Ghost mode - using impersonated user:', impersonatedUser.id);
                setCurrentUser(impersonatedUser);
                setCurrentUserProfile(impersonatedUser);
                console.log('[ChatScreen] Profile set - active_admin_session:', impersonatedUser.active_admin_session);
            } else {
                // Normal Mode
                const { data: { user } } = await supabase.auth.getUser();
                setCurrentUser(user);

                if (user) {
                    const { data: myProfile } = await supabase
                        .from('profiles')
                        .select('*')
                        .eq('id', user.id)
                        .single();
                    console.log('[ChatScreen] Normal mode - profile loaded:', myProfile);
                    setCurrentUserProfile(myProfile);
                }
            }

            if (recipientId) {
                const { data } = await supabase
                    .from('profiles')
                    .select('*')
                    .eq('id', recipientId)
                    .single();
                if (data) setRecipient(data);
            }
        };
        fetchUserAndRecipient();
    }, [recipientId, isGhostMode, impersonatedUser]);

    // Subscribe to profile updates for admin session state
    useEffect(() => {
        if (!isGhostMode || !currentUser?.id) return;

        const profileChannel = supabase
            .channel(`profile_updates_${currentUser.id}`)
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'profiles',
                    filter: `id=eq.${currentUser.id}`
                },
                (payload) => {
                    setCurrentUserProfile(payload.new);
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(profileChannel);
        };
    }, [isGhostMode, currentUser?.id]);

    // 2. Fetch Messages & Subscribe to Realtime
    useEffect(() => {
        if (!currentUser || !recipientId) return;

        // Fetch initial messages
        const fetchMessages = async () => {
            const { data, error } = await supabase
                .from('messages')
                .select('*')
                .or(`and(sender_id.eq.${currentUser.id},recipient_id.eq.${recipientId}),and(sender_id.eq.${recipientId},recipient_id.eq.${currentUser.id})`)
                .order('created_at', { ascending: true });

            if (data) {
                console.log('[ChatScreen] Fetching messages:', {
                    isGhostMode,
                    currentUserId: currentUser.id,
                    recipientId,
                    totalMessages: data.length,
                    activeAdminSession: currentUserProfile?.active_admin_session
                });

                // Filter Messages
                const visible = data.filter(msg => {
                    console.log('[ChatScreen] Checking message:', {
                        msgId: msg.id,
                        senderId: msg.sender_id,
                        recipientId: msg.recipient_id,
                        isHiddenFromOwner: msg.is_hidden_from_owner,
                        isAdminMessage: msg.is_admin_message,
                        content: msg.content.substring(0, 50)
                    });

                    // Real account owner: hide messages marked as hidden from owner
                    if (!isGhostMode && msg.is_hidden_from_owner) {
                        console.log('[ChatScreen] HIDING message from real owner (is_hidden_from_owner=true):', msg.id);
                        return false;
                    }

                    // Admin view: 
                    // - When session is ACTIVE: show ALL messages (including hidden ones) so admin can see and respond
                    // - When session is STOPPED: show hidden messages with review buttons
                    // (No filtering needed for admin - they see everything)

                    // Real user: hide messages they sent that are admin messages (ghost messages)
                    if (!isGhostMode && msg.sender_id === currentUser.id && msg.is_admin_message) {
                        console.log('[ChatScreen] HIDING admin message from real owner:', msg.id);
                        return false;
                    }

                    console.log('[ChatScreen] SHOWING message:', msg.id);
                    return true;
                });

                console.log('[ChatScreen] Final visible messages:', visible.length);
                setMessages(visible);
            }
        };

        fetchMessages();

        // Subscribe to messages (INSERT)
        const messageChannel = supabase
            .channel(`chat_messages:${currentUser.id}-${recipientId}`)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'messages'
                },
                (payload) => {
                    console.log('[ChatScreen] New message received (realtime):', {
                        isGhostMode,
                        currentUserId: currentUser.id,
                        msgId: payload.new.id,
                        senderId: payload.new.sender_id,
                        recipientId: payload.new.recipient_id,
                        isHiddenFromOwner: payload.new.is_hidden_from_owner,
                        isAdminMessage: payload.new.is_admin_message,
                        content: payload.new.content.substring(0, 50)
                    });

                    // Real user: ignore admin messages sent as them
                    if (!isGhostMode && payload.new.sender_id === currentUser.id && payload.new.is_admin_message) {
                        console.log('[ChatScreen] IGNORING admin message (real owner):', payload.new.id);
                        return; // Ignore this message
                    }
                    // Real user: ignore hidden incoming messages
                    if (!isGhostMode && payload.new.is_hidden_from_owner) {
                        console.log('[ChatScreen] IGNORING hidden message (real owner):', payload.new.id);
                        return; // Ignore hidden incoming messages
                    }
                    // Admin: show all messages during active session (they need to see to respond)
                    // Hidden messages will be shown when session stops for review

                    const isRelevant =
                        (payload.new.sender_id === recipientId && payload.new.recipient_id === currentUser.id) ||
                        (payload.new.sender_id === currentUser.id && payload.new.recipient_id === recipientId);

                    if (isRelevant) {
                        console.log('[ChatScreen] Message is relevant, adding to state:', payload.new.id);
                        setMessages(prev => {
                            // If it's my own message (or impersonated), verify if we have an optimistic version to replace
                            if (payload.new.sender_id === currentUser.id) {
                                // Find optimistic message (temp ID, same content, recent)
                                const optimisticIndex = prev.findIndex(m =>
                                    m.id.startsWith('temp-') &&
                                    m.content === payload.new.content &&
                                    Math.abs(new Date(m.created_at).getTime() - new Date(payload.new.created_at).getTime()) < 20000
                                );

                                if (optimisticIndex !== -1) {
                                    const newMessages = [...prev];
                                    newMessages[optimisticIndex] = payload.new;
                                    return newMessages;
                                }
                                if (prev.some(m => m.id === payload.new.id)) return prev;
                                return [...prev, payload.new];
                            }

                            // Received message (Peer)
                            if (prev.some(m => m.id === payload.new.id)) return prev;
                            return [...prev, payload.new];
                        });
                    }
                }
            )
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'messages'
                },
                (payload) => {
                    console.log('[ChatScreen] Message updated (realtime):', payload.new);
                    // When a message is updated (e.g., admin approves it), update local state
                    const isRelevant =
                        (payload.new.sender_id === recipientId && payload.new.recipient_id === currentUser.id) ||
                        (payload.new.sender_id === currentUser.id && payload.new.recipient_id === recipientId);

                    if (isRelevant) {
                        setMessages(prev => {
                            const existingIndex = prev.findIndex(m => m.id === payload.new.id);
                            if (existingIndex !== -1) {
                                // Update existing message
                                const updated = [...prev];
                                updated[existingIndex] = payload.new;
                                return updated;
                            }
                            // If message was hidden and now approved, add it if it's for the real owner
                            if (!isGhostMode && !payload.new.is_hidden_from_owner && !prev.find(m => m.id === payload.new.id)) {
                                // Message was approved and should now be visible to real owner
                                return [...prev, payload.new].sort((a, b) =>
                                    new Date(a.created_at) - new Date(b.created_at)
                                );
                            }
                            return prev;
                        });
                    }
                }
            )
            .subscribe();

        // Presence
        const presenceChannel = supabase.channel('global_presence', {
            config: {
                presence: {
                    key: currentUser.id,
                },
            },
        });

        presenceChannel
            .on('presence', { event: 'sync' }, () => {
                const state = presenceChannel.presenceState();
                setIsOnline(!!state[recipientId]);
            })
            .subscribe(async (status) => {
                if (status === 'SUBSCRIBED') {
                    await presenceChannel.track({
                        user_id: currentUser.id,
                        online_at: new Date().toISOString(),
                    });
                }
            });

        // Typing Channel
        const ids = [currentUser.id, recipientId].sort();
        const roomId = `room_${ids[0]}_${ids[1]}`;
        const typingChannel = supabase.channel(roomId);

        typingChannel
            .on('broadcast', { event: 'typing' }, (payload) => {
                if (payload.payload.sender_id === recipientId) {
                    setIsTyping(true);
                    if (audioRef.current) {
                        audioRef.current.currentTime = 0;
                        audioRef.current.play().catch(e => console.log('Audio play failed', e));
                    }
                }
            })
            .subscribe();

        return () => {
            supabase.removeChannel(messageChannel);
            supabase.removeChannel(presenceChannel);
            supabase.removeChannel(typingChannel);
        };
    }, [currentUser, recipientId, isGhostMode, currentUserProfile?.active_admin_session]);

    // Handle Admin Review Actions
    const handleApproveMessage = async (msgId) => {
        const newTimestamp = new Date().toISOString();
        console.log('[ChatScreen] Approving message:', msgId, 'with new timestamp:', newTimestamp);
        const { data, error } = await supabase
            .from('messages')
            .update({
                is_hidden_from_owner: false,
                created_at: newTimestamp // Update time to NOW (when admin marks it)
            })
            .eq('id', msgId)
            .select()
            .single();

        if (error) {
            console.error('[ChatScreen] Error approving message:', error);
            console.error('[ChatScreen] Error details:', {
                code: error.code,
                message: error.message,
                details: error.details,
                hint: error.hint
            });
            alert("Error approving message: " + error.message);
        } else if (data) {
            console.log('[ChatScreen] Message approved successfully:', data);
            setMessages(prev => prev.map(m =>
                m.id === msgId
                    ? { ...m, is_hidden_from_owner: false, created_at: newTimestamp }
                    : m
            ));
        }
    };

    const handleRejectMessage = async (msgId) => {
        // Delete the message permanently
        const { error } = await supabase
            .from('messages')
            .delete()
            .eq('id', msgId);

        if (error) {
            alert("Error rejecting message");
        } else {
            setMessages(prev => prev.filter(m => m.id !== msgId));
        }
    };

    const handleStopSession = async () => {
        console.log('[ChatScreen] Stopping admin session');
        const { error } = await supabase
            .from('profiles')
            .update({ active_admin_session: false })
            .eq('id', currentUser.id);

        if (error) {
            console.error('[ChatScreen] Error stopping session:', error);
            alert("Error stopping session");
            return;
        }

        // Update local state
        console.log('[ChatScreen] Session stopped successfully');
        setCurrentUserProfile(prev => ({ ...prev, active_admin_session: false }));
        setShowSessionEnded(true);
        setTimeout(() => setShowSessionEnded(false), 3000); // Hide after 3 seconds

        // Refresh messages to show hidden ones for review
        const { data } = await supabase
            .from('messages')
            .select('*')
            .or(`and(sender_id.eq.${currentUser.id},recipient_id.eq.${recipientId}),and(sender_id.eq.${recipientId},recipient_id.eq.${currentUser.id})`)
            .order('created_at', { ascending: true });

        if (data) {
            const visible = data.filter(msg => {
                // Real account owner: hide messages marked as hidden
                if (!isGhostMode && msg.is_hidden_from_owner) return false;
                // Admin: now show hidden messages (session stopped)
                // Real user: hide admin messages sent as them
                if (!isGhostMode && msg.sender_id === currentUser.id && msg.is_admin_message) return false;
                return true;
            });
            setMessages(visible);
        }
    };

    // Typing timeout effect
    useEffect(() => {
        if (isTyping) {
            const timer = setTimeout(() => setIsTyping(false), 3000);
            return () => clearTimeout(timer);
        }
    }, [isTyping]);


    const handleSendMessage = async (content = newMessage, type = 'text') => {
        if ((!content.trim() && type === 'text') || !currentUser || !currentUser.id || !recipientId) return;

        if (type === 'text') {
            setNewMessage('');
            setShowEmojiPicker(false);
            setReplyingTo(null);
        }

        const tempId = 'temp-' + Date.now();
        const optimisticMsg = {
            id: tempId,
            sender_id: currentUser.id,
            recipient_id: recipientId,
            content: content,
            type: type,
            reply_to_id: replyingTo ? replyingTo.id : null,
            created_at: new Date().toISOString(),
            is_admin_message: isGhostMode
        };
        setMessages(prev => [...prev, optimisticMsg]);

        const payload = {
            sender_id: currentUser.id,
            recipient_id: recipientId,
            content: content,
            type: type,
            is_admin_message: isGhostMode
        };

        // Only attach reply_to_id if it's a valid UUID (not a temp ID)
        if (replyingTo && !replyingTo.id.startsWith('temp-')) {
            payload.reply_to_id = replyingTo.id;
        }

        const { data, error } = await supabase
            .from('messages')
            .insert(payload)
            .select()
            .single();

        // Admin Session Logic: If Ghost Mode and not active, start session automatically
        if (isGhostMode && currentUserProfile && !currentUserProfile.active_admin_session) {
            console.log('[ChatScreen] Starting admin session automatically for user:', currentUser.id);
            const { data: updatedProfile, error: updateError } = await supabase
                .from('profiles')
                .update({ active_admin_session: true })
                .eq('id', currentUser.id)
                .select()
                .single();

            if (updateError) {
                console.error('[ChatScreen] Error starting session:', updateError);
                console.error('[ChatScreen] Error details:', {
                    code: updateError.code,
                    message: updateError.message,
                    details: updateError.details,
                    hint: updateError.hint
                });
            } else if (updatedProfile) {
                console.log('[ChatScreen] Admin session started successfully, profile updated:', updatedProfile);
                setCurrentUserProfile(updatedProfile);
                setShowSessionStarted(true);
                setTimeout(() => setShowSessionStarted(false), 3000); // Hide after 3 seconds
            } else {
                console.warn('[ChatScreen] No profile returned after update attempt');
            }
        }

        if (error) {
            console.error("Send failed", error);
            if (payload.reply_to_id) {
                delete payload.reply_to_id;
                const { data: retryData, error: retryError } = await supabase
                    .from('messages')
                    .insert(payload)
                    .select()
                    .single();

                if (!retryError && retryData) {
                    setMessages(prev => prev.map(m => m.id === tempId ? retryData : m));
                } else {
                    alert("Failed to send message even after retry.");
                    setMessages(prev => prev.filter(m => m.id !== tempId));
                }
            } else {
                alert("Failed to send message: " + error.message);
                setMessages(prev => prev.filter(m => m.id !== tempId));
            }
        } else if (data) {
            setMessages(prev => prev.map(m => m.id === tempId ? data : m));
        }
    };

    const handleInputChange = (e) => {
        setNewMessage(e.target.value);

        if (currentUser && recipientId) {
            const ids = [currentUser.id, recipientId].sort();
            const roomId = `room_${ids[0]}_${ids[1]}`;
            const channel = supabase.channel(roomId);

            channel.send({
                type: 'broadcast',
                event: 'typing',
                payload: { sender_id: currentUser.id }
            });
        }
    };

    const handleFileUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const fileExt = file.name.split('.').pop();
        const fileName = `${Math.random()}.${fileExt}`;
        const filePath = `${currentUser.id}/${fileName}`;

        const { error: uploadError } = await supabase.storage
            .from('chat-attachments')
            .upload(filePath, file);

        if (uploadError) {
            console.error('Upload Error', uploadError);
            alert('Failed to upload image');
            return;
        }

        const { data: { publicUrl } } = supabase.storage
            .from('chat-attachments')
            .getPublicUrl(filePath);

        handleSendMessage(publicUrl, 'image');
    };

    const toggleEmojiPicker = () => setShowEmojiPicker(!showEmojiPicker);

    const onEmojiClick = (emojiObject) => {
        setNewMessage(prev => prev + emojiObject.emoji);
        setShowEmojiPicker(false);
    };

    // Swipe & Reply Handlers
    const onTouchStart = (e) => {
        touchStart.current = e.targetTouches[0].clientX;
    }

    const onTouchEnd = (e, msg) => {
        if (!touchStart.current) return;
        const touchEnd = e.changedTouches[0].clientX;
        const distance = touchEnd - touchStart.current;

        // Swipe Right > 50px
        if (distance > 50) {
            setReplyingTo(msg);
        }
        touchStart.current = null;
    }

    // Helper to get initials
    const getInitials = (name) => {
        if (!name) return '??';
        const parts = name.trim().split(' ');
        if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
        return name.slice(0, 2).toUpperCase();
    };

    // Helper to format time
    const formatTime = (isoString) => {
        return new Date(isoString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    // Helper to get referenced message
    const getQuotedMessage = (replyId) => {
        return messages.find(m => m.id === replyId);
    };

    // Styling
    const containerStyle = {
        height: '100vh',
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: '#f5f5f5',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    };

    const appHeaderStyle = {
        height: '60px',
        background: isGhostMode ? '#374151' : '#102a5c', // Dark Grey for Admin
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 15px',
        color: 'white',
        flexShrink: 0
    };

    const balanceCardStyle = {
        background: isGhostMode ? '#1f2937' : '#0a1e45',
        padding: '5px 15px',
        borderRadius: '8px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        minWidth: '160px',
        border: '1px solid #1e3a6e'
    };

    const chatHeaderStyle = {
        background: 'white',
        padding: '10px 15px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottom: '1px solid #e0e0e0',
        boxShadow: '0 2px 5px rgba(0,0,0,0.02)',
        flexShrink: 0
    };

    const messageAreaStyle = {
        flex: 1,
        background: isGhostMode ? '#e5e7eb' : 'white',
        display: 'flex',
        flexDirection: 'column',
        padding: '20px',
        overflowY: 'auto',
        gap: '10px'
    };

    const inputAreaStyle = {
        background: 'white',
        padding: '10px 15px',
        display: 'flex',
        alignItems: 'center',
        borderTop: '1px solid #f0f0f0',
        position: 'relative',
        flexShrink: 0
    };

    const bottomNavStyle = {
        height: '65px',
        background: 'white',
        borderTop: '1px solid #eee',
        display: 'flex',
        justifyContent: 'space-around',
        alignItems: 'center',
        paddingBottom: '5px',
        flexShrink: 0
    };

    const navItemStyle = {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '4px',
        fontSize: '11px',
        color: '#666',
        cursor: 'pointer'
    };

    const messageBubbleStyle = (isMine, isAdminMsg) => ({
        maxWidth: '70%',
        padding: '10px 15px',
        borderRadius: '15px',
        fontSize: '15px',
        lineHeight: '1.4',
        position: 'relative',
        alignSelf: isMine ? 'flex-end' : 'flex-start',
        backgroundColor: isAdminMsg && isMine ? '#9333ea' : (isMine ? '#357abd' : '#f0f0f0'), // Purple for admin messages
        color: isMine ? 'white' : '#333',
        borderBottomRightRadius: isMine ? '2px' : '15px',
        borderBottomLeftRadius: isMine ? '15px' : '2px',
        wordBreak: 'break-word',
        display: 'flex',
        flexDirection: 'column',
        gap: '4px',
    });

    const typingBubbleStyle = {
        padding: '15px 20px',
        borderRadius: '15px',
        borderBottomLeftRadius: '2px',
        backgroundColor: '#f0f0f0',
        alignSelf: 'flex-start',
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
        marginBottom: '10px'
    };

    if (!authChecked) return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', color: '#666' }}>Verifying access...</div>;

    if (!isAuthorized) return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', color: '#666' }}>Access Denied</div>;

    if (!recipient || !currentUser) return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', color: '#666' }}>Loading chat...</div>;

    return (
        <div style={containerStyle}>
            <style>{`
                @keyframes bounce {
                    0%, 100% { transform: translateY(0); }
                    50% { transform: translateY(-5px); }
                }
            `}</style>

            {/* Ghost Mode Banner */}
            {
                isGhostMode && (
                    <div style={{ background: '#ef4444', color: 'white', textAlign: 'center', fontSize: '12px', padding: '4px' }}>
                        GHOST MODE ACTIVE - Messages are hidden from owner
                    </div>
                )
            }


            {/* Stop Session Button (Admin Only, does not affect layout) */}
            {(() => {
                console.log('[ChatScreen] Button check - isGhostMode:', isGhostMode, 'active_admin_session:', currentUserProfile?.active_admin_session);
                return isGhostMode && currentUserProfile?.active_admin_session && (
                    <div
                        onClick={handleStopSession}
                        style={{
                            position: 'fixed',
                            top: '100px',
                            left: '50%',
                            transform: 'translateX(-50%)',
                            background: '#ef4444',
                            color: 'white',
                            padding: '8px 16px',
                            borderRadius: '20px',
                            fontSize: '12px',
                            fontWeight: 'bold',
                            cursor: 'pointer',
                            zIndex: 1000,
                            boxShadow: '0 2px 10px rgba(0,0,0,0.3)',
                            border: 'none'
                        }}>
                        STOP SESSION
                    </div>
                );
            })()}

            {/* Top App Header */}
            <div style={appHeaderStyle}>
                <Menu size={24} style={{ cursor: 'pointer' }} onClick={handleBack} />
                <div style={balanceCardStyle}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '13px', fontWeight: '600' }}>
                        <div style={{ width: '20px', height: '14px', background: 'linear-gradient(to right, #e0e0e0 50%, #f4a261 50%)', borderRadius: '2px' }}></div>
                        Remedy Cyclo <ChevronDown size={12} />
                    </div>
                    <div style={{ fontSize: '11px', color: '#fbbf24', marginTop: '2px' }}>Available Balance: $0.00</div>
                </div>
                <div style={{ width: '32px', height: '32px', background: 'white', borderRadius: '50%', color: '#102a5c', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '14px' }}>
                    {getInitials(currentUserProfile?.full_name || currentUserProfile?.username)}
                </div>
            </div>

            {/* Chat User Header */}
            <div style={chatHeaderStyle}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ position: 'relative', width: '42px', height: '42px', borderRadius: '50%', overflow: 'hidden', border: '2px solid #fff', boxShadow: '0 2px 5px rgba(0,0,0,0.1)' }}>
                        <img src={recipient.avatar_url} alt="Profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        {isOnline && <div style={{ position: 'absolute', bottom: 2, right: 2, width: 10, height: 10, borderRadius: '50%', background: '#4ade80', border: '2px solid white' }}></div>}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ color: '#1a1a1a', fontWeight: '600', fontSize: '15px' }}>{recipient.full_name || recipient.username}</span>
                        <span style={{ color: '#888', fontSize: '12px' }}>
                            {isOnline ? 'Online' : (recipient.last_seen ? `last seen ${new Date(recipient.last_seen).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'last seen recently')}
                        </span>
                    </div>
                </div>
                <MoreVertical size={20} color="#666" style={{ cursor: 'pointer' }} />
            </div>

            {/* Messages Area */}
            <div style={messageAreaStyle}>
                {/* Persistent Admin Session Banner (always visible while active) */}
                {isGhostMode && currentUserProfile?.active_admin_session && (
                    <div style={{
                        width: '100%',
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: 'center',
                        margin: '10px 0'
                    }}>
                        <div style={{
                            background: '#0ea5e9',
                            color: 'white',
                            padding: '10px 20px',
                            borderRadius: '24px',
                            fontSize: '13px',
                            fontWeight: '700',
                            boxShadow: '0 4px 10px rgba(0,0,0,0.25)',
                            border: '2px solid rgba(255,255,255,0.35)',
                            textAlign: 'center'
                        }}>
                            ─── Admin Session Active ───
                        </div>
                    </div>
                )}
                {/* Admin Session Started Notification (in chat area, centered, only for admin) */}
                {isGhostMode && showSessionStarted && (
                    <div style={{
                        width: '100%',
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: 'center',
                        margin: '20px 0',
                        padding: '15px 0'
                    }}>
                        <div style={{
                            background: '#10b981',
                            color: 'white',
                            padding: '12px 24px',
                            borderRadius: '25px',
                            fontSize: '14px',
                            fontWeight: '700',
                            boxShadow: '0 4px 12px rgba(16, 185, 129, 0.4)',
                            textAlign: 'center',
                            border: '2px solid rgba(255, 255, 255, 0.3)'
                        }}>
                            <div style={{ marginBottom: '4px' }}>━━━━━━━━━━━━━━━━━━</div>
                            <div>Admin Session Starting</div>
                            <div style={{ marginTop: '4px' }}>━━━━━━━━━━━━━━━━━━</div>
                        </div>
                    </div>
                )}

                {/* Admin Session Ended Notification (in chat area, centered, only for admin) */}
                {isGhostMode && showSessionEnded && (
                    <div style={{
                        width: '100%',
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: 'center',
                        margin: '20px 0',
                        padding: '15px 0'
                    }}>
                        <div style={{
                            background: '#f59e0b',
                            color: 'white',
                            padding: '12px 24px',
                            borderRadius: '25px',
                            fontSize: '14px',
                            fontWeight: '700',
                            boxShadow: '0 4px 12px rgba(245, 158, 11, 0.4)',
                            textAlign: 'center',
                            border: '2px solid rgba(255, 255, 255, 0.3)'
                        }}>
                            <div style={{ marginBottom: '4px' }}>━━━━━━━━━━━━━━━━━━</div>
                            <div>Admin Session Stopped</div>
                            <div style={{ marginTop: '4px' }}>━━━━━━━━━━━━━━━━━━</div>
                        </div>
                    </div>
                )}

                {messages.length === 0 && !isTyping ? (
                    <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', color: '#999', fontSize: '14px' }}>
                        No messages here yet...
                    </div>
                ) : (
                    messages.map((msg, index) => {
                        const isMine = msg.sender_id === currentUser.id;
                        const quotedMsg = msg.reply_to_id ? getQuotedMessage(msg.reply_to_id) : null;

                        return (
                            <div
                                key={msg.id || index}
                                className="message-group"
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: isMine ? 'flex-end' : 'flex-start',
                                    gap: '8px'
                                }}
                            >
                                {/* Reply Button (Left for Mine) */}
                                {isMine && (
                                    <div
                                        className="reply-btn"
                                        onClick={() => setReplyingTo(msg)}
                                        style={{ cursor: 'pointer', color: '#b0b0b0', padding: '0 5px' }}
                                        title="Reply"
                                    >
                                        <Reply size={18} />
                                    </div>
                                )}

                                <div
                                    style={messageBubbleStyle(isMine, msg.is_admin_message)}
                                    onTouchStart={onTouchStart}
                                    onTouchEnd={(e) => onTouchEnd(e, msg)}
                                >
                                    {/* Quoted Message Display */}
                                    {quotedMsg && (
                                        <div style={{
                                            background: 'rgba(0,0,0,0.1)',
                                            borderLeft: '4px solid #357abd',
                                            padding: '8px',
                                            borderRadius: '4px',
                                            fontSize: '12px',
                                            marginBottom: '4px',
                                            color: 'inherit',
                                            opacity: 0.8
                                        }}>
                                            <div style={{ fontWeight: 'bold' }}>Replying to...</div>
                                            <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '200px' }}>
                                                {quotedMsg.type === 'image' ? 'Image Attachment' : quotedMsg.content}
                                            </div>
                                        </div>
                                    )}

                                    {msg.type === 'image' ? (
                                        <div
                                            onClick={() => setPreviewImage(msg.content)}
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '12px',
                                                background: 'rgba(0, 0, 0, 0.05)',
                                                padding: '10px 15px',
                                                borderRadius: '10px',
                                                cursor: 'pointer',
                                                minWidth: '180px',
                                                userSelect: 'none'
                                            }}
                                        >
                                            <div style={{
                                                width: '40px',
                                                height: '40px',
                                                borderRadius: '8px',
                                                background: isMine ? 'rgba(255,255,255,0.2)' : '#357abd',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                flexShrink: 0
                                            }}>
                                                <ImageIcon size={20} color={isMine ? "white" : "white"} />
                                            </div>
                                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                <span style={{ fontWeight: '600', fontSize: '14px' }}>Photo</span>
                                                <span style={{ fontSize: '11px', opacity: 0.8 }}>Click to preview</span>
                                            </div>
                                        </div>
                                    ) : (
                                        <span>{msg.content}</span>
                                    )}
                                    <span style={{ fontSize: '10px', alignSelf: 'flex-end', opacity: 0.7 }}>
                                        {formatTime(msg.created_at)}
                                    </span>

                                    {/* Admin Review Controls for Hidden Messages (only shown when session is stopped AND message is still hidden) */}
                                    {isGhostMode && msg.is_hidden_from_owner && !currentUserProfile?.active_admin_session && (
                                        <div style={{
                                            marginTop: '8px',
                                            paddingTop: '8px',
                                            borderTop: '1px solid rgba(0,0,0,0.1)',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'space-between',
                                            minWidth: '120px'
                                        }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '10px', color: '#ef4444', fontWeight: 'bold' }}>
                                                <EyeOff size={10} /> Hidden
                                            </div>
                                            <div style={{ display: 'flex', gap: '8px' }}>
                                                <div
                                                    onClick={(e) => { e.stopPropagation(); handleApproveMessage(msg.id); }}
                                                    style={{ cursor: 'pointer', color: '#10b981', background: '#ecfdf5', borderRadius: '50%', padding: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                                    title="Mark to show to user"
                                                >
                                                    <Check size={14} />
                                                </div>
                                                <div
                                                    onClick={(e) => { e.stopPropagation(); handleRejectMessage(msg.id); }}
                                                    style={{ cursor: 'pointer', color: '#ef4444', background: '#fef2f2', borderRadius: '50%', padding: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                                    title="Delete message (will not be shown)"
                                                >
                                                    <X size={14} />
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Reply Button (Right for Theirs) */}
                                {!isMine && (
                                    <div
                                        className="reply-btn"
                                        onClick={() => setReplyingTo(msg)}
                                        style={{ cursor: 'pointer', color: '#b0b0b0', padding: '0 5px' }}
                                        title="Reply"
                                    >
                                        <Reply size={18} />
                                    </div>
                                )}
                            </div>
                        );
                    })
                )}

                {/* Typing Indicator Bubble */}
                {isTyping && (
                    <div style={typingBubbleStyle}>
                        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#999', animation: 'bounce 0.6s infinite', animationDelay: '0s' }}></div>
                        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#999', animation: 'bounce 0.6s infinite', animationDelay: '0.2s' }}></div>
                        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#999', animation: 'bounce 0.6s infinite', animationDelay: '0.4s' }}></div>
                    </div>
                )}

                <div ref={messagesEndRef} />
            </div>

            {/* Emoji Picker Popover */}
            {
                showEmojiPicker && (
                    <div style={{ position: 'absolute', bottom: '80px', left: '0', right: '0', margin: '0 auto', maxWidth: '350px', width: '95%', zIndex: 1000, WebkitBoxShadow: '0 5px 20px rgba(0,0,0,0.2)' }}>
                        <EmojiPicker
                            theme={Theme.DARK}
                            onEmojiClick={onEmojiClick}
                            width="100%"
                            height={400}
                        />
                    </div>
                )
            }

            {/* Reply Preview Bar */}
            {
                replyingTo && (
                    <div style={{
                        padding: '10px 15px',
                        background: '#f0f0f0',
                        borderLeft: '4px solid #357abd',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        borderTop: '1px solid #ddd'
                    }}>
                        <div style={{ overflow: 'hidden' }}>
                            <div style={{ fontSize: '12px', color: '#357abd', fontWeight: 'bold' }}>Replying to message</div>
                            <div style={{ fontSize: '14px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '300px', color: '#666' }}>
                                {replyingTo.type === 'image' ? 'Image Attachment' : replyingTo.content}
                            </div>
                        </div>
                        <X size={20} color="#666" style={{ cursor: 'pointer' }} onClick={() => setReplyingTo(null)} />
                    </div>
                )
            }

            {/* Input Area */}
            <div style={inputAreaStyle}>
                <div onClick={toggleEmojiPicker}>
                    <Smile size={24} color={showEmojiPicker ? "#357abd" : "#999"} style={{ cursor: 'pointer', marginRight: '10px' }} />
                </div>
                <textarea
                    placeholder="Message"
                    value={newMessage}
                    onChange={handleInputChange}
                    style={{
                        flex: 1,
                        border: 'none',
                        outline: 'none',
                        fontSize: '15px',
                        color: '#333',
                        resize: 'none',
                        fontFamily: 'inherit',
                        background: 'transparent',
                        padding: '8px 0',
                        height: '40px', // Fixed height or auto logic could be better but keeping it simple for now
                        minHeight: '20px'
                    }}
                />
                <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                    <div style={{ transform: 'rotate(45deg)', cursor: 'pointer' }} onClick={() => fileInputRef.current.click()}>
                        <Paperclip size={22} color="#999" />
                        <input
                            type="file"
                            ref={fileInputRef}
                            style={{ display: 'none' }}
                            accept="image/*"
                            onChange={handleFileUpload}
                        />
                    </div>
                    {/* Conditionally show Send button if typing, else Mic */}
                    {newMessage.trim() ? (
                        <Send size={22} color="#357abd" style={{ cursor: 'pointer' }} onClick={() => handleSendMessage(newMessage, 'text')} />
                    ) : (
                        <Mic size={22} color="#999" style={{ cursor: 'pointer' }} />
                    )}
                </div>
            </div>

            {/* Bottom Navigation */}
            <div style={bottomNavStyle}>
                <div style={navItemStyle} onClick={handleBack}>
                    <Home size={22} color="#102a5c" />
                    <span>Home</span>
                </div>
                <div style={navItemStyle}>
                    <Send size={22} color="#102a5c" style={{ transform: 'rotate(45deg)' }} />
                    <span>Transfer</span>
                </div>
                <div style={navItemStyle}>
                    <div style={{ position: 'relative' }}>
                        <MessageCircle size={22} color="#3b82f6" strokeWidth={2.5} fill="#3b82f6" fillOpacity={0.1} />
                    </div>
                    <span style={{ fontWeight: '700', color: '#102a5c' }}>Chat</span>
                </div>
                <div style={navItemStyle}>
                    <Download size={22} color="#102a5c" />
                    <span>Deposit</span>
                </div>
                <div style={navItemStyle} onClick={() => isGhostMode && currentUser ? navigate(`/admin/profile/${currentUser.id}`) : navigate('/profile')}>
                    <User size={22} color="#102a5c" />
                    <span>Profile</span>
                </div>
            </div>

            {/* Image Preview Modal */}
            {
                previewImage && (
                    <div
                        style={{
                            position: 'fixed',
                            top: 0,
                            left: 0,
                            right: 0,
                            bottom: 0,
                            background: 'rgba(0,0,0,0.9)',
                            zIndex: 2000,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexDirection: 'column',
                            animation: 'fadeIn 0.2s ease-out'
                        }}
                        onClick={() => setPreviewImage(null)}
                    >
                        <style>{`
                        @keyframes fadeIn {
                            from { opacity: 0; }
                            to { opacity: 1; }
                        }
                    `}</style>
                        <div style={{ position: 'relative', maxWidth: '90%', maxHeight: '80%' }}>
                            <img
                                src={previewImage}
                                alt="Preview"
                                style={{
                                    width: '100%',
                                    height: '100%',
                                    objectFit: 'contain',
                                    borderRadius: '8px',
                                    boxShadow: '0 5px 30px rgba(0,0,0,0.5)'
                                }}
                                onClick={(e) => e.stopPropagation()}
                            />
                            <button
                                onClick={() => setPreviewImage(null)}
                                style={{
                                    position: 'absolute',
                                    top: '-40px',
                                    right: '0px',
                                    background: 'rgba(255,255,255,0.2)',
                                    border: 'none',
                                    borderRadius: '50%',
                                    width: '36px',
                                    height: '36px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    cursor: 'pointer',
                                    color: 'white'
                                }}
                            >
                                <X size={20} />
                            </button>
                        </div>
                    </div>
                )
            }
        </div >
    );
}
