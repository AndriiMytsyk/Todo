import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mail, Lock, User, ArrowRight } from 'lucide-react';
import { useAuth } from './AuthContext';

const AuthUI: React.FC = () => {
    const { login: setAuthUser } = useAuth();
    const [mode, setMode] = useState<'login' | 'signup'>('login');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [name, setName] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    // Load Google script once
    useEffect(() => {
        const script = document.createElement('script');
        script.src = 'https://accounts.google.com/gsi/client';
        script.async = true;
        document.body.appendChild(script);
        return () => {
            if (document.body.contains(script)) {
                document.body.removeChild(script);
            }
        };
    }, []);

    // Re-render Google button when mode changes
    useEffect(() => {
        /* global google */
        const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
        if (!clientId || clientId.includes('YOUR_GOOGLE') || !window.google) {
            return;
        }

        const handleGoogleResponse = async (response: any) => {
            setIsLoading(true);
            setError(null);
            try {
                const res = await fetch('/api/auth/google', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ credential: response.credential }),
                });

                if (res.ok) {
                    const userData = await res.json();
                    setAuthUser(userData);
                } else {
                    const errData = await res.json();
                    setError(errData.error || 'Google login failed');
                }
            } catch (err) {
                setError('Google authentication error');
            } finally {
                setIsLoading(false);
            }
        };

        // @ts-ignore
        google.accounts.id.initialize({
            client_id: clientId,
            callback: handleGoogleResponse,
        });

        // @ts-ignore
        const container = document.getElementById('google-btn');
        if (container && window.google) {
            container.innerHTML = ''; // Clear previous button instance
            // @ts-ignore
            google.accounts.id.renderButton(
                container,
                {
                    theme: 'filled_black',
                    size: 'large',
                    width: 380,
                    shape: 'pill',
                    text: mode === 'login' ? 'signin_with' : 'signup_with'
                }
            );
        }
    }, [mode, setAuthUser]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError(null);

        const endpoint = mode === 'login' ? '/api/auth/login' : '/api/auth/register';
        const body = mode === 'login' ? { email, password } : { email, password, name };

        try {
            const res = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });

            if (res.ok) {
                const userData = await res.json();
                setAuthUser(userData);
            } else {
                const errData = await res.json();
                setError(errData.error || 'Authentication failed');
            }
        } catch (err) {
            setError('Network error');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="auth-hero">
            <header>
                <motion.h1
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="title"
                >
                    TaskFlow
                </motion.h1>
                <p className="subtitle">Premium Productivity</p>
            </header>

            <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="glass-card auth-card custom-auth"
            >
                <div className="auth-tabs">
                    <button
                        className={`auth-tab ${mode === 'login' ? 'active' : ''}`}
                        onClick={() => setMode('login')}
                    >
                        Login
                    </button>
                    <button
                        className={`auth-tab ${mode === 'signup' ? 'active' : ''}`}
                        onClick={() => setMode('signup')}
                    >
                        Register
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="auth-form">
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={mode}
                            initial={{ opacity: 0, x: mode === 'login' ? -20 : 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: mode === 'login' ? 20 : -20 }}
                            transition={{ duration: 0.2 }}
                            className="auth-inputs-wrapper"
                        >
                            {mode === 'signup' && (
                                <div className="form-group">
                                    <User size={18} className="form-icon" />
                                    <input
                                        type="text"
                                        placeholder="Full Name"
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        required
                                    />
                                </div>
                            )}
                            <div className="form-group">
                                <Mail size={18} className="form-icon" />
                                <input
                                    type="email"
                                    placeholder="Email Address"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    required
                                />
                            </div>
                            <div className="form-group">
                                <Lock size={18} className="form-icon" />
                                <input
                                    type="password"
                                    placeholder="Password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                />
                            </div>
                        </motion.div>
                    </AnimatePresence>

                    {error && <p className="auth-error">{error}</p>}

                    <button type="submit" disabled={isLoading} className="add-btn login-btn">
                        {isLoading ? 'Processing...' : mode === 'login' ? 'Sign In' : 'Create Account'}
                        <ArrowRight size={18} />
                    </button>
                </form>

                <div className="divider">
                    <span>or</span>
                </div>

                <div
                    key={`${mode}-google`}
                    id="google-btn"
                    className="google-container"
                ></div>
            </motion.div>
        </div>
    );
};

export default AuthUI;
