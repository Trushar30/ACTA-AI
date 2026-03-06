import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import {
    FileText, Loader2, Sparkles, Check, ChevronDown, Search, X,
    Users, Clock, Calendar, CheckCircle2, AlertTriangle, BarChart2,
    TrendingUp, MessageSquare, Target, Zap, ShieldCheck, Copy
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const API_URL = 'http://localhost:3000';

const SummaryPage = () => {
    const navigate = useNavigate();
    const [meetings, setMeetings] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedMeetings, setSelectedMeetings] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [dropdownOpen, setDropdownOpen] = useState(false);
    const [generating, setGenerating] = useState(false);
    const [summary, setSummary] = useState(null);
    const [error, setError] = useState(null);
    const [copied, setCopied] = useState(null);

    useEffect(() => {
        fetchMeetings();
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

    const selectAll = () => {
        if (selectedMeetings.length === filteredMeetings.length) {
            setSelectedMeetings([]);
        } else {
            setSelectedMeetings(filteredMeetings.map(m => m._id));
        }
    };

    const filteredMeetings = meetings.filter(m => {
        const query = searchQuery.toLowerCase();
        return (
            (m.meetingName || '').toLowerCase().includes(query) ||
            (m.topic || '').toLowerCase().includes(query) ||
            (m.meetingLink || '').toLowerCase().includes(query)
        );
    });

    const handleGenerateSummary = async () => {
        if (selectedMeetings.length === 0) return;
        setGenerating(true);
        setError(null);
        setSummary(null);

        try {
            const res = await axios.post(`${API_URL}/api/meetings/combined-summary`, {
                meetingIds: selectedMeetings
            });
            if (res.data.success) {
                setSummary(res.data.summary);
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

    const handleCopy = (text, key) => {
        navigator.clipboard.writeText(text);
        setCopied(key);
        setTimeout(() => setCopied(null), 2000);
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

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-white animate-spin" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#0B0E14]">
            <div className="max-w-7xl mx-auto px-6 py-10">
                {/* Header */}
                <div className="mb-10">
                    <h1 className="text-4xl font-bold text-white mb-2">Combined Summary</h1>
                    <p className="text-slate-400">Select multiple meetings and generate a comprehensive combined analysis</p>
                </div>

                {/* Meeting Selector */}
                <div className="bg-[#1C1F2E] rounded-2xl border border-white/5 p-6 mb-8">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-lg font-bold text-white flex items-center gap-2">
                            <FileText size={20} className="text-slate-400" />
                            Select Meetings
                        </h2>
                        <span className="text-sm text-slate-400">
                            {selectedMeetings.length} selected
                        </span>
                    </div>

                    {/* Selected Meeting Tags */}
                    {selectedMeetings.length > 0 && (
                        <div className="flex flex-wrap gap-2 mb-4">
                            {getSelectedMeetingDetails().map(m => (
                                <div
                                    key={m._id}
                                    className="flex items-center gap-2 px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-sm text-emerald-400"
                                >
                                    <span className="max-w-[200px] truncate">{m.meetingName || m.topic || 'Untitled'}</span>
                                    <button
                                        onClick={() => removeMeeting(m._id)}
                                        className="hover:text-emerald-300 transition-colors"
                                    >
                                        <X size={14} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Dropdown Trigger */}
                    <div className="relative">
                        <button
                            onClick={() => setDropdownOpen(!dropdownOpen)}
                            className="w-full flex items-center justify-between px-4 py-3 bg-[#0B0E14] border border-white/10 rounded-xl text-sm text-slate-300 hover:border-white/20 transition-colors"
                        >
                            <span>{dropdownOpen ? 'Close meeting list' : 'Click to select meetings...'}</span>
                            <ChevronDown size={18} className={`text-slate-400 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
                        </button>

                        <AnimatePresence>
                            {dropdownOpen && (
                                <motion.div
                                    initial={{ opacity: 0, y: -10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -10 }}
                                    className="absolute z-50 w-full mt-2 bg-[#0B0E14] border border-white/10 rounded-xl shadow-2xl overflow-hidden"
                                >
                                    {/* Search */}
                                    <div className="p-3 border-b border-white/5">
                                        <div className="relative">
                                            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                                            <input
                                                type="text"
                                                value={searchQuery}
                                                onChange={(e) => setSearchQuery(e.target.value)}
                                                placeholder="Search meetings..."
                                                className="w-full bg-[#1C1F2E] border border-white/5 rounded-lg pl-10 pr-4 py-2.5 text-sm text-white focus:outline-none focus:border-white/20 placeholder:text-slate-500"
                                            />
                                        </div>
                                    </div>

                                    {/* Select All */}
                                    <div className="px-3 py-2 border-b border-white/5">
                                        <button
                                            onClick={selectAll}
                                            className="text-xs text-slate-400 hover:text-white transition-colors"
                                        >
                                            {selectedMeetings.length === filteredMeetings.length ? 'Deselect All' : 'Select All'}
                                        </button>
                                    </div>

                                    {/* Meeting List */}
                                    <div className="max-h-[300px] overflow-y-auto custom-scrollbar">
                                        {filteredMeetings.length > 0 ? (
                                            filteredMeetings.map(meeting => {
                                                const isSelected = selectedMeetings.includes(meeting._id);
                                                return (
                                                    <button
                                                        key={meeting._id}
                                                        onClick={() => toggleMeeting(meeting._id)}
                                                        className={`w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-white/5 transition-colors ${isSelected ? 'bg-emerald-500/5' : ''}`}
                                                    >
                                                        <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${isSelected ? 'bg-emerald-500 border-emerald-500' : 'border-white/20'
                                                            }`}>
                                                            {isSelected && <Check size={12} className="text-white" />}
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <p className="text-sm font-medium text-white truncate">
                                                                {meeting.meetingName || meeting.topic || 'Untitled Meeting'}
                                                            </p>
                                                            <div className="flex items-center gap-3 text-xs text-slate-500 mt-0.5">
                                                                <span>{formatDate(meeting.createdAt)}</span>
                                                                <span className="capitalize">{meeting.platform || 'unknown'}</span>
                                                            </div>
                                                        </div>
                                                    </button>
                                                );
                                            })
                                        ) : (
                                            <div className="px-4 py-8 text-center text-sm text-slate-500">
                                                No meetings found
                                            </div>
                                        )}
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>

                    {/* Generate Button */}
                    <div className="mt-6 flex items-center gap-4">
                        <button
                            onClick={handleGenerateSummary}
                            disabled={selectedMeetings.length === 0 || generating}
                            className="flex items-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                            {generating ? (
                                <>
                                    <Loader2 size={18} className="animate-spin" />
                                    Generating Summary...
                                </>
                            ) : (
                                <>
                                    <Sparkles size={18} />
                                    Generate Combined Summary
                                </>
                            )}
                        </button>
                        {selectedMeetings.length > 0 && !generating && (
                            <span className="text-sm text-slate-400">
                                {selectedMeetings.length} meeting{selectedMeetings.length > 1 ? 's' : ''} selected
                            </span>
                        )}
                    </div>
                </div>

                {/* Error */}
                {error && (
                    <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 mb-8 flex items-center gap-3">
                        <AlertTriangle size={20} className="text-red-400 flex-shrink-0" />
                        <p className="text-sm text-red-400">{error}</p>
                    </div>
                )}

                {/* Generating Animation */}
                {generating && (
                    <div className="bg-[#1C1F2E] rounded-2xl border border-white/5 p-16 mb-8 flex flex-col items-center justify-center">
                        <div className="relative mb-6">
                            <Loader2 size={48} className="text-emerald-400 animate-spin" />
                            <Sparkles size={20} className="text-yellow-400 absolute -top-2 -right-2 animate-pulse" />
                        </div>
                        <h3 className="text-xl font-bold text-white mb-2">Analyzing {selectedMeetings.length} Meeting{selectedMeetings.length > 1 ? 's' : ''}...</h3>
                        <p className="text-sm text-slate-400 text-center max-w-md">
                            AI is processing all transcripts, extracting insights, and creating a comprehensive combined summary.
                        </p>
                    </div>
                )}

                {/* Summary Result */}
                {summary && !generating && (
                    <div className="space-y-6">
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
                                <div className="flex items-center justify-between mb-3">
                                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                                        <Sparkles size={18} className="text-emerald-400" />
                                        Executive Summary
                                    </h3>
                                    <CopyBtn text={summary.executiveSummary} label="Copy" copied={copied} onCopy={handleCopy} copyKey="exec" />
                                </div>
                                <p className="text-slate-300 text-sm leading-relaxed whitespace-pre-line">
                                    {summary.executiveSummary}
                                </p>
                            </div>
                        </div>

                        {/* Meeting Breakdown */}
                        <div className="bg-[#1C1F2E] rounded-2xl border border-white/5 p-8">
                            <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                                <BarChart2 size={18} className="text-slate-400" />
                                Meeting-by-Meeting Breakdown
                            </h3>
                            <div className="space-y-4">
                                {summary.meetingBreakdowns?.map((mb, i) => (
                                    <div key={i} className="bg-[#0B0E14] rounded-xl border border-white/5 p-5">
                                        <div className="flex items-start justify-between mb-3">
                                            <div>
                                                <h4 className="text-base font-semibold text-white">{mb.title}</h4>
                                                <p className="text-xs text-slate-500 mt-0.5">{mb.date}</p>
                                            </div>
                                            <span className="text-xs px-2 py-1 bg-white/5 rounded-lg text-slate-400">
                                                {mb.participantCount} participants
                                            </span>
                                        </div>
                                        <p className="text-sm text-slate-300 leading-relaxed">{mb.summary}</p>
                                        {mb.keyDecisions?.length > 0 && (
                                            <div className="mt-3 flex flex-wrap gap-2">
                                                {mb.keyDecisions.map((d, j) => (
                                                    <span key={j} className="text-xs px-2 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-emerald-400">
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
                                        const colors = ['bg-purple-500', 'bg-emerald-500', 'bg-amber-500', 'bg-blue-500', 'bg-pink-500', 'bg-cyan-500'];
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
                                <div className="space-y-3 max-h-[400px] overflow-y-auto custom-scrollbar">
                                    {summary.allActionItems?.map((task, i) => (
                                        <div key={i} className="flex items-start gap-3 p-3 bg-[#0B0E14] rounded-xl border border-white/5">
                                            <CheckCircle2 size={16} className="text-slate-500 mt-0.5 flex-shrink-0" />
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm text-slate-200">{task.task}</p>
                                                <div className="flex items-center gap-2 mt-1">
                                                    {task.owner && (
                                                        <span className="text-xs text-slate-500">{task.owner}</span>
                                                    )}
                                                    {task.priority && (
                                                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold uppercase ${task.priority === 'High' ? 'bg-red-500/10 text-red-400' :
                                                            task.priority === 'Medium' ? 'bg-amber-500/10 text-amber-400' : 'bg-blue-500/10 text-blue-400'
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
                                    {!summary.allActionItems?.length && <p className="text-slate-500 text-sm">No action items found</p>}
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
                                <div className="space-y-3 max-h-[400px] overflow-y-auto custom-scrollbar">
                                    {summary.allDecisions?.map((d, i) => (
                                        <div key={i} className="p-4 bg-[#0B0E14] rounded-xl border border-white/5">
                                            <p className="text-sm text-slate-200 font-medium">{d.conclusion}</p>
                                            {d.rationale && (
                                                <p className="text-xs text-slate-500 mt-1">{d.rationale}</p>
                                            )}
                                            {d.fromMeeting && (
                                                <p className="text-[10px] text-slate-600 mt-2">from: {d.fromMeeting}</p>
                                            )}
                                        </div>
                                    ))}
                                    {!summary.allDecisions?.length && <p className="text-slate-500 text-sm">No decisions recorded</p>}
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
                                        <Zap size={18} className="text-emerald-400" />
                                        Recommendations & Next Steps
                                    </h3>
                                    <CopyBtn text={summary.recommendations} label="Copy" copied={copied} onCopy={handleCopy} copyKey="recs" />
                                </div>
                                <p className="text-slate-300 text-sm leading-relaxed whitespace-pre-line">
                                    {summary.recommendations}
                                </p>
                            </div>
                        )}
                    </div>
                )}

                {/* Empty State */}
                {!summary && !generating && !error && (
                    <div className="bg-[#1C1F2E] rounded-2xl border border-white/5 p-16 flex flex-col items-center justify-center text-center">
                        <FileText size={64} className="text-slate-500 mb-4 opacity-20" />
                        <h3 className="text-xl font-bold text-slate-400 mb-2">Select Meetings to Begin</h3>
                        <p className="text-sm text-slate-500 max-w-md">
                            Choose one or more past meetings from the dropdown above and click "Generate Combined Summary" to create a comprehensive analysis across all selected meetings.
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
        {copied === copyKey ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
        {copied === copyKey ? 'Copied!' : label}
    </button>
);

export default SummaryPage;
