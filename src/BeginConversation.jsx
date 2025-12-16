import React, { useEffect, useState } from 'react';
import { Search, Home, MessageCircle, Send, Download, User } from 'lucide-react';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { supabase } from './supabaseClient';
import ChatScreen from './ChatScreen';

export default function BeginConversation({ impersonatedUserId = null, isGhostMode = false }) {
    const navigate = useNavigate();
    const location = useLocation();
    const [searchParams, setSearchParams] = useSearchParams();
    const chatRecipientId = searchParams.get('chat');

    const [currentUser, setCurrentUser] = useState(null);
    const [profile, setProfile] = useState(null);

    // ... (State variables same) ...
    const [isSearching, setIsSearching] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [searchResults, setSearchResults] = useState([]);

    // Recent Conversations State
    const [conversations, setConversations] = useState([]);
    const [loadingChats, setLoadingChats] = useState(true);
    const [authorizationChecked, setAuthorizationChecked] = useState(false);

    // Fetch User & Profile (Impersonation Support)
    useEffect(() => {
        const fetchUser = async () => {
            if (isGhostMode && impersonatedUserId) {
                // Fetch victim profile to mock currentUser
                const { data: victim } = await supabase.from('profiles').select('*').eq('id', impersonatedUserId).single();
                if (victim) {
                    setCurrentUser({ id: victim.id, email: 'ghost@admin.com', ...victim });
                    setProfile(victim);
                } else {
                    alert("User not found");
                    navigate('/admin');
                }
            } else {
                // Normal User Flow
                const { data: { user } } = await supabase.auth.getUser();
                if (!user) {
                    navigate('/login');
                    return;
                }
                setCurrentUser(user);

                // Update status to online/last seen (Only if NOT ghost)
                if (!isGhostMode) {
                    await supabase.from('profiles').update({ last_seen: new Date().toISOString() }).eq('id', user.id);
                }

                const { data } = await supabase
                    .from('profiles')
                    .select('*')
                    .eq('id', user.id)
                    .maybeSingle();

                if (data) setProfile(data);
            }
        };
        fetchUser();
    }, [navigate, impersonatedUserId, isGhostMode]);

    // Verify Chat Authorization
    useEffect(() => {
        const verifyChatAccess = async () => {
            if (!chatRecipientId || !currentUser) {
                setAuthorizationChecked(true);
                return;
            }

            // 1. Ghost Mode or Explicit UI Navigation (State set) -> Allow
            if (isGhostMode || location.state?.startNewChat) {
                setAuthorizationChecked(true);
                return;
            }

            // 2. Security Check: Direct URL Access requires existing history
            const { data: messages } = await supabase
                .from('messages')
                .select('id')
                .or(`and(sender_id.eq.${currentUser.id},recipient_id.eq.${chatRecipientId}),and(sender_id.eq.${chatRecipientId},recipient_id.eq.${currentUser.id})`)
                .limit(1);

            if (!messages || messages.length === 0) {
                // Unauthorized direct access
                navigate('/dashboard');
            } else {
                setAuthorizationChecked(true);
            }
        };

        verifyChatAccess();
    }, [chatRecipientId, currentUser, navigate, isGhostMode, location.state]);

    // Fetch Recent Messages and Subscribe
    useEffect(() => {
        if (!currentUser) return;

        const fetchInbox = async () => {
            const { data: messages } = await supabase
                .from('messages')
                .select('*')
                .or(`sender_id.eq.${currentUser.id},recipient_id.eq.${currentUser.id}`)
                .order('created_at', { ascending: false })
                .limit(50);

            if (!messages) {
                setLoadingChats(false);
                return;
            }

            // Filter out Ghost Messages and Hidden Messages if I am NOT the ghost (Real Owner viewing inbox)
            const filteredMessages = messages.filter(msg => {
                if (isGhostMode) return true; // Admin sees everything
                // Real user: hide messages SENT BY ME that are flagged as admin_message
                if (msg.sender_id === currentUser.id && msg.is_admin_message) return false;
                // Real user: hide messages marked as hidden from owner (intercepted during admin session)
                if (msg.is_hidden_from_owner) return false;
                return true;
            });

            const peerMap = new Map();
            filteredMessages.forEach(msg => {
                const peerId = msg.sender_id === currentUser.id ? msg.recipient_id : msg.sender_id;
                if (!peerMap.has(peerId)) {
                    peerMap.set(peerId, { lastMessage: msg, peerId });
                }
            });

            if (peerMap.size === 0) {
                setConversations([]);
                setLoadingChats(false);
                return;
            }

            const { data: profiles } = await supabase
                .from('profiles')
                .select('*')
                .in('id', Array.from(peerMap.keys()));

            const conversationList = Array.from(peerMap.values()).map(item => {
                const peerProfile = profiles?.find(p => p.id === item.peerId);
                return { ...item, peerProfile };
            });

            setConversations(conversationList);
            setLoadingChats(false);
        };

        fetchInbox();

        const channel = supabase
            .channel('inbox-global')
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'messages'
                },
                (payload) => {
                    const isRelevant =
                        payload.new.sender_id === currentUser.id ||
                        payload.new.recipient_id === currentUser.id;

                    if (isRelevant) {
                        fetchInbox();
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };

    }, [currentUser, isGhostMode]);

    // ... (Handlers) ...

    const handleSearchChange = async (e) => {
        const term = e.target.value;
        setSearchTerm(term);

        if (term.length > 0) {
            let query = supabase
                .from('profiles')
                .select('*')
                .ilike('username', `%${term}%`)
                .limit(5);

            if (profile && profile.id) {
                query = query.neq('id', profile.id);
            }

            const { data } = await query;
            setSearchResults(data || []);
        } else {
            setSearchResults([]);
        }
    };

    const openChat = (recipientId) => {
        // Pass state to indicate this is an intentional new chat
        navigate(`/dashboard?chat=${recipientId}`, { state: { startNewChat: true } });
        setIsSearching(false);
        setSearchResults([]);
        setSearchTerm('');
    };


    // Styles
    const bottomNavStyle = {
        height: '65px',
        background: 'white',
        borderTop: '1px solid #eee',
        display: 'flex',
        justifyContent: 'space-around',
        alignItems: 'center',
        paddingBottom: '5px',
        flexShrink: 0,
        zIndex: 10
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

    if (chatRecipientId && authorizationChecked) {
        return <ChatScreen recipientId={chatRecipientId} impersonatedUser={isGhostMode ? currentUser : null} isGhostMode={isGhostMode} />;
    }

    if (chatRecipientId && !authorizationChecked) {
        return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', color: '#666' }}>Verifying access...</div>;
    }

    const handleProfileClick = () => {
        if (isGhostMode && currentUser) {
            navigate(`/admin/profile/${currentUser.id}`);
        } else {
            navigate('/profile');
        }
    };

    return (
        <div style={{ height: '100vh', width: '100%', background: 'white', display: 'flex', flexDirection: 'column' }}>
            {/* Header */}
            <div style={{
                height: '5rem',
                background: '#357abd',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0 15px',
                position: 'relative',
                boxShadow: '0 4px 20px rgba(53, 122, 189, 0.2)',
                flexShrink: 0
            }}>
                <div style={{ color: 'white', fontWeight: 'bold', fontSize: '20px' }}>Chats</div>

                {isSearching ? (
                    <div style={{
                        flex: 1,
                        maxWidth: '500px',
                        display: 'flex',
                        alignItems: 'center',
                        background: 'rgba(255,255,255,0.15)',
                        borderRadius: '12px',
                        padding: '10px 15px',
                        marginLeft: '20px',
                        backdropFilter: 'blur(10px)',
                        border: '1px solid rgba(255,255,255,0.2)',
                    }}>
                        <Search size={18} color="rgba(255,255,255,0.8)" style={{ marginRight: '10px' }} />
                        <input
                            type="text"
                            placeholder="Find users..."
                            autoFocus
                            value={searchTerm}
                            onChange={handleSearchChange}
                            style={{
                                background: 'transparent',
                                border: 'none',
                                color: 'white',
                                width: '100%',
                                outline: 'none',
                                fontSize: '16px'
                            }}
                        />
                        <div
                            style={{ cursor: 'pointer', color: 'rgba(255,255,255,0.8)', marginLeft: '10px' }}
                            onClick={() => { setIsSearching(false); setSearchResults([]); setSearchTerm(''); }}
                        >✕</div>
                    </div>
                ) : (
                    <div onClick={() => setIsSearching(true)} style={{ cursor: 'pointer', padding: '10px' }}>
                        <Search size={24} color="white" />
                    </div>
                )}

                {/* Search Results Dropdown */}
                {isSearching && searchResults.length > 0 && (
                    <div style={{
                        position: 'absolute',
                        top: '5.5rem',
                        right: '0',
                        left: '0',
                        margin: '0 auto',
                        maxWidth: '500px',
                        width: '90%',
                        background: 'white',
                        borderRadius: '12px',
                        boxShadow: '0 10px 30px rgba(0,0,0,0.2)',
                        zIndex: 100,
                        overflow: 'hidden'
                    }}>
                        {searchResults.map((user) => (
                            <div
                                key={user.id}
                                onClick={() => openChat(user.id)}
                                style={{
                                    padding: '12px 15px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '12px',
                                    cursor: 'pointer',
                                    borderBottom: '1px solid #f0f0f0',
                                    background: 'white'
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f9f9f9'}
                                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'white'}
                            >
                                <img src={user.avatar_url} alt="" style={{ width: '40px', height: '40px', borderRadius: '50%' }} />
                                <div>
                                    <div style={{ fontWeight: '600', color: '#333' }}>{user.full_name || user.username}</div>
                                    <div style={{ fontSize: '12px', color: '#888' }}>@{user.username}</div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Inbox List */}
            <div style={{ flex: 1, overflowY: 'auto', background: '#f8f9fa' }}>
                {loadingChats ? (
                    <div style={{ padding: '20px', textAlign: 'center', color: '#999' }}>Loading chats...</div>
                ) : conversations.length === 0 ? (
                    <div style={{ height: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', flexDirection: 'column', color: '#aaa' }}>
                        <Search size={48} color="#ddd" style={{ marginBottom: '15px' }} />
                        <p style={{ fontSize: '18px' }}>No conversations yet</p>
                        <p style={{ fontSize: '14px' }}>Search for a user to start chatting</p>
                    </div>
                ) : (
                    conversations.map(({ lastMessage, peerProfile }) => {
                        if (!peerProfile) return null;
                        const isMe = lastMessage.sender_id === currentUser?.id;
                        return (
                            <div
                                key={lastMessage.id}
                                onClick={() => openChat(peerProfile.id)}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    padding: '15px 20px',
                                    background: 'white',
                                    borderBottom: '1px solid #f0f0f0',
                                    cursor: 'pointer',
                                    transition: 'background 0.2s'
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#fafafa'}
                                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'white'}
                            >
                                {/* Avatar */}
                                <div style={{ position: 'relative', marginRight: '15px' }}>
                                    <img
                                        src={peerProfile.avatar_url}
                                        alt=""
                                        style={{ width: '56px', height: '56px', borderRadius: '50%', objectFit: 'cover', boxShadow: '0 2px 5px rgba(0,0,0,0.1)' }}
                                    />
                                    {!isMe && !lastMessage.is_read && (
                                        <div style={{
                                            position: 'absolute',
                                            bottom: '0',
                                            right: '0',
                                            width: '12px',
                                            height: '12px',
                                            background: '#e53e3e',
                                            borderRadius: '50%',
                                            border: '2px solid white'
                                        }}></div>
                                    )}
                                </div>

                                {/* Info */}
                                <div style={{ flex: 1 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                                        <span style={{ fontSize: '16px', fontWeight: 'bold', color: '#333' }}>
                                            {peerProfile.full_name || peerProfile.username}
                                        </span>
                                        <span style={{ fontSize: '12px', color: '#999' }}>
                                            {new Date(lastMessage.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                    </div>
                                    <div style={{
                                        fontSize: '14px', color: '#666',
                                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '250px'
                                    }}>
                                        {isMe ? (
                                            <span><span style={{ color: '#888' }}>You:</span> {lastMessage.content}</span>
                                        ) : (
                                            <span style={{ fontWeight: !lastMessage.is_read ? '600' : '400', color: !lastMessage.is_read ? '#e53e3e' : '#666' }}>
                                                {lastMessage.content}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

            {/* Bottom Navigation */}
            <div style={bottomNavStyle}>
                <div style={navItemStyle} onClick={() => {
                    if (isGhostMode) {
                        navigate('/admin'); // Or back to admin dashboard
                    } else {
                        // Already home
                    }
                }}>
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
                <div style={navItemStyle} onClick={handleProfileClick}>
                    <User size={22} color="#102a5c" />
                    <span>Profile</span>
                </div>
            </div>
        </div>
    );
}
