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
    Shield
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

    // Reply State
    const [replyingTo, setReplyingTo] = useState(null);

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

    // 1. Fetch Current User, User Profile & Recipient & Initial Presence
    useEffect(() => {
        const fetchUserAndRecipient = async () => {
            if (isGhostMode && impersonatedUser) {
                // Impersonation Mode
                setCurrentUser(impersonatedUser);
                setCurrentUserProfile(impersonatedUser);
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
                // Filter Ghost Messages for normal user
                const visible = data.filter(msg => {
                    if (isGhostMode) return true;
                    // If I am the sender AND it is a ghost message, I shouldn't see it (because I didn't write it, Admin did)
                    if (msg.sender_id === currentUser.id && msg.is_admin_message) return false;
                    return true;
                });
                setMessages(visible);
            }
        };

        fetchMessages();

        // MARK AS READ: When I open the chat, mark all messages FROM THE RECIPIENT as read
        const markAsRead = async () => {
            await supabase
                .from('messages')
                .update({ is_read: true })
                .eq('sender_id', recipientId)
                .eq('recipient_id', currentUser.id)
                .eq('is_read', false);
        };
        markAsRead();

        // Subscribe to messages
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
                    // Check Ghost Visibility
                    if (!isGhostMode && payload.new.sender_id === currentUser.id && payload.new.is_admin_message) {
                        return; // Ignore this message
                    }

                    const isRelevant =
                        (payload.new.sender_id === recipientId && payload.new.recipient_id === currentUser.id) ||
                        (payload.new.sender_id === currentUser.id && payload.new.recipient_id === recipientId);

                    if (isRelevant) {
                        // IF I receive a new message while in the chat, mark it as read immediately
                        if (payload.new.sender_id === recipientId && payload.new.recipient_id === currentUser.id) {
                            supabase.from('messages').update({ is_read: true }).eq('id', payload.new.id).then();
                        }

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
    }, [currentUser, recipientId, isGhostMode]);

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
        backgroundColor: isAdminMsg
            ? '#7f1d1d' // Dark Red for Ghost Message (Seen by Admin)
            : (isMine ? '#357abd' : '#f0f0f0'),
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

    if (!recipient || !currentUser) return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', color: '#666' }}>Loading chat...</div>;

    return (
        <div style={containerStyle}>
            <style>{`
                @keyframes bounce {
                    0%, 100% { transform: translateY(0); }
                    50% { transform: translateY(-5px); }
                }
                .message-group:hover .reply-btn {
                    opacity: 1 !important;
                }
            `}</style>

            {/* Ghost Mode Banner */}
            {isGhostMode && (
                <div style={{ background: '#ef4444', color: 'white', textAlign: 'center', fontSize: '12px', padding: '4px' }}>
                    GHOST MODE ACTIVE - Messages are hidden from owner
                </div>
            )}

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
                                        style={{ opacity: 0, transition: 'opacity 0.2s', cursor: 'pointer', color: '#999' }}
                                    >
                                        <Reply size={16} />
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
                                        <img src={msg.content} alt="Attachment" style={{ maxWidth: '100%', borderRadius: '8px', cursor: 'pointer' }} onClick={() => window.open(msg.content, '_blank')} />
                                    ) : (
                                        <span>{msg.content}</span>
                                    )}
                                    <span style={{ fontSize: '10px', alignSelf: 'flex-end', opacity: 0.7 }}>
                                        {formatTime(msg.created_at)}
                                    </span>
                                    {msg.is_admin_message && <Shield size={10} style={{ position: 'absolute', top: -4, right: -4, color: '#ef4444' }} />}
                                </div>

                                {/* Reply Button (Right for Theirs) */}
                                {!isMine && (
                                    <div
                                        className="reply-btn"
                                        onClick={() => setReplyingTo(msg)}
                                        style={{ opacity: 0, transition: 'opacity 0.2s', cursor: 'pointer', color: '#999' }}
                                    >
                                        <Reply size={16} />
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
            {showEmojiPicker && (
                <div style={{ position: 'absolute', bottom: '130px', left: '10px', zIndex: 1000, WebkitBoxShadow: '0 5px 20px rgba(0,0,0,0.2)' }}>
                    <EmojiPicker
                        theme={Theme.DARK}
                        onEmojiClick={onEmojiClick}
                        width={320}
                        height={400}
                    />
                </div>
            )}

            {/* Reply Preview Bar */}
            {replyingTo && (
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
            )}

            {/* Input Area */}
            <div style={inputAreaStyle}>
                <div onClick={toggleEmojiPicker}>
                    <Smile size={24} color={showEmojiPicker ? "#357abd" : "#999"} style={{ cursor: 'pointer', marginRight: '10px' }} />
                </div>
                <input
                    type="text"
                    placeholder="Message"
                    value={newMessage}
                    onChange={handleInputChange}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSendMessage(newMessage, 'text');
                    }}
                    style={{ flex: 1, border: 'none', outline: 'none', fontSize: '15px', color: '#333' }}
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
                <div style={navItemStyle} onClick={() => navigate('/profile')}>
                    <User size={22} color="#102a5c" />
                    <span>Profile</span>
                </div>
            </div>
        </div>
    );
}
