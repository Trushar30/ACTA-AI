import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import Home from './pages/Home';
import Dashboard from './pages/Dashboard';
import MeetingDashboard from './pages/MeetingDashboard';
import CollaborateDashboard from './pages/CollaborateDashboard';
import ScheduledMeetings from './pages/ScheduledMeetings';
import Settings from './pages/Settings';
import Profile from './pages/Profile';
import Analysis from './pages/Analysis';
import Upload from './pages/Upload';
import Presentation from './pages/Presentation';
import Loader from './components/Loader';

import axios from 'axios';

const API_URL = 'http://localhost:3000';

// Configure axios to send credentials
axios.defaults.withCredentials = true;

// Set up axios interceptor to include token in all requests
axios.interceptors.request.use((config) => {
    const token = localStorage.getItem('authToken');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
}, (error) => {
    return Promise.reject(error);
});

// Navigation Component
const Navigation = () => {
    const location = useLocation();
    const [serverStatus, setServerStatus] = useState(null);
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [imgError, setImgError] = useState(false);

    useEffect(() => {
        const checkServer = async () => {
            try {
                await axios.get(`${API_URL}/api/bots/active`);
                setServerStatus(true);
            } catch {
                setServerStatus(false);
            }
        };
        checkServer();
        const interval = setInterval(checkServer, 10000);
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        const checkAuth = async () => {
            try {
                // Check URL for token (from OAuth redirect)
                const urlParams = new URLSearchParams(window.location.search);
                const tokenFromUrl = urlParams.get('token');

                if (tokenFromUrl) {
                    // Store token in localStorage
                    localStorage.setItem('authToken', tokenFromUrl);
                    // Remove token from URL
                    window.history.replaceState({}, document.title, window.location.pathname);
                }

                // Try to get user with stored token
                const token = localStorage.getItem('authToken');
                if (token) {
                    const res = await axios.get(`${API_URL}/api/auth/verify`);
                    setUser(res.data.user);
                } else {
                    setUser(null);
                }
            } catch (err) {
                // Token invalid or expired, clear it
                localStorage.removeItem('authToken');
                setUser(null);
            } finally {
                setLoading(false);
            }
        };
        checkAuth();
    }, []);

    // Show loader while checking authentication
    if (loading) {
        return <Loader message="Initializing..." />;
    }

    const handleLogin = () => {
        window.location.href = `${API_URL}/api/auth/google`;
    };

    const navItems = [
        { path: '/', label: 'Home' },
        { path: '/analysis', label: 'Analysis' },
        { path: '/upload', label: 'Upload' },
        { path: '/dashboard', label: 'Archive Meetings' },
        { path: '/scheduled', label: 'Scheduled' },
        { path: '/collaborate', label: 'Collaborate' },

    ];

    return (
        <nav className="border-b border-white/5 bg-[#0B0E14]/80 backdrop-blur-md sticky top-0 z-50">
            <div className="max-w-7xl mx-auto px-6 h-16 flex justify-between items-center">
                {/* Logo Section */}
                <Link to="/" className="flex items-center gap-2 group">
                    <img 
                        src="/logo.svg" 
                        alt="ACTA Logo" 
                        className="h-8 w-auto transition-transform group-hover:scale-105"
                    />
                </Link>

                {/* Center Links */}
                <div className="flex items-center gap-8">
                    {navItems.map(item => {
                        const isActive = item.path === '/dashboard' 
                            ? location.pathname === item.path || location.pathname.startsWith('/dashboard/')
                            : location.pathname === item.path;
                        
                        return (
                            <Link
                                key={item.path}
                                to={item.path}
                                className={`text-sm font-medium transition-all duration-200 ${isActive
                                    ? 'text-white'
                                    : 'text-slate-400 hover:text-white'
                                    }`}
                            >
                                {item.label}
                            </Link>
                        );
                    })}
                </div>

                {/* Right Side - Settings & Profile */}
                <div className="flex items-center gap-4">
                    {/* Server Status Indicator */}
                    <div className="flex items-center gap-2 px-2 py-1 rounded-full bg-white/5 border border-white/5" title={serverStatus ? "System Online" : "System Offline"}>
                        <div className={`w-1.5 h-1.5 rounded-full ${serverStatus === null ? 'bg-yellow-500 animate-pulse' :
                            serverStatus ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]' : 'bg-red-500'
                            }`} />
                        <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 hidden md:block">
                            {serverStatus ? 'Online' : 'Offline'}
                        </span>
                    </div>

                    <div className="h-4 w-px bg-white/10 mx-2"></div>

                    <Link to="/settings" className="text-slate-400 hover:text-white transition-colors">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.38a2 2 0 0 0-.73-2.73l-.15-.1a2 2 0 0 1-1-1.72v-.51a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
                            <circle cx="12" cy="12" r="3" />
                        </svg>
                    </Link>

                    {/* User Profile / Login */}
                    {!loading && (
                        user ? (
                            <div className="flex items-center gap-3">
                                <Link to="/profile" className="group relative block">
                                    {user.picture && !imgError ? (
                                        <img
                                            src={user.picture}
                                            alt={user.name}
                                            className="w-8 h-8 rounded-full border border-white/10 group-hover:border-white/30 transition-colors"
                                            onError={() => setImgError(true)}
                                        />
                                    ) : (
                                        <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center text-xs font-bold text-blue-400 border border-blue-500/30">
                                            {user.name && user.name[0] ? user.name[0].toUpperCase() : 'U'}
                                        </div>
                                    )}
                                </Link>
                            </div>
                        ) : (
                            <button
                                onClick={handleLogin}
                                className="bg-white text-[#0B0E14] px-5 py-2 rounded-md text-sm font-semibold hover:bg-slate-200 transition-colors"
                            >
                                Login
                            </button>
                        )
                    )}
                </div>
            </div>
        </nav>
    );
};

function App() {
    return (
        <Router>
            <div className="min-h-screen">
                <Navigation />
                <Routes>
                    <Route path="/" element={<Home />} />
                    <Route path="/analysis" element={<Analysis />} />
                    <Route path="/upload" element={<Upload />} />
                    <Route path="/dashboard" element={<Dashboard />} />
                    <Route path="/dashboard/:id" element={<MeetingDashboard />} />
                    <Route path="/scheduled" element={<ScheduledMeetings />} />
                    <Route path="/collaborate" element={<CollaborateDashboard />} />
                    <Route path="/settings" element={<Settings />} />
                    <Route path="/profile" element={<Profile />} />
                    <Route path="/presentation" element={<Presentation />} />
                </Routes>
            </div>
        </Router>
    );
}

export default App;
