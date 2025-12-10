import React, { useState } from 'react';
import { User, Lock, Eye, EyeOff, Fingerprint, LogIn, UserPlus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from './supabaseClient';

export default function LoginForm() {
    const [formData, setFormData] = useState({
        username: '',
        password: '',
        rememberMe: false
    });
    const [showPassword, setShowPassword] = useState(false);
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const handleChange = (e) => {
        const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
        setFormData({
            ...formData,
            [e.target.name]: value
        });
    };

    const handleSubmit = async () => {
        setLoading(true);
        setError(null);
        try {
            const { data, error } = await supabase.auth.signInWithPassword({
                email: formData.username,
                password: formData.password,
            });

            if (error) throw error;

            console.log('Login successful:', data);
            navigate('/dashboard');
        } catch (err) {
            console.error('Login error:', err.message);
            setError(err.message);
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

    const labelContainerStyle = {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '9px'
    };

    const labelStyle = {
        fontSize: '14.5px',
        fontWeight: '500',
        color: '#1a1a1a',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    };

    const forgotPasswordStyle = {
        fontSize: '13px',
        color: '#2a5298',
        textDecoration: 'none',
        fontWeight: '600',
        cursor: 'pointer'
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

    const eyeIconStyle = {
        position: 'absolute',
        right: '14px',
        color: '#999',
        cursor: 'pointer',
        zIndex: 1,
        padding: '4px'
    };

    const inputStyle = {
        width: '100%',
        padding: '13px 40px 13px 44px',
        border: '1px solid #e0e0e0',
        borderRadius: '8px',
        fontSize: '14.5px',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        transition: 'border-color 0.3s ease, background-color 0.3s ease',
        outline: 'none',
        backgroundColor: '#fafafa',
        boxSizing: 'border-box'
    };

    const checkboxGroupStyle = {
        display: 'flex',
        alignItems: 'center',
        marginBottom: '28px',
        gap: '8px'
    };

    const checkboxLabelStyle = {
        fontSize: '14.5px',
        color: '#666',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        cursor: 'pointer'
    };

    const buttonGroupStyle = {
        display: 'flex',
        gap: '12px'
    };

    const buttonBaseStyle = {
        flex: 1,
        padding: '15px',
        borderRadius: '8px',
        fontSize: '16px',
        fontWeight: '600',
        cursor: 'pointer',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        transition: 'transform 0.2s ease, box-shadow 0.3s ease',
        textAlign: 'center',
        border: 'none',
        outline: 'none',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '8px'
    };

    const loginButtonStyle = {
        ...buttonBaseStyle,
        background: '#0a2342', // Darker navy for login
        color: 'white',
        boxShadow: '0 5px 15px rgba(10, 35, 66, 0.2)'
    };

    const registerButtonStyle = {
        ...buttonBaseStyle,
        background: 'white',
        color: '#0a2342',
        border: '2px solid #e0e0e0'
    };

    // Generate grid of squares
    const squares = [];
    const squareSize = 120;
    const gap = 16;
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

                <div style={titleStyle}>Login Form</div>
                <div style={subtitleStyle}>Access your banking account</div>

                {error && (
                    <div style={{
                        padding: '10px',
                        marginBottom: '15px',
                        borderRadius: '6px',
                        backgroundColor: '#fee2e2',
                        color: '#ef4444',
                        fontSize: '14px'
                    }}>
                        {error}
                    </div>
                )}

                <div>
                    <div style={inputGroupStyle}>
                        <label style={{ ...labelStyle, display: 'block', marginBottom: '9px' }}>Username (Email)</label>
                        <div style={inputWrapperStyle}>
                            <User size={18} style={inputIconStyle} />
                            <input
                                type="text"
                                name="username"
                                placeholder="Enter your email"
                                value={formData.username}
                                onChange={handleChange}
                                style={inputStyle}
                                disabled={loading}
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

                    <div style={{ marginBottom: '22px' }}>
                        <div style={labelContainerStyle}>
                            <label style={labelStyle}>Password</label>
                            <span style={forgotPasswordStyle}>Forgot Password?</span>
                        </div>
                        <div style={inputWrapperStyle}>
                            <Fingerprint size={18} style={inputIconStyle} />
                            <input
                                type={showPassword ? "text" : "password"}
                                name="password"
                                placeholder="Enter your password"
                                value={formData.password}
                                onChange={handleChange}
                                style={inputStyle}
                                disabled={loading}
                                onFocus={(e) => {
                                    e.target.style.borderColor = '#4a90e2';
                                    e.target.style.backgroundColor = 'white';
                                }}
                                onBlur={(e) => {
                                    e.target.style.borderColor = '#e0e0e0';
                                    e.target.style.backgroundColor = '#fafafa';
                                }}
                            />
                            <div
                                style={eyeIconStyle}
                                onClick={() => setShowPassword(!showPassword)}
                            >
                                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                            </div>
                        </div>
                    </div>

                    <div style={checkboxGroupStyle}>
                        <input
                            type="checkbox"
                            name="rememberMe"
                            id="rememberMe"
                            checked={formData.rememberMe}
                            onChange={handleChange}
                            style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                        />
                        <label htmlFor="rememberMe" style={checkboxLabelStyle}>Remember me</label>
                    </div>

                    <div style={buttonGroupStyle}>
                        <button
                            onClick={handleSubmit}
                            style={loginButtonStyle}
                            disabled={loading}
                            onMouseEnter={(e) => {
                                e.target.style.transform = 'translateY(-2px)';
                                e.target.style.boxShadow = '0 8px 25px rgba(10, 35, 66, 0.3)';
                            }}
                            onMouseLeave={(e) => {
                                e.target.style.transform = 'translateY(0)';
                                e.target.style.boxShadow = '0 5px 15px rgba(10, 35, 66, 0.2)';
                            }}
                        >
                            {loading ? 'Logging in...' : <><LogIn size={18} /> Login</>}
                        </button>
                        <button
                            onClick={() => navigate('/signup')} // Route to Register
                            style={registerButtonStyle}
                            onMouseEnter={(e) => {
                                e.target.style.backgroundColor = '#f5f5f5';
                                e.target.style.transform = 'translateY(-2px)';
                            }}
                            onMouseLeave={(e) => {
                                e.target.style.backgroundColor = 'white';
                                e.target.style.transform = 'translateY(0)';
                            }}
                        >
                            <UserPlus size={18} /> Register
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
