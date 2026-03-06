import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, Loader, CheckCircle, AlertCircle } from 'lucide-react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { ZoomLogo, TeamsLogo, MeetLogo } from '../components/Logos';

const API_URL = 'http://localhost:3000';

// Animated Text Component with letter-by-letter reveal
const AnimatedText = ({ text, isVisible }) => {
    const words = text.split(' ');
    
    const containerVariants = {
        hidden: { opacity: 0 },
        visible: {
            opacity: 1,
            transition: {
                staggerChildren: 0.08,
                delayChildren: 0.1
            }
        },
        exit: {
            opacity: 0,
            transition: {
                staggerChildren: 0.03,
                staggerDirection: -1
            }
        }
    };

    const wordVariants = {
        hidden: { 
            opacity: 0, 
            y: 40,
            rotateX: 90,
            scale: 0.5,
            filter: 'blur(10px)'
        },
        visible: { 
            opacity: 1, 
            y: 0,
            rotateX: 0,
            scale: 1,
            filter: 'blur(0px)',
            transition: {
                type: 'spring',
                damping: 12,
                stiffness: 100,
                duration: 0.6
            }
        },
        exit: { 
            opacity: 0, 
            y: -40,
            rotateX: -90,
            scale: 0.5,
            filter: 'blur(10px)',
            transition: {
                duration: 0.3
            }
        }
    };

    return (
        <motion.span
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="inline-flex gap-[0.3em] flex-wrap justify-center md:justify-start"
            style={{ perspective: '1000px' }}
        >
            {words.map((word, index) => (
                <motion.span
                    key={index}
                    variants={wordVariants}
                    className="inline-block bg-gradient-to-r from-blue-400 via-purple-500 to-pink-500 bg-clip-text text-transparent"
                    style={{ 
                        transformStyle: 'preserve-3d',
                        textShadow: '0 0 60px rgba(139, 92, 246, 0.4)'
                    }}
                >
                    {word}
                </motion.span>
            ))}
        </motion.span>
    );
};

const Home = () => {
    const [link, setLink] = useState('');
    const [meetingName, setMeetingName] = useState('');
    const [botName, setBotName] = useState('AI Assistant');
    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState({ type: null, message: '' });
    const [botConfigured, setBotConfigured] = useState(true);  // Default true to avoid flashing
    const [setupLoading, setSetupLoading] = useState(false);
    const [showAdvanced, setShowAdvanced] = useState(false);
    const [currentPhraseIndex, setCurrentPhraseIndex] = useState(0);
    const navigate = useNavigate();

    const rotatingPhrases = [
        'Actionable Intelligence',
        'Strategic Insights',
        'Business Insights',
        'Smart Decisions',
        'Clear Action Plans',
        'Powerful Analytics'
    ];

    const defaultMeetingNames = [
        'Daily Standup',
        'Sprint Planning',
        'Client Meeting',
        'Team Sync',
        'Project Review',
        'Q&A Session',
        'All Hands Meeting',
        'One-on-One',
        'Technical Discussion',
        'Product Demo'
    ];

    useEffect(() => {
        checkBotSetup();
    }, []);

    // Rotate phrases every 3.5 seconds
    useEffect(() => {
        const interval = setInterval(() => {
            setCurrentPhraseIndex((prev) => (prev + 1) % rotatingPhrases.length);
        }, 3500);

        return () => clearInterval(interval);
    }, []);

    const checkBotSetup = async () => {
        try {
            const token = localStorage.getItem('authToken');
            if (!token) {
                setBotConfigured(true);  // Skip check if not logged in
                return;
            }

            const res = await axios.get(`${API_URL}/api/bot/setup`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            setBotConfigured(res.data.isConfigured || false);
        } catch (err) {
            console.error('Error checking bot setup:', err);
        }
    };

    const setupBot = async () => {
        try {
            const token = localStorage.getItem('authToken');
            if (!token) {
                setStatus({ type: 'error', message: 'Please login first to setup Google Meet bot' });
                return;
            }

            setSetupLoading(true);
            setStatus({ type: 'info', message: 'Opening browser for Google account login...' });

            const res = await axios.post(`${API_URL}/api/bot/setup/start`, {}, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            setStatus({ type: 'success', message: res.data.message });
            setSetupLoading(false);

            // Check setup status after a delay
            setTimeout(() => {
                checkBotSetup();
            }, 3000);
        } catch (err) {
            console.error('Setup error:', err);
            setStatus({ type: 'error', message: err.response?.data?.error || 'Failed to start bot setup' });
            setSetupLoading(false);
        }
    };

    const handleJoin = async () => {
        if (!link) {
            setStatus({ type: 'error', message: 'Please enter a meeting link' });
            return;
        }

        // Check if Google Meet link and bot not configured
        if (link.includes('meet.google.com') && !botConfigured) {
            setStatus({ type: 'error', message: 'Please setup bot credentials for Google Meet first' });
            return;
        }

        setLoading(true);
        setStatus({ type: 'info', message: 'Summoning bot...' });

        try {
            await axios.post(`${API_URL}/api/join`, {
                link,
                meetingName: meetingName || 'Meeting',
                botName: botName || 'AI Assistant'
            });
            setStatus({ type: 'success', message: 'Bot deployed! Audio recording will start automatically.' });

            // Reset form after successful submission
            setLink('');
            setMeetingName('');
            setBotName('AI Assistant');
            setShowAdvanced(false);

            setTimeout(() => navigate('/dashboard'), 2500);
        } catch (err) {
            setStatus({ type: 'error', message: err.response?.data?.error || 'Failed to summon bot' });
            setLoading(false);
        }
    };

    const handleLinkChange = (e) => {
        const value = e.target.value;
        setLink(value);
        // Auto-expand Meeting Details when user pastes a link
        if (value && !showAdvanced) {
            setShowAdvanced(true);
        }
    };
    return (
        <div className="min-h-[calc(100vh-64px)] flex flex-col items-center pt-24 pb-12 relative overflow-hidden">

            <div className="relative z-10 w-full max-w-5xl mx-auto px-4 text-center">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, ease: "easeOut" }}
                    className="flex flex-col items-center"
                >
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 mb-8 backdrop-blur-sm">
                        <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
                        </span>
                        <span className="text-xs font-medium text-slate-300 tracking-wide uppercase">AI-Powered Meeting Assistant</span>
                    </div>

                    <h1 className="text-5xl md:text-7xl font-bold mb-6 tracking-tight text-white max-w-4xl leading-[1.1]">
                        Turn Conversations into <br />
                        <span className="relative inline-block min-w-[450px] min-h-[1.2em]">
                            <AnimatePresence mode="wait">
                                <motion.span
                                    key={currentPhraseIndex}
                                    className="inline-block"
                                >
                                    <AnimatedText text={rotatingPhrases[currentPhraseIndex]} />
                                </motion.span>
                            </AnimatePresence>
                            {/* Animated glow effect */}
                            <motion.div
                                key={`glow-${currentPhraseIndex}`}
                                initial={{ opacity: 0, scale: 0.8 }}
                                animate={{ 
                                    opacity: [0.3, 0.6, 0.3], 
                                    scale: [0.8, 1.2, 1]
                                }}
                                transition={{ 
                                    duration: 2,
                                    repeat: Infinity,
                                    repeatType: 'reverse'
                                }}
                                className="absolute inset-0 bg-gradient-to-r from-blue-500/30 via-purple-500/30 to-pink-500/30 blur-3xl -z-10 rounded-full"
                            />
                        </span>
                    </h1>

                    <p className="text-lg text-slate-400 mb-10 max-w-2xl mx-auto leading-relaxed">
                        Seamlessly join meetings, transcribe in real-time, and generate executive summaries with zero friction.
                    </p>

                    {/* Input Field - Professional */}
                    <div className="w-full max-w-xl mx-auto mb-6 relative group">
                        <div className="absolute -inset-1 bg-gradient-to-r from-blue-500 via-purple-500 to-indigo-500 rounded-lg blur opacity-25 group-hover:opacity-50 transition duration-500"></div>
                        <div className="relative flex items-center bg-[#0B0E14] border border-white/10 rounded-lg focus-within:border-white/20 transition-colors h-12 shadow-2xl p-1">
                            <input
                                type="text"
                                placeholder="Paste Zoom, Teams, or Meet link..."
                                value={link}
                                onChange={handleLinkChange}
                                onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
                                disabled={loading}
                                className="flex-1 bg-transparent border-none outline-none text-white px-4 h-full text-lg placeholder-slate-600 font-light"
                            />
                            <button
                                onClick={handleJoin}
                                disabled={loading || !link}
                                className="h-full px-4 bg-white text-black hover:bg-slate-200 rounded-md transition-all disabled:opacity-50 disabled:cursor-not-allowed font-medium text-xs flex items-center gap-1.5"
                            >
                                {loading ? <Loader size={14} className="animate-spin" /> :
                                    <>
                                        <span>ANALYZE MEETING</span>
                                        <ArrowRight size={13} />
                                    </>
                                }
                            </button>
                        </div>
                    </div>

                    {/* Advanced Options */}
                    <div className="w-full max-w-xl mx-auto mb-16">
                        <button
                            onClick={() => setShowAdvanced(!showAdvanced)}
                            className="text-sm text-slate-400 hover:text-slate-300 transition-colors flex items-center gap-2 justify-center w-full mb-4"
                        >
                            <span>{showAdvanced ? '▼' : '▶'}</span>
                            Meeting Details
                        </button>

                        {showAdvanced && (
                            <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                                className="space-y-4 p-4 bg-white/5 border border-white/10 rounded-lg"
                            >
                                {/* Meeting Name Field */}
                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-2">Meeting Name</label>
                                    <input
                                        type="text"
                                        placeholder="Enter meeting name..."
                                        value={meetingName}
                                        onChange={(e) => setMeetingName(e.target.value)}
                                        className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none transition-colors"
                                    />
                                    <div className="mt-2 flex flex-wrap gap-2">
                                        {defaultMeetingNames.map((name) => (
                                            <button
                                                key={name}
                                                onClick={() => setMeetingName(name)}
                                                className={`text-xs px-3 py-1.5 rounded-full transition-colors ${meetingName === name
                                                    ? 'bg-blue-600 text-white'
                                                    : 'bg-white/10 text-slate-300 hover:bg-white/20'
                                                    }`}
                                            >
                                                {name}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Bot Name Field */}
                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-2">Bot Name</label>
                                    <input
                                        type="text"
                                        placeholder="Enter bot name..."
                                        value={botName}
                                        onChange={(e) => setBotName(e.target.value)}
                                        className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none transition-colors"
                                    />
                                    <p className="text-xs text-slate-500 mt-1">This is how the bot will appear in the meeting</p>
                                </div>
                            </motion.div>
                        )}
                    </div>

                    {/* Status Message */}
                    <AnimatePresence>
                        {status.message && (
                            <motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                className={`mb-12 inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium ${status.type === 'success' ? 'bg-green-500/10 text-green-400 border border-green-500/20' :
                                    status.type === 'error' ? 'bg-red-500/10 text-red-400 border border-red-500/20' :
                                        'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                                    }`}
                            >
                                {status.type === 'success' && <CheckCircle size={14} />}
                                {status.type === 'error' && <AlertCircle size={14} />}
                                {status.type === 'info' && <Loader size={14} className="animate-spin" />}
                                {status.message}
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Bot Setup Warning for Google Meet */}
                    {!botConfigured && (
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="mb-8 max-w-md mx-auto"
                        >
                            <div className="relative">
                                <div className="absolute -inset-1 bg-gradient-to-r from-yellow-500 to-orange-500 rounded-lg blur opacity-25"></div>
                                <div className="relative bg-[#0B0E14] border border-yellow-500/30 rounded-lg p-6">
                                    <div className="flex items-start gap-3 mb-4">
                                        <AlertCircle size={20} className="text-yellow-400 mt-0.5 flex-shrink-0" />
                                        <div>
                                            <h3 className="text-white font-semibold mb-1">Google Meet Setup Required</h3>
                                            <p className="text-sm text-slate-400">
                                                To join Google Meet meetings, you need to authenticate your Google account.
                                                A browser will open for you to log in.
                                            </p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={setupBot}
                                        disabled={setupLoading}
                                        className="w-full px-4 py-2.5 bg-yellow-500 hover:bg-yellow-400 text-black font-medium rounded-md transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                    >
                                        {setupLoading ? (
                                            <>
                                                <Loader size={16} className="animate-spin" />
                                                <span>Opening Browser...</span>
                                            </>
                                        ) : (
                                            <>
                                                <span>Setup Google Account</span>
                                                <ArrowRight size={16} />
                                            </>
                                        )}
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    )}

                    {/* Bot Configured - Show Re-auth Option */}
                    {botConfigured && localStorage.getItem('authToken') && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="mb-12"
                        >
                            <button
                                onClick={setupBot}
                                disabled={setupLoading}
                                className="text-xs text-slate-500 hover:text-slate-300 transition-colors underline decoration-dotted"
                            >
                                {setupLoading ? 'Opening browser...' : 'Re-authenticate Google Meet Bot'}
                            </button>
                        </motion.div>
                    )}

                    {/* Supported Platforms */}
                    <div className="flex flex-col items-center gap-6">
                        <span className="text-xs font-semibold text-slate-500 uppercase tracking-widest">Works Seamlessly With</span>
                        <div className="flex items-center gap-12 grayscale opacity-40 hover:grayscale-0 hover:opacity-100 transition-all duration-500">
                            <div className="flex items-center gap-2">
                                <ZoomLogo className="w-8 h-8" />
                                <span className="font-semibold text-xl text-white hidden md:block">Zoom</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <TeamsLogo className="w-8 h-8" />
                                <span className="font-semibold text-xl text-white hidden md:block">Teams</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <MeetLogo className="w-8 h-8" />
                                <span className="font-semibold text-xl text-white hidden md:block">Google Meet</span>
                            </div>
                        </div>
                    </div>

                </motion.div>
            </div>
        </div>
    );
};

export default Home;
