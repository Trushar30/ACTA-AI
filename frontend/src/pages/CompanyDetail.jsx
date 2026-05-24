import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Building2, ArrowLeft, Plus, Trash2, Globe, Lock, Link as LinkIcon, Calendar, Settings, UserPlus, Mail, Crown, Briefcase, Copy, Check, RefreshCw, KeyRound } from 'lucide-react';
import ChatBox from '../components/ChatBox';

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

const ROLE_LABELS = {
    ceo: 'CEO', cto: 'CTO', hr: 'HR', manager: 'Manager',
    'team-lead': 'Team Lead', employee: 'Employee', intern: 'Intern'
};

const ROLE_COLORS = {
    ceo: 'yellow', cto: 'blue', hr: 'pink', manager: 'purple',
    'team-lead': 'emerald', employee: 'slate', intern: 'cyan'
};

export default function CompanyDetail() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [company, setCompany] = useState(null);
    const [myRole, setMyRole] = useState(null);
    const [loading, setLoading] = useState(true);
    const [activeSection, setActiveSection] = useState('employees');
    const [showAddEmployee, setShowAddEmployee] = useState(false);
    const [showShareMeeting, setShowShareMeeting] = useState(false);
    const [newEmployee, setNewEmployee] = useState({ email: '', role: 'employee', department: '' });
    const [meetingForm, setMeetingForm] = useState({ link: '', title: '', scheduledTime: '', platform: 'meet', department: '' });

    useEffect(() => { loadCompany(); }, [id]);

    const loadCompany = async () => {
        try {
            const res = await axios.get(`${API_URL}/api/companies/${id}`);
            setCompany(res.data.company);
            setMyRole(res.data.myRole);
        } catch (err) {
            console.error('Load error:', err);
        }
        setLoading(false);
    };

    const isAdmin = ['ceo', 'hr', 'manager'].includes(myRole);

    const handleAddEmployee = async () => {
        if (!newEmployee.email.trim()) return;
        try {
            await axios.post(`${API_URL}/api/companies/${id}/employees`, newEmployee);
            setNewEmployee({ email: '', role: 'employee', department: '' });
            setShowAddEmployee(false);
            loadCompany();
        } catch (err) { alert(err.response?.data?.error || 'Failed'); }
    };

    const handleRemoveEmployee = async (email) => {
        if (!confirm('Remove this employee?')) return;
        try {
            await axios.delete(`${API_URL}/api/companies/${id}/employees`, { data: { email } });
            loadCompany();
        } catch (err) { alert(err.response?.data?.error || 'Failed'); }
    };

    const handleUpdateRole = async (email, role, department) => {
        try {
            await axios.put(`${API_URL}/api/companies/${id}/employees/role`, { email, role, department });
            loadCompany();
        } catch (err) { alert(err.response?.data?.error || 'Failed'); }
    };

    const handleShareMeeting = async () => {
        if (!meetingForm.link.trim()) return;
        try {
            await axios.post(`${API_URL}/api/companies/${id}/meeting`, meetingForm);
            setMeetingForm({ link: '', title: '', scheduledTime: '', platform: 'meet', department: '' });
            setShowShareMeeting(false);
            loadCompany();
        } catch (err) { alert(err.response?.data?.error || 'Failed'); }
    };

    const handleUpdateSettings = async (settings) => {
        try {
            await axios.put(`${API_URL}/api/companies/${id}`, { settings });
            loadCompany();
        } catch (err) { alert(err.response?.data?.error || 'Failed'); }
    };

    const handleDelete = async () => {
        if (!confirm('Delete this company?')) return;
        try {
            await axios.delete(`${API_URL}/api/companies/${id}`);
            navigate('/teams');
        } catch (err) { alert(err.response?.data?.error || 'Failed'); }
    };

    if (loading) return <div className="text-center text-slate-400 py-20">Loading...</div>;
    if (!company) return <div className="text-center text-red-400 py-20">Company not found</div>;

    const activeEmployees = company.employees.filter(e => e.status !== 'removed');
    const departments = [...new Set(activeEmployees.map(e => e.department).filter(Boolean))];

    const sections = [
        { id: 'employees', label: 'Employees', icon: <Briefcase size={15} /> },
        { id: 'departments', label: 'Departments', icon: <Building2 size={15} /> },
        { id: 'meetings', label: 'Meetings', icon: <Calendar size={15} /> },
        { id: 'chat', label: 'Chat', icon: <Mail size={15} /> },
        ...(isAdmin ? [{ id: 'settings', label: 'Settings', icon: <Settings size={15} /> }] : []),
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
                        <div className="w-10 h-10 rounded-lg bg-emerald-500/20 flex items-center justify-center text-emerald-400">
                            <Building2 size={20} />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-white">{company.name}</h1>
                            <div className="flex items-center gap-3 text-xs text-slate-500">
                                {company.industry && <span>{company.industry}</span>}
                                <span>Size: {company.size}</span>
                                <span className="flex items-center gap-1">{company.visibility === 'public' ? <Globe size={10} /> : <Lock size={10} />} {company.visibility}</span>
                                <span>{activeEmployees.length} employees</span>
                            </div>
                        </div>
                    </div>
                </div>
                {myRole && (
                    <span className={`px-3 py-1 bg-${ROLE_COLORS[myRole] || 'slate'}-500/20 text-${ROLE_COLORS[myRole] || 'slate'}-400 text-xs rounded-full font-medium uppercase`}>
                        {ROLE_LABELS[myRole] || myRole}
                    </span>
                )}
            </div>

            {company.description && <p className="text-slate-400 text-sm mb-4 ml-14">{company.description}</p>}
            {company.website && <p className="text-blue-400 text-xs mb-6 ml-14">{company.website}</p>}

            {/* Section Tabs */}
            <div className="flex gap-1 mb-6 bg-[#151921]/70 p-1 rounded-lg border border-white/5 w-fit">
                {sections.map(s => (
                    <button key={s.id} onClick={() => setActiveSection(s.id)}
                        className={`flex items-center gap-1.5 px-4 py-2 rounded-md text-xs font-medium transition-all ${activeSection === s.id ? 'bg-white/10 text-white' : 'text-slate-500 hover:text-slate-300'}`}>
                        {s.icon} {s.label}
                    </button>
                ))}
            </div>

            {/* Employees */}
            {activeSection === 'employees' && (
                <div>
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-white font-semibold">Employees ({activeEmployees.length})</h2>
                        {isAdmin && (
                            <button onClick={() => setShowAddEmployee(true)} className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-medium transition-colors">
                                <UserPlus size={14} /> Add Employee
                            </button>
                        )}
                    </div>
                    <div className="space-y-2">
                        {activeEmployees.map((emp, i) => (
                            <div key={i} className="flex items-center justify-between p-3 bg-[#151921]/70 border border-white/5 rounded-lg">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400 text-xs font-bold">
                                        {(emp.name || emp.email)[0].toUpperCase()}
                                    </div>
                                    <div>
                                        <p className="text-white text-sm font-medium">{emp.name || emp.email}</p>
                                        <p className="text-slate-500 text-xs">{emp.email}{emp.department ? ` · ${emp.department}` : ''}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium uppercase tracking-wider bg-${ROLE_COLORS[emp.role] || 'slate'}-500/20 text-${ROLE_COLORS[emp.role] || 'slate'}-400`}>
                                        {emp.role === 'ceo' && <Crown size={10} className="inline mr-1" />}
                                        {ROLE_LABELS[emp.role] || emp.role}
                                    </span>
                                    <span className={`px-2 py-0.5 rounded-full text-[10px] ${emp.status === 'active' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-yellow-500/20 text-yellow-400'}`}>{emp.status}</span>
                                    {isAdmin && emp.role !== 'ceo' && (
                                        <div className="flex gap-1">
                                            <select value={emp.role} onChange={e => handleUpdateRole(emp.email, e.target.value, emp.department)}
                                                className="bg-transparent border border-white/10 rounded text-xs text-slate-400 px-1 py-0.5 focus:outline-none">
                                                {Object.entries(ROLE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                                            </select>
                                            <button onClick={() => handleRemoveEmployee(emp.email)} className="text-red-400/50 hover:text-red-400 transition-colors">
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

            {/* Departments */}
            {activeSection === 'departments' && (
                <div>
                    <h2 className="text-white font-semibold mb-4">Departments ({departments.length})</h2>
                    {departments.length === 0 ? (
                        <div className="text-center py-12 text-slate-500 text-sm border border-dashed border-white/10 rounded-xl">No departments. Assign departments to employees.</div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {departments.map((dept, i) => {
                                const deptEmployees = activeEmployees.filter(e => e.department === dept);
                                return (
                                    <div key={i} className="p-4 bg-[#151921]/70 border border-white/5 rounded-xl">
                                        <h3 className="text-white font-medium mb-2">{dept}</h3>
                                        <p className="text-slate-500 text-xs mb-3">{deptEmployees.length} member{deptEmployees.length !== 1 ? 's' : ''}</p>
                                        <div className="flex flex-wrap gap-1">
                                            {deptEmployees.map((e, j) => (
                                                <span key={j} className="px-2 py-1 bg-white/5 text-slate-400 text-xs rounded-full">{e.name || e.email.split('@')[0]}</span>
                                            ))}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            {/* Meetings */}
            {activeSection === 'meetings' && (
                <div>
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-white font-semibold">Company Meetings</h2>
                        {isAdmin && (
                            <button onClick={() => setShowShareMeeting(true)} className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-medium transition-colors">
                                <LinkIcon size={14} /> Share Meeting
                            </button>
                        )}
                    </div>
                    {company.meetingLinks.length === 0 ? (
                        <div className="text-center py-12 text-slate-500 text-sm border border-dashed border-white/10 rounded-xl">No meetings</div>
                    ) : (
                        <div className="space-y-3">
                            {company.meetingLinks.map((m, i) => (
                                <div key={i} className="flex items-center justify-between p-4 bg-[#151921]/70 border border-white/5 rounded-lg">
                                    <div>
                                        <p className="text-white text-sm font-medium">{m.title}</p>
                                        <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
                                            <span className="uppercase">{m.platform}</span>
                                            {m.department && <span>Dept: {m.department}</span>}
                                            {m.scheduledTime && <span>{new Date(m.scheduledTime).toLocaleString()}</span>}
                                        </div>
                                    </div>
                                    <a href={m.link} target="_blank" rel="noopener noreferrer"
                                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs rounded-lg transition-colors">Join</a>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Chat */}
            {activeSection === 'chat' && <ChatBox contextType="company" contextId={id} />}

            {/* Settings */}
            {activeSection === 'settings' && isAdmin && (
                <div className="max-w-lg space-y-6">
                    {/* Invite Code */}
                    <InviteCodeSection
                        code={company.inviteCode}
                        onRegenerate={async () => {
                            try {
                                await axios.post(`${API_URL}/api/companies/${id}/regenerate-code`);
                                loadCompany();
                            } catch (err) { alert(err.response?.data?.error || 'Failed'); }
                        }}
                    />
                    <div className="space-y-4">
                        <h2 className="text-white font-semibold">Company Settings</h2>
                        <ToggleSetting label="Auto-share meetings" checked={company.settings?.autoShareMeetings} onChange={v => handleUpdateSettings({ autoShareMeetings: v })} />
                        <ToggleSetting label="Email notifications" checked={company.settings?.emailNotifications} onChange={v => handleUpdateSettings({ emailNotifications: v })} />
                        <ToggleSetting label="Allow employee invites" checked={company.settings?.allowEmployeeInvite} onChange={v => handleUpdateSettings({ allowEmployeeInvite: v })} />
                    </div>
                    <div className="pt-6 border-t border-white/5">
                        <button onClick={handleDelete} className="px-4 py-2 bg-red-600/20 text-red-400 hover:bg-red-600/30 rounded-lg text-sm transition-colors">Delete Company</button>
                    </div>
                </div>
            )}

            {/* Add Employee Modal */}
            {showAddEmployee && (
                <Modal title="Add Employee" onClose={() => setShowAddEmployee(false)}>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-xs text-slate-400 mb-1.5">Email</label>
                            <input value={newEmployee.email} onChange={e => setNewEmployee({ ...newEmployee, email: e.target.value })}
                                placeholder="employee@company.com" className="w-full px-3 py-2.5 bg-[#0B0E14] border border-white/10 rounded-lg text-white text-sm placeholder-slate-500 focus:border-white/20 focus:outline-none" />
                        </div>
                        <div>
                            <label className="block text-xs text-slate-400 mb-1.5">Role</label>
                            <select value={newEmployee.role} onChange={e => setNewEmployee({ ...newEmployee, role: e.target.value })}
                                className="w-full px-3 py-2.5 bg-[#0B0E14] border border-white/10 rounded-lg text-white text-sm focus:border-white/20 focus:outline-none">
                                {Object.entries(ROLE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs text-slate-400 mb-1.5">Department</label>
                            <input value={newEmployee.department} onChange={e => setNewEmployee({ ...newEmployee, department: e.target.value })}
                                placeholder="e.g. Engineering" className="w-full px-3 py-2.5 bg-[#0B0E14] border border-white/10 rounded-lg text-white text-sm placeholder-slate-500 focus:border-white/20 focus:outline-none" />
                        </div>
                        <button onClick={handleAddEmployee} disabled={!newEmployee.email.trim()}
                            className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors">Add Employee</button>
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
                                placeholder="https://..." className="w-full px-3 py-2.5 bg-[#0B0E14] border border-white/10 rounded-lg text-white text-sm placeholder-slate-500 focus:border-white/20 focus:outline-none" />
                        </div>
                        <div>
                            <label className="block text-xs text-slate-400 mb-1.5">Title</label>
                            <input value={meetingForm.title} onChange={e => setMeetingForm({ ...meetingForm, title: e.target.value })}
                                className="w-full px-3 py-2.5 bg-[#0B0E14] border border-white/10 rounded-lg text-white text-sm placeholder-slate-500 focus:border-white/20 focus:outline-none" />
                        </div>
                        <div>
                            <label className="block text-xs text-slate-400 mb-1.5">Department (optional, send to specific dept)</label>
                            <input value={meetingForm.department} onChange={e => setMeetingForm({ ...meetingForm, department: e.target.value })}
                                placeholder="All departments" className="w-full px-3 py-2.5 bg-[#0B0E14] border border-white/10 rounded-lg text-white text-sm placeholder-slate-500 focus:border-white/20 focus:outline-none" />
                        </div>
                        <div>
                            <label className="block text-xs text-slate-400 mb-1.5">Scheduled Time</label>
                            <input type="datetime-local" value={meetingForm.scheduledTime} onChange={e => setMeetingForm({ ...meetingForm, scheduledTime: e.target.value })}
                                className="w-full px-3 py-2.5 bg-[#0B0E14] border border-white/10 rounded-lg text-white text-sm focus:border-white/20 focus:outline-none" />
                        </div>
                        <button onClick={handleShareMeeting} disabled={!meetingForm.link.trim()}
                            className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors">Share</button>
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
                <span className="text-[10px] text-slate-500 ml-auto">Share this code so employees can join</span>
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
                className={`w-10 h-5 rounded-full transition-colors relative ${checked ? 'bg-emerald-600' : 'bg-white/10'}`}>
                <div className={`w-4 h-4 bg-white rounded-full absolute top-0.5 transition-transform ${checked ? 'translate-x-5' : 'translate-x-0.5'}`} />
            </button>
        </div>
    );
}
