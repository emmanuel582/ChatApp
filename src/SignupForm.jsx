import React, { useState } from 'react';
import { Mail, User, AtSign, Lock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import { supabase } from './supabaseClient';

export default function SignupForm() {
    const navigate = useNavigate();
    const [formData, setFormData] = useState({
        email: '',
        fullName: '',
        username: '',
        password: '',
        confirmPassword: ''
    });
    const [loading, setLoading] = useState(false);

    const handleChange = (e) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value
        });
    };

    const getRandomProfilePicture = () => {
        // List of available images in the public folder
        const images = [
            "avatar_1.jpg",
            "avatar_2.jpg",
            "avatar_3.jpg",
            "avatar_4.jpg",
            "avatar_5.jpg",
            "avatar_6.jpg",
        ];
        const randomIndex = Math.floor(Math.random() * images.length);
        return images[randomIndex];
    };

    const handleSubmit = async () => {
        if (formData.password !== formData.confirmPassword) {
            alert("Passwords do not match!");
            return;
        }

        setLoading(true);
        try {
            const randomImage = getRandomProfilePicture();

            const { data, error } = await supabase.auth.signUp({
                email: formData.email,
                password: formData.password,
                options: {
                    data: {
                        full_name: formData.fullName,
                        username: formData.username,
                        avatar_url: '/' + randomImage, // Path relative to public folder
                    },
                },
            });

            if (error) throw error;

            console.log('Signup successful:', data);

            // If Supabase returns a session, it means email verification is disabled (or optional)
            // and the user is logged in automatically.
            if (data.session) {
                navigate('/dashboard');
            } else {
                alert('Signup successful! Please confirm your email to login.');
                navigate('/login');
            }

        } catch (error) {
            console.error('Signup error:', error.message);
            alert('Error signing up: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    const containerStyle = {
        minHeight: '100vh',
        width: '100%',
        background: '#1a3a6b',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
        position: 'relative',
        overflow: 'hidden'
    };

    const squareLayerStyle = {
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        opacity: 0.6
    };

    const cardStyle = {
        background: 'white',
        borderRadius: '16px',
        padding: '45px 40px',
        width: '100%',
        maxWidth: '440px',
        boxShadow: '0 25px 70px rgba(0, 0, 0, 0.4)',
        position: 'relative',
        zIndex: 10
    };

    const logoStyle = {
        display: 'flex',
        justifyContent: 'center',
        marginBottom: '28px'
    };

    const logoIconStyle = {
        width: '42px',
        height: '42px',
        background: 'linear-gradient(135deg, #4a90e2 0%, #357abd 100%)',
        borderRadius: '10px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transform: 'rotate(45deg)',
        boxShadow: '0 5px 15px rgba(74, 144, 226, 0.4)'
    };

    const logoInnerStyle = {
        width: '24px',
        height: '24px',
        background: 'white',
        borderRadius: '4px',
        transform: 'rotate(-45deg)'
    };

    const titleStyle = {
        fontSize: '24px',
        fontWeight: '600',
        color: '#1a1a1a',
        marginBottom: '8px',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    };

    const subtitleStyle = {
        fontSize: '14.5px',
        color: '#666',
        marginBottom: '32px',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    };

    const inputGroupStyle = {
        marginBottom: '22px'
    };

    const labelStyle = {
        display: 'block',
        fontSize: '14.5px',
        fontWeight: '500',
        color: '#1a1a1a',
        marginBottom: '9px',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    };

    const inputWrapperStyle = {
        position: 'relative',
        display: 'flex',
        alignItems: 'center'
    };

    const inputIconStyle = {
        position: 'absolute',
        left: '14px',
        color: '#999',
        pointerEvents: 'none',
        zIndex: 1
    };

    const inputStyle = {
        width: '100%',
        padding: '13px 13px 13px 44px',
        border: '1px solid #e0e0e0',
        borderRadius: '8px',
        fontSize: '14.5px',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        transition: 'border-color 0.3s ease, background-color 0.3s ease',
        outline: 'none',
        backgroundColor: '#fafafa',
        boxSizing: 'border-box'
    };

    const buttonStyle = {
        width: '100%',
        padding: '15px',
        background: 'linear-gradient(135deg, #1a3a6b 0%, #2a5298 100%)',
        color: 'white',
        border: 'none',
        borderRadius: '8px',
        fontSize: '16px',
        fontWeight: '600',
        cursor: 'pointer',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        transition: 'transform 0.2s ease, box-shadow 0.3s ease',
        marginTop: '12px',
        boxShadow: '0 5px 15px rgba(30, 60, 114, 0.35)'
    };

    const footerStyle = {
        marginTop: '24px',
        textAlign: 'center',
        fontSize: '14.5px',
        color: '#666',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    };

    const linkStyle = {
        color: '#2a5298',
        textDecoration: 'none',
        fontWeight: '600',
        cursor: 'pointer'
    };

    // Generate grid of squares (chess-like pattern)
    const squares = [];
    const squareSize = 120;
    const gap = 16; // 1rem = 16px
    const cols = 12;
    const rows = 10;

    for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
            squares.push(
                <div
                    key={`${row}-${col}`}
                    style={{
                        position: 'absolute',
                        width: `${squareSize}px`,
                        height: `${squareSize}px`,
                        border: '3px solid rgba(120, 180, 255, 0.6)',
                        borderRadius: '12px',
                        top: `${row * (squareSize + gap)}px`,
                        left: `${col * (squareSize + gap)}px`,
                        pointerEvents: 'none'
                    }}
                />
            );
        }
    }

    return (
        <div style={containerStyle}>
            <div style={squareLayerStyle}>
                {squares}
            </div>

            <div style={cardStyle}>
                <div style={logoStyle}>
                    <div style={logoIconStyle}>
                        <div style={logoInnerStyle}></div>
                    </div>
                </div>

                <div style={titleStyle}>Registration Form</div>
                <div style={subtitleStyle}>Create your banking account</div>

                <div>
                    <div style={inputGroupStyle}>
                        <label style={labelStyle}>Email</label>
                        <div style={inputWrapperStyle}>
                            <Mail size={18} style={inputIconStyle} />
                            <input
                                type="email"
                                name="email"
                                placeholder="Enter your email"
                                value={formData.email}
                                onChange={handleChange}
                                style={inputStyle}
                                onFocus={(e) => {
                                    e.target.style.borderColor = '#4a90e2';
                                    e.target.style.backgroundColor = 'white';
                                }}
                                onBlur={(e) => {
                                    e.target.style.borderColor = '#e0e0e0';
                                    e.target.style.backgroundColor = '#fafafa';
                                }}
                            />
                        </div>
                    </div>

                    <div style={inputGroupStyle}>
                        <label style={labelStyle}>Full Name</label>
                        <div style={inputWrapperStyle}>
                            <User size={18} style={inputIconStyle} />
                            <input
                                type="text"
                                name="fullName"
                                placeholder="Enter your full name"
                                value={formData.fullName}
                                onChange={handleChange}
                                style={inputStyle}
                                onFocus={(e) => {
                                    e.target.style.borderColor = '#4a90e2';
                                    e.target.style.backgroundColor = 'white';
                                }}
                                onBlur={(e) => {
                                    e.target.style.borderColor = '#e0e0e0';
                                    e.target.style.backgroundColor = '#fafafa';
                                }}
                            />
                        </div>
                    </div>

                    <div style={inputGroupStyle}>
                        <label style={labelStyle}>Username</label>
                        <div style={inputWrapperStyle}>
                            <AtSign size={18} style={inputIconStyle} />
                            <input
                                type="text"
                                name="username"
                                placeholder="Choose a unique username"
                                value={formData.username}
                                onChange={handleChange}
                                style={inputStyle}
                                onFocus={(e) => {
                                    e.target.style.borderColor = '#4a90e2';
                                    e.target.style.backgroundColor = 'white';
                                }}
                                onBlur={(e) => {
                                    e.target.style.borderColor = '#e0e0e0';
                                    e.target.style.backgroundColor = '#fafafa';
                                }}
                            />
                        </div>
                    </div>

                    <div style={inputGroupStyle}>
                        <label style={labelStyle}>Password</label>
                        <div style={inputWrapperStyle}>
                            <Lock size={18} style={inputIconStyle} />
                            <input
                                type="password"
                                name="password"
                                placeholder="Enter your password"
                                value={formData.password}
                                onChange={handleChange}
                                style={inputStyle}
                                onFocus={(e) => {
                                    e.target.style.borderColor = '#4a90e2';
                                    e.target.style.backgroundColor = 'white';
                                }}
                                onBlur={(e) => {
                                    e.target.style.borderColor = '#e0e0e0';
                                    e.target.style.backgroundColor = '#fafafa';
                                }}
                            />
                        </div>
                    </div>

                    <div style={inputGroupStyle}>
                        <label style={labelStyle}>Confirm Password</label>
                        <div style={inputWrapperStyle}>
                            <Lock size={18} style={inputIconStyle} />
                            <input
                                type="password"
                                name="confirmPassword"
                                placeholder="Confirm your password"
                                value={formData.confirmPassword}
                                onChange={handleChange}
                                style={inputStyle}
                                onFocus={(e) => {
                                    e.target.style.borderColor = '#4a90e2';
                                    e.target.style.backgroundColor = 'white';
                                }}
                                onBlur={(e) => {
                                    e.target.style.borderColor = '#e0e0e0';
                                    e.target.style.backgroundColor = '#fafafa';
                                }}
                            />
                        </div>
                    </div>

                    <button
                        onClick={handleSubmit}
                        style={buttonStyle}
                        onMouseEnter={(e) => {
                            e.target.style.transform = 'translateY(-2px)';
                            e.target.style.boxShadow = '0 8px 25px rgba(30, 60, 114, 0.45)';
                        }}
                        onMouseLeave={(e) => {
                            e.target.style.transform = 'translateY(0)';
                            e.target.style.boxShadow = '0 5px 15px rgba(30, 60, 114, 0.35)';
                        }}
                    >
                        Register
                    </button>
                </div>

                <div style={footerStyle}>
                    Already have an account? <span onClick={() => navigate('/login')} style={linkStyle}>Login</span>
                </div>
            </div>
        </div>
    );
}
