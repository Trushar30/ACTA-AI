import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, Loader, CheckCircle, AlertCircle, Upload as UploadIcon, File, FileAudio, FileVideo, X, Loader2, CheckCircle2, Sparkles } from 'lucide-react';
import axios from 'axios';
import { io } from 'socket.io-client';
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
    const [botConfigured, setBotConfigured] = useState(true);
    const [setupLoading, setSetupLoading] = useState(false);
    const [showAdvanced, setShowAdvanced] = useState(false);
    const [currentPhraseIndex, setCurrentPhraseIndex] = useState(0);
    const navigate = useNavigate();

    // ── Upload state ──
    const [showUploadDrawer, setShowUploadDrawer] = useState(false);
    const [selectedFile, setSelectedFile] = useState(null);
    const [uploading, setUploading] = useState(false);
    const [processing, setProcessing] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [uploadResult, setUploadResult] = useState(null);
    const [uploadError, setUploadError] = useState(null);
    const [meetingTitle, setMeetingTitle] = useState('');
    const [currentMeetingId, setCurrentMeetingId] = useState(null);
    const [processingStatus, setProcessingStatus] = useState('');
    const [fabHovered, setFabHovered] = useState(false);

    const acceptedFormats = [
        '.mp3', '.wav', '.m4a', '.aac', '.ogg', '.flac',
        '.mp4', '.webm', '.mov', '.avi', '.mkv'
    ];

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

    useEffect(() => {
        const interval = setInterval(() => {
            setCurrentPhraseIndex((prev) => (prev + 1) % rotatingPhrases.length);
        }, 3500);
        return () => clearInterval(interval);
    }, []);

    // ── Upload: Socket.IO for real-time processing updates ──
    useEffect(() => {
        if (!currentMeetingId) return;

        const socket = io(API_URL, { transports: ['websocket', 'polling'] });

        socket.on('connect', () => {
            console.log('[Upload] Socket connected:', socket.id);
        });

        socket.on('meetingUpdate', (data) => {
            if (data.meetingId === currentMeetingId) {
                if (data.status === 'processing') {
                    setProcessingStatus(data.message || 'Processing...');
                } else if (data.status === 'completed') {
                    setProcessing(false);
                    setUploadResult({
                        success: true,
                        meetingId: data.meetingId,
                        transcription: data.transcription,
                        speakers: data.speakers?.length || data.totalSpeakers || 0,
                        timeline: data.timeline
                    });
                } else if (data.status === 'failed') {
                    setProcessing(false);
                    setUploadError(data.message || 'Processing failed');
                }
            }
        });

        return () => socket.disconnect();
    }, [currentMeetingId]);

    // ── Upload: 15-minute timeout ──
    useEffect(() => {
        if (processing && currentMeetingId) {
            const timeout = setTimeout(() => {
                setProcessing(false);
                setUploadError('Processing timeout. Please check the Archive Meetings page.');
            }, 15 * 60 * 1000);
            return () => clearTimeout(timeout);
        }
    }, [processing, currentMeetingId]);

    // ── Original Home functions ──
    const checkBotSetup = async () => {
        try {
            const token = localStorage.getItem('authToken');
            if (!token) { setBotConfigured(true); return; }
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
            setTimeout(() => checkBotSetup(), 3000);
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
        if (value && !showAdvanced) setShowAdvanced(true);
    };

    // ── Upload handler functions ──
    const handleFileSelect = (e) => {
        const file = e.target.files[0];
        if (file) {
            if (file.size > 500 * 1024 * 1024) {
                setUploadError('File size must be less than 500MB');
                return;
            }
            setSelectedFile(file);
            setUploadError(null);
            setUploadResult(null);
        }
    };

    const handleDrop = (e) => {
        e.preventDefault();
        const file = e.dataTransfer.files[0];
        if (file) {
            if (file.size > 500 * 1024 * 1024) {
                setUploadError('File size must be less than 500MB');
                return;
            }
            setSelectedFile(file);
            setUploadError(null);
            setUploadResult(null);
        }
    };

    const handleDragOver = (e) => e.preventDefault();

    const removeFile = () => {
        setSelectedFile(null);
        setUploadProgress(0);
        setUploadError(null);
        setUploadResult(null);
        setMeetingTitle('');
    };

    const resetUpload = () => {
        removeFile();
        setUploading(false);
        setProcessing(false);
        setCurrentMeetingId(null);
        setProcessingStatus('');
    };

    const handleUpload = async () => {
        if (!selectedFile) return;
        setUploading(true);
        setProcessing(false);
        setUploadError(null);
        setUploadProgress(0);

        const formData = new FormData();
        formData.append('audio', selectedFile);
        formData.append('title', meetingTitle || selectedFile.name);

        try {
            const response = await axios.post(`${API_URL}/api/meetings/upload`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
                onUploadProgress: (progressEvent) => {
                    const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
                    setUploadProgress(progress);
                }
            });
            setUploading(false);
            setProcessing(true);
            setCurrentMeetingId(response.data.meetingId);
            setProcessingStatus('Processing started...');
        } catch (err) {
            console.error('Upload error:', err);
            setUploadError(err.response?.data?.error || 'Upload failed. Please try again.');
            setUploading(false);
            setProcessing(false);
        }
    };

    const getFileIcon = (file) => {
        if (!file) return <File size={32} />;
        const ext = file.name.split('.').pop().toLowerCase();
        if (['mp4', 'webm', 'mov', 'avi', 'mkv'].includes(ext)) {
            return <FileVideo size={32} className="text-white" />;
        }
        return <FileAudio size={32} className="text-blue-400" />;
    };

    const formatFileSize = (bytes) => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
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

            {/* ═══════════════════════════════════════════════════════════════
                FLOATING UPLOAD BUTTON (FAB)
            ═══════════════════════════════════════════════════════════════ */}
            <motion.button
                onClick={() => setShowUploadDrawer(true)}
                onMouseEnter={() => setFabHovered(true)}
                onMouseLeave={() => setFabHovered(false)}
                initial={{ opacity: 0, scale: 0.5, y: 40 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ delay: 1, type: 'spring', stiffness: 200, damping: 15 }}
                className="fixed bottom-8 right-8 z-40 group"
                style={{ WebkitTapHighlightColor: 'transparent' }}
            >
                {/* Outer glow ring */}
                <motion.div
                    className="absolute -inset-1 rounded-full bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 blur-md"
                    animate={{
                        opacity: fabHovered ? 0.8 : 0.4,
                        scale: fabHovered ? 1.15 : 1,
                    }}
                    transition={{ duration: 0.3 }}
                />
                {/* Pulsing ring */}
                <motion.div
                    className="absolute -inset-2 rounded-full border border-white/10"
                    animate={{
                        scale: [1, 1.2, 1],
                        opacity: [0.3, 0, 0.3],
                    }}
                    transition={{
                        duration: 2.5,
                        repeat: Infinity,
                        ease: 'easeInOut'
                    }}
                />
                {/* Button body */}
                <div className="relative flex items-center gap-2.5 px-5 py-3 bg-[#0B0E14]/90 backdrop-blur-xl border border-white/15 rounded-full shadow-2xl transition-all duration-300 group-hover:border-white/30 group-hover:bg-[#0B0E14]">
                    <motion.div
                        animate={{ rotate: fabHovered ? 180 : 0 }}
                        transition={{ duration: 0.4, ease: 'easeInOut' }}
                    >
                        <UploadIcon size={18} className="text-white" />
                    </motion.div>
                    <span className="text-sm font-semibold text-white tracking-wide">Upload</span>
                </div>
            </motion.button>

            {/* ═══════════════════════════════════════════════════════════════
                UPLOAD SLIDE-UP DRAWER
            ═══════════════════════════════════════════════════════════════ */}
            <AnimatePresence>
                {showUploadDrawer && (
                    <>
                        {/* Backdrop overlay */}
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => { if (!uploading && !processing) setShowUploadDrawer(false); }}
                            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
                        />

                        {/* Drawer panel */}
                        <motion.div
                            initial={{ y: '100%' }}
                            animate={{ y: 0 }}
                            exit={{ y: '100%' }}
                            transition={{ type: 'spring', damping: 28, stiffness: 300 }}
                            className="fixed bottom-0 left-0 right-0 z-50 max-h-[85vh] overflow-y-auto"
                        >
                            <div
                                className="mx-auto max-w-2xl rounded-t-3xl border border-white/10 border-b-0 shadow-2xl"
                                style={{
                                    background: 'linear-gradient(180deg, rgba(11,14,20,0.97) 0%, rgba(11,14,20,0.99) 100%)',
                                    backdropFilter: 'blur(40px)',
                                }}
                            >
                                {/* Drawer handle + header */}
                                <div className="flex items-center justify-between p-6 pb-4 border-b border-white/5">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 rounded-xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 border border-white/10">
                                            <UploadIcon size={20} className="text-white" />
                                        </div>
                                        <div>
                                            <h2 className="text-lg font-bold text-white">Upload Recording</h2>
                                            <p className="text-xs text-slate-500">Audio or video · AI transcription</p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => { if (!uploading && !processing) { setShowUploadDrawer(false); resetUpload(); } }}
                                        className="p-2 rounded-full hover:bg-white/10 transition-colors"
                                    >
                                        <X size={20} className="text-slate-400" />
                                    </button>
                                </div>

                                {/* Drawer body */}
                                <div className="p-6 space-y-5">
                                    {!selectedFile ? (
                                        /* ── Drop zone ── */
                                        <div
                                            onDrop={handleDrop}
                                            onDragOver={handleDragOver}
                                            onClick={() => document.getElementById('uploadFileInput').click()}
                                            className="border-2 border-dashed border-white/20 rounded-2xl p-10 text-center hover:border-white/40 transition-all cursor-pointer group/drop"
                                        >
                                            <motion.div
                                                animate={{ y: [0, -6, 0] }}
                                                transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                                            >
                                                <UploadIcon size={48} className="mx-auto mb-4 text-white/30 group-hover/drop:text-white/60 transition-colors" />
                                            </motion.div>
                                            <h3 className="text-base font-semibold text-white mb-1">Drop your file here</h3>
                                            <p className="text-slate-500 text-sm mb-3">or click to browse</p>
                                            <p className="text-xs text-slate-600">
                                                MP3, WAV, M4A, MP4, WebM, MOV · Max 500MB
                                            </p>
                                            <input
                                                id="uploadFileInput"
                                                type="file"
                                                accept={acceptedFormats.join(',')}
                                                onChange={handleFileSelect}
                                                className="hidden"
                                            />
                                        </div>
                                    ) : (
                                        /* ── File selected ── */
                                        <div className="space-y-4">
                                            {/* Meeting title */}
                                            <div>
                                                <label className="block text-xs text-slate-500 mb-1.5 uppercase tracking-wider font-medium">Meeting Title (Optional)</label>
                                                <input
                                                    type="text"
                                                    value={meetingTitle}
                                                    onChange={(e) => setMeetingTitle(e.target.value)}
                                                    placeholder="e.g., Q1 Planning Meeting"
                                                    className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:border-blue-500/50 text-white text-sm placeholder-slate-600"
                                                />
                                            </div>

                                            {/* File card */}
                                            <div className="flex items-center gap-3 p-3.5 bg-white/5 rounded-xl border border-white/5">
                                                <div className="flex-shrink-0 p-2 bg-white/5 rounded-lg">
                                                    {getFileIcon(selectedFile)}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-white text-sm font-medium truncate">{selectedFile.name}</p>
                                                    <p className="text-xs text-slate-500">{formatFileSize(selectedFile.size)}</p>
                                                </div>
                                                {!uploading && !processing && (
                                                    <button
                                                        onClick={removeFile}
                                                        className="flex-shrink-0 p-1.5 hover:bg-red-500/20 rounded-lg transition-colors"
                                                    >
                                                        <X size={16} className="text-red-400" />
                                                    </button>
                                                )}
                                            </div>

                                            {/* Upload progress */}
                                            {uploading && (
                                                <div>
                                                    <div className="flex justify-between text-xs text-slate-400 mb-1.5">
                                                        <span>Uploading...</span>
                                                        <span>{uploadProgress}%</span>
                                                    </div>
                                                    <div className="w-full bg-white/5 rounded-full h-1.5 overflow-hidden">
                                                        <motion.div
                                                            initial={{ width: 0 }}
                                                            animate={{ width: `${uploadProgress}%` }}
                                                            className="h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full"
                                                        />
                                                    </div>
                                                </div>
                                            )}

                                            {/* Processing status */}
                                            {processing && (
                                                <div className="p-4 bg-white/5 border border-white/10 rounded-xl">
                                                    <div className="flex items-center gap-3">
                                                        <Loader2 className="animate-spin text-blue-400" size={20} />
                                                        <div>
                                                            <p className="text-white text-sm font-medium">Processing your recording...</p>
                                                            <p className="text-xs text-slate-500 mt-0.5">
                                                                {processingStatus || 'AI transcription & speaker identification'}
                                                            </p>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}

                                            {/* Upload button */}
                                            {!uploading && !processing && !uploadResult && (
                                                <button
                                                    onClick={handleUpload}
                                                    className="w-full py-3 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-400 hover:to-purple-500 text-white rounded-xl font-semibold transition-all flex items-center justify-center gap-2 text-sm shadow-lg shadow-blue-500/20"
                                                >
                                                    <Sparkles size={16} />
                                                    Start AI Transcription
                                                </button>
                                            )}
                                        </div>
                                    )}

                                    {/* Error */}
                                    <AnimatePresence>
                                        {uploadError && (
                                            <motion.div
                                                initial={{ opacity: 0, y: -8 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                exit={{ opacity: 0, y: -8 }}
                                                className="flex items-center gap-2.5 p-3.5 bg-red-500/10 border border-red-500/20 rounded-xl"
                                            >
                                                <AlertCircle className="text-red-400 flex-shrink-0" size={18} />
                                                <p className="text-red-400 text-sm">{uploadError}</p>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>

                                    {/* Success result */}
                                    <AnimatePresence>
                                        {uploadResult && (
                                            <motion.div
                                                initial={{ opacity: 0, scale: 0.95 }}
                                                animate={{ opacity: 1, scale: 1 }}
                                                exit={{ opacity: 0, scale: 0.95 }}
                                                className="text-center p-6 bg-white/5 border border-green-500/20 rounded-2xl"
                                            >
                                                <CheckCircle2 size={44} className="text-green-400 mx-auto mb-3" />
                                                <h3 className="text-lg font-bold text-white mb-1">Transcription Complete! 🎉</h3>
                                                <p className="text-slate-500 text-sm mb-5">Your recording has been processed</p>

                                                <div className="grid grid-cols-2 gap-3 mb-5">
                                                    <div className="p-3 bg-white/5 rounded-xl">
                                                        <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-0.5">Speakers</p>
                                                        <p className="text-xl font-bold text-white">{uploadResult.speakers || 'N/A'}</p>
                                                    </div>
                                                    <div className="p-3 bg-white/5 rounded-xl">
                                                        <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-0.5">Meeting ID</p>
                                                        <p className="text-xs font-mono text-slate-300 mt-1">{uploadResult.meetingId?.slice(-8)}</p>
                                                    </div>
                                                </div>

                                                <div className="flex gap-2">
                                                    <button
                                                        onClick={resetUpload}
                                                        className="flex-1 px-4 py-2.5 bg-white/5 hover:bg-white/10 rounded-xl text-sm font-semibold text-white transition-colors"
                                                    >
                                                        Upload Another
                                                    </button>
                                                    <a
                                                        href="/dashboard"
                                                        className="flex-1 px-4 py-2.5 bg-white hover:bg-slate-200 text-black rounded-xl text-sm font-semibold transition-all text-center"
                                                    >
                                                        View Dashboard
                                                    </a>
                                                </div>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>

                                {/* Bottom safe area */}
                                <div className="h-6" />
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </div>
    );
};

export default Home;
