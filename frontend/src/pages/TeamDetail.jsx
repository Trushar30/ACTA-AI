import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Users, ArrowLeft, Plus, Trash2, Shield, Globe, Lock, Link as LinkIcon, Calendar, Settings, UserPlus, Crown, Mail, Copy, Check, RefreshCw, KeyRound } from 'lucide-react';
import ChatBox from '../components/ChatBox';

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

export default function TeamDetail() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [team, setTeam] = useState(null);
    const [loading, setLoading] = useState(true);
    const [activeSection, setActiveSection] = useState('members');
    const [showAddMember, setShowAddMember] = useState(false);
    const [showShareMeeting, setShowShareMeeting] = useState(false);
    const [showSettings, setShowSettings] = useState(false);
    const [newMember, setNewMember] = useState({ email: '', role: 'member' });
    const [meetingForm, setMeetingForm] = useState({ link: '', title: '', scheduledTime: '', platform: 'meet' });

    useEffect(() => { loadTeam(); }, [id]);

    const loadTeam = async () => {
        try {
            const res = await axios.get(`${API_URL}/api/teams/${id}`);
            setTeam(res.data.team);
        } catch (err) {
            console.error('Load team error:', err);
            if (err.response?.status === 403) alert('Access denied');
        }
        setLoading(false);
    };

    const handleAddMember = async () => {
        if (!newMember.email.trim()) return;
        try {
            await axios.post(`${API_URL}/api/teams/${id}/members`, newMember);
            setNewMember({ email: '', role: 'member' });
            setShowAddMember(false);
            loadTeam();
        } catch (err) {
            alert(err.response?.data?.error || 'Failed to add member');
        }
    };

    const handleRemoveMember = async (email) => {
        if (!confirm('Remove this member?')) return;
        try {
            await axios.delete(`${API_URL}/api/teams/${id}/members`, { data: { email } });
            loadTeam();
        } catch (err) {
            alert(err.response?.data?.error || 'Failed to remove');
        }
    };

    const handleUpdateRole = async (email, role) => {
        try {
            await axios.put(`${API_URL}/api/teams/${id}/members/role`, { email, role });
            loadTeam();
        } catch (err) {
            alert(err.response?.data?.error || 'Failed to update role');
        }
    };

    const handleShareMeeting = async () => {
        if (!meetingForm.link.trim()) return;
        try {
            await axios.post(`${API_URL}/api/teams/${id}/meeting`, meetingForm);
            setMeetingForm({ link: '', title: '', scheduledTime: '', platform: 'meet' });
            setShowShareMeeting(false);
            loadTeam();
        } catch (err) {
            alert(err.response?.data?.error || 'Failed to share meeting');
        }
    };

    const handleUpdateSettings = async (settings) => {
        try {
            await axios.put(`${API_URL}/api/teams/${id}`, { settings });
            loadTeam();
        } catch (err) {
            alert(err.response?.data?.error || 'Failed to update settings');
        }
    };

    const handleDeleteTeam = async () => {
        if (!confirm('Are you sure you want to delete this team? This action cannot be undone.')) return;
        try {
            await axios.delete(`${API_URL}/api/teams/${id}`);
            navigate('/teams');
        } catch (err) {
            alert(err.response?.data?.error || 'Failed to delete team');
        }
    };

    if (loading) return <div className="text-center text-slate-400 py-20">Loading...</div>;
    if (!team) return <div className="text-center text-red-400 py-20">Team not found or access denied</div>;

    const activeMembers = team.members.filter(m => m.status !== 'removed');
    const myRole = team.members.find(m => m.userId?.toString() === localStorage.getItem('userId'))?.role;
    const isOwnerOrAdmin = team.members.some(m => ['owner', 'admin'].includes(m.role));

    const sections = [
        { id: 'members', label: 'Members', icon: <Users size={15} /> },
        { id: 'meetings', label: 'Meetings', icon: <Calendar size={15} /> },
        { id: 'chat', label: 'Chat', icon: <Mail size={15} /> },
        { id: 'settings', label: 'Settings', icon: <Settings size={15} /> },
    ];

    return (
        <div className="max-w-7xl mx-auto px-6 py-8">
            {/* Header */}
            <div className="flex items-center gap-4 mb-6">
                <button onClick={() => navigate('/teams')} className="text-slate-400 hover:text-white transition-colors">
                    <ArrowLeft size={20} />
                </button>
                <div className="flex-1">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center text-blue-400">
                            <Users size={20} />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-white">{team.name}</h1>
                            <div className="flex items-center gap-3 text-xs text-slate-500">
                                <span className="flex items-center gap-1">{team.visibility === 'public' ? <Globe size={10} /> : <Lock size={10} />} {team.visibility}</span>
                                <span>{activeMembers.length} members</span>
                                <span className="capitalize">{team.category}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {team.description && <p className="text-slate-400 text-sm mb-6 ml-14">{team.description}</p>}

            {/* Section Tabs */}
            <div className="flex gap-1 mb-6 bg-[#151921]/70 p-1 rounded-lg border border-white/5 w-fit">
                {sections.map(s => (
                    <button key={s.id} onClick={() => setActiveSection(s.id)}
                        className={`flex items-center gap-1.5 px-4 py-2 rounded-md text-xs font-medium transition-all ${activeSection === s.id ? 'bg-white/10 text-white' : 'text-slate-500 hover:text-slate-300'}`}>
                        {s.icon} {s.label}
                    </button>
                ))}
            </div>

            {/* Members Tab */}
            {activeSection === 'members' && (
                <div>
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-white font-semibold">Members ({activeMembers.length})</h2>
                        <button onClick={() => setShowAddMember(true)} className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-medium transition-colors">
                            <UserPlus size={14} /> Add Member
                        </button>
                    </div>
                    <div className="space-y-2">
                        {activeMembers.map((m, i) => (
                            <div key={i} className="flex items-center justify-between p-3 bg-[#151921]/70 border border-white/5 rounded-lg">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400 text-xs font-bold">
                                        {(m.name || m.email)[0].toUpperCase()}
                                    </div>
                                    <div>
                                        <p className="text-white text-sm font-medium">{m.name || m.email}</p>
                                        <p className="text-slate-500 text-xs">{m.email}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium uppercase tracking-wider ${m.role === 'owner' ? 'bg-yellow-500/20 text-yellow-400' :
                                        m.role === 'admin' ? 'bg-purple-500/20 text-purple-400' :
                                            m.role === 'teacher' ? 'bg-emerald-500/20 text-emerald-400' :
                                                'bg-slate-500/20 text-slate-400'}`}>
                                        {m.role === 'owner' && <Crown size={10} className="inline mr-1" />}
                                        {m.role}
                                    </span>
                                    <span className={`px-2 py-0.5 rounded-full text-[10px] ${m.status === 'active' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-yellow-500/20 text-yellow-400'}`}>
                                        {m.status}
                                    </span>
                                    {m.role !== 'owner' && (
                                        <div className="flex gap-1">
                                            <select value={m.role} onChange={e => handleUpdateRole(m.email, e.target.value)}
                                                className="bg-transparent border border-white/10 rounded text-xs text-slate-400 px-1 py-0.5 focus:outline-none">
                                                <option value="member">Member</option>
                                                <option value="admin">Admin</option>
                                                <option value="teacher">Teacher</option>
                                                <option value="student">Student</option>
                                            </select>
                                            <button onClick={() => handleRemoveMember(m.email)} className="text-red-400/50 hover:text-red-400 transition-colors">
                                                <Trash2 size={13} />
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Meetings Tab */}
            {activeSection === 'meetings' && (
                <div>
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-white font-semibold">Shared Meetings</h2>
                        <button onClick={() => setShowShareMeeting(true)} className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-medium transition-colors">
                            <LinkIcon size={14} /> Share Meeting
                        </button>
                    </div>
                    {team.meetingLinks.length === 0 ? (
                        <div className="text-center py-12 text-slate-500 text-sm border border-dashed border-white/10 rounded-xl">No meetings shared yet</div>
                    ) : (
                        <div className="space-y-3">
                            {team.meetingLinks.map((m, i) => (
                                <div key={i} className="flex items-center justify-between p-4 bg-[#151921]/70 border border-white/5 rounded-lg">
                                    <div>
                                        <p className="text-white text-sm font-medium">{m.title}</p>
                                        <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
                                            <span className="uppercase">{m.platform}</span>
                                            {m.scheduledTime && <span>{new Date(m.scheduledTime).toLocaleString()}</span>}
                                        </div>
                                    </div>
                                    <a href={m.link} target="_blank" rel="noopener noreferrer"
                                        className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs rounded-lg transition-colors">
                                        Join
                                    </a>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Chat Tab */}
            {activeSection === 'chat' && (
                <ChatBox contextType="team" contextId={id} />
            )}

            {/* Settings Tab */}
            {activeSection === 'settings' && (
                <div className="max-w-lg space-y-6">
                    {/* Invite Code */}
                    <InviteCodeSection
                        code={team.inviteCode}
                        onRegenerate={async () => {
                            try {
                                const res = await axios.post(`${API_URL}/api/teams/${id}/regenerate-code`);
                                loadTeam();
                            } catch (err) { alert(err.response?.data?.error || 'Failed'); }
                        }}
                    />
                    <div className="space-y-4">
                        <h2 className="text-white font-semibold">Team Settings</h2>
                        <ToggleSetting label="Auto-share meetings with members" checked={team.settings?.autoShareMeetings} onChange={v => handleUpdateSettings({ autoShareMeetings: v })} />
                        <ToggleSetting label="Allow members to invite others" checked={team.settings?.allowMemberInvite} onChange={v => handleUpdateSettings({ allowMemberInvite: v })} />
                        <ToggleSetting label="Email notifications" checked={team.settings?.emailNotifications} onChange={v => handleUpdateSettings({ emailNotifications: v })} />
                    </div>
                    <div className="pt-6 border-t border-white/5">
                        <button onClick={handleDeleteTeam} className="px-4 py-2 bg-red-600/20 text-red-400 hover:bg-red-600/30 rounded-lg text-sm transition-colors">
                            Delete Team
                        </button>
                    </div>
                </div>
            )}

            {/* Add Member Modal */}
            {showAddMember && (
                <Modal title="Add Member" onClose={() => setShowAddMember(false)}>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-xs text-slate-400 mb-1.5">Email Address</label>
                            <input value={newMember.email} onChange={e => setNewMember({ ...newMember, email: e.target.value })}
                                placeholder="user@example.com" className="w-full px-3 py-2.5 bg-[#0B0E14] border border-white/10 rounded-lg text-white text-sm placeholder-slate-500 focus:border-white/20 focus:outline-none" />
                        </div>
                        <div>
                            <label className="block text-xs text-slate-400 mb-1.5">Role</label>
                            <select value={newMember.role} onChange={e => setNewMember({ ...newMember, role: e.target.value })}
                                className="w-full px-3 py-2.5 bg-[#0B0E14] border border-white/10 rounded-lg text-white text-sm focus:border-white/20 focus:outline-none">
                                <option value="member">Member</option>
                                <option value="admin">Admin</option>
                                <option value="teacher">Teacher</option>
                                <option value="student">Student</option>
                            </select>
                        </div>
                        <button onClick={handleAddMember} disabled={!newMember.email.trim()}
                            className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors">
                            Add Member
                        </button>
                    </div>
                </Modal>
            )}

            {/* Share Meeting Modal */}
            {showShareMeeting && (
                <Modal title="Share Meeting Link" onClose={() => setShowShareMeeting(false)}>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-xs text-slate-400 mb-1.5">Meeting Link</label>
                            <input value={meetingForm.link} onChange={e => setMeetingForm({ ...meetingForm, link: e.target.value })}
                                placeholder="https://meet.google.com/..." className="w-full px-3 py-2.5 bg-[#0B0E14] border border-white/10 rounded-lg text-white text-sm placeholder-slate-500 focus:border-white/20 focus:outline-none" />
                        </div>
                        <div>
                            <label className="block text-xs text-slate-400 mb-1.5">Title</label>
                            <input value={meetingForm.title} onChange={e => setMeetingForm({ ...meetingForm, title: e.target.value })}
                                placeholder="Meeting title" className="w-full px-3 py-2.5 bg-[#0B0E14] border border-white/10 rounded-lg text-white text-sm placeholder-slate-500 focus:border-white/20 focus:outline-none" />
                        </div>
                        <div>
                            <label className="block text-xs text-slate-400 mb-1.5">Scheduled Time</label>
                            <input type="datetime-local" value={meetingForm.scheduledTime} onChange={e => setMeetingForm({ ...meetingForm, scheduledTime: e.target.value })}
                                className="w-full px-3 py-2.5 bg-[#0B0E14] border border-white/10 rounded-lg text-white text-sm focus:border-white/20 focus:outline-none" />
                        </div>
                        <div>
                            <label className="block text-xs text-slate-400 mb-1.5">Platform</label>
                            <select value={meetingForm.platform} onChange={e => setMeetingForm({ ...meetingForm, platform: e.target.value })}
                                className="w-full px-3 py-2.5 bg-[#0B0E14] border border-white/10 rounded-lg text-white text-sm focus:border-white/20 focus:outline-none">
                                <option value="meet">Google Meet</option>
                                <option value="zoom">Zoom</option>
                                <option value="teams">Microsoft Teams</option>
                            </select>
                        </div>
                        <button onClick={handleShareMeeting} disabled={!meetingForm.link.trim()}
                            className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors">
                            Share with Team
                        </button>
                    </div>
                </Modal>
            )}
        </div>
    );
}

function Modal({ title, onClose, children }) {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
            <div className="bg-[#151921] border border-white/10 rounded-2xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-5">
                    <h2 className="text-lg font-semibold text-white">{title}</h2>
                    <button onClick={onClose} className="text-slate-500 hover:text-white text-xl">&times;</button>
                </div>
                {children}
            </div>
        </div>
    );
}

function InviteCodeSection({ code, onRegenerate }) {
    const [copied, setCopied] = React.useState(false);
    const handleCopy = () => {
        navigator.clipboard.writeText(code || '');
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };
    return (
        <div className="p-4 bg-[#151921]/70 border border-amber-500/20 rounded-xl">
            <div className="flex items-center gap-2 mb-3">
                <KeyRound size={16} className="text-amber-400" />
                <h3 className="text-white font-semibold text-sm">Invite Code</h3>
                <span className="text-[10px] text-slate-500 ml-auto">Share this code so others can join</span>
            </div>
            <div className="flex items-center gap-3">
                <div className="flex-1 px-4 py-2.5 bg-[#0B0E14] border border-white/10 rounded-lg text-center">
                    <span className="text-lg font-mono tracking-[0.4em] text-amber-400 font-bold select-all">{code || '...'}</span>
                </div>
                <button onClick={handleCopy} title="Copy code"
                    className="px-3 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-slate-400 hover:text-white transition-colors">
                    {copied ? <Check size={16} className="text-emerald-400" /> : <Copy size={16} />}
                </button>
                <button onClick={onRegenerate} title="Generate new code"
                    className="px-3 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-slate-400 hover:text-white transition-colors">
                    <RefreshCw size={16} />
                </button>
            </div>
        </div>
    );
}

function ToggleSetting({ label, checked, onChange }) {
    return (
        <div className="flex items-center justify-between p-3 bg-[#151921]/70 border border-white/5 rounded-lg">
            <span className="text-sm text-slate-300">{label}</span>
            <button onClick={() => onChange(!checked)}
                className={`w-10 h-5 rounded-full transition-colors relative ${checked ? 'bg-blue-600' : 'bg-white/10'}`}>
                <div className={`w-4 h-4 bg-white rounded-full absolute top-0.5 transition-transform ${checked ? 'translate-x-5' : 'translate-x-0.5'}`} />
            </button>
        </div>
    );
}
