import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { GraduationCap, ArrowLeft, Plus, Trash2, Globe, Lock, Link as LinkIcon, Calendar, Settings, UserPlus, Mail, Megaphone, Copy, Check, RefreshCw, KeyRound } from 'lucide-react';
import ChatBox from '../components/ChatBox';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export default function ClassroomDetail() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [classroom, setClassroom] = useState(null);
    const [isTeacher, setIsTeacher] = useState(false);
    const [loading, setLoading] = useState(true);
    const [activeSection, setActiveSection] = useState('students');
    const [showAddStudent, setShowAddStudent] = useState(false);
    const [showShareMeeting, setShowShareMeeting] = useState(false);
    const [showAnnouncement, setShowAnnouncement] = useState(false);
    const [newStudentEmail, setNewStudentEmail] = useState('');
    const [announcementText, setAnnouncementText] = useState('');
    const [meetingForm, setMeetingForm] = useState({ link: '', title: '', scheduledTime: '', platform: 'meet' });

    useEffect(() => { loadClassroom(); }, [id]);

    const loadClassroom = async () => {
        try {
            const res = await axios.get(`${API_URL}/api/classrooms/${id}`);
            setClassroom(res.data.classroom);
            setIsTeacher(res.data.isTeacher);
        } catch (err) {
            console.error('Load error:', err);
        }
        setLoading(false);
    };

    const handleAddStudent = async () => {
        if (!newStudentEmail.trim()) return;
        try {
            await axios.post(`${API_URL}/api/classrooms/${id}/students`, { email: newStudentEmail });
            setNewStudentEmail('');
            setShowAddStudent(false);
            loadClassroom();
        } catch (err) { alert(err.response?.data?.error || 'Failed'); }
    };

    const handleRemoveStudent = async (email) => {
        if (!confirm('Remove this student?')) return;
        try {
            await axios.delete(`${API_URL}/api/classrooms/${id}/students`, { data: { email } });
            loadClassroom();
        } catch (err) { alert(err.response?.data?.error || 'Failed'); }
    };

    const handleShareMeeting = async () => {
        if (!meetingForm.link.trim()) return;
        try {
            await axios.post(`${API_URL}/api/classrooms/${id}/meeting`, meetingForm);
            setMeetingForm({ link: '', title: '', scheduledTime: '', platform: 'meet' });
            setShowShareMeeting(false);
            loadClassroom();
        } catch (err) { alert(err.response?.data?.error || 'Failed'); }
    };

    const handleAddAnnouncement = async () => {
        if (!announcementText.trim()) return;
        try {
            await axios.post(`${API_URL}/api/classrooms/${id}/announcements`, { text: announcementText });
            setAnnouncementText('');
            setShowAnnouncement(false);
            loadClassroom();
        } catch (err) { alert(err.response?.data?.error || 'Failed'); }
    };

    const handleUpdateSettings = async (settings) => {
        try {
            await axios.put(`${API_URL}/api/classrooms/${id}`, { settings });
            loadClassroom();
        } catch (err) { alert(err.response?.data?.error || 'Failed'); }
    };

    const handleDelete = async () => {
        if (!confirm('Delete this classroom?')) return;
        try {
            await axios.delete(`${API_URL}/api/classrooms/${id}`);
            navigate('/teams');
        } catch (err) { alert(err.response?.data?.error || 'Failed'); }
    };

    if (loading) return <div className="text-center text-slate-400 py-20">Loading...</div>;
    if (!classroom) return <div className="text-center text-red-400 py-20">Classroom not found</div>;

    const activeStudents = classroom.students.filter(s => s.status !== 'removed');

    const sections = [
        { id: 'students', label: 'Students', icon: <GraduationCap size={15} /> },
        { id: 'meetings', label: 'Meetings', icon: <Calendar size={15} /> },
        { id: 'announcements', label: 'Announcements', icon: <Megaphone size={15} /> },
        { id: 'chat', label: 'Chat', icon: <Mail size={15} /> },
        ...(isTeacher ? [{ id: 'settings', label: 'Settings', icon: <Settings size={15} /> }] : []),
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
                        <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center text-purple-400">
                            <GraduationCap size={20} />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-white">{classroom.name}</h1>
                            <div className="flex items-center gap-3 text-xs text-slate-500">
                                {classroom.subject && <span>{classroom.subject}</span>}
                                {classroom.section && <span>Section {classroom.section}</span>}
                                <span className="flex items-center gap-1">{classroom.visibility === 'public' ? <Globe size={10} /> : <Lock size={10} />} {classroom.visibility}</span>
                                <span>Teacher: {classroom.teacherName || classroom.teacherEmail}</span>
                                <span>{activeStudents.length} students</span>
                            </div>
                        </div>
                    </div>
                </div>
                {isTeacher && <span className="px-3 py-1 bg-purple-500/20 text-purple-400 text-xs rounded-full font-medium">Teacher</span>}
            </div>

            {classroom.description && <p className="text-slate-400 text-sm mb-6 ml-14">{classroom.description}</p>}

            {/* Section Tabs */}
            <div className="flex gap-1 mb-6 bg-[#151921]/70 p-1 rounded-lg border border-white/5 w-fit">
                {sections.map(s => (
                    <button key={s.id} onClick={() => setActiveSection(s.id)}
                        className={`flex items-center gap-1.5 px-4 py-2 rounded-md text-xs font-medium transition-all ${activeSection === s.id ? 'bg-white/10 text-white' : 'text-slate-500 hover:text-slate-300'}`}>
                        {s.icon} {s.label}
                    </button>
                ))}
            </div>

            {/* Students */}
            {activeSection === 'students' && (
                <div>
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-white font-semibold">Students ({activeStudents.length})</h2>
                        {isTeacher && (
                            <button onClick={() => setShowAddStudent(true)} className="flex items-center gap-1.5 px-3 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-xs font-medium transition-colors">
                                <UserPlus size={14} /> Add Student
                            </button>
                        )}
                    </div>
                    {activeStudents.length === 0 ? (
                        <div className="text-center py-12 text-slate-500 text-sm border border-dashed border-white/10 rounded-xl">No students yet</div>
                    ) : (
                        <div className="space-y-2">
                            {activeStudents.map((s, i) => (
                                <div key={i} className="flex items-center justify-between p-3 bg-[#151921]/70 border border-white/5 rounded-lg">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center text-purple-400 text-xs font-bold">
                                            {(s.name || s.email)[0].toUpperCase()}
                                        </div>
                                        <div>
                                            <p className="text-white text-sm font-medium">{s.name || s.email}</p>
                                            <p className="text-slate-500 text-xs">{s.email}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className={`px-2 py-0.5 rounded-full text-[10px] ${s.status === 'active' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-yellow-500/20 text-yellow-400'}`}>{s.status}</span>
                                        {isTeacher && (
                                            <button onClick={() => handleRemoveStudent(s.email)} className="text-red-400/50 hover:text-red-400 transition-colors">
                                                <Trash2 size={13} />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Meetings */}
            {activeSection === 'meetings' && (
                <div>
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-white font-semibold">Class Meetings</h2>
                        {isTeacher && (
                            <button onClick={() => setShowShareMeeting(true)} className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-medium transition-colors">
                                <LinkIcon size={14} /> Share Meeting
                            </button>
                        )}
                    </div>
                    {classroom.meetingLinks.length === 0 ? (
                        <div className="text-center py-12 text-slate-500 text-sm border border-dashed border-white/10 rounded-xl">No meetings shared</div>
                    ) : (
                        <div className="space-y-3">
                            {classroom.meetingLinks.map((m, i) => (
                                <div key={i} className="flex items-center justify-between p-4 bg-[#151921]/70 border border-white/5 rounded-lg">
                                    <div>
                                        <p className="text-white text-sm font-medium">{m.title}</p>
                                        <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
                                            <span className="uppercase">{m.platform}</span>
                                            {m.scheduledTime && <span>{new Date(m.scheduledTime).toLocaleString()}</span>}
                                        </div>
                                    </div>
                                    <a href={m.link} target="_blank" rel="noopener noreferrer"
                                        className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white text-xs rounded-lg transition-colors">Join</a>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Announcements */}
            {activeSection === 'announcements' && (
                <div>
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-white font-semibold">Announcements</h2>
                        {isTeacher && (
                            <button onClick={() => setShowAnnouncement(true)} className="flex items-center gap-1.5 px-3 py-2 bg-yellow-600 hover:bg-yellow-500 text-white rounded-lg text-xs font-medium transition-colors">
                                <Megaphone size={14} /> Post Announcement
                            </button>
                        )}
                    </div>
                    {(!classroom.announcements || classroom.announcements.length === 0) ? (
                        <div className="text-center py-12 text-slate-500 text-sm border border-dashed border-white/10 rounded-xl">No announcements</div>
                    ) : (
                        <div className="space-y-3">
                            {[...classroom.announcements].reverse().map((a, i) => (
                                <div key={i} className="p-4 bg-[#151921]/70 border border-white/5 rounded-lg">
                                    <p className="text-white text-sm">{a.text}</p>
                                    <p className="text-slate-600 text-xs mt-2">{new Date(a.createdAt).toLocaleString()}</p>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Chat */}
            {activeSection === 'chat' && <ChatBox contextType="classroom" contextId={id} />}

            {/* Settings */}
            {activeSection === 'settings' && isTeacher && (
                <div className="max-w-lg space-y-6">
                    {/* Invite Code */}
                    <InviteCodeSection
                        code={classroom.inviteCode}
                        onRegenerate={async () => {
                            try {
                                await axios.post(`${API_URL}/api/classrooms/${id}/regenerate-code`);
                                loadClassroom();
                            } catch (err) { alert(err.response?.data?.error || 'Failed'); }
                        }}
                    />
                    <div className="space-y-4">
                        <h2 className="text-white font-semibold">Classroom Settings</h2>
                        <ToggleSetting label="Auto-share meetings" checked={classroom.settings?.autoShareMeetings} onChange={v => handleUpdateSettings({ autoShareMeetings: v })} />
                        <ToggleSetting label="Email notifications" checked={classroom.settings?.emailNotifications} onChange={v => handleUpdateSettings({ emailNotifications: v })} />
                        <ToggleSetting label="Allow student chat" checked={classroom.settings?.allowStudentChat} onChange={v => handleUpdateSettings({ allowStudentChat: v })} />
                    </div>
                    <div className="pt-6 border-t border-white/5">
                        <button onClick={handleDelete} className="px-4 py-2 bg-red-600/20 text-red-400 hover:bg-red-600/30 rounded-lg text-sm transition-colors">Delete Classroom</button>
                    </div>
                </div>
            )}

            {/* Add Student Modal */}
            {showAddStudent && (
                <Modal title="Add Student" onClose={() => setShowAddStudent(false)}>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-xs text-slate-400 mb-1.5">Student Email</label>
                            <input value={newStudentEmail} onChange={e => setNewStudentEmail(e.target.value)}
                                placeholder="student@example.com" className="w-full px-3 py-2.5 bg-[#0B0E14] border border-white/10 rounded-lg text-white text-sm placeholder-slate-500 focus:border-white/20 focus:outline-none" />
                        </div>
                        <button onClick={handleAddStudent} disabled={!newStudentEmail.trim()}
                            className="w-full py-2.5 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors">Add Student</button>
                    </div>
                </Modal>
            )}

            {/* Share Meeting Modal */}
            {showShareMeeting && (
                <Modal title="Share Meeting" onClose={() => setShowShareMeeting(false)}>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-xs text-slate-400 mb-1.5">Meeting Link</label>
                            <input value={meetingForm.link} onChange={e => setMeetingForm({ ...meetingForm, link: e.target.value })}
                                placeholder="https://meet.google.com/..." className="w-full px-3 py-2.5 bg-[#0B0E14] border border-white/10 rounded-lg text-white text-sm placeholder-slate-500 focus:border-white/20 focus:outline-none" />
                        </div>
                        <div>
                            <label className="block text-xs text-slate-400 mb-1.5">Title</label>
                            <input value={meetingForm.title} onChange={e => setMeetingForm({ ...meetingForm, title: e.target.value })}
                                className="w-full px-3 py-2.5 bg-[#0B0E14] border border-white/10 rounded-lg text-white text-sm placeholder-slate-500 focus:border-white/20 focus:outline-none" />
                        </div>
                        <div>
                            <label className="block text-xs text-slate-400 mb-1.5">Scheduled Time</label>
                            <input type="datetime-local" value={meetingForm.scheduledTime} onChange={e => setMeetingForm({ ...meetingForm, scheduledTime: e.target.value })}
                                className="w-full px-3 py-2.5 bg-[#0B0E14] border border-white/10 rounded-lg text-white text-sm focus:border-white/20 focus:outline-none" />
                        </div>
                        <button onClick={handleShareMeeting} disabled={!meetingForm.link.trim()}
                            className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors">Share</button>
                    </div>
                </Modal>
            )}

            {/* Announcement Modal */}
            {showAnnouncement && (
                <Modal title="Post Announcement" onClose={() => setShowAnnouncement(false)}>
                    <div className="space-y-4">
                        <textarea value={announcementText} onChange={e => setAnnouncementText(e.target.value)}
                            placeholder="Write your announcement..." rows={4}
                            className="w-full px-3 py-2.5 bg-[#0B0E14] border border-white/10 rounded-lg text-white text-sm placeholder-slate-500 focus:border-white/20 focus:outline-none resize-none" />
                        <button onClick={handleAddAnnouncement} disabled={!announcementText.trim()}
                            className="w-full py-2.5 bg-yellow-600 hover:bg-yellow-500 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors">Post</button>
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
                <span className="text-[10px] text-slate-500 ml-auto">Share this code so students can join</span>
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
                className={`w-10 h-5 rounded-full transition-colors relative ${checked ? 'bg-purple-600' : 'bg-white/10'}`}>
                <div className={`w-4 h-4 bg-white rounded-full absolute top-0.5 transition-transform ${checked ? 'translate-x-5' : 'translate-x-0.5'}`} />
            </button>
        </div>
    );
}
