import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Users, Calendar, Clock, ExternalLink, Loader2, Mail, ArrowLeft, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Loader from '../components/Loader';

const API_URL = 'http://localhost:3000';

const CollaborateDashboard = () => {
    const navigate = useNavigate();
    const [sharedMeetings, setSharedMeetings] = useState([]);
    const [loading, setLoading] = useState(true);
    const [userEmail, setUserEmail] = useState('');
    const [emailEntered, setEmailEntered] = useState(false);
    const [user, setUser] = useState(null);

    useEffect(() => {
        // First, try to get the logged-in user's email
        const fetchUser = async () => {
            try {
                const res = await axios.get(`${API_URL}/api/auth/user`);
                if (res.data.user && res.data.user.email) {
                    setUser(res.data.user);
                    setUserEmail(res.data.user.email);
                    setEmailEntered(true);
                    fetchSharedMeetings(res.data.user.email);
                    return;
                }
            } catch (err) {
                console.log('No authenticated user, checking localStorage');
            }

            // Fallback to localStorage if not authenticated
            const savedEmail = localStorage.getItem('collaborateEmail');
            if (savedEmail) {
                setUserEmail(savedEmail);
                setEmailEntered(true);
                fetchSharedMeetings(savedEmail);
            } else {
                setLoading(false);
            }
        };

        fetchUser();
    }, []);

    const fetchSharedMeetings = async (email) => {
        setLoading(true);
        try {
            const res = await axios.get(`${API_URL}/api/meetings/shared`, {
                params: { email }
            });
            if (res.data.success) {
                setSharedMeetings(res.data.meetings);
            }
        } catch (err) {
            console.error('Error fetching shared meetings:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleEmailSubmit = (e) => {
        e.preventDefault();
        if (!userEmail.trim() || !userEmail.includes('@')) {
            alert('Please enter a valid email address');
            return;
        }
        localStorage.setItem('collaborateEmail', userEmail);
        setEmailEntered(true);
        fetchSharedMeetings(userEmail);
    };

    const handleChangeEmail = () => {
        setEmailEntered(false);
        localStorage.removeItem('collaborateEmail');
        setSharedMeetings([]);
    };

    const formatDate = (dateString) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    };

    const formatTime = (dateString) => {
        const date = new Date(dateString);
        return date.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    if (!emailEntered) {
        return (
            <div className="min-h-screen text-slate-100 flex items-center justify-center p-6">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="max-w-md w-full"
                >
                    <div className="bg-white/5 rounded-2xl p-8 border border-white/10 backdrop-blur-sm">
                        <div className="text-center mb-6">
                            <div className="w-14 h-14 bg-white/5 border border-white/10 rounded-xl flex items-center justify-center mx-auto mb-4">
                                <Users size={28} className="text-white" />
                            </div>
                            <h1 className="text-2xl font-bold text-white mb-2">Collaborate</h1>
                            <p className="text-gray-400 text-sm">
                                Enter your email to view meetings shared with you
                            </p>
                        </div>

                        <form onSubmit={handleEmailSubmit} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-400 mb-2">
                                    Your Email Address
                                </label>
                                <div className="relative">
                                    <Mail size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                                    <input
                                        type="email"
                                        value={userEmail}
                                        onChange={(e) => setUserEmail(e.target.value)}
                                        placeholder="you@example.com"
                                        className="w-full pl-10 pr-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder:text-gray-500 focus:outline-none focus:border-white/30 transition-colors"
                                        required
                                    />
                                </div>
                            </div>
                            <button
                                type="submit"
                                className="w-full py-3 bg-white text-black hover:bg-gray-200 font-semibold rounded-lg transition-colors flex items-center justify-center gap-2"
                            >
                                View Shared Meetings
                                <ExternalLink size={18} />
                            </button>
                        </form>

                        <button
                            onClick={() => navigate('/dashboard')}
                            className="w-full mt-4 text-gray-400 hover:text-white text-sm transition-colors"
                        >
                            Back to Dashboard
                        </button>
                    </div>
                </motion.div>
            </div>
        );
    }

    if (loading) {
        return <Loader message="Loading shared meetings..." />;
    }

    return (
        <div className="max-w-[1400px] mx-auto w-full px-6 py-8">
            {/* Header */}
            <header className="flex items-center justify-between gap-8 mb-10">
                <div className="flex items-center gap-4">
                    <h1 className="text-3xl font-bold tracking-tight text-white">Collaborate</h1>
                    <div className="h-6 w-px bg-white/10"></div>
                    <p className="text-gray-400 font-medium flex items-center gap-2 text-sm">
                        <Users size={16} className="text-white" />
                        Shared Meetings
                    </p>
                </div>
            </header>

            {/* Main Content */}
            <main>
                {loading ? (
                    <div className="flex items-center justify-center py-20">
                        <Loader2 size={40} className="animate-spin text-emerald-400" />
                    </div>
                ) : sharedMeetings.length === 0 ? (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-white/5 rounded-2xl p-12 border border-white/10 text-center backdrop-blur-sm"
                    >
                        <Users size={64} className="mx-auto mb-4 text-gray-600" />
                        <h3 className="text-xl font-bold text-white mb-2">No Shared Meetings</h3>
                        <p className="text-gray-400">
                            No meetings have been shared with <span className="text-white font-medium">{userEmail}</span> yet.
                        </p>
                        <p className="text-gray-500 text-sm mt-2">
                            When someone shares a meeting dashboard with you, it will appear here.
                        </p>
                    </motion.div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
                        {sharedMeetings.map((meeting, index) => (
                            <motion.div
                                key={meeting._id}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: index * 0.05 }}
                                onClick={() => navigate(`/dashboard/${meeting._id}`)}
                                className="group relative cursor-pointer"
                            >
                                <div className="relative bg-white/5 rounded-xl overflow-hidden border border-white/10 group-hover:border-white/30 transition-all backdrop-blur-sm">
                                    {/* Header */}
                                    <div className="p-5">
                                        <div className="flex items-start justify-between mb-4">
                                            <div className="flex items-center gap-3 flex-1">
                                                <div className="w-10 h-10 rounded-lg bg-white/10 border border-white/20 flex items-center justify-center">
                                                    <Users size={20} className="text-white" />
                                                </div>
                                                <div className="flex-1">
                                                    <h3 className="font-semibold text-white text-base leading-tight line-clamp-2">
                                                        {meeting.meetingName || 'Meeting'}
                                                    </h3>
                                                    <p className="text-xs text-gray-500 mt-1">
                                                        Shared by: {meeting.userEmail?.split('@')[0] || 'Unknown'}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold uppercase tracking-wider border ${
                                                meeting.status === 'completed'
                                                    ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                                                    : 'bg-white/10 text-white border-white/20'
                                            }`}>
                                                <div className={`w-1.5 h-1.5 rounded-full ${
                                                    meeting.status === 'completed' ? 'bg-emerald-400' : 'bg-white'
                                                }`} />
                                                {meeting.status}
                                            </div>
                                        </div>

                                        {/* Meeting Details */}
                                        <div className="space-y-2 mb-4">
                                            <div className="flex items-center gap-2 text-xs text-gray-400">
                                                <Calendar size={12} />
                                                <span>{formatDate(meeting.createdAt)}</span>
                                            </div>
                                            <div className="flex items-center gap-2 text-xs text-gray-400">
                                                <Clock size={12} />
                                                <span>{formatTime(meeting.createdAt)}</span>
                                            </div>
                                        </div>

                                        {/* Footer */}
                                        <div className="pt-3 border-t border-white/5 flex items-center justify-between">
                                            <span className="text-xs text-gray-500">
                                                View dashboard
                                            </span>
                                            <ExternalLink size={12} className="text-gray-500 group-hover:text-white transition-colors" />
                                        </div>
                                    </div>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                )}
            </main>
        </div>
    );
};

export default CollaborateDashboard;
