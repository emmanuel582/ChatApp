import React, { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';
import { useNavigate } from 'react-router-dom';
import { Search, Shield, User, ArrowRight } from 'lucide-react';

export default function AdminDashboard() {
    const navigate = useNavigate();
    const [adminUser, setAdminUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [results, setResults] = useState([]);

    useEffect(() => {
        const checkAdmin = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                navigate('/login');
                return;
            }

            // Check if admin
            const { data: profile } = await supabase
                .from('profiles')
                .select('is_admin')
                .eq('id', user.id)
                .single();

            if (!profile || !profile.is_admin) {
                alert("Access Denied: Admins Only");
                navigate('/dashboard');
                return;
            }

            setAdminUser(user);
            setLoading(false);
        };
        checkAdmin();
    }, [navigate]);

    // Fetch initial users
    useEffect(() => {
        const fetchInitialUsers = async () => {
            const { data } = await supabase
                .from('profiles')
                .select('*')
                .limit(50);
            setResults(data || []);
        };

        if (adminUser) {
            fetchInitialUsers();
        }
    }, [adminUser]);

    const handleSearch = async (e) => {
        const term = e.target.value;
        setSearchTerm(term);

        if (term.length > 0) {
            const { data } = await supabase
                .from('profiles')
                .select('*')
                .ilike('username', `%${term}%`)
                .limit(50);
            setResults(data || []);
        } else {
            // Reset to default list if search is cleared
            const { data } = await supabase
                .from('profiles')
                .select('*')
                .limit(50);
            setResults(data || []);
        }
    };

    const impersonateUser = (userId) => {
        if (confirm("Enter Ghost Mode for this user? You will see their chats and can send hidden messages.")) {
            // Navigate to the Admin Chat View, passing the target user ID
            navigate(`/admin/chat/${userId}`);
        }
    };

    if (loading) return <div style={{ padding: 20 }}>Verifying Admin Access...</div>;

    return (
        <div style={{ minHeight: '100vh', background: '#111827', color: 'white', fontFamily: 'sans-serif', padding: '20px' }}>
            <div style={{ maxWidth: '600px', margin: '0 auto' }}>
                <div style={{ display: 'flex', alignItems: 'center', marginBottom: '30px', borderBottom: '1px solid #374151', paddingBottom: '20px' }}>
                    <Shield size={32} color="#ef4444" style={{ marginRight: '15px' }} />
                    <div>
                        <h1 style={{ fontSize: '24px', fontWeight: 'bold', margin: 0 }}>Ghost Admin Panel</h1>
                        <p style={{ color: '#9ca3af', margin: '5px 0 0 0' }}>Impersonate users and send invisible messages.</p>
                    </div>
                </div>

                <div style={{ background: '#1f2937', padding: '20px', borderRadius: '12px', border: '1px solid #374151' }}>
                    <div style={{ display: 'flex', alignItems: 'center', background: '#374151', borderRadius: '8px', padding: '12px', marginBottom: '20px' }}>
                        <Search size={20} color="#9ca3af" style={{ marginRight: '10px' }} />
                        <input
                            type="text"
                            placeholder="Search by username..."
                            value={searchTerm}
                            onChange={handleSearch}
                            style={{ background: 'transparent', border: 'none', color: 'white', fontSize: '16px', width: '100%', outline: 'none' }}
                        />
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {results.map(user => (
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
                                    <img src={user.avatar_url || 'https://via.placeholder.com/40'} style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover' }} />
                                    <div>
                                        <div style={{ fontWeight: 'bold' }}>{user.full_name}</div>
                                        <div style={{ fontSize: '13px', color: '#9ca3af' }}>@{user.username}</div>
                                        {/* Display Email if available (Admin View) */}
                                        <div style={{ fontSize: '11px', color: '#6b7280' }}>{user.email}</div>
                                    </div>
                                </div>
                                <ArrowRight size={20} color="#ef4444" />
                            </div>
                        ))}
                        {results.length === 0 && (
                            <div style={{ textAlign: 'center', color: '#6b7280', padding: '20px' }}>No users found</div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
