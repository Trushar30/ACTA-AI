import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { LogOut, User, Mail, Shield } from 'lucide-react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

const API_URL = 'http://localhost:3000';

const Profile = () => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [imgError, setImgError] = useState(false);
    const navigate = useNavigate();

    useEffect(() => {
        const fetchUser = async () => {
            try {
                const res = await axios.get(`${API_URL}/api/auth/verify`);
                setUser(res.data.user);
            } catch (err) {
                console.error('Failed to fetch user:', err);
                navigate('/'); // Redirect to home if not authenticated
            } finally {
                setLoading(false);
            }
        };
        fetchUser();
    }, [navigate]);

    const handleLogout = async () => {
        try {
            await axios.get(`${API_URL}/api/auth/logout`);
            localStorage.removeItem('authToken');
            // Force a full reload to clear state or navigate to home
            window.location.href = '/';
        } catch (err) {
            console.error('Logout failed:', err);
        }
    };

    if (loading) {
        return (
            <div className="min-h-[80vh] flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
            </div>
        );
    }

    if (!user) return null;

    return (
        <div className="min-h-[80vh] max-w-xl mx-auto px-4 py-8">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="glass rounded-2xl p-6 border border-white/5"
            >
                <div className="flex flex-col items-center mb-6">
                    <div className="relative mb-3">
                        <div className="w-20 h-20 rounded-full p-[2px] bg-gradient-to-br from-white/20 via-white/10 to-transparent">
                            {user.picture && !imgError ? (
                                <img
                                    src={user.picture}
                                    alt={user.name}
                                    className="w-full h-full rounded-full object-cover border-2 border-[#0B0E14]"
                                    onError={() => setImgError(true)}
                                />
                            ) : (
                                <div className="w-full h-full rounded-full bg-[#0B0E14] flex items-center justify-center text-xl font-bold text-white">
                                    {user.name && user.name[0] ? user.name[0].toUpperCase() : 'U'}
                                </div>
                            )}
                        </div>
                    </div>
                    <h1 className="text-xl font-bold text-white">{user.name}</h1>
                    <p className="text-slate-400 text-xs mt-0.5">{user.email}</p>
                </div>

                <div className="space-y-2.5 mb-6">
                    <div className="p-3 rounded-xl bg-white/5 border border-white/5 flex items-center gap-3 hover:bg-white/[0.07] transition-colors">
                        <div className="p-2 rounded-lg bg-white/5 text-white/70">
                            <User size={16} />
                        </div>
                        <div className="flex-1">
                            <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-0.5">Name</p>
                            <p className="text-white/90 font-medium text-sm">{user.name}</p>
                        </div>
                    </div>

                    <div className="p-3 rounded-xl bg-white/5 border border-white/5 flex items-center gap-3 hover:bg-white/[0.07] transition-colors">
                        <div className="p-2 rounded-lg bg-white/5 text-white/70">
                            <Mail size={16} />
                        </div>
                        <div className="flex-1">
                            <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-0.5">Email</p>
                            <p className="text-white/90 font-medium text-sm break-all">{user.email}</p>
                        </div>
                    </div>

                    <div className="p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/20 flex items-center gap-3 hover:bg-emerald-500/10 transition-colors">
                        <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
                            <Shield size={16} />
                        </div>
                        <div className="flex-1">
                            <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-0.5">Account Status</p>
                            <div className="flex items-center gap-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                                <p className="text-white/90 font-medium text-sm">Active</p>
                            </div>
                        </div>
                    </div>
                </div>

                <button
                    onClick={handleLogout}
                    className="w-full py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white/70 hover:text-white border border-white/5 hover:border-white/10 transition-all font-medium flex items-center justify-center gap-2 text-sm"
                >
                    <LogOut size={16} />
                    Sign Out
                </button>
            </motion.div>
        </div>
    );
};

export default Profile;
