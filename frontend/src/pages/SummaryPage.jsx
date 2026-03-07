import React, { useState, useEffect, useRef, useMemo } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import {
    FileText, Loader2, Sparkles, Check, ChevronDown, Search, X,
    Users, Clock, Calendar, CheckCircle2, AlertTriangle, BarChart2,
    TrendingUp, MessageSquare, Target, Zap, ShieldCheck, Copy,
    Save, Trash2, Pencil, ArrowLeft, FolderOpen, Send, User,
    Plus, Filter, LayoutGrid
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const API_URL = 'http://localhost:3000';

// Helper function to format text for better readability
const formatTextContent = (text) => {
    if (!text) return null;

    // Split by double newlines first to preserve intentional paragraphs
    const paragraphs = text.split(/\n\n+/);
    
    return paragraphs.map((para, pIdx) => {
        // Check if paragraph contains bullet-like patterns
        const lines = para.split('\n').filter(line => line.trim());
        
        // If it looks like a list (starts with -, •, *, numbers, etc.)
        const isList = lines.some(line => 
            /^[\-•*]\s/.test(line.trim()) || 
            /^\d+[\.)]\s/.test(line.trim())
        );
        
        if (isList) {
            return (
                <ul key={pIdx} className="space-y-2 my-3">
                    {lines.map((line, lIdx) => {
                        const cleanLine = line.trim().replace(/^[\-•*]\s/, '').replace(/^\d+[\.)]\s/, '');
                        return cleanLine ? (
                            <li key={lIdx} className="flex items-start gap-2 text-slate-300">
                                <span className="text-blue-400 mt-1.5">•</span>
                                <span className="flex-1 leading-relaxed">{cleanLine}</span>
                            </li>
                        ) : null;
                    })}
                </ul>
            );
        }
        
        // Regular paragraph
        return para.trim() ? (
            <p key={pIdx} className="text-slate-300 leading-relaxed mb-4 last:mb-0">
                {para.trim()}
            </p>
        ) : null;
    });
};

const SummaryPage = () => {
    const navigate = useNavigate();
    const [meetings, setMeetings] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedMeetings, setSelectedMeetings] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [generating, setGenerating] = useState(false);
    const [summary, setSummary] = useState(null);
    const [error, setError] = useState(null);
    const [copied, setCopied] = useState(null);
    const [activeTab, setActiveTab] = useState('create'); // 'create' | 'saved'
    const [quickFilter, setQuickFilter] = useState('all'); // 'all' | 'week' | 'month'

    // Saved summaries state
    const [savedSummaries, setSavedSummaries] = useState([]);
    const [saving, setSaving] = useState(false);
    const [summaryName, setSummaryName] = useState('');
    const [isSaved, setIsSaved] = useState(false);
    const [currentSavedId, setCurrentSavedId] = useState(null);
    const [viewingSaved, setViewingSaved] = useState(false);
    const [editingNameId, setEditingNameId] = useState(null);
    const [editNameValue, setEditNameValue] = useState('');
    const [deletingId, setDeletingId] = useState(null);

    // Ask AI state
    const [chatOpen, setChatOpen] = useState(false);
    const [chatHistory, setChatHistory] = useState([]);
    const [chatQuery, setChatQuery] = useState('');
    const [askingAi, setAskingAi] = useState(false);
    const chatEndRef = useRef(null);

    useEffect(() => {
        fetchMeetings();
        fetchSavedSummaries();
    }, []);

    const fetchMeetings = async () => {
        try {
            const res = await axios.get(`${API_URL}/api/meetings`);
            const completedMeetings = (res.data || []).filter(
                m => m.status === 'completed' && m.transcription
            );
            setMeetings(completedMeetings);
        } catch (err) {
            console.error('Error fetching meetings:', err);
        } finally {
            setLoading(false);
        }
    };

    const fetchSavedSummaries = async () => {
        try {
            const res = await axios.get(`${API_URL}/api/saved-summaries`);
            if (res.data.success) {
                setSavedSummaries(res.data.summaries);
            }
        } catch (err) {
            console.error('Error fetching saved summaries:', err);
        }
    };

    const toggleMeeting = (meetingId) => {
        setSelectedMeetings(prev =>
            prev.includes(meetingId)
                ? prev.filter(id => id !== meetingId)
                : [...prev, meetingId]
        );
    };

    const removeMeeting = (meetingId) => {
        setSelectedMeetings(prev => prev.filter(id => id !== meetingId));
    };

    const filteredMeetings = useMemo(() => {
        const now = new Date();
        return meetings.filter(m => {
            const query = searchQuery.toLowerCase();
            const matchesSearch = (m.meetingName || '').toLowerCase().includes(query) ||
                (m.topic || '').toLowerCase().includes(query) ||
                (m.meetingLink || '').toLowerCase().includes(query);

            if (!matchesSearch) return false;

            if (quickFilter === 'week') {
                const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                return new Date(m.createdAt) >= weekAgo;
            }
            if (quickFilter === 'month') {
                const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
                return new Date(m.createdAt) >= monthAgo;
            }
            return true;
        });
    }, [meetings, searchQuery, quickFilter]);

    const selectAll = () => {
        if (selectedMeetings.length === filteredMeetings.length && filteredMeetings.length > 0) {
            setSelectedMeetings([]);
        } else {
            setSelectedMeetings(filteredMeetings.map(m => m._id));
        }
    };

    const generateAutoName = () => {
        const selected = meetings.filter(m => selectedMeetings.includes(m._id));
        const date = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        if (selected.length === 1) {
            return `Summary - ${selected[0].meetingName || selected[0].topic || 'Meeting'} (${date})`;
        }
        return `Combined Summary - ${selected.length} Meetings (${date})`;
    };

    const handleGenerateSummary = async () => {
        if (selectedMeetings.length === 0) return;
        setGenerating(true);
        setError(null);
        setSummary(null);
        setIsSaved(false);
        setCurrentSavedId(null);
        setViewingSaved(false);

        try {
            const res = await axios.post(`${API_URL}/api/meetings/combined-summary`, {
                meetingIds: selectedMeetings
            });
            if (res.data.success) {
                setSummary(res.data.summary);
                setSummaryName(generateAutoName());
            } else {
                setError(res.data.error || 'Failed to generate summary');
            }
        } catch (err) {
            console.error('Error generating combined summary:', err);
            setError(err.response?.data?.error || 'Failed to generate combined summary. Please try again.');
        } finally {
            setGenerating(false);
        }
    };

    const handleSaveSummary = async () => {
        if (!summary || !summaryName.trim()) return;
        setSaving(true);
        try {
            const res = await axios.post(`${API_URL}/api/saved-summaries`, {
                name: summaryName.trim(),
                meetingIds: selectedMeetings,
                summaryData: summary,
            });
            if (res.data.success) {
                setIsSaved(true);
                setCurrentSavedId(res.data.summary._id);
                await fetchSavedSummaries();
            }
        } catch (err) {
            console.error('Error saving summary:', err);
            alert('Failed to save summary');
        } finally {
            setSaving(false);
        }
    };

    const handleOpenSaved = (saved) => {
        setSummary(saved.summaryData);
        setSummaryName(saved.name);
        setIsSaved(true);
        setCurrentSavedId(saved._id);
        setViewingSaved(true);
        setSelectedMeetings(saved.meetingIds?.map(id => id.toString()) || []);
    };

    const handleRenameSaved = async (id) => {
        if (!editNameValue.trim()) return;
        try {
            const res = await axios.put(`${API_URL}/api/saved-summaries/${id}`, {
                name: editNameValue.trim()
            });
            if (res.data.success) {
                setSavedSummaries(prev => prev.map(s => s._id === id ? { ...s, name: editNameValue.trim() } : s));
                if (currentSavedId === id) setSummaryName(editNameValue.trim());
                setEditingNameId(null);
            }
        } catch (err) {
            console.error('Error renaming summary:', err);
        }
    };

    const handleDeleteSaved = async (id) => {
        setDeletingId(id);
        try {
            await axios.delete(`${API_URL}/api/saved-summaries/${id}`);
            setSavedSummaries(prev => prev.filter(s => s._id !== id));
            if (currentSavedId === id) {
                setSummary(null);
                setIsSaved(false);
                setCurrentSavedId(null);
                setViewingSaved(false);
            }
        } catch (err) {
            console.error('Error deleting summary:', err);
        } finally {
            setDeletingId(null);
        }
    };

    const handleBackToList = () => {
        setSummary(null);
        setIsSaved(false);
        setCurrentSavedId(null);
        setViewingSaved(false);
        setSelectedMeetings([]);
        setSummaryName('');
        setChatHistory([]);
        setChatOpen(false);
    };

    const handleCopy = (text, key) => {
        navigator.clipboard.writeText(text);
        setCopied(key);
        setTimeout(() => setCopied(null), 2000);
    };

    const handleAskAi = async (e) => {
        e?.preventDefault();
        if (!chatQuery.trim() || askingAi || !summary) return;

        const userMsg = chatQuery.trim();
        setChatHistory(prev => [...prev, { role: 'user', content: userMsg }]);
        setChatQuery('');
        setAskingAi(true);

        try {
            const res = await axios.post(`${API_URL}/api/summary/ask`, {
                question: userMsg,
                summaryData: summary,
            });
            if (res.data.success) {
                setChatHistory(prev => [...prev, { role: 'ai', content: res.data.answer }]);
            } else {
                setChatHistory(prev => [...prev, { role: 'ai', content: 'Sorry, I could not find an answer.' }]);
            }
        } catch (err) {
            console.error('Ask AI error:', err);
            setChatHistory(prev => [...prev, { role: 'ai', content: 'Failed to get a response. Please try again.' }]);
        } finally {
            setAskingAi(false);
            setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
        }
    };

    const getSelectedMeetingDetails = () => {
        return meetings.filter(m => selectedMeetings.includes(m._id));
    };

    const formatDate = (dateStr) => {
        if (!dateStr) return 'N/A';
        return new Date(dateStr).toLocaleDateString('en-US', {
            month: 'short', day: 'numeric', year: 'numeric'
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

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-white animate-spin" />
            </div>
        );
    }

    // ─── HOME VIEW (no summary being viewed) ───
    const showHome = !summary && !generating;

    return (
        <div className="min-h-screen bg-[#0B0E14]">
            <div className="max-w-7xl mx-auto px-6 py-8">
                {/* ═══════════ Header ═══════════ */}
                <div className="mb-8">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            {(summary || viewingSaved) && (
                                <button
                                    onClick={handleBackToList}
                                    className="p-2.5 bg-white/5 hover:bg-white/10 rounded-xl text-slate-400 hover:text-white transition-all border border-white/5 hover:border-white/10"
                                >
                                    <ArrowLeft size={18} />
                                </button>
                            )}
                            <div>
                                <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                                    <div className="p-2 bg-blue-500/10 rounded-xl border border-blue-500/20">
                                        <Sparkles size={22} className="text-blue-400" />
                                    </div>
                                    AI Summary
                                </h1>
                                <p className="text-slate-500 text-sm mt-1.5 ml-[52px]">
                                    {summary ? summaryName : 'Generate combined insights from your meetings'}
                                </p>
                            </div>
                        </div>

                        {/* Quick Stats (only on home) */}
                        {showHome && (
                            <div className="hidden md:flex items-center gap-3">
                                <div className="flex items-center gap-2 px-3 py-2 bg-[#1C1F2E] rounded-xl border border-white/5 text-xs">
                                    <FileText size={14} className="text-cyan-400" />
                                    <span className="text-slate-400">{meetings.length} meetings</span>
                                </div>
                                <div className="flex items-center gap-2 px-3 py-2 bg-[#1C1F2E] rounded-xl border border-white/5 text-xs">
                                    <FolderOpen size={14} className="text-purple-400" />
                                    <span className="text-slate-400">{savedSummaries.length} saved</span>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* ═══════════ HOME VIEW ═══════════ */}
                {showHome && (
                    <>
                        {/* Tab Navigation */}
                        <div className="flex items-center gap-1 bg-[#1C1F2E] rounded-xl p-1 mb-6 w-fit border border-white/5">
                            <button
                                onClick={() => setActiveTab('create')}
                                className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all ${
                                    activeTab === 'create'
                                        ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20'
                                        : 'text-slate-400 hover:text-white hover:bg-white/5'
                                }`}
                            >
                                <Plus size={16} />
                                Create New
                            </button>
                            <button
                                onClick={() => setActiveTab('saved')}
                                className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all ${
                                    activeTab === 'saved'
                                        ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20'
                                        : 'text-slate-400 hover:text-white hover:bg-white/5'
                                }`}
                            >
                                <FolderOpen size={16} />
                                Saved
                                {savedSummaries.length > 0 && (
                                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                                        activeTab === 'saved' ? 'bg-white/20 text-white' : 'bg-white/10 text-slate-400'
                                    }`}>
                                        {savedSummaries.length}
                                    </span>
                                )}
                            </button>
                        </div>

                        {/* ── CREATE NEW TAB ── */}
                        {activeTab === 'create' && !viewingSaved && (
                            <div className="space-y-5">
                                {/* Search & Filters Bar */}
                                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                                    <div className="relative flex-1">
                                        <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                                        <input
                                            type="text"
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                            placeholder="Search meetings by name or topic..."
                                            className="w-full bg-[#1C1F2E] border border-white/5 rounded-xl pl-10 pr-4 py-3 text-sm text-white focus:outline-none focus:border-blue-500/30 placeholder:text-slate-600 transition-colors"
                                        />
                                        {searchQuery && (
                                            <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white">
                                                <X size={14} />
                                            </button>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {[
                                            { key: 'all', label: 'All' },
                                            { key: 'week', label: 'This Week' },
                                            { key: 'month', label: 'This Month' },
                                        ].map(f => (
                                            <button
                                                key={f.key}
                                                onClick={() => setQuickFilter(f.key)}
                                                className={`px-3.5 py-2.5 rounded-lg text-xs font-medium transition-all border ${
                                                    quickFilter === f.key
                                                        ? 'bg-blue-600/15 border-blue-500/30 text-blue-400'
                                                        : 'bg-[#1C1F2E] border-white/5 text-slate-400 hover:text-white hover:border-white/10'
                                                }`}
                                            >
                                                {f.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Selection Actions Bar */}
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <button
                                            onClick={selectAll}
                                            className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-slate-400 hover:text-white bg-[#1C1F2E] hover:bg-white/10 rounded-lg border border-white/5 transition-all"
                                        >
                                            {selectedMeetings.length === filteredMeetings.length && filteredMeetings.length > 0 ? (
                                                <><X size={12} /> Deselect All</>
                                            ) : (
                                                <><CheckCircle2 size={12} /> Select All</>
                                            )}
                                        </button>
                                        <span className="text-xs text-slate-600">
                                            {filteredMeetings.length} meeting{filteredMeetings.length !== 1 ? 's' : ''} available
                                        </span>
                                    </div>

                                    {selectedMeetings.length > 0 && (
                                        <motion.div
                                            initial={{ opacity: 0, scale: 0.95 }}
                                            animate={{ opacity: 1, scale: 1 }}
                                            className="flex items-center gap-3"
                                        >
                                            <span className="text-xs font-medium text-blue-400 bg-blue-500/10 px-3 py-1.5 rounded-lg border border-blue-500/20">
                                                {selectedMeetings.length} selected
                                            </span>
                                            <button
                                                onClick={() => setSelectedMeetings([])}
                                                className="text-xs text-slate-500 hover:text-white transition-colors"
                                            >
                                                Clear
                                            </button>
                                        </motion.div>
                                    )}
                                </div>

                                {/* Meeting Cards Grid */}
                                {filteredMeetings.length > 0 ? (
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                        {filteredMeetings.map((meeting) => {
                                            const isSelected = selectedMeetings.includes(meeting._id);
                                            return (
                                                <motion.button
                                                    key={meeting._id}
                                                    onClick={() => toggleMeeting(meeting._id)}
                                                    layout
                                                    className={`relative text-left p-4 rounded-xl border transition-all group ${
                                                        isSelected
                                                            ? 'bg-blue-500/5 border-blue-500/30 ring-1 ring-blue-500/20'
                                                            : 'bg-[#1C1F2E] border-white/5 hover:border-white/15 hover:bg-[#1e2235]'
                                                    }`}
                                                >
                                                    {/* Checkbox */}
                                                    <div className="flex items-start gap-3">
                                                        <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition-all ${
                                                            isSelected ? 'bg-blue-500 border-blue-500 scale-110' : 'border-white/20 group-hover:border-white/40'
                                                        }`}>
                                                            {isSelected && <Check size={12} className="text-white" />}
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <p className="text-sm font-semibold text-white truncate mb-1">
                                                                {meeting.meetingName || meeting.topic || 'Untitled Meeting'}
                                                            </p>
                                                            <div className="flex items-center gap-2 text-[11px] text-slate-500">
                                                                <span className="flex items-center gap-1">
                                                                    <Calendar size={10} />
                                                                    {getRelativeTime(meeting.createdAt)}
                                                                </span>
                                                                {meeting.platform && (
                                                                    <span className="px-1.5 py-0.5 bg-white/5 rounded text-[10px] capitalize">
                                                                        {meeting.platform}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </motion.button>
                                            );
                                        })}
                                    </div>
                                ) : (
                                    <div className="bg-[#1C1F2E] rounded-2xl border border-white/5 p-12 text-center">
                                        <Search size={40} className="text-slate-600 mx-auto mb-3" />
                                        <p className="text-sm text-slate-400 font-semibold mb-1">No meetings found</p>
                                        <p className="text-xs text-slate-600">
                                            {searchQuery ? 'Try a different search term' : 'Complete a meeting with transcription to get started'}
                                        </p>
                                    </div>
                                )}

                                {/* ── Sticky Generate Bar ── */}
                                <AnimatePresence>
                                    {selectedMeetings.length > 0 && (
                                        <motion.div
                                            initial={{ opacity: 0, y: 20 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, y: 20 }}
                                            className="sticky bottom-6 z-40"
                                        >
                                            <div className="bg-[#1C1F2E]/95 backdrop-blur-xl rounded-2xl border border-blue-500/20 p-4 shadow-2xl shadow-black/40 flex items-center justify-between gap-4">
                                                <div className="flex items-center gap-3 min-w-0">
                                                    <div className="w-10 h-10 bg-blue-500/10 rounded-xl flex items-center justify-center flex-shrink-0 border border-blue-500/20">
                                                        <Sparkles size={18} className="text-blue-400" />
                                                    </div>
                                                    <div className="min-w-0">
                                                        <p className="text-sm font-semibold text-white">
                                                            {selectedMeetings.length} meeting{selectedMeetings.length > 1 ? 's' : ''} selected
                                                        </p>
                                                        <p className="text-[11px] text-slate-500 truncate">
                                                            {getSelectedMeetingDetails().map(m => m.meetingName || m.topic || 'Untitled').join(', ')}
                                                        </p>
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={handleGenerateSummary}
                                                    disabled={generating}
                                                    className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl transition-all shadow-lg shadow-blue-600/20 hover:shadow-blue-500/30 disabled:opacity-40 disabled:cursor-not-allowed text-sm whitespace-nowrap"
                                                >
                                                    <Sparkles size={16} />
                                                    Generate Summary
                                                </button>
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>

                                {/* Empty welcome when no meetings selected and none saved */}
                                {selectedMeetings.length === 0 && meetings.length > 0 && savedSummaries.length === 0 && (
                                    <div className="bg-gradient-to-br from-blue-500/5 via-[#1C1F2E] to-[#1C1F2E] rounded-2xl border border-blue-500/10 p-10 text-center">
                                        <div className="w-14 h-14 bg-blue-500/10 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-blue-500/20">
                                            <Sparkles size={28} className="text-blue-400" />
                                        </div>
                                        <h3 className="text-lg font-bold text-white mb-2">Select meetings above to begin</h3>
                                        <p className="text-sm text-slate-500 max-w-md mx-auto">
                                            Click on one or more meetings, then hit "Generate Summary" to create a comprehensive AI-powered analysis combining insights from all selected meetings.
                                        </p>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* ── SAVED TAB ── */}
                        {activeTab === 'saved' && (
                            <div>
                                {savedSummaries.length > 0 ? (
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                        {savedSummaries.map((saved) => (
                                            <motion.div
                                                key={saved._id}
                                                initial={{ opacity: 0, y: 10 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                className="bg-[#1C1F2E] rounded-2xl border border-white/5 p-5 hover:border-blue-500/30 transition-all group cursor-pointer"
                                                onClick={() => handleOpenSaved(saved)}
                                            >
                                                <div className="flex items-start justify-between mb-3">
                                                    <div className="flex-1 min-w-0">
                                                        {editingNameId === saved._id ? (
                                                            <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                                                                <input
                                                                    type="text"
                                                                    value={editNameValue}
                                                                    onChange={(e) => setEditNameValue(e.target.value)}
                                                                    onKeyDown={(e) => {
                                                                        if (e.key === 'Enter') handleRenameSaved(saved._id);
                                                                        if (e.key === 'Escape') setEditingNameId(null);
                                                                    }}
                                                                    autoFocus
                                                                    className="w-full bg-[#0B0E14] border border-white/20 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-blue-500/50"
                                                                />
                                                                <button
                                                                    onClick={() => handleRenameSaved(saved._id)}
                                                                    className="p-1.5 bg-blue-500/20 hover:bg-blue-500/30 rounded-lg text-blue-400 transition-colors"
                                                                >
                                                                    <Check size={14} />
                                                                </button>
                                                            </div>
                                                        ) : (
                                                            <h3 className="text-base font-semibold text-white truncate">{saved.name}</h3>
                                                        )}
                                                    </div>
                                                    <div className="flex items-center gap-1 ml-2 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                                                        <button
                                                            onClick={() => { setEditingNameId(saved._id); setEditNameValue(saved.name); }}
                                                            className="p-1.5 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white transition-colors"
                                                            title="Rename"
                                                        >
                                                            <Pencil size={14} />
                                                        </button>
                                                        <button
                                                            onClick={() => handleDeleteSaved(saved._id)}
                                                            disabled={deletingId === saved._id}
                                                            className="p-1.5 hover:bg-red-500/10 rounded-lg text-slate-400 hover:text-red-400 transition-colors disabled:opacity-50"
                                                            title="Delete"
                                                        >
                                                            {deletingId === saved._id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                                                        </button>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-3 text-xs text-slate-500 mb-3">
                                                    <span className="flex items-center gap-1">
                                                        <Calendar size={12} />
                                                        {getRelativeTime(saved.createdAt)}
                                                    </span>
                                                    <span className="flex items-center gap-1">
                                                        <FileText size={12} />
                                                        {saved.summaryData?.meetingCount || saved.meetingIds?.length || 0} meetings
                                                    </span>
                                                </div>
                                                <p className="text-sm text-slate-400 line-clamp-2">
                                                    {saved.summaryData?.executiveSummary?.substring(0, 120) || 'No preview available'}...
                                                </p>
                                                <div className="mt-3 flex items-center gap-4 text-xs text-slate-500">
                                                    {saved.summaryData?.totalParticipants > 0 && (
                                                        <span className="flex items-center gap-1"><Users size={12} /> {saved.summaryData.totalParticipants}</span>
                                                    )}
                                                    {saved.summaryData?.totalActionItems > 0 && (
                                                        <span className="flex items-center gap-1"><CheckCircle2 size={12} /> {saved.summaryData.totalActionItems} tasks</span>
                                                    )}
                                                </div>
                                            </motion.div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="bg-[#1C1F2E] rounded-2xl border border-white/5 p-16 text-center">
                                        <FolderOpen size={48} className="text-slate-600 mx-auto mb-4" />
                                        <h3 className="text-lg font-bold text-slate-400 mb-2">No saved summaries yet</h3>
                                        <p className="text-sm text-slate-500 mb-6 max-w-sm mx-auto">
                                            Generate a summary and save it for quick access later.
                                        </p>
                                        <button
                                            onClick={() => setActiveTab('create')}
                                            className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl transition-colors text-sm"
                                        >
                                            <Plus size={16} />
                                            Create Your First Summary
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}
                    </>
                )}

                {/* ═══════════ ERROR ═══════════ */}
                {error && (
                    <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 mb-6 flex items-center gap-3">
                        <AlertTriangle size={20} className="text-red-400 flex-shrink-0" />
                        <p className="text-sm text-red-400">{error}</p>
                        <button onClick={() => setError(null)} className="ml-auto text-red-400/60 hover:text-red-400"><X size={16} /></button>
                    </div>
                )}

                {/* ═══════════ GENERATING ═══════════ */}
                {generating && (
                    <div className="bg-[#1C1F2E] rounded-2xl border border-white/5 p-16 mb-8 flex flex-col items-center justify-center">
                        <div className="relative mb-6">
                            <Loader2 size={48} className="text-blue-400 animate-spin" />
                            <Sparkles size={20} className="text-yellow-400 absolute -top-2 -right-2 animate-pulse" />
                        </div>
                        <h3 className="text-xl font-bold text-white mb-2">Analyzing {selectedMeetings.length} Meeting{selectedMeetings.length > 1 ? 's' : ''}...</h3>
                        <p className="text-sm text-slate-400 text-center max-w-md">
                            AI is processing all transcripts, extracting insights, and creating a comprehensive combined summary.
                        </p>
                        <div className="mt-6 flex items-center gap-2">
                            <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" />
                            <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0.15s' }} />
                            <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0.3s' }} />
                        </div>
                    </div>
                )}

                {/* Summary Result */}
                {summary && !generating && (
                    <div className="space-y-6">
                        {/* Save Bar */}
                        <div className="bg-[#1C1F2E] rounded-2xl border border-white/5 p-5">
                            <div className="flex items-center gap-4">
                                <div className="flex-1">
                                    <label className="text-xs text-slate-500 font-semibold uppercase tracking-wider mb-1.5 block">Summary Name</label>
                                    <input
                                        type="text"
                                        value={summaryName}
                                        onChange={(e) => setSummaryName(e.target.value)}
                                        placeholder="Enter summary name..."
                                        disabled={isSaved}
                                        className="w-full bg-[#0B0E14] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500/50 placeholder:text-slate-500 disabled:opacity-60"
                                    />
                                </div>
                                {!isSaved ? (
                                    <button
                                        onClick={handleSaveSummary}
                                        disabled={saving || !summaryName.trim()}
                                        className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-colors disabled:opacity-40 disabled:cursor-not-allowed mt-5"
                                    >
                                        {saving ? (
                                            <><Loader2 size={16} className="animate-spin" /> Saving...</>
                                        ) : (
                                            <><Save size={16} /> Save</>
                                        )}
                                    </button>
                                ) : (
                                    <div className="flex items-center gap-2 px-4 py-2.5 bg-blue-500/10 border border-blue-500/20 rounded-xl text-blue-400 text-sm font-semibold mt-5">
                                        <Check size={16} /> Saved
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Title & Overview */}
                        <div className="bg-[#1C1F2E] rounded-2xl border border-white/5 p-8">
                            <div className="flex items-start justify-between mb-6">
                                <div>
                                    <h2 className="text-2xl font-bold text-white mb-2">{summary.title}</h2>
                                    <p className="text-slate-400 text-sm">
                                        Combined analysis of {summary.meetingCount} meeting{summary.meetingCount > 1 ? 's' : ''}
                                    </p>
                                </div>
                                <CopyBtn text={JSON.stringify(summary, null, 2)} label="Copy All" copied={copied} onCopy={handleCopy} copyKey="all" />
                            </div>

                            {/* Stats Grid */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                                <StatCard label="Meetings" value={summary.meetingCount} icon={<FileText size={16} className="text-cyan-400" />} />
                                <StatCard label="Participants" value={summary.totalParticipants} icon={<Users size={16} className="text-green-400" />} />
                                <StatCard label="Action Items" value={summary.totalActionItems} icon={<CheckCircle2 size={16} className="text-purple-400" />} />
                                <StatCard label="Decisions" value={summary.totalDecisions} icon={<ShieldCheck size={16} className="text-yellow-400" />} />
                            </div>

                            {/* Executive Summary */}
                            <div className="mb-6">
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                                        <Sparkles size={18} className="text-blue-400" />
                                        Executive Summary
                                    </h3>
                                    <CopyBtn text={summary.executiveSummary} label="Copy" copied={copied} onCopy={handleCopy} copyKey="exec" />
                                </div>
                                <div className="text-sm space-y-3">
                                    {formatTextContent(summary.executiveSummary)}
                                </div>
                            </div>
                        </div>

                        {/* Meeting Breakdown */}
                        <div className="bg-[#1C1F2E] rounded-2xl border border-white/5 p-8">
                            <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                                <BarChart2 size={18} className="text-slate-400" />
                                Meeting-by-Meeting Breakdown
                            </h3>
                            <div className="space-y-5">
                                {summary.meetingBreakdowns?.map((mb, i) => (
                                    <div key={i} className="bg-[#0B0E14] rounded-xl border border-white/5 p-6">
                                        <div className="flex items-start justify-between mb-4">
                                            <div>
                                                <h4 className="text-base font-semibold text-white">{mb.title}</h4>
                                                <p className="text-xs text-slate-500 mt-1">{mb.date}</p>
                                            </div>
                                            <span className="text-xs px-2.5 py-1 bg-white/5 rounded-lg text-slate-400 font-medium">
                                                {mb.participantCount} participants
                                            </span>
                                        </div>
                                        <div className="text-sm space-y-3">
                                            {formatTextContent(mb.summary)}
                                        </div>
                                        {mb.keyDecisions?.length > 0 && (
                                            <div className="mt-4 pt-4 border-t border-white/5 flex flex-wrap gap-2">
                                                {mb.keyDecisions.map((d, j) => (
                                                    <span key={j} className="text-xs px-2.5 py-1 bg-blue-500/10 border border-blue-500/20 rounded-lg text-blue-400">
                                                        {d}
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            {/* All Participants */}
                            <div className="bg-[#1C1F2E] rounded-2xl border border-white/5 p-8">
                                <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                                    <Users size={18} className="text-slate-400" />
                                    All Participants
                                </h3>
                                <div className="space-y-3">
                                    {summary.allParticipants?.map((p, i) => {
                                        const colors = ['bg-purple-500', 'bg-blue-500', 'bg-amber-500', 'bg-blue-500', 'bg-pink-500', 'bg-cyan-500'];
                                        return (
                                            <div key={i} className="flex items-center gap-3 p-3 bg-[#0B0E14] rounded-xl border border-white/5">
                                                <div className={`w-9 h-9 rounded-lg ${colors[i % 6]} flex items-center justify-center text-white font-bold text-sm flex-shrink-0`}>
                                                    {p.name?.charAt(0) || '?'}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-semibold text-white truncate">{p.name}</p>
                                                    <p className="text-xs text-slate-500">{p.meetingsAttended} meeting{p.meetingsAttended > 1 ? 's' : ''} • {p.role || 'Participant'}</p>
                                                </div>
                                            </div>
                                        );
                                    })}
                                    {!summary.allParticipants?.length && <p className="text-slate-500 text-sm">No participants found</p>}
                                </div>
                            </div>

                            {/* Combined Action Items */}
                            <div className="bg-[#1C1F2E] rounded-2xl border border-white/5 p-8">
                                <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                                    <Target size={18} className="text-slate-400" />
                                    All Action Items
                                </h3>
                                <div className="space-y-3 max-h-[500px] overflow-y-auto custom-scrollbar pr-2">
                                    {summary.allActionItems?.map((task, i) => (
                                        <div key={i} className="flex items-start gap-3 p-4 bg-[#0B0E14] rounded-xl border border-white/5 hover:border-white/10 transition-colors">
                                            <CheckCircle2 size={16} className="text-blue-400 mt-0.5 flex-shrink-0" />
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm text-slate-200 leading-relaxed mb-2">{task.task}</p>
                                                <div className="flex flex-wrap items-center gap-2">
                                                    {task.owner && (
                                                        <span className="flex items-center gap-1 text-xs text-slate-400 bg-white/5 px-2 py-0.5 rounded">
                                                            <User size={10} />
                                                            {task.owner}
                                                        </span>
                                                    )}
                                                    {task.priority && (
                                                        <span className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase ${task.priority === 'High' ? 'bg-red-500/15 text-red-400 border border-red-500/20' :
                                                            task.priority === 'Medium' ? 'bg-amber-500/15 text-amber-400 border border-amber-500/20' : 'bg-blue-500/15 text-blue-400 border border-blue-500/20'
                                                            }`}>
                                                            {task.priority}
                                                        </span>
                                                    )}
                                                    {task.fromMeeting && (
                                                        <span className="text-[10px] text-slate-600">from: {task.fromMeeting}</span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                    {!summary.allActionItems?.length && (
                                        <div className="text-center py-8">
                                            <CheckCircle2 size={40} className="text-slate-600 mx-auto mb-2" />
                                            <p className="text-slate-500 text-sm">No action items found</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            {/* Key Decisions */}
                            <div className="bg-[#1C1F2E] rounded-2xl border border-white/5 p-8">
                                <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                                    <ShieldCheck size={18} className="text-slate-400" />
                                    All Key Decisions
                                </h3>
                                <div className="space-y-3 max-h-[500px] overflow-y-auto custom-scrollbar pr-2">
                                    {summary.allDecisions?.map((d, i) => (
                                        <div key={i} className="p-4 bg-[#0B0E14] rounded-xl border border-white/5 hover:border-white/10 transition-colors">
                                            <div className="flex items-start gap-3">
                                                <div className="w-6 h-6 rounded-md bg-blue-500/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                                                    <ShieldCheck size={14} className="text-blue-400" />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm text-slate-200 font-medium leading-relaxed mb-2">{d.conclusion}</p>
                                                    {d.rationale && (
                                                        <p className="text-xs text-slate-400 leading-relaxed pl-3 border-l-2 border-white/10">{d.rationale}</p>
                                                    )}
                                                    {d.fromMeeting && (
                                                        <p className="text-[10px] text-slate-600 mt-2 flex items-center gap-1">
                                                            <span className="w-1 h-1 rounded-full bg-slate-600"></span>
                                                            from: {d.fromMeeting}
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                    {!summary.allDecisions?.length && (
                                        <div className="text-center py-8">
                                            <ShieldCheck size={40} className="text-slate-600 mx-auto mb-2" />
                                            <p className="text-slate-500 text-sm">No decisions recorded</p>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Risks & Concerns */}
                            <div className="bg-[#1C1F2E] rounded-2xl border border-white/5 p-8">
                                <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                                    <AlertTriangle size={18} className="text-slate-400" />
                                    Risks & Concerns
                                </h3>
                                <div className="space-y-3 max-h-[400px] overflow-y-auto custom-scrollbar">
                                    {summary.allRisks?.map((risk, i) => (
                                        <div key={i} className="p-4 bg-[#0B0E14] rounded-xl border-l-2 border border-white/5"
                                            style={{ borderLeftColor: risk.severity === 'High' ? '#ef4444' : risk.severity === 'Medium' ? '#f59e0b' : '#3b82f6' }}>
                                            <div className="flex justify-between items-start mb-1">
                                                <p className="text-sm text-slate-200 font-medium">{risk.issue}</p>
                                                <span className={`text-[10px] px-1.5 py-0.5 rounded uppercase font-bold flex-shrink-0 ml-2 ${risk.severity === 'High' ? 'bg-red-500/20 text-red-400' :
                                                    risk.severity === 'Medium' ? 'bg-amber-500/20 text-amber-400' : 'bg-blue-500/20 text-blue-400'
                                                    }`}>
                                                    {risk.severity}
                                                </span>
                                            </div>
                                            <p className="text-xs text-slate-500">{risk.impact}</p>
                                        </div>
                                    ))}
                                    {!summary.allRisks?.length && <p className="text-slate-500 text-sm">No risks identified</p>}
                                </div>
                            </div>
                        </div>

                        {/* Key Themes */}
                        {summary.keyThemes?.length > 0 && (
                            <div className="bg-[#1C1F2E] rounded-2xl border border-white/5 p-8">
                                <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                                    <TrendingUp size={18} className="text-slate-400" />
                                    Key Themes Across Meetings
                                </h3>
                                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                                    {summary.keyThemes.map((theme, i) => (
                                        <div key={i} className="bg-[#0B0E14] p-5 rounded-xl border border-white/5">
                                            <h4 className="text-sm font-bold text-white mb-2">{theme.theme}</h4>
                                            <p className="text-xs text-slate-400 leading-relaxed">{theme.description}</p>
                                            <div className="mt-3 flex items-center gap-2">
                                                <span className="text-[10px] text-slate-500">
                                                    Mentioned in {theme.frequency} meeting{theme.frequency > 1 ? 's' : ''}
                                                </span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Follow-up Recommendations */}
                        {summary.recommendations && (
                            <div className="bg-[#1C1F2E] rounded-2xl border border-white/5 p-8">
                                <div className="flex items-center justify-between mb-6">
                                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                                        <Zap size={18} className="text-blue-400" />
                                        Recommendations & Next Steps
                                    </h3>
                                    <CopyBtn text={summary.recommendations} label="Copy" copied={copied} onCopy={handleCopy} copyKey="recs" />
                                </div>
                                <div className="text-sm space-y-3">
                                    {formatTextContent(summary.recommendations)}
                                </div>
                            </div>
                        )}

                        {/* Ask AI Section */}
                        <div className="bg-[#1C1F2E] rounded-2xl border border-white/5 overflow-hidden">
                            <button
                                onClick={() => setChatOpen(!chatOpen)}
                                className="w-full flex items-center justify-between p-6 hover:bg-white/5 transition-colors"
                            >
                                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                                    <Sparkles size={18} className="text-blue-400" />
                                    Ask AI About This Summary
                                </h3>
                                <ChevronDown size={18} className={`text-slate-400 transition-transform ${chatOpen ? 'rotate-180' : ''}`} />
                            </button>

                            <AnimatePresence>
                                {chatOpen && (
                                    <motion.div
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: 'auto', opacity: 1 }}
                                        exit={{ height: 0, opacity: 0 }}
                                        transition={{ duration: 0.2 }}
                                    >
                                        <div className="border-t border-white/5">
                                            {/* Chat Messages */}
                                            <div className="h-[350px] overflow-y-auto p-6 space-y-4 custom-scrollbar">
                                                {chatHistory.length === 0 && (
                                                    <div className="h-full flex flex-col items-center justify-center text-center">
                                                        <Sparkles size={40} className="text-white mb-3 opacity-30" />
                                                        <h4 className="text-base font-bold text-white mb-1">Ask anything about this summary</h4>
                                                        <p className="text-xs text-slate-500 mb-4">Powered by Google Gemini AI</p>
                                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 w-full max-w-lg">
                                                            {[
                                                                'What are the most critical action items?',
                                                                'Summarize the key decisions made',
                                                                'What are the biggest risks identified?',
                                                                'Who were the most active participants?'
                                                            ].map((q, idx) => (
                                                                <button
                                                                    key={idx}
                                                                    onClick={() => { setChatQuery(q); }}
                                                                    className="text-left p-3 bg-[#0B0E14] hover:bg-white/10 border border-white/10 hover:border-white/20 rounded-lg text-xs text-slate-300 transition-all"
                                                                >
                                                                    <span className="flex items-center gap-2">
                                                                        <MessageSquare size={12} className="text-white opacity-60" />
                                                                        {q}
                                                                    </span>
                                                                </button>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}

                                                {chatHistory.map((msg, i) => (
                                                    <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                                        {msg.role === 'ai' && (
                                                            <div className="w-7 h-7 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400 border border-blue-500/30 flex-shrink-0">
                                                                <Sparkles size={12} />
                                                            </div>
                                                        )}
                                                        <div className={`max-w-[80%] p-3 rounded-xl text-sm leading-relaxed ${
                                                            msg.role === 'user'
                                                                ? 'bg-blue-600/20 text-white rounded-br-none'
                                                                : 'bg-[#0B0E14] text-slate-200 border border-white/10 rounded-bl-none'
                                                        }`}>
                                                            <p className="whitespace-pre-line">{msg.content}</p>
                                                        </div>
                                                        {msg.role === 'user' && (
                                                            <div className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center text-white flex-shrink-0">
                                                                <User size={12} />
                                                            </div>
                                                        )}
                                                    </div>
                                                ))}
                                                {askingAi && (
                                                    <div className="flex gap-3 justify-start">
                                                        <div className="w-7 h-7 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400 border border-blue-500/30">
                                                            <Sparkles size={12} />
                                                        </div>
                                                        <div className="bg-[#0B0E14] px-3 py-2 rounded-xl rounded-bl-none border border-white/10 flex items-center gap-2">
                                                            <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce"></span>
                                                            <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></span>
                                                            <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></span>
                                                        </div>
                                                    </div>
                                                )}
                                                <div ref={chatEndRef}></div>
                                            </div>

                                            {/* Chat Input */}
                                            <div className="p-4 bg-[#0B0E14] border-t border-white/5">
                                                <form onSubmit={handleAskAi} className="relative">
                                                    <input
                                                        type="text"
                                                        value={chatQuery}
                                                        onChange={(e) => setChatQuery(e.target.value)}
                                                        placeholder="Ask anything about the summary..."
                                                        disabled={askingAi}
                                                        className="w-full bg-[#1C1F2E] border border-white/10 rounded-xl pl-4 pr-12 py-3 text-sm text-white focus:outline-none focus:border-blue-500/50 transition-all placeholder:text-slate-500 disabled:opacity-50"
                                                    />
                                                    <button
                                                        type="submit"
                                                        disabled={!chatQuery.trim() || askingAi}
                                                        className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-blue-600/20 hover:bg-blue-600/40 text-blue-400 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                                                    >
                                                        <Send size={16} />
                                                    </button>
                                                </form>
                                            </div>
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    </div>
                )}

                {/* Empty State - no meetings at all */}
                {showHome && meetings.length === 0 && (
                    <div className="bg-[#1C1F2E] rounded-2xl border border-white/5 p-16 flex flex-col items-center justify-center text-center">
                        <FileText size={56} className="text-slate-600 mb-4" />
                        <h3 className="text-lg font-bold text-slate-400 mb-2">No meetings available</h3>
                        <p className="text-sm text-slate-500 max-w-md">
                            Complete a meeting with transcription first, then come back to generate AI-powered summaries.
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
};

const StatCard = ({ label, value, icon }) => (
    <div className="bg-[#0B0E14] p-4 rounded-xl border border-white/5 flex items-center gap-3">
        <div className="p-2 bg-white/5 rounded-lg">
            {icon}
        </div>
        <div>
            <p className="text-slate-500 text-xs font-semibold uppercase tracking-wider">{label}</p>
            <p className="text-xl font-bold text-white">{value || 0}</p>
        </div>
    </div>
);

const CopyBtn = ({ text, label, copied, onCopy, copyKey }) => (
    <button
        onClick={() => onCopy(text, copyKey)}
        className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white rounded-lg text-xs font-medium transition-colors"
    >
        {copied === copyKey ? <Check size={12} className="text-blue-400" /> : <Copy size={12} />}
        {copied === copyKey ? 'Copied!' : label}
    </button>
);

export default SummaryPage;
