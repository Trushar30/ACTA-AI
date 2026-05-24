import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
    Users, Calendar, Clock, ExternalLink, Loader2, Mail, ArrowLeft,
    Sparkles, Search, X, ChevronRight, FileText
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Loader from '../components/Loader';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

const CollaborateDashboard = () => {
    const navigate = useNavigate();
    const [sharedMeetings, setSharedMeetings] = useState([]);
    const [loading, setLoading] = useState(true);
    const [userEmail, setUserEmail] = useState('');
    const [emailEntered, setEmailEntered] = useState(false);
    const [user, setUser] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
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

    const getRelativeTime = (dateStr) => {
        if (!dateStr) return '';
        const diff = Date.now() - new Date(dateStr).getTime();
        const mins = Math.floor(diff / 60000);
        if (mins < 60) return `${mins}m ago`;
        const hours = Math.floor(mins / 60);
        if (hours < 24) return `${hours}h ago`;
        const days = Math.floor(hours / 24);
        if (days < 7) return `${days}d ago`;
        return formatDate(dateStr);
    };

    const filteredMeetings = sharedMeetings.filter(m => {
        const q = searchQuery.toLowerCase();
        return (m.meetingName || '').toLowerCase().includes(q) ||
            (m.userEmail || '').toLowerCase().includes(q) ||
            (m.topic || '').toLowerCase().includes(q);
    });

    if (!emailEntered) {
        return (
            <div className="min-h-screen bg-[#0B0E14] text-slate-100 flex items-center justify-center p-6">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="max-w-md w-full"
                >
                    <div className="bg-[#1C1F2E] rounded-2xl p-8 border border-white/5">
                        <div className="text-center mb-8">
                            <div className="w-16 h-16 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex items-center justify-center mx-auto mb-5">
                                <Users size={30} className="text-emerald-400" />
                            </div>
                            <h1 className="text-2xl font-bold text-white mb-2">Shared With You</h1>
                            <p className="text-slate-500 text-sm">
                                Enter your email to see meetings others have shared with you
                            </p>
                        </div>

                        <form onSubmit={handleEmailSubmit} className="space-y-4">
                            <div className="relative">
                                <Mail size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
                                <input
                                    type="email"
                                    value={userEmail}
                                    onChange={(e) => setUserEmail(e.target.value)}
                                    placeholder="your@email.com"
                                    className="w-full pl-11 pr-4 py-3.5 bg-[#0B0E14] border border-white/10 rounded-xl text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-emerald-500/40 focus:ring-1 focus:ring-emerald-500/20 transition-all"
                                    required
                                />
                            </div>
                            <button
                                type="submit"
                                className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-xl transition-all flex items-center justify-center gap-2 text-sm shadow-lg shadow-emerald-600/20"
                            >
                                Continue
                                <ChevronRight size={16} />
                            </button>
                        </form>

                        <button
                            onClick={() => navigate('/dashboard')}
                            className="w-full mt-4 flex items-center justify-center gap-2 text-slate-500 hover:text-white text-sm transition-colors py-2"
                        >
                            <ArrowLeft size={14} />
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
        <div className="min-h-screen bg-[#0B0E14]">
            <div className="max-w-7xl mx-auto px-6 py-8">
                {/* Header */}
                <div className="mb-8">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-emerald-500/10 rounded-xl border border-emerald-500/20">
                                <Users size={22} className="text-emerald-400" />
                            </div>
                            <div>
                                <h1 className="text-2xl font-bold text-white">Shared With You</h1>
                                <p className="text-slate-500 text-sm mt-0.5">
                                    Meetings shared with <span className="text-slate-300 font-medium">{userEmail}</span>
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <div className="flex items-center gap-2 px-3 py-2 bg-[#1C1F2E] rounded-xl border border-white/5 text-xs">
                                <FileText size={14} className="text-cyan-400" />
                                <span className="text-slate-400">{sharedMeetings.length} meeting{sharedMeetings.length !== 1 ? 's' : ''}</span>
                            </div>
                            <button
                                onClick={handleChangeEmail}
                                className="px-3 py-2 text-xs text-slate-500 hover:text-white bg-[#1C1F2E] hover:bg-white/10 rounded-xl border border-white/5 transition-all"
                            >
                                Change Email
                            </button>
                        </div>
                    </div>
                </div>

                {sharedMeetings.length === 0 ? (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-[#1C1F2E] rounded-2xl border border-white/5 p-16 text-center"
                    >
                        <div className="w-16 h-16 bg-white/5 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-white/5">
                            <Users size={28} className="text-slate-600" />
                        </div>
                        <h3 className="text-lg font-bold text-slate-400 mb-2">No shared meetings yet</h3>
                        <p className="text-sm text-slate-500 max-w-sm mx-auto mb-6">
                            When someone shares a meeting dashboard with you, it will appear here automatically.
                        </p>
                        <button
                            onClick={() => navigate('/dashboard')}
                            className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-xl transition-colors text-sm"
                        >
                            <ArrowLeft size={16} />
                            Go to My Meetings
                        </button>
                    </motion.div>
                ) : (
                    <>
                        {/* Search */}
                        {sharedMeetings.length > 3 && (
                            <div className="relative mb-5">
                                <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                                <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder="Search shared meetings..."
                                    className="w-full sm:w-80 bg-[#1C1F2E] border border-white/5 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500/30 placeholder:text-slate-600 transition-colors"
                                />
                                {searchQuery && (
                                    <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white">
                                        <X size={14} />
                                    </button>
                                )}
                            </div>
                        )}

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {filteredMeetings.map((meeting, index) => {
                                const avatarColors = ['bg-purple-500', 'bg-emerald-500', 'bg-amber-500', 'bg-blue-500', 'bg-pink-500', 'bg-cyan-500'];
                                return (
                                    <motion.div
                                        key={meeting._id}
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: index * 0.04 }}
                                        onClick={() => navigate(`/dashboard/${meeting._id}`)}
                                        className="bg-[#1C1F2E] rounded-xl border border-white/5 hover:border-emerald-500/30 transition-all cursor-pointer group"
                                    >
                                        <div className="p-5">
                                            <div className="flex items-start gap-3 mb-4">
                                                <div className={`w-10 h-10 rounded-xl ${avatarColors[index % avatarColors.length]} flex items-center justify-center text-sm font-bold text-white flex-shrink-0`}>
                                                    {(meeting.meetingName || 'M').charAt(0).toUpperCase()}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <h3 className="text-sm font-semibold text-white truncate">
                                                        {meeting.meetingName || meeting.topic || 'Untitled Meeting'}
                                                    </h3>
                                                    <p className="text-[11px] text-slate-500 mt-0.5">
                                                        Shared by {meeting.userEmail?.split('@')[0] || 'Unknown'}
                                                    </p>
                                                </div>
                                                <div className={`flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase border ${meeting.status === 'completed'
                                                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                                        : 'bg-white/5 text-slate-400 border-white/10'
                                                    }`}>
                                                    <div className={`w-1.5 h-1.5 rounded-full ${meeting.status === 'completed' ? 'bg-emerald-400' : 'bg-slate-400'
                                                        }`} />
                                                    {meeting.status}
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-3 text-[11px] text-slate-500 mb-4">
                                                <span className="flex items-center gap-1">
                                                    <Calendar size={11} />
                                                    {getRelativeTime(meeting.createdAt)}
                                                </span>
                                                {meeting.platform && (
                                                    <span className="px-1.5 py-0.5 bg-white/5 rounded text-[10px] capitalize">
                                                        {meeting.platform}
                                                    </span>
                                                )}
                                            </div>

                                            <div className="pt-3 border-t border-white/5 flex items-center justify-between">
                                                <span className="text-xs text-slate-500 group-hover:text-emerald-400 transition-colors font-medium">View Dashboard</span>
                                                <ChevronRight size={14} className="text-slate-600 group-hover:text-emerald-400 transition-colors" />
                                            </div>
                                        </div>
                                    </motion.div>
                                );
                            })}
                        </div>

                        {searchQuery && filteredMeetings.length === 0 && (
                            <div className="text-center py-12">
                                <Search size={32} className="text-slate-600 mx-auto mb-3" />
                                <p className="text-sm text-slate-400">No meetings match "{searchQuery}"</p>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
};

export default CollaborateDashboard;
