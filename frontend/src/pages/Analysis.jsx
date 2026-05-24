import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { motion } from 'framer-motion';
import {
    AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
    XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import Loader from '../components/Loader';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

// ─── Animated Counter ────────────────────────────────────────────────
const AnimatedNumber = ({ value, suffix = '' }) => {
    const [display, setDisplay] = useState(0);
    useEffect(() => {
        const num = typeof value === 'number' ? value : parseInt(value) || 0;
        if (num === 0) { setDisplay(0); return; }
        let start = 0;
        const step = Math.max(1, Math.ceil(num / 40));
        const timer = setInterval(() => {
            start += step;
            if (start >= num) { setDisplay(num); clearInterval(timer); }
            else setDisplay(start);
        }, 25);
        return () => clearInterval(timer);
    }, [value]);
    return <>{display.toLocaleString()}{suffix}</>;
};

// ─── KPI Card ────────────────────────────────────────────────────────
const KpiCard = ({ icon, value, label, change, changeType = 'positive', gradient, delay = 0 }) => (
    <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay }}
        className="relative group overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] backdrop-blur-xl p-6 hover:border-white/20 transition-all duration-500"
    >
        {/* Subtle gradient accent */}
        <div className={`absolute -top-12 -right-12 w-32 h-32 rounded-full blur-3xl opacity-20 group-hover:opacity-30 transition-opacity duration-500 ${gradient}`} />

        <div className="relative z-10">
            <div className="flex items-center justify-between mb-4">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-white/[0.06] border border-white/10">
                    {icon}
                </div>
                {change !== undefined && change !== null && (
                    <div className={`flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full ${changeType === 'positive'
                        ? 'bg-emerald-500/15 text-emerald-400'
                        : 'bg-rose-500/15 text-rose-400'
                        }`}>
                        <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                            <path
                                d={changeType === 'positive' ? 'M5 8V2M5 2L2 5M5 2L8 5' : 'M5 2V8M5 8L2 5M5 8L8 5'}
                                stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
                            />
                        </svg>
                        {Math.abs(change)}%
                    </div>
                )}
            </div>
            <div className="text-3xl font-bold text-white tracking-tight">
                {typeof value === 'number' ? <AnimatedNumber value={value} /> : value}
            </div>
            <div className="text-sm text-slate-400 mt-1">{label}</div>
        </div>
    </motion.div>
);

// ─── Chart Card Wrapper ──────────────────────────────────────────────
const ChartCard = ({ title, subtitle, children, delay = 0, className = '' }) => (
    <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay }}
        className={`rounded-2xl border border-white/10 bg-white/[0.04] backdrop-blur-xl p-6 ${className}`}
    >
        <div className="mb-5">
            <h3 className="text-lg font-semibold text-white">{title}</h3>
            {subtitle && <p className="text-sm text-slate-400 mt-0.5">{subtitle}</p>}
        </div>
        {children}
    </motion.div>
);

// ─── Custom Recharts Tooltip ─────────────────────────────────────────
const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    return (
        <div className="bg-[#1a1f2e] border border-white/15 rounded-xl px-4 py-3 shadow-2xl">
            <p className="text-xs text-slate-400 mb-1">{label}</p>
            {payload.map((p, i) => (
                <p key={i} className="text-sm font-semibold" style={{ color: p.color }}>
                    {p.name}: {p.value}
                </p>
            ))}
        </div>
    );
};

// ─── Insight Card ────────────────────────────────────────────────────
const InsightItem = ({ icon, text, type = 'info' }) => {
    const colors = {
        success: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
        warning: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
        info: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
        danger: 'text-rose-400 bg-rose-500/10 border-rose-500/20',
    };
    return (
        <div className={`flex items-start gap-3 p-3.5 rounded-xl border ${colors[type]} transition-all duration-300`}>
            <span className="text-lg mt-0.5 shrink-0">{icon}</span>
            <span className="text-sm leading-relaxed">{text}</span>
        </div>
    );
};

// ─── Recent Meeting Row ──────────────────────────────────────────────
const MeetingRow = ({ meeting, getPlatformFromLink }) => {
    const platform = getPlatformFromLink(meeting.meetingLink);
    const platformLabels = { zoom: 'Zoom', meet: 'Google Meet', teams: 'Teams', unknown: 'Other' };
    const isActive = ['recording', 'in-meeting', 'starting', 'joining'].includes(meeting.status);
    const date = new Date(meeting.createdAt);
    const formattedDate = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const formattedTime = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

    return (
        <div className="flex items-center gap-4 p-3.5 rounded-xl hover:bg-white/[0.04] transition-all duration-300 group">
            {/* Platform icon */}
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xs font-bold border ${isActive
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                : 'bg-white/[0.06] border-white/10 text-white'
                }`}>
                {platform === 'zoom' ? 'Z' : platform === 'meet' ? 'G' : platform === 'teams' ? 'T' : '•'}
            </div>

            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-white truncate">
                        {meeting.topic || platformLabels[platform] + ' Meeting'}
                    </span>
                    {isActive && (
                        <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-emerald-400">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                            Live
                        </span>
                    )}
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
                    <span>{formattedDate}</span>
                    <span>•</span>
                    <span>{formattedTime}</span>
                    {meeting.speakerCount > 0 && (
                        <>
                            <span>•</span>
                            <span>{meeting.speakerCount} speakers</span>
                        </>
                    )}
                </div>
            </div>

            {/* Status badge */}
            <div className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${meeting.status === 'completed'
                ? 'bg-emerald-500/10 text-emerald-400'
                : isActive
                    ? 'bg-blue-500/10 text-blue-400'
                    : 'bg-white/5 text-slate-400'
                }`}>
                {meeting.status}
            </div>
        </div>
    );
};

// ─── Chart colors ────────────────────────────────────────────────────
const CHART_COLORS = {
    blue: '#3b82f6',
    emerald: '#10b981',
    amber: '#f59e0b',
    rose: '#f43f5e',
    purple: '#a855f7',
    cyan: '#06b6d4',
};

const PIE_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#a855f7'];
const PRIORITY_COLORS = { high: '#f43f5e', medium: '#f59e0b', low: '#3b82f6' };

// ═════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═════════════════════════════════════════════════════════════════════
const Analysis = () => {
    const [stats, setStats] = useState(null);
    const [platformStats, setPlatformStats] = useState({});
    const [meetingsInfo, setMeetingsInfo] = useState({});
    const [recentMeetings, setRecentMeetings] = useState([]);
    const [meetingsTrend, setMeetingsTrend] = useState({});
    const [speakerFrequency, setSpeakerFrequency] = useState([]);
    const [taskStats, setTaskStats] = useState({ priorityStats: {}, categoryStats: {}, totalTasks: 0 });
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => { fetchAll(); }, []);

    const fetchAll = async () => {
        try {
            // User
            try {
                const u = await axios.get(`${API_URL}/api/auth/verify`);
                setUser(u.data.user);
            } catch { /* not logged in */ }

            // Dashboard
            const dash = await axios.get(`${API_URL}/api/analytics/dashboard`);
            if (dash.data.success) {
                setStats(dash.data.stats);
                setPlatformStats(dash.data.platformStats || {});
                setMeetingsInfo(dash.data.meetings || {});
            }

            // Detailed
            try {
                const det = await axios.get(`${API_URL}/api/analytics/detailed`);
                if (det.data.success) {
                    setRecentMeetings([
                        ...(det.data.activeMeetings || []),
                        ...(det.data.recentMeetings || [])
                    ]);
                    setMeetingsTrend(det.data.meetingsTrend || {});
                    setSpeakerFrequency(det.data.speakerFrequency || []);
                }
            } catch { }

            // Tasks
            try {
                const tasks = await axios.get(`${API_URL}/api/analytics/tasks`);
                if (tasks.data.success) {
                    setTaskStats({
                        priorityStats: tasks.data.priorityStats || {},
                        categoryStats: tasks.data.categoryStats || {},
                        totalTasks: tasks.data.totalTasks || 0,
                    });
                }
            } catch { }

        } catch (err) {
            console.error('Analytics fetch error:', err);
        } finally {
            setLoading(false);
        }
    };

    const getPlatformFromLink = (link) => {
        if (!link) return 'unknown';
        if (link.includes('zoom.us')) return 'zoom';
        if (link.includes('meet.google.com')) return 'meet';
        if (link.includes('teams.microsoft.com')) return 'teams';
        return 'unknown';
    };

    // ── Derived chart data ───────────────────────────────────────────
    const trendData = useMemo(() => {
        return Object.entries(meetingsTrend).map(([date, count]) => {
            const d = new Date(date);
            return {
                day: d.toLocaleDateString('en-US', { weekday: 'short' }),
                date: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
                meetings: count,
            };
        });
    }, [meetingsTrend]);

    const platformData = useMemo(() => {
        const items = [
            { name: 'Zoom', value: platformStats.zoom || 0 },
            { name: 'Google Meet', value: platformStats.googleMeet || 0 },
            { name: 'Other', value: platformStats.other || 0 },
        ].filter(i => i.value > 0);
        return items.length ? items : [{ name: 'No Data', value: 1 }];
    }, [platformStats]);

    const priorityData = useMemo(() => {
        const p = taskStats.priorityStats;
        return [
            { name: 'High', value: p.high || 0, fill: PRIORITY_COLORS.high },
            { name: 'Medium', value: p.medium || 0, fill: PRIORITY_COLORS.medium },
            { name: 'Low', value: p.low || 0, fill: PRIORITY_COLORS.low },
        ];
    }, [taskStats]);

    const speakerData = useMemo(() => {
        return speakerFrequency.slice(0, 6).map(s => ({
            name: s.name?.length > 12 ? s.name.slice(0, 12) + '…' : s.name,
            meetings: s.count,
        }));
    }, [speakerFrequency]);

    // ── AI Insights ──────────────────────────────────────────────────
    const insights = useMemo(() => {
        if (!stats) return [];
        const items = [];
        const totalMeetings = stats.totalMeetings || 0;

        // Meetings trend
        if (stats.meetingsChange > 0) {
            items.push({ icon: '📈', text: `Meeting activity is up ${stats.meetingsChange}% compared to last week — great momentum!`, type: 'success' });
        } else if (stats.meetingsChange < 0) {
            items.push({ icon: '📉', text: `Meetings decreased by ${Math.abs(stats.meetingsChange)}% this week. Fewer meetings can mean more focused work time.`, type: 'info' });
        }

        // Platform dominance
        const totalPlatform = (platformStats.zoom || 0) + (platformStats.googleMeet || 0) + (platformStats.other || 0);
        if (totalPlatform > 0) {
            const zoomPct = Math.round(((platformStats.zoom || 0) / totalPlatform) * 100);
            const meetPct = Math.round(((platformStats.googleMeet || 0) / totalPlatform) * 100);
            if (zoomPct >= 60) items.push({ icon: '🎥', text: `${zoomPct}% of your meetings happen on Zoom — it's your primary platform.`, type: 'info' });
            else if (meetPct >= 60) items.push({ icon: '🎥', text: `${meetPct}% of your meetings happen on Google Meet — it's your primary platform.`, type: 'info' });
        }

        // Action items
        const highPriority = taskStats.priorityStats?.high || 0;
        if (highPriority > 0) {
            items.push({ icon: '🔴', text: `You have ${highPriority} high-priority action item${highPriority > 1 ? 's' : ''} that need${highPriority === 1 ? 's' : ''} immediate attention.`, type: 'danger' });
        }

        // Words transcribed
        if (stats.totalWords > 10000) {
            items.push({ icon: '📝', text: `Over ${(stats.totalWords / 1000).toFixed(0)}K words transcribed — that's a lot of knowledge captured!`, type: 'success' });
        }

        // Team size
        if ((stats.uniqueSpeakers || 0) >= 5) {
            items.push({ icon: '👥', text: `${stats.uniqueSpeakers} unique team members have been identified across your meetings.`, type: 'info' });
        }

        // Bot time
        if (stats.totalBotMinutes > 60) {
            const hours = Math.floor(stats.totalBotMinutes / 60);
            items.push({ icon: '🤖', text: `ACTA Bot has spent ${hours}+ hours in meetings, so you don't have to.`, type: 'success' });
        }

        // Fallback
        if (items.length === 0) {
            items.push({ icon: '✨', text: 'Start recording meetings to unlock personalized insights and analytics.', type: 'info' });
        }

        return items;
    }, [stats, platformStats, taskStats]);

    // ─── Loading ─────────────────────────────────────────────────────
    if (loading) return <Loader message="Loading analytics..." />;

    const s = stats || {};

    return (
        <div className="min-h-screen">
            <div className="max-w-[1400px] mx-auto px-6 py-8">
                {/* ────── Header ────── */}
                <motion.div
                    initial={{ opacity: 0, y: -12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4 }}
                    className="mb-8"
                >
                    <div className="flex items-center gap-3 mb-2">
                        <div className="w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.6)]" />
                        <span className="text-xs font-bold uppercase tracking-widest text-slate-400">Analytics Dashboard</span>
                    </div>
                    <h1 className="text-3xl font-bold text-white">
                        {user ? `Welcome back, ${user.name.split(' ')[0]}` : 'Analytics Overview'}
                    </h1>
                    <p className="text-slate-400 mt-1">Deep dive into your meeting activity, productivity, and team insights.</p>
                </motion.div>

                {/* ────── KPI Strip ────── */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-8">
                    <KpiCard
                        icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-blue-400"><path d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>}
                        value={s.totalMeetings || 0}
                        label="Total Meetings"
                        change={s.meetingsChange}
                        changeType={s.meetingsChange >= 0 ? 'positive' : 'negative'}
                        gradient="bg-blue-500"
                        delay={0}
                    />
                    <KpiCard
                        icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-emerald-400"><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></svg>}
                        value={s.totalBotTime || '0h'}
                        label="Bot Active Time"
                        gradient="bg-emerald-500"
                        delay={0.05}
                    />
                    <KpiCard
                        icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-purple-400"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" /></svg>}
                        value={s.totalWords || 0}
                        label="Words Transcribed"
                        change={s.wordsChange}
                        changeType={s.wordsChange >= 0 ? 'positive' : 'negative'}
                        gradient="bg-purple-500"
                        delay={0.1}
                    />
                    <KpiCard
                        icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-amber-400"><path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" /></svg>}
                        value={s.actionItems || 0}
                        label="Action Items"
                        change={s.itemsChange}
                        changeType={s.itemsChange >= 0 ? 'positive' : 'negative'}
                        gradient="bg-amber-500"
                        delay={0.15}
                    />
                    <KpiCard
                        icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-cyan-400"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" /></svg>}
                        value={s.uniqueSpeakers || 0}
                        label="Team Members"
                        change={s.speakersChange}
                        changeType={s.speakersChange >= 0 ? 'positive' : 'negative'}
                        gradient="bg-cyan-500"
                        delay={0.2}
                    />
                </div>

                {/* ────── Charts Grid ────── */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">

                    {/* Meeting Activity Trend */}
                    <ChartCard title="Meeting Activity" subtitle="Last 7 days" delay={0.25} className="lg:col-span-2">
                        <div className="h-64">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={trendData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                                    <defs>
                                        <linearGradient id="blueGrad" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="0%" stopColor={CHART_COLORS.blue} stopOpacity={0.3} />
                                            <stop offset="100%" stopColor={CHART_COLORS.blue} stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                                    <XAxis dataKey="day" tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false} />
                                    <YAxis tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false} allowDecimals={false} />
                                    <Tooltip content={<CustomTooltip />} />
                                    <Area type="monotone" dataKey="meetings" name="Meetings" stroke={CHART_COLORS.blue} strokeWidth={2.5} fill="url(#blueGrad)" dot={{ r: 4, fill: CHART_COLORS.blue, strokeWidth: 0 }} activeDot={{ r: 6, fill: CHART_COLORS.blue, stroke: '#1e293b', strokeWidth: 3 }} />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </ChartCard>

                    {/* Platform Distribution */}
                    <ChartCard title="Platform Distribution" subtitle="Where your meetings happen" delay={0.3}>
                        <div className="h-64 flex items-center justify-center">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={platformData}
                                        cx="50%" cy="50%"
                                        innerRadius={55} outerRadius={90}
                                        paddingAngle={4}
                                        dataKey="value"
                                        stroke="none"
                                    >
                                        {platformData.map((_, i) => (
                                            <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip content={<CustomTooltip />} />
                                    <Legend
                                        verticalAlign="bottom"
                                        iconType="circle"
                                        iconSize={8}
                                        formatter={(value) => <span className="text-slate-300 text-xs ml-1">{value}</span>}
                                    />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                    </ChartCard>

                    {/* Task Priority Breakdown */}
                    <ChartCard title="Task Priority Breakdown" subtitle={`${taskStats.totalTasks} total action items`} delay={0.35}>
                        <div className="h-64">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={priorityData} layout="vertical" margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" horizontal={false} />
                                    <XAxis type="number" tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false} allowDecimals={false} />
                                    <YAxis type="category" dataKey="name" tick={{ fill: '#94a3b8', fontSize: 13, fontWeight: 500 }} axisLine={false} tickLine={false} width={65} />
                                    <Tooltip content={<CustomTooltip />} />
                                    <Bar dataKey="value" name="Tasks" radius={[0, 8, 8, 0]} barSize={28}>
                                        {priorityData.map((entry, i) => (
                                            <Cell key={i} fill={entry.fill} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </ChartCard>
                </div>

                {/* ────── Bottom Row: Insights + Speakers + Recent ────── */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                    {/* AI Insights */}
                    <ChartCard title="AI Insights" delay={0.4}>
                        <div className="flex items-center gap-2 mb-4">
                            <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2z" /></svg>
                            </div>
                            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Powered by your data</span>
                        </div>
                        <div className="space-y-3">
                            {insights.map((insight, i) => (
                                <InsightItem key={i} {...insight} />
                            ))}
                        </div>
                    </ChartCard>

                    {/* Speaker Leaderboard */}
                    <ChartCard title="Top Speakers" subtitle="Most active participants" delay={0.45}>
                        {speakerData.length > 0 ? (
                            <div className="h-64">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={speakerData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                                        <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 10 }} axisLine={false} tickLine={false} interval={0} angle={-20} textAnchor="end" height={50} />
                                        <YAxis tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false} allowDecimals={false} />
                                        <Tooltip content={<CustomTooltip />} />
                                        <Bar dataKey="meetings" name="Appearances" radius={[6, 6, 0, 0]} barSize={32}>
                                            {speakerData.map((_, i) => (
                                                <Cell key={i} fill={Object.values(CHART_COLORS)[i % Object.values(CHART_COLORS).length]} />
                                            ))}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        ) : (
                            <div className="h-64 flex items-center justify-center text-slate-500 text-sm">
                                No speaker data available yet
                            </div>
                        )}
                    </ChartCard>

                    {/* Recent Activity */}
                    <ChartCard title="Recent Activity" subtitle={`${recentMeetings.length} meetings`} delay={0.5}>
                        <div className="space-y-1 max-h-72 overflow-y-auto custom-scrollbar">
                            {recentMeetings.length > 0 ? (
                                recentMeetings.slice(0, 8).map((m) => (
                                    <MeetingRow key={m._id} meeting={m} getPlatformFromLink={getPlatformFromLink} />
                                ))
                            ) : (
                                <div className="h-64 flex flex-col items-center justify-center text-slate-500 text-sm gap-3">
                                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-slate-600">
                                        <path d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                    </svg>
                                    <span>No meetings recorded yet</span>
                                    <a href="/" className="text-blue-400 hover:text-blue-300 text-xs font-medium transition-colors">
                                        Start your first meeting →
                                    </a>
                                </div>
                            )}
                        </div>
                    </ChartCard>
                </div>

                {/* ────── Meeting Status Summary ────── */}
                <motion.div
                    initial={{ opacity: 0, y: 24 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.55 }}
                    className="mt-6 rounded-2xl border border-white/10 bg-white/[0.04] backdrop-blur-xl p-6"
                >
                    <h3 className="text-lg font-semibold text-white mb-4">Meeting Status Overview</h3>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                        {[
                            { label: 'Completed', value: meetingsInfo.completed || 0, color: 'emerald' },
                            { label: 'Active', value: meetingsInfo.active || 0, color: 'blue' },
                            { label: 'Failed', value: meetingsInfo.failed || 0, color: 'rose' },
                            { label: 'Total', value: meetingsInfo.total || 0, color: 'slate' },
                        ].map((item, i) => (
                            <div key={i} className="text-center p-4 rounded-xl bg-white/[0.03] border border-white/5">
                                <div className={`text-2xl font-bold text-${item.color}-400`}>
                                    <AnimatedNumber value={item.value} />
                                </div>
                                <div className="text-xs text-slate-400 mt-1 font-medium uppercase tracking-wider">{item.label}</div>
                            </div>
                        ))}
                    </div>
                    {/* Progress bar */}
                    {(meetingsInfo.total || 0) > 0 && (
                        <div className="mt-4">
                            <div className="h-2 rounded-full bg-white/5 overflow-hidden flex">
                                <div
                                    className="h-full bg-emerald-500 rounded-l-full transition-all duration-1000"
                                    style={{ width: `${((meetingsInfo.completed || 0) / meetingsInfo.total) * 100}%` }}
                                />
                                <div
                                    className="h-full bg-blue-500 transition-all duration-1000"
                                    style={{ width: `${((meetingsInfo.active || 0) / meetingsInfo.total) * 100}%` }}
                                />
                                <div
                                    className="h-full bg-rose-500 rounded-r-full transition-all duration-1000"
                                    style={{ width: `${((meetingsInfo.failed || 0) / meetingsInfo.total) * 100}%` }}
                                />
                            </div>
                            <div className="flex items-center gap-4 mt-2 text-[10px] text-slate-500">
                                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500" /> Completed</span>
                                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500" /> Active</span>
                                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-rose-500" /> Failed</span>
                            </div>
                        </div>
                    )}
                </motion.div>
            </div>
        </div>
    );
};

export default Analysis;
