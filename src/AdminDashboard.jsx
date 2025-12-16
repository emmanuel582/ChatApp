import React, { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';
import { useNavigate } from 'react-router-dom';
import { Search, Shield, User, ArrowRight, Lock, LogIn } from 'lucide-react';

export default function AdminDashboard() {
    const navigate = useNavigate();
    const [adminUser, setAdminUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [results, setResults] = useState([]);

    // Login State
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loginError, setLoginError] = useState('');
    const [isLoggingIn, setIsLoggingIn] = useState(false);

    useEffect(() => {
        const checkSession = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (user && user.email === 'admin@admin.com') {
                setAdminUser(user);
            }
            setLoading(false);
        };
        checkSession();
    }, []);

    const handleAdminLogin = async (e) => {
        e.preventDefault();
        setLoginError('');
        setIsLoggingIn(true);

        // Strict Credential Check before attempting network request
        if (email !== 'admin@admin.com' || password !== 'emmanuelOYEBIMPE~!@#1') {
            setLoginError('Invalid Username or Password');
            setIsLoggingIn(false);
            return;
        }

        try {
            // Real Authentication to establish valid session for RLS
            const { data, error } = await supabase.auth.signInWithPassword({
                email: email,
                password: password,
            });

            if (error) throw error;

            if (data?.user) {
                // Ensure the user is actually an admin in the profiles table to allow RLS to work
                // We update the profile to set is_admin = true
                await supabase.from('profiles').update({ is_admin: true }).eq('id', data.user.id);
                setAdminUser(data.user);
            }
        } catch (error) {
            console.error('Login Failed', error);
            if (error.message.includes('Invalid login credentials')) {
                setLoginError('Admin account not found or invalid credentials. Please ensure the admin user exists in Supabase.');
            } else {
                setLoginError(error.message);
            }
        } finally {
            setIsLoggingIn(false);
        }
    };

    const handleSearch = async (e) => {
        const term = e.target.value;
        setSearchTerm(term);

        if (term.length > 0) {
            const { data } = await supabase
                .from('profiles')
                .select('*')
                .ilike('username', `%${term}%`)
                .limit(10);
            setResults(data || []);
        } else {
            setResults([]);
        }
    };

    const impersonateUser = (userId) => {
        if (confirm("Enter Ghost Mode for this user? You will see their chats and can send hidden messages.")) {
            // Navigate to the Admin Chat View, passing the target user ID
            navigate(`/admin/chat/${userId}`);
        }
    };

    const handleLogout = async () => {
        await supabase.auth.signOut();
        setAdminUser(null);
        setEmail('');
        setPassword('');
    };

    if (loading) return <div style={{ padding: 20, color: 'white', background: '#111827', minHeight: '100vh' }}>Verifying Admin Access...</div>;

    // LOGIN VIEW
    if (!adminUser) {
        return (
            <div style={{ minHeight: '100vh', background: '#111827', color: 'white', display: 'flex', justifyContent: 'center', alignItems: 'center', fontFamily: 'sans-serif' }}>
                <div style={{ maxWidth: '400px', width: '100%', padding: '40px', background: '#1f2937', borderRadius: '16px', border: '1px solid #374151', boxShadow: '0 10px 25px rgba(0,0,0,0.5)' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '30px' }}>
                        <div style={{ background: '#ef4444', padding: '12px', borderRadius: '50%', marginBottom: '15px' }}>
                            <Shield size={32} color="white" />
                        </div>
                        <h1 style={{ fontSize: '24px', fontWeight: 'bold' }}>Admin Access</h1>
                        <p style={{ color: '#9ca3af', marginTop: '5px' }}> Restricted Area </p>
                    </div>

                    <form onSubmit={handleAdminLogin} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                        <div>
                            <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', color: '#d1d5db' }}>Username / Email</label>
                            <div style={{ position: 'relative' }}>
                                <User size={18} color="#9ca3af" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="admin@admin.com"
                                    style={{ width: '100%', padding: '12px 12px 12px 40px', background: '#374151', border: '1px solid #4b5563', borderRadius: '8px', color: 'white', outline: 'none' }}
                                    required
                                />
                            </div>
                        </div>

                        <div>
                            <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', color: '#d1d5db' }}>Password</label>
                            <div style={{ position: 'relative' }}>
                                <Lock size={18} color="#9ca3af" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                                <input
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="••••••••"
                                    style={{ width: '100%', padding: '12px 12px 12px 40px', background: '#374151', border: '1px solid #4b5563', borderRadius: '8px', color: 'white', outline: 'none' }}
                                    required
                                />
                            </div>
                        </div>

                        {loginError && (
                            <div style={{ padding: '10px', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', borderRadius: '6px', fontSize: '14px', textAlign: 'center' }}>
                                {loginError}
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={isLoggingIn}
                            style={{
                                background: '#ef4444',
                                color: 'white',
                                border: 'none',
                                padding: '12px',
                                borderRadius: '8px',
                                fontSize: '16px',
                                fontWeight: '600',
                                cursor: isLoggingIn ? 'not-allowed' : 'pointer',
                                display: 'flex',
                                justifyContent: 'center',
                                alignItems: 'center',
                                gap: '8px',
                                transition: 'background 0.2s',
                                marginTop: '10px'
                            }}
                            onMouseOver={(e) => !isLoggingIn && (e.currentTarget.style.background = '#dc2626')}
                            onMouseOut={(e) => !isLoggingIn && (e.currentTarget.style.background = '#ef4444')}
                        >
                            {isLoggingIn ? 'Authenticating...' : <><LogIn size={18} /> Enter Admin Panel</>}
                        </button>
                    </form>
                </div>
            </div>
        );
    }

    // DASHBOARD VIEW
    return (
        <div style={{ minHeight: '100vh', background: '#111827', color: 'white', fontFamily: 'sans-serif', padding: '20px' }}>
            <div style={{ maxWidth: '600px', margin: '0 auto' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '30px', borderBottom: '1px solid #374151', paddingBottom: '20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                        <Shield size={32} color="#ef4444" style={{ marginRight: '15px' }} />
                        <div>
                            <h1 style={{ fontSize: '24px', fontWeight: 'bold', margin: 0 }}>Ghost Admin Panel</h1>
                            <p style={{ color: '#9ca3af', margin: '5px 0 0 0' }}>Impersonate users and send invisible messages.</p>
                        </div>
                    </div>
                    <button
                        onClick={handleLogout}
                        style={{
                            background: 'transparent',
                            border: '1px solid #4b5563',
                            color: '#e5e7eb',
                            padding: '8px 12px',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontSize: '14px'
                        }}
                    >
                        Sign Out
                    </button>
                </div>

                <div style={{ background: '#1f2937', padding: '20px', borderRadius: '12px', border: '1px solid #374151' }}>
                    <div style={{ display: 'flex', alignItems: 'center', background: '#374151', borderRadius: '8px', padding: '12px', marginBottom: '20px' }}>
                        <Search size={20} color="#9ca3af" style={{ marginRight: '10px' }} />
                        <input
                            type="text"
                            placeholder="Search username to impersonate..."
                            value={searchTerm}
                            onChange={handleSearch}
                            style={{ background: 'transparent', border: 'none', color: 'white', fontSize: '16px', width: '100%', outline: 'none' }}
                        />
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {results.length > 0 ? results.map(user => (
                            <div
                                key={user.id}
                                onClick={() => impersonateUser(user.id)}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    padding: '15px',
                                    background: '#111827',
                                    borderRadius: '8px',
                                    cursor: 'pointer',
                                    border: '1px solid #374151',
                                    transition: 'background 0.2s'
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.borderColor = '#ef4444'}
                                onMouseLeave={(e) => e.currentTarget.style.borderColor = '#374151'}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    <img src={user.avatar_url} style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover' }} />
                                    <div>
                                        <div style={{ fontWeight: 'bold' }}>{user.full_name}</div>
                                        <div style={{ fontSize: '13px', color: '#9ca3af' }}>@{user.username}</div>
                                    </div>
                                </div>
                                <ArrowRight size={20} color="#ef4444" />
                            </div>
                        )) : searchTerm ? (
                            <div style={{ textAlign: 'center', color: '#6b7280', padding: '20px' }}>No users found</div>
                        ) : (
                            <div style={{ textAlign: 'center', color: '#6b7280', padding: '20px' }}>Search for a user...</div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
