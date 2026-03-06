import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Loader from '../components/Loader';

const API_URL = 'http://localhost:3000';

// Stat Card Component
const StatCard = ({ icon, value, label, change, changeType = 'positive' }) => {
    return (
        <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-xl p-6 hover:bg-white/8 transition-all duration-300 hover:border-white/20">
            <div className="flex items-start justify-between mb-4">
                <div className="p-3 bg-white/5 rounded-lg border border-white/10">
                    {icon}
                </div>
                {change && (
                    <div className={`flex items-center gap-1 text-xs font-semibold ${changeType === 'positive' ? 'text-emerald-400' : 'text-red-400'}`}>
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className={changeType === 'positive' ? 'rotate-[45deg]' : '-rotate-[45deg]'}>
                            <path d={changeType === 'positive' ? "M6 2L6 10M6 2L3 5M6 2L9 5" : "M6 10L6 2M6 10L3 7M6 10L9 7"} stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                        {change}
                    </div>
                )}
            </div>
            <div className="space-y-1">
                <div className="text-3xl font-bold text-white">{value}</div>
                <div className="text-sm text-slate-400">{label}</div>
            </div>
        </div>
    );
};

// Meeting List Item Component
const MeetingItem = ({ meeting, isLive = false, onStopBot, getPlatformFromLink, formatDuration }) => {
    const getPlatformIcon = (platform) => {
        switch (platform?.toLowerCase()) {
            case 'zoom':
                return (
                    <div className="w-10 h-10 bg-white/5 rounded-full flex items-center justify-center border border-white/10">
                        <span className="text-white font-bold text-xs">Z</span>
                    </div>
                );
            case 'meet':
            case 'google meet':
                return (
                    <div className="w-10 h-10 bg-white/5 rounded-full flex items-center justify-center border border-white/10">
                        <span className="text-white font-bold text-xs">G</span>
                    </div>
                );
            case 'teams':
            case 'microsoft teams':
                return (
                    <div className="w-10 h-10 bg-white/5 rounded-full flex items-center justify-center border border-white/10">
                        <span className="text-white font-bold text-xs">T</span>
                    </div>
                );
            default:
                return (
                    <div className="w-10 h-10 bg-white/5 rounded-full flex items-center justify-center border border-white/10">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-white">
                            <path d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                    </div>
                );
        }
    };

    // Live meetings display
    if (isLive) {
        const platform = getPlatformFromLink(meeting.meetingLink);
        const duration = formatDuration(meeting.createdAt);

        return (
            <div className="flex items-center justify-between p-4 bg-white/5 rounded-lg border border-white/5 hover:bg-white/8 hover:border-white/20 transition-all duration-300 group">
                <div className="flex items-center gap-3 flex-1">
                    {getPlatformIcon(platform)}
                    <div className="flex-1">
                        <div className="text-white font-medium">{meeting.topic || 'Live Meeting'}</div>
                        <div className="flex items-center gap-2 text-xs text-slate-400 mt-1">
                            <span className="flex items-center gap-1">
                                <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></div>
                                In Progress
                            </span>
                            <span className="text-slate-500">•</span>
                            <span>{duration}</span>
                            <span className="text-slate-500">•</span>
                            <span className="capitalize">{meeting.status.replace('-', ' ')}</span>
                        </div>
                    </div>
                </div>
                <button
                    onClick={() => onStopBot(meeting._id)}
                    className="px-4 py-2 bg-red-500/20 text-red-400 rounded-lg text-sm font-medium hover:bg-red-500/30 transition-all duration-200 border border-red-500/30 opacity-0 group-hover:opacity-100"
                >
                    Stop Bot
                </button>
            </div>
        );
    }

    // Recent/completed meetings display 
    const platform = getPlatformFromLink(meeting.meetingLink);
    const duration = formatDuration(meeting.createdAt);

    return (
        <div className="flex items-center justify-between p-4 bg-white/5 rounded-lg border border-white/5 hover:bg-white/8 hover:border-white/20 transition-all duration-300 group">
            <div className="flex items-center gap-3 flex-1">
                {getPlatformIcon(platform)}
                <div className="flex-1">
                    <div className="text-white font-medium">{meeting.topic || 'Meeting Recording'}</div>
                    <div className="flex items-center gap-2 text-xs text-slate-400 mt-1">
                        <span>{new Date(meeting.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                        <span className="text-slate-500">•</span>
                        <span>{duration}</span>
                        <span className="text-slate-500">•</span>
                        <span className={`px-2 py-0.5 rounded text-xs ${meeting.status === 'completed'
                            ? 'bg-white/10 text-white'
                            : 'bg-slate-500/10 text-slate-400'
                            }`}>
                            {meeting.status}
                        </span>
                    </div>
                </div>
            </div>
            <button className="p-2 bg-white/5 rounded-lg hover:bg-white/10 transition-all duration-200 border border-white/10">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" className="text-white">
                    <path d="M8 5v14l11-7z" />
                </svg>
            </button>
        </div>
    );
};

// Quick Action Button Component
const QuickAction = ({ icon, label, description, onClick }) => {
    return (
        <button
            onClick={onClick}
            className="flex items-center gap-3 p-4 bg-white/5 rounded-lg border border-white/5 hover:bg-white/8 hover:border-white/20 transition-all duration-300 w-full text-left group"
        >
            <div className="p-2 bg-white/5 rounded-lg border border-white/10 group-hover:bg-white/10 transition-colors">
                {icon}
            </div>
            <div>
                <div className="text-white font-medium text-sm">{label}</div>
                <div className="text-xs text-slate-400">{description}</div>
            </div>
        </button>
    );
};

// Important Date Item Component
const DateItem = ({ date, month, title, color = 'white' }) => {
    const colorClasses = {
        white: 'bg-white/5 text-white border-white/10',
        red: 'bg-white/5 text-white border-white/10',
        green: 'bg-white/5 text-white border-white/10',
        orange: 'bg-white/5 text-white border-white/10'
    };

    return (
        <div className="flex items-center gap-3 p-3 hover:bg-white/5 rounded-lg transition-all duration-200">
            <div className={`flex flex-col items-center justify-center w-12 h-12 rounded-lg border ${colorClasses[color]}`}>
                <div className="text-[10px] font-bold uppercase">{month}</div>
                <div className="text-lg font-bold">{date}</div>
            </div>
            <div className="flex-1">
                <div className="text-sm text-white">{title}</div>
            </div>
        </div>
    );
};

// Task Item Component
const TaskItem = ({ task, priority = 'medium' }) => {
    const priorityColors = {
        high: 'text-white',
        medium: 'text-slate-300',
        low: 'text-slate-400'
    };

    return (
        <div className="flex items-start gap-3 p-3 hover:bg-white/5 rounded-lg transition-all duration-200 group">
            <div className={`w-1.5 h-1.5 rounded-full mt-2 ${priorityColors[priority]} shadow-[0_0_8px_currentColor]`}></div>
            <div className="flex-1">
                <div className="text-sm text-white">{task.title}</div>
                <div className="text-xs text-slate-400 mt-1">
                    {task.dueDate} • {task.meeting}
                </div>
            </div>
        </div>
    );
};

const Analysis = () => {
    const [stats, setStats] = useState({
        totalBotTime: '0h 0m',
        totalWords: 0,
        totalWordsFormatted: '0 words',
        wordsChange: 0,
        meetingsRecorded: 0,
        meetingsChange: 0,
        actionItems: 0,
        itemsChange: 0,
        teamMembers: 0,
        speakersChange: 0
    });
    const [recentMeetings, setRecentMeetings] = useState([]);
    const [liveMeetings, setLiveMeetings] = useState([]);
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchAnalyticsData();
    }, []);

    const fetchAnalyticsData = async () => {
        try {
            // Fetch user data for personalization
            try {
                const userRes = await axios.get(`${API_URL}/api/auth/verify`);
                setUser(userRes.data.user);
            } catch (err) {
                // User not logged in, that's okay
                console.log('User not authenticated');
            }

            // Fetch dashboard analytics data
            const analyticsRes = await axios.get(`${API_URL}/api/analytics/dashboard`);
            
            // Set stats from analytics endpoint
            if (analyticsRes.data.success) {
                console.log('Analytics data:', analyticsRes.data);
                setStats({
                    totalBotTime: analyticsRes.data.stats?.totalBotTime || '0h 0m',
                    totalWords: analyticsRes.data.stats?.totalWords || 0,
                    totalWordsFormatted: analyticsRes.data.stats?.totalWordsFormatted || '0 words',
                    wordsChange: 56, // Temp test value
                    meetingsRecorded: analyticsRes.data.stats?.meetingsRecorded || 0,
                    meetingsChange: 30, // Temp test value
                    actionItems: analyticsRes.data.stats?.actionItems || 0,
                    itemsChange: analyticsRes.data.stats?.itemsChange || 0,
                    teamMembers: analyticsRes.data.stats?.uniqueSpeakers || 0,
                    speakersChange: analyticsRes.data.stats?.speakersChange || 0
                });
            }

            // Fetch detailed analytics data
            try {
                const detailedRes = await axios.get(`${API_URL}/api/analytics/detailed`);
                if (detailedRes.data.success) {
                    console.log('Detailed analytics:', detailedRes.data);
                    setRecentMeetings(detailedRes.data.recentMeetings || []);
                    setLiveMeetings(detailedRes.data.activeMeetings || []);
                }
            } catch (detailedErr) {
                console.error('Error fetching detailed analytics:', detailedErr.message);
                setRecentMeetings([]);
                setLiveMeetings([]);
            }

            setLoading(false);
        } catch (error) {
            console.error('Error fetching analytics:', error);
            // Set default values on error
            setStats({
                totalBotTime: '0h 0m',
                totalWords: 0,
                totalWordsFormatted: '0 words',
                wordsChange: 0,
                meetingsRecorded: 0,
                meetingsChange: 0,
                actionItems: 0,
                itemsChange: 0,
                teamMembers: 0,
                speakersChange: 0
            });
            setRecentMeetings([]);
            setLiveMeetings([]);
            setLoading(false);
        }
    };

    const handleStopBot = async (meetingId) => {
        try {
            await axios.post(`${API_URL}/api/meetings/${meetingId}/stop`);
            // Refresh data after stopping
            fetchAnalyticsData();
        } catch (error) {
            console.error('Error stopping bot:', error);
            alert('Failed to stop bot. Please try again.');
        }
    };

    const getPlatformFromLink = (link) => {
        if (!link) return 'unknown';
        if (link.includes('zoom.us')) return 'zoom';
        if (link.includes('meet.google.com')) return 'meet';
        if (link.includes('teams.microsoft.com')) return 'teams';
        return 'unknown';
    };

    const formatDuration = (createdAt) => {
        if (!createdAt) return 'Unknown';
        const created = new Date(createdAt);
        const now = new Date();
        const diffMinutes = Math.floor((now - created) / (1000 * 60));

        if (diffMinutes < 1) return 'Just started';
        if (diffMinutes < 60) return `${diffMinutes} min`;

        const hours = Math.floor(diffMinutes / 60);
        const minutes = diffMinutes % 60;
        return `${hours}h ${minutes}m`;
    };

    // Mock important dates
    const importantDates = [
        { date: '20', month: 'DEC', title: 'Sprint Review', color: 'white' },
        { date: '22', month: 'DEC', title: 'Q4 Deadline', color: 'red' },
        { date: '25', month: 'DEC', title: 'Holiday - Office Closed', color: 'green' },
        { date: '2', month: 'JAN', title: 'New Year Kickoff', color: 'orange' }
    ];

    // Mock upcoming tasks
    const upcomingTasks = [
        { title: 'Review API documentation', dueDate: 'Today', meeting: 'Tech Sync', priority: 'high' },
        { title: 'Prepare Q4 presentation slides', dueDate: 'Tomorrow', meeting: 'Q4 Planning', priority: 'medium' },
        { title: 'Update project roadmap', dueDate: 'Dec 20', meeting: 'Sprint Review', priority: 'low' },
        { title: 'Send follow-up email to client', dueDate: 'Dec 21', meeting: 'Client Call', priority: 'high' }
    ];

    if (loading) {
        return <Loader message="Loading analytics..." />;
    }

    return (
        <div className="min-h-screen">
            <div className="max-w-7xl mx-auto px-6 py-8">
                {/* Header */}
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-white mb-2">
                        Welcome back, {user ? user.name.split(' ')[0] : 'Guest'}
                    </h1>
                    <p className="text-slate-400">Here's what's happening with your meetings today.</p>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                    <StatCard
                        icon={
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-white">
                                <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-2 7h.01" />
                            </svg>
                        }
                        value={stats.totalWordsFormatted}
                        label="Total Words Transcribed"
                        change={`${stats.wordsChange > 0 ? '+' : ''}${stats.wordsChange}%`}
                        changeType={stats.wordsChange >= 0 ? 'positive' : 'negative'}
                    />
                    <StatCard
                        icon={
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-white">
                                <path d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                            </svg>
                        }
                        value={stats.meetingsRecorded}
                        label="Meetings Recorded"
                        change={`${stats.meetingsChange > 0 ? '+' : ''}${stats.meetingsChange}%`}
                        changeType={stats.meetingsChange >= 0 ? 'positive' : 'negative'}
                    />
                    <StatCard
                        icon={
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-white">
                                <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                            </svg>
                        }
                        value={stats.actionItems}
                        label="Action Items"
                        change={`${stats.itemsChange > 0 ? '+' : ''}${stats.itemsChange}%`}
                        changeType={stats.itemsChange >= 0 ? 'positive' : 'negative'}
                    />
                    <StatCard
                        icon={
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-white">
                                <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
                                <circle cx="9" cy="7" r="4" />
                                <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
                            </svg>
                        }
                        value={stats.teamMembers}
                        label="Team Members"
                        change={`${stats.speakersChange > 0 ? '+' : ''}${stats.speakersChange}%`}
                        changeType={stats.speakersChange >= 0 ? 'positive' : 'negative'}
                    />
                </div>

                {/* Main Content Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Left Column - Meetings */}
                    <div className="lg:col-span-2 space-y-6">
                        {/* Live Meetings */}
                        <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-xl p-6">
                            <div className="flex items-center justify-between mb-6">
                                <div className="flex items-center gap-2">
                                    <h2 className="text-xl font-bold text-white">Live Meetings</h2>
                                    {liveMeetings.length > 0 && (
                                        <span className="px-2 py-1 bg-red-500/20 text-red-400 text-xs font-bold rounded-full flex items-center gap-1">
                                            <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse"></div>
                                            {liveMeetings.length} Active
                                        </span>
                                    )}
                                </div>
                            </div>
                            <div className="space-y-3">
                                {liveMeetings.length > 0 ? (
                                    liveMeetings.map((meeting) => (
                                        <MeetingItem
                                            key={meeting._id}
                                            meeting={meeting}
                                            isLive={true}
                                            onStopBot={handleStopBot}
                                            getPlatformFromLink={getPlatformFromLink}
                                            formatDuration={formatDuration}
                                        />
                                    ))
                                ) : (
                                    <div className="text-center py-8 text-slate-400">
                                        No live meetings. Start a bot from the <a href="/" className="text-white hover:underline">Home page</a>.
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Recent Meetings */}
                        <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-xl p-6">
                            <div className="flex items-center justify-between mb-6">
                                <h2 className="text-xl font-bold text-white">Recent Meetings</h2>
                                <a
                                    href="/dashboard"
                                    className="flex items-center gap-1 text-white text-sm font-medium hover:text-slate-300 transition-colors"
                                >
                                    View all
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d="M5 12h14M12 5l7 7-7 7" />
                                    </svg>
                                </a>
                            </div>
                            <div className="space-y-3">
                                {recentMeetings.length > 0 ? (
                                    recentMeetings.map((meeting) => (
                                        <MeetingItem
                                            key={meeting._id}
                                            meeting={meeting}
                                            getPlatformFromLink={getPlatformFromLink}
                                            formatDuration={formatDuration}
                                        />
                                    ))
                                ) : (
                                    <div className="text-center py-8 text-slate-400">
                                        No recent meetings found
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Right Column - Sidebar */}
                    <div className="space-y-6">
                        {/* Quick Actions */}
                        <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-xl p-6">
                            <h2 className="text-xl font-bold text-white mb-6">Quick Actions</h2>
                            <div className="space-y-3">
                                <QuickAction
                                    icon={
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-white">
                                            <circle cx="12" cy="12" r="10" />
                                            <path d="M12 6v6l4 2" />
                                        </svg>
                                    }
                                    label="Summon Bot"
                                    description="Join a meeting with AI"
                                    onClick={() => window.location.href = '/'}
                                />
                                <QuickAction
                                    icon={
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-white">
                                            <path d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                        </svg>
                                    }
                                    label="View Meetings"
                                    description="Browse all recordings"
                                    onClick={() => window.location.href = '/dashboard'}
                                />
                                <QuickAction
                                    icon={
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-white">
                                            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                                            <path d="M16 2v4M8 2v4M3 10h18" />
                                        </svg>
                                    }
                                    label="Connect Calendar"
                                    description="Sync your schedule"
                                    onClick={() => window.location.href = '/settings'}
                                />
                            </div>
                        </div>

                        {/* Important Dates */}
                        <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-xl p-6">
                            <h2 className="text-xl font-bold text-white mb-6">Important Dates</h2>
                            <div className="space-y-2">
                                {importantDates.map((date, idx) => (
                                    <DateItem key={idx} {...date} />
                                ))}
                            </div>
                        </div>

                        {/* Upcoming Tasks */}
                        <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-xl p-6">
                            <h2 className="text-xl font-bold text-white mb-6">Upcoming Tasks</h2>
                            <div className="space-y-2">
                                {upcomingTasks.map((task, idx) => (
                                    <TaskItem key={idx} task={task} priority={task.priority} />
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Analysis;
