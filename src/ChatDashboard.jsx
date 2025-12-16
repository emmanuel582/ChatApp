import React, { useEffect, useState, useRef } from 'react';
import { supabase } from './supabaseClient';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Camera, LogOut, Save, Lock, User } from 'lucide-react';

export default function ChatDashboard() {
    const navigate = useNavigate();
    const { userId } = useParams(); // For Admin Ghost Mode
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [user, setUser] = useState(null);
    const [profile, setProfile] = useState({
        username: '',
        full_name: '',
        avatar_url: ''
    });

    const [fullName, setFullName] = useState('');
    const [password, setPassword] = useState('');

    const fileInputRef = useRef(null);

    useEffect(() => {
        getProfile();
    }, [userId]);

    const getProfile = async () => {
        try {
            setLoading(true);
            let targetUserId = null;

            if (userId) {
                // Admin Impersonation Mode
                console.log("Loading profile for Impersonated User:", userId);
                targetUserId = userId;
                setUser({ id: userId }); // Mock user object for state
            } else {
                // Normal User Mode
                const { data: { user } } = await supabase.auth.getUser();
                if (!user) {
                    navigate('/login');
                    return;
                }
                targetUserId = user.id;
                setUser(user);
            }

            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', targetUserId)
                .maybeSingle();

            if (error && status !== 406) {
                throw error;
            }

            if (data) {
                setProfile(data);
                setFullName(data.full_name || '');
            }
        } catch (error) {
            console.error('Error loading user data!', error.message);
        } finally {
            setLoading(false);
        }
    };

    const handleUpdateProfile = async () => {
        try {
            setSaving(true);
            const { error } = await supabase
                .from('profiles')
                .update({ full_name: fullName, updated_at: new Date() })
                .eq('id', user.id);

            if (error) throw error;

            if (password) {
                // Only allow password update for self, not when impersonating (unless we want admins to change user passwords)
                // For safety, let's disable password update in ghost mode for now or allow it if desired. 
                // The user only asked to VIEW the profile.
                if (!userId) {
                    const { error: passError } = await supabase.auth.updateUser({ password: password });
                    if (passError) throw passError;
                    setPassword('');
                    alert('Profile and password updated successfully!');
                } else {
                    alert('Profile updated successfully! (Password update disabled in Ghost Mode)');
                }
            } else {
                alert('Profile updated successfully!');
            }
        } catch (error) {
            alert('Error updating profile: ' + error.message);
        } finally {
            setSaving(false);
        }
    };

    const handleAvatarUpload = async (event) => {
        try {
            setSaving(true);
            if (!event.target.files || event.target.files.length === 0) {
                throw new Error('You must select an image to upload.');
            }

            const file = event.target.files[0];
            const fileExt = file.name.split('.').pop();
            const fileName = `${Math.random()}.${fileExt}`;
            const filePath = `${user.id}/${fileName}`;

            let { error: uploadError } = await supabase.storage
                .from('chat-attachments') // Using chat-attachments as fallback/primary
                .upload(filePath, file);

            if (uploadError) throw uploadError;

            const { data } = supabase.storage.from('chat-attachments').getPublicUrl(filePath);
            await updateAvatarUrl(data.publicUrl);

        } catch (error) {
            alert(error.message);
        } finally {
            setSaving(false);
        }
    };

    const updateAvatarUrl = async (url) => {
        const { error } = await supabase
            .from('profiles')
            .update({ avatar_url: url })
            .eq('id', user.id);

        if (error) throw error;
        setProfile(prev => ({ ...prev, avatar_url: url }));
    };

    const handleSignOut = async () => {
        if (userId) {
            // In Ghost Mode: "Exit to Admin"
            navigate('/admin');
        } else {
            await supabase.auth.signOut();
            navigate('/login');
        }
    };

    const handleBack = () => {
        if (userId) {
            navigate(`/admin/chat/${userId}`);
        } else {
            navigate('/dashboard');
        }
    }

    if (loading) {
        return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', color: '#fff', background: '#1f2937' }}>Loading...</div>;
    }

    return (
        <div style={{
            minHeight: '100vh',
            background: '#1f2937', // Dark background
            color: 'white',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
            display: 'flex',
            flexDirection: 'column'
        }}>
            {/* Header */}
            <div style={{
                height: '60px',
                display: 'flex',
                alignItems: 'center',
                padding: '0 20px',
                background: '#111827',
                borderBottom: '1px solid #374151'
            }}>
                <ArrowLeft style={{ cursor: 'pointer', marginRight: '15px' }} onClick={handleBack} />
                <h2 style={{ fontSize: '18px', fontWeight: '600', margin: 0 }}>Edit Profile</h2>
            </div>

            {/* Content */}
            <div style={{ padding: '30px 20px', maxWidth: '500px', margin: '0 auto', width: '100%' }}>

                {/* Avatar Section */}
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '30px', position: 'relative' }}>
                    <div style={{
                        width: '120px',
                        height: '120px',
                        borderRadius: '50%',
                        overflow: 'hidden',
                        border: '4px solid #374151',
                        position: 'relative'
                    }}>
                        <img
                            src={profile.avatar_url || 'https://via.placeholder.com/150'}
                            alt="Avatar"
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                        <div
                            onClick={() => fileInputRef.current.click()}
                            style={{
                                position: 'absolute',
                                bottom: '0',
                                left: '0',
                                width: '100%',
                                height: '40px',
                                background: 'rgba(0,0,0,0.6)',
                                display: 'flex',
                                justifyContent: 'center',
                                alignItems: 'center',
                                cursor: 'pointer',
                                transition: 'background 0.2s'
                            }}
                        >
                            <Camera size={20} color="white" />
                        </div>
                    </div>
                    <input
                        type="file"
                        ref={fileInputRef}
                        style={{ display: 'none' }}
                        accept="image/*"
                        onChange={handleAvatarUpload}
                    />
                </div>

                {/* Form Fields */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

                    {/* Username (Read-Only) */}
                    <div>
                        <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', color: '#9ca3af' }}>Username</label>
                        <div style={{
                            background: '#374151',
                            padding: '12px 15px',
                            borderRadius: '8px',
                            color: '#d1d5db',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '10px'
                        }}>
                            <User size={18} color="#9ca3af" />
                            <span>@{profile.username}</span>
                        </div>
                    </div>

                    {/* Full Name */}
                    <div>
                        <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', color: '#9ca3af' }}>Full Name</label>
                        <input
                            type="text"
                            value={fullName}
                            onChange={(e) => setFullName(e.target.value)}
                            placeholder="Enter your full name"
                            style={{
                                width: '100%',
                                background: '#111827',
                                border: '1px solid #374151',
                                padding: '12px 15px',
                                borderRadius: '8px',
                                color: 'white',
                                outline: 'none',
                                fontSize: '16px'
                            }}
                        />
                    </div>

                    {/* Password */}
                    <div>
                        <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', color: '#9ca3af' }}>New Password</label>
                        <div style={{ position: 'relative' }}>
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="Set a new password"
                                style={{
                                    width: '100%',
                                    background: '#111827',
                                    border: '1px solid #374151',
                                    padding: '12px 15px',
                                    paddingLeft: '45px',
                                    borderRadius: '8px',
                                    color: 'white',
                                    outline: 'none',
                                    fontSize: '16px'
                                }}
                            />
                            <Lock size={18} color="#9ca3af" style={{ position: 'absolute', left: '15px', top: '50%', transform: 'translateY(-50%)' }} />
                        </div>
                        <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '5px' }}>Leave blank to keep current password</p>
                    </div>

                    {/* Save Button */}
                    <button
                        onClick={handleUpdateProfile}
                        disabled={saving}
                        style={{
                            background: 'linear-gradient(to right, #3b82f6, #2563eb)',
                            color: 'white',
                            border: 'none',
                            padding: '14px',
                            borderRadius: '10px',
                            fontSize: '16px',
                            fontWeight: '600',
                            cursor: saving ? 'not-allowed' : 'pointer',
                            marginTop: '10px',
                            display: 'flex',
                            justifyContent: 'center',
                            alignItems: 'center',
                            gap: '10px',
                            opacity: saving ? 0.7 : 1
                        }}
                    >
                        <Save size={20} />
                        {saving ? 'Saving...' : 'Save Changes'}
                    </button>

                    {/* Logout Button */}
                    <button
                        onClick={handleSignOut}
                        style={{
                            background: 'transparent',
                            color: '#ef4444',
                            border: '1px solid #ef4444',
                            padding: '12px',
                            borderRadius: '10px',
                            fontSize: '16px',
                            fontWeight: '600',
                            cursor: 'pointer',
                            marginTop: '10px',
                            display: 'flex',
                            justifyContent: 'center',
                            alignItems: 'center',
                            gap: '10px'
                        }}
                    >
                        <LogOut size={20} />
                        Sign Out
                    </button>

                </div>
            </div>
        </div>
    );
}
