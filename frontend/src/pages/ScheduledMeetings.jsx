import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Calendar, Clock, Plus, X, Trash2, ExternalLink, Video, Loader2, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Loader from '../components/Loader';

// Import Platform Logos
import googleMeetLogo from '../assets/google-meet.png';
import teamsLogo from '../assets/teams.png';
import zoomLogo from '../assets/zoom.png';

const API_URL = 'http://localhost:3000';

const ScheduledMeetings = () => {
    const navigate = useNavigate();
    const [scheduledMeetings, setScheduledMeetings] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showCreateForm, setShowCreateForm] = useState(false);
    const [creating, setCreating] = useState(false);
    const [schedulerStatus, setSchedulerStatus] = useState(null);

    // Gemini AI state
    const [showGeminiModal, setShowGeminiModal] = useState(false);
    const [geminiPrompt, setGeminiPrompt] = useState('');
    const [generatingWithGemini, setGeneratingWithGemini] = useState(false);

    // Form state
    const [formData, setFormData] = useState({
        meetingType: 'zoom',
        meetingLink: '',
        scheduledTime: '',
        title: ''
    });

    useEffect(() => {
        fetchScheduledMeetings();
        fetchSchedulerStatus();

        // Poll scheduler status every 30 seconds
        const statusInterval = setInterval(fetchSchedulerStatus, 30000);

        // Refresh meetings list every 60 seconds to remove expired ones
        const meetingsInterval = setInterval(fetchScheduledMeetings, 60000);

        return () => {
            clearInterval(statusInterval);
            clearInterval(meetingsInterval);
        };
    }, []);

    const fetchSchedulerStatus = async () => {
        try {
            const res = await axios.get(`${API_URL}/api/scheduler/status`);
            setSchedulerStatus(res.data);
        } catch (err) {
            console.error('Error fetching scheduler status:', err);
        }
    };

    const fetchScheduledMeetings = async () => {
        setLoading(true);
        try {
            const res = await axios.get(`${API_URL}/api/scheduled-meetings`);
            if (res.data.success) {
                // Filter meetings based on status and time
                const now = new Date();
                const thirtyMinutesAgo = new Date(now.getTime() - 30 * 60000);
                const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60000);
                const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60000);

                const activeMeetings = res.data.meetings.filter(meeting => {
                    const scheduledTime = new Date(meeting.scheduledTime);

                    // Filter logic for all meeting types (Zoom, Meet, Teams)
                    if (meeting.status === 'scheduled') {
                        // Show scheduled meetings that are NOT expired (within 30 min grace period)
                        return scheduledTime >= thirtyMinutesAgo;
                    } else if (meeting.status === 'completed') {
                        // Show completed meetings for up to 7 days
                        return scheduledTime >= sevenDaysAgo;
                    } else if (meeting.status === 'cancelled') {
                        // Show cancelled meetings for up to 1 day
                        return scheduledTime >= oneDayAgo;
                    }

                    return true; // Keep other statuses
                });

                setScheduledMeetings(activeMeetings);
            }
        } catch (err) {
            console.error('Error fetching scheduled meetings:', err);
        } finally {
            setLoading(false);
        }
    };

    const detectMeetingType = (link) => {
        if (!link) return 'zoom'; // Default

        const lowerLink = link.toLowerCase();

        if (lowerLink.includes('zoom.us') || lowerLink.includes('zoom.')) {
            return 'zoom';
        } else if (lowerLink.includes('meet.google.com') || lowerLink.includes('meet.')) {
            return 'meet';
        } else if (lowerLink.includes('teams.microsoft.com') || lowerLink.includes('teams.')) {
            return 'teams';
        }

        return formData.meetingType; // Keep current if not detected
    };

    const handleLinkChange = (link) => {
        const detectedType = detectMeetingType(link);
        setFormData({
            ...formData,
            meetingLink: link,
            meetingType: detectedType
        });
    };

    const handleCreateMeeting = async (e) => {
        e.preventDefault();

        if (!formData.meetingLink || !formData.scheduledTime) {
            alert('Please fill in all required fields');
            return;
        }

        setCreating(true);
        try {
            const res = await axios.post(`${API_URL}/api/scheduled-meetings`, formData);
            if (res.data.success) {
                setScheduledMeetings([...scheduledMeetings, res.data.meeting]);
                setShowCreateForm(false);
                setFormData({
                    meetingType: 'zoom',
                    meetingLink: '',
                    scheduledTime: '',
                    title: ''
                });
            }
        } catch (err) {
            alert(err.response?.data?.error || 'Failed to create scheduled meeting');
        } finally {
            setCreating(false);
        }
    };

    const handleGenerateWithGemini = async () => {
        if (!geminiPrompt.trim()) {
            alert('Please enter a prompt for Gemini AI');
            return;
        }

        setGeneratingWithGemini(true);
        try {
            const res = await axios.post(`${API_URL}/api/scheduled-meetings/gemini/generate`, {
                prompt: geminiPrompt
            });

            if (res.data.success) {
                const generatedMeeting = res.data.meeting;

                // Directly create the meeting without showing the form
                const createRes = await axios.post(`${API_URL}/api/scheduled-meetings`, {
                    title: generatedMeeting.title || 'Scheduled Meeting',
                    meetingType: generatedMeeting.meetingType || 'zoom',
                    meetingLink: generatedMeeting.meetingLink || '',
                    scheduledTime: generatedMeeting.scheduledTime
                });

                if (createRes.data.success) {
                    setScheduledMeetings([...scheduledMeetings, createRes.data.meeting]);
                    setShowGeminiModal(false);
                    setGeminiPrompt('');
                    alert('✨ Meeting scheduled successfully!');
                }
            }
        } catch (err) {
            alert(err.response?.data?.error || 'Failed to generate meeting with AI Bot');
        } finally {
            setGeneratingWithGemini(false);
        }
    };

    const handleDeleteMeeting = async (id) => {
        if (!confirm('Delete this scheduled meeting?')) return;

        try {
            await axios.delete(`${API_URL}/api/scheduled-meetings/${id}`);
            setScheduledMeetings(scheduledMeetings.filter(m => m._id !== id));
        } catch (err) {
            alert('Failed to delete scheduled meeting');
        }
    };

    const handleTriggerMeeting = async (id, title) => {
        if (!confirm(`Start bot for "${title || 'this meeting'}" now?`)) return;

        try {
            const res = await axios.post(`${API_URL}/api/scheduled-meetings/${id}/trigger`);
            if (res.data.success) {
                alert('Bot launched! Check "My Meetings" dashboard.');
                // Refresh to update status
                fetchScheduledMeetings();
            }
        } catch (err) {
            alert(err.response?.data?.error || 'Failed to trigger meeting');
        }
    };

    const getMeetingTypeDetails = (type) => {
        switch (type) {
            case 'zoom':
                return {
                    name: 'Zoom',
                    logo: zoomLogo,
                    color: 'text-white',
                    bgColor: 'bg-white/5',
                    borderColor: 'border-white/10'
                };
            case 'meet':
                return {
                    name: 'Google Meet',
                    logo: googleMeetLogo,
                    color: 'text-white',
                    bgColor: 'bg-white/5',
                    borderColor: 'border-white/10'
                };
            case 'teams':
                return {
                    name: 'Microsoft Teams',
                    logo: teamsLogo,
                    color: 'text-white',
                    bgColor: 'bg-white/5',
                    borderColor: 'border-white/10'
                };
            default:
                return {
                    name: 'Meeting',
                    logo: null,
                    color: 'text-white',
                    bgColor: 'bg-white/5',
                    borderColor: 'border-white/10'
                };
        }
    };

    const formatDateTime = (dateString) => {
        const date = new Date(dateString);
        return {
            date: date.toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric'
            }),
            time: date.toLocaleTimeString('en-US', {
                hour: '2-digit',
                minute: '2-digit'
            })
        };
    };

    if (loading) {
        return <Loader message="Loading scheduled meetings..." />;
    }

    return (
        <div className="max-w-[1400px] mx-auto w-full px-6 py-8">
            {/* Header */}
            <header className="flex items-center justify-between gap-8 mb-10">
                <div className="flex items-center gap-4 flex-shrink-0">
                    <h1 className="text-3xl font-bold tracking-tight text-white">Scheduled Meetings</h1>
                    <div className="h-6 w-px bg-white/10"></div>
                    <div className="flex items-center gap-3">
                        {schedulerStatus && (
                            <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-full">
                                <div className={`w-1.5 h-1.5 rounded-full ${schedulerStatus.running ? 'bg-emerald-400 animate-pulse' : 'bg-gray-500'}`} />
                                <span className="text-xs text-emerald-400 font-medium">
                                    {schedulerStatus.running ? 'Auto-Join Active' : 'Scheduler Offline'}
                                </span>
                            </div>
                        )}
                    </div>
                </div>
                <div className="flex items-center gap-3">
                        <button
                            onClick={() => setShowGeminiModal(true)}
                            className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                                showGeminiModal 
                                    ? 'bg-purple-500/20 border-2 border-purple-500/50 text-purple-400 shadow-[0_0_20px_rgba(168,85,247,0.2)]' 
                                    : 'bg-white/5 border border-white/10 text-gray-400 hover:bg-white/10 hover:text-white'
                            }`}
                            title="Generate with Gemini AI"
                        >
                            <Sparkles size={16} className={showGeminiModal ? 'animate-pulse' : ''} />
                        </button>
                        <button
                            onClick={() => setShowCreateForm(true)}
                            className="flex items-center gap-2 px-4 py-2.5 bg-white text-black hover:bg-slate-200 rounded-md transition-all font-semibold text-sm shadow-lg"
                        >
                            <Plus size={18} />
                            Create Schedule
                        </button>
                </div>
            </header>

            {/* Main Content */}
            <main>
                {scheduledMeetings.length === 0 ? (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="text-center py-20 text-gray-500 border border-dashed border-white/10 rounded-3xl bg-white/5"
                    >
                        <Calendar size={60} className="mx-auto mb-4 opacity-30" />
                        <h3 className="text-xl mb-2 font-semibold text-gray-400">No Scheduled Meetings</h3>
                        <p className="text-sm mb-4">
                            Create your first scheduled meeting to get started.
                        </p>
                        <button
                            onClick={() => setShowCreateForm(true)}
                            className="inline-flex items-center gap-2 px-5 py-2.5 bg-white text-black hover:bg-slate-200 rounded-md transition-all font-semibold text-sm shadow-lg"
                        >
                            <Plus size={18} />
                            Create Schedule
                        </button>
                    </motion.div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
                        {scheduledMeetings.map((meeting, index) => {
                            const details = getMeetingTypeDetails(meeting.meetingType);
                            const { date, time } = formatDateTime(meeting.scheduledTime);

                            return (
                                <motion.div
                                    key={meeting._id}
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: index * 0.05 }}
                                    className="group relative"
                                >
                                    <div className="relative bg-white/5 rounded-xl overflow-hidden border border-white/10 group-hover:border-white/30 transition-all backdrop-blur-sm h-full flex flex-col">
                                        <div className="p-5">
                                            <div className="flex items-start justify-between mb-4">
                                                <div className={`w-10 h-10 rounded-lg ${details.bgColor} border ${details.borderColor} flex items-center justify-center`}>
                                                    {details.logo ? (
                                                        <img src={details.logo} alt={details.name} className="w-6 h-6" />
                                                    ) : (
                                                        <Video size={20} className={details.color} />
                                                    )}
                                                </div>
                                                <button
                                                    onClick={() => handleDeleteMeeting(meeting._id)}
                                                    className="p-1.5 hover:bg-red-500/10 rounded-md text-red-400 hover:text-red-300 transition-colors"
                                                    title="Delete"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>

                                            <h3 className="font-semibold text-white text-base leading-tight line-clamp-2 mb-1">
                                                {meeting.title || 'Scheduled Meeting'}
                                            </h3>
                                            <div className="flex items-center gap-2 mb-3">
                                                <p className={`text-xs ${details.color}`}>{details.name}</p>
                                                {/* Status Badge */}
                                                {meeting.status === 'completed' && (
                                                    <span className="px-2 py-0.5 text-[10px] font-semibold bg-emerald-500/20 text-emerald-400 rounded-full border border-emerald-500/30">
                                                        Completed
                                                    </span>
                                                )}
                                                {meeting.status === 'cancelled' && (
                                                    <span className="px-2 py-0.5 text-[10px] font-semibold bg-white/10 text-white/60 rounded-full border border-white/20">
                                                        Cancelled
                                                    </span>
                                                )}
                                                {meeting.status === 'scheduled' && (
                                                    <span className="px-2 py-0.5 text-[10px] font-semibold bg-white/10 text-white rounded-full border border-white/20">
                                                        Scheduled
                                                    </span>
                                                )}
                                            </div>

                                            <div className="space-y-1.5 mb-4">
                                                <div className="flex items-center gap-2 text-xs text-gray-400">
                                                    <Calendar size={12} />
                                                    {date}
                                                </div>
                                                <div className="flex items-center gap-2 text-xs text-gray-400">
                                                    <Clock size={12} />
                                                    {time}
                                                </div>
                                            </div>

                                            {/* Action Buttons */}
                                            <div className="space-y-2 mt-auto">
                                                {meeting.status === 'scheduled' && (
                                                    <button
                                                        onClick={() => handleTriggerMeeting(meeting._id, meeting.title)}
                                                        className="flex items-center justify-center gap-2 w-full py-2 bg-white text-black hover:bg-slate-200 rounded-md transition-all text-xs font-semibold shadow-md"
                                                    >
                                                        <Video size={12} />
                                                        Start Bot Now
                                                    </button>
                                                )}
                                                <a
                                                    href={meeting.meetingLink}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="flex items-center justify-center gap-2 w-full py-2 bg-white/5 text-white border border-white/10 rounded-md hover:bg-white/10 transition-all text-xs font-medium"
                                                >
                                                    <ExternalLink size={12} />
                                                    Join Meeting
                                                </a>
                                            </div>
                                        </div>
                                    </div>
                                </motion.div>
                            );
                        })}
                    </div>
                )}
            </main>

            {/* Create Form Modal */}
            <AnimatePresence>
                {showCreateForm && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/70 backdrop-blur-lg z-50 flex items-center justify-center p-4"
                        onClick={() => setShowCreateForm(false)}
                    >
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0, y: 20 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.9, opacity: 0, y: 20 }}
                            transition={{ duration: 0.3, ease: "easeOut" }}
                            onClick={(e) => e.stopPropagation()}
                            className="max-w-md w-full relative group"
                        >


                            {/* Modal Content */}
                            <div className="relative bg-[#12151C] rounded-xl p-6 border border-white/5 shadow-2xl">
                                {/* Header */}
                                <div className="flex items-center justify-between mb-6">
                                    <h2 className="text-xl font-bold text-white">Create Scheduled Meeting</h2>
                                    <button
                                        onClick={() => setShowCreateForm(false)}
                                        className="p-2 hover:bg-white/10 rounded-lg transition-all hover:rotate-90 duration-300"
                                    >
                                        <X size={20} className="text-gray-400 hover:text-white transition-colors" />
                                    </button>
                                </div>

                                <form onSubmit={handleCreateMeeting} className="space-y-5">
                                    {/* Meeting Title */}
                                    <div>
                                        <label className="block text-sm font-medium text-slate-300 mb-2">
                                            Meeting Title
                                        </label>
                                        <div className="relative">
                                            <input
                                                type="text"
                                                value={formData.title}
                                                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                                placeholder="e.g., Team Standup"
                                                className="w-full px-4 py-3 bg-[#0B0E14] border border-white/10 rounded-lg text-white placeholder-slate-500 focus:border-white/20 focus:outline-none transition-all duration-300"
                                            />
                                        </div>
                                    </div>

                                    {/* Meeting Type */}
                                    <div>
                                        <label className="block text-sm font-medium text-slate-300 mb-2">
                                            Meeting Type * <span className="text-xs text-slate-500">(Auto-detected from link)</span>
                                        </label>
                                        <div className="relative">
                                            <select
                                                value={formData.meetingType}
                                                onChange={(e) => setFormData({ ...formData, meetingType: e.target.value })}
                                                className="w-full px-4 py-3 bg-[#0B0E14] border border-white/10 rounded-lg text-white focus:border-white/20 focus:outline-none transition-all duration-300 cursor-pointer"
                                                required
                                            >
                                                <option value="zoom">Zoom</option>
                                                <option value="meet">Google Meet</option>
                                                <option value="teams">Microsoft Teams</option>
                                            </select>
                                        </div>
                                    </div>

                                    {/* Meeting Link */}
                                    <div>
                                        <label className="block text-sm font-medium text-slate-300 mb-2">
                                            Meeting Link *
                                        </label>
                                        <div className="relative">
                                            <input
                                                type="url"
                                                value={formData.meetingLink}
                                                onChange={(e) => handleLinkChange(e.target.value)}
                                                placeholder="https://zoom.us/j/... or https://meet.google.com/..."
                                                className="w-full px-4 py-3 bg-[#0B0E14] border border-white/10 rounded-lg text-white placeholder-slate-500 focus:border-white/20 focus:outline-none transition-all duration-300"
                                                required
                                            />
                                        </div>
                                        <p className="text-xs text-slate-400 mt-1.5">Meeting type will be auto-detected from the link</p>
                                    </div>

                                    {/* Scheduled Date & Time - Improved UI */}
                                    <div>
                                        <label className="block text-sm font-medium text-slate-300 mb-2">
                                            Scheduled Date & Time *
                                        </label>
                                        <div className="relative bg-[#0B0E14] border border-white/10 rounded-lg overflow-hidden">
                                            <input
                                                type="datetime-local"
                                                value={formData.scheduledTime}
                                                onChange={(e) => setFormData({ ...formData, scheduledTime: e.target.value })}
                                                className="w-full px-4 py-3 bg-transparent text-white focus:outline-none transition-all duration-300 cursor-pointer [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-70 [&::-webkit-calendar-picker-indicator]:hover:opacity-100 [&::-webkit-calendar-picker-indicator]:transition-opacity"
                                                required
                                                min={new Date().toISOString().slice(0, 16)}
                                            />
                                            <Clock size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                                        </div>
                                        <p className="text-xs text-slate-500 mt-1.5">Select the date and time for your meeting</p>
                                    </div>

                                    {/* Action Buttons */}
                                    <div className="flex gap-3 pt-4">
                                        <button
                                            type="button"
                                            onClick={() => setShowCreateForm(false)}
                                            className="flex-1 px-4 py-3 bg-white/5 hover:bg-white/10 text-white rounded-lg transition-all font-medium"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            type="submit"
                                            disabled={creating}
                                            className="flex-1 px-4 py-3 bg-white text-black hover:bg-slate-200 rounded-md font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg hover:scale-[1.02]"
                                        >
                                            {creating ? (
                                                <>
                                                    <Loader2 size={18} className="animate-spin" />
                                                    Creating...
                                                </>
                                            ) : (
                                                <>
                                                    <Plus size={18} />
                                                    Create
                                                </>
                                            )}
                                        </button>
                                    </div>
                                </form>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Gemini AI Modal */}
            <AnimatePresence>
                {showGeminiModal && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/70 backdrop-blur-lg z-50 flex items-center justify-center p-4"
                        onClick={() => setShowGeminiModal(false)}
                    >
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0, y: 20 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.9, opacity: 0, y: 20 }}
                            transition={{ duration: 0.3, ease: "easeOut" }}
                            onClick={(e) => e.stopPropagation()}
                            className="max-w-md w-full relative group"
                        >
                            {/* Gradient Glow Effect */}
                            <div className="absolute -inset-1 bg-gradient-to-r from-white/20 via-white/10 to-white/20 rounded-2xl blur opacity-30 group-hover:opacity-50 transition duration-500"></div>

                            {/* Modal Content */}
                            <div className="relative bg-[#12151C] rounded-2xl p-6 border border-white/10 shadow-2xl">
                                {/* Header */}
                                <div className="flex items-center justify-between mb-6">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center">
                                            <Sparkles size={20} className="text-slate-400" />
                                        </div>
                                        <h2 className="text-xl font-bold text-white">Ask AI</h2>
                                    </div>
                                    <button
                                        onClick={() => setShowGeminiModal(false)}
                                        className="p-2 hover:bg-white/10 rounded-lg transition-all hover:rotate-90 duration-300"
                                    >
                                        <X size={20} className="text-gray-400 hover:text-white transition-colors" />
                                    </button>
                                </div>

                                {/* Content */}
                                <div className="mb-6">
                                    <p className="text-slate-300 text-sm mb-4 leading-relaxed">
                                        Describe the meeting you want to schedule, and I'll generate it for you!
                                    </p>

                                    {/* Example Prompts */}
                                    <div className="bg-white/5 border border-white/10 rounded-xl p-4 mb-5 backdrop-blur-sm">
                                        <p className="text-xs text-white/50 font-semibold mb-2.5 flex items-center gap-1.5">
                                            <span className="text-base">💡</span> Example prompts:
                                        </p>
                                        <ul className="text-xs text-slate-400 space-y-1.5">
                                            <li className="hover:text-slate-300 transition-colors cursor-default">• "Schedule a team standup tomorrow at 10 AM on Zoom"</li>
                                            <li className="hover:text-slate-300 transition-colors cursor-default">• "Create a client review meeting on Google Meet in 2 hours"</li>
                                            <li className="hover:text-slate-300 transition-colors cursor-default">• "Set up a project kickoff on Teams next Monday at 2 PM"</li>
                                        </ul>
                                    </div>

                                    {/* Input Field */}
                                    <label className="block text-sm font-medium text-slate-300 mb-2.5">
                                        Your Prompt
                                    </label>
                                    <div className="relative">
                                        <textarea
                                            value={geminiPrompt}
                                            onChange={(e) => setGeminiPrompt(e.target.value)}
                                            placeholder="e.g., Schedule a team meeting tomorrow at 3 PM on Zoom to discuss Q1 goals"
                                            className="relative w-full px-4 py-3 bg-[#0B0E14] border border-white/10 rounded-lg text-white placeholder-slate-500 focus:border-white/20 focus:outline-none transition-all duration-300 resize-none"
                                            rows="4"
                                            disabled={generatingWithGemini}
                                        />
                                    </div>
                                </div>

                                {/* Action Buttons */}
                                <div className="flex gap-3">
                                    <button
                                        type="button"
                                        onClick={() => setShowGeminiModal(false)}
                                        className="flex-1 px-4 py-3 bg-white/5 hover:bg-white/10 text-white rounded-lg transition-all font-medium"
                                        disabled={generatingWithGemini}
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={handleGenerateWithGemini}
                                        disabled={generatingWithGemini || !geminiPrompt.trim()}
                                        className="flex-1 px-4 py-3 bg-white text-black hover:bg-slate-200 font-semibold rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg hover:scale-[1.02]"
                                    >
                                        {generatingWithGemini ? (
                                            <>
                                                <Loader2 size={18} className="animate-spin" />
                                                Generating...
                                            </>
                                        ) : (
                                            <>
                                                <Sparkles size={18} />
                                                Generate
                                            </>
                                        )}
                                    </button>
                                </div>

                                {/* Footer */}
                                <p className="text-xs text-center text-white/50 mt-4">
                                    Powered by Google Gemini AI
                                </p>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default ScheduledMeetings;
