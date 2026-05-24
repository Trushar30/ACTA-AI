import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Users, Building2, GraduationCap, Plus, Globe, Lock, Search, ChevronRight, KeyRound, Copy, Check } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export default function TeamsHub() {
    const [activeTab, setActiveTab] = useState('student');
    const [teams, setTeams] = useState([]);
    const [classrooms, setClassrooms] = useState([]);
    const [companies, setCompanies] = useState([]);
    const [publicTeams, setPublicTeams] = useState([]);
    const [publicClassrooms, setPublicClassrooms] = useState([]);
    const [publicCompanies, setPublicCompanies] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [showCreate, setShowCreate] = useState(null); // 'team', 'classroom', 'company'
    const [showJoinCode, setShowJoinCode] = useState(false);
    const navigate = useNavigate();

    useEffect(() => { loadData(); }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const [teamsRes, classroomsRes, companiesRes, pubTeams, pubClassrooms, pubCompanies] = await Promise.all([
                axios.get(`${API_URL}/api/teams`),
                axios.get(`${API_URL}/api/classrooms`),
                axios.get(`${API_URL}/api/companies`),
                axios.get(`${API_URL}/api/teams/public`),
                axios.get(`${API_URL}/api/classrooms/public`),
                axios.get(`${API_URL}/api/companies/public`)
            ]);
            setTeams(teamsRes.data.teams || []);
            setClassrooms(classroomsRes.data.classrooms || []);
            setCompanies(companiesRes.data.companies || []);
            setPublicTeams(pubTeams.data.teams || []);
            setPublicClassrooms(pubClassrooms.data.classrooms || []);
            setPublicCompanies(pubCompanies.data.companies || []);
        } catch (err) {
            console.error('Load data error:', err);
        }
        setLoading(false);
    };

    const handleCreateTeam = async (formData) => {
        try {
            await axios.post(`${API_URL}/api/teams`, formData);
            setShowCreate(null);
            loadData();
        } catch (err) {
            alert(err.response?.data?.error || 'Failed to create team');
        }
    };

    const handleCreateClassroom = async (formData) => {
        try {
            await axios.post(`${API_URL}/api/classrooms`, formData);
            setShowCreate(null);
            loadData();
        } catch (err) {
            alert(err.response?.data?.error || 'Failed to create classroom');
        }
    };

    const handleCreateCompany = async (formData) => {
        try {
            await axios.post(`${API_URL}/api/companies`, formData);
            setShowCreate(null);
            loadData();
        } catch (err) {
            alert(err.response?.data?.error || 'Failed to create company');
        }
    };

    const handleJoinTeam = async (id) => {
        try {
            await axios.post(`${API_URL}/api/teams/${id}/join`);
            loadData();
        } catch (err) {
            alert(err.response?.data?.error || 'Failed to join');
        }
    };

    const handleJoinClassroom = async (id) => {
        try {
            await axios.post(`${API_URL}/api/classrooms/${id}/join`);
            loadData();
        } catch (err) {
            alert(err.response?.data?.error || 'Failed to join');
        }
    };

    const handleJoinCompany = async (id) => {
        try {
            await axios.post(`${API_URL}/api/companies/${id}/join`);
            loadData();
        } catch (err) {
            alert(err.response?.data?.error || 'Failed to join');
        }
    };

    const handleJoinByCode = async (code) => {
        const errors = [];
        const endpoints = [
            { url: `${API_URL}/api/teams/join-by-code`, type: 'team' },
            { url: `${API_URL}/api/classrooms/join-by-code`, type: 'classroom' },
            { url: `${API_URL}/api/companies/join-by-code`, type: 'company' },
        ];
        for (const ep of endpoints) {
            try {
                const res = await axios.post(ep.url, { code });
                if (res.data.success) {
                    setShowJoinCode(false);
                    loadData();
                    const entity = res.data.team || res.data.classroom || res.data.company;
                    if (entity) {
                        navigate(`/teams/${ep.type}/${entity._id}`);
                    }
                    return;
                }
            } catch (err) {
                errors.push(err.response?.data?.error || 'Failed');
            }
        }
        // If all three returned "Invalid invite code", show one clean error
        if (errors.every(e => e === 'Invalid invite code')) {
            alert('Invalid invite code. Please check and try again.');
        } else {
            // Show first non-"invalid code" error (e.g. "Already a member")
            const meaningful = errors.find(e => e !== 'Invalid invite code');
            alert(meaningful || 'Invalid invite code');
        }
    };

    const filteredTeams = teams.filter(t => t.name.toLowerCase().includes(search.toLowerCase()));
    const filteredClassrooms = classrooms.filter(c => c.name.toLowerCase().includes(search.toLowerCase()));
    const filteredCompanies = companies.filter(c => c.name.toLowerCase().includes(search.toLowerCase()));

    return (
        <div className="max-w-7xl mx-auto px-6 py-8">
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-white">Teams & Organization</h1>
                    <p className="text-slate-400 mt-1">Manage your teams, classrooms, and companies</p>
                </div>
                <button onClick={() => setShowJoinCode(true)}
                    className="flex items-center gap-2 px-4 py-2.5 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-sm font-medium transition-colors">
                    <KeyRound size={16} /> Join with Code
                </button>
            </div>

            {/* Tab Switcher */}
            <div className="flex gap-2 mb-6 bg-[#151921]/70 p-1.5 rounded-xl border border-white/5 w-fit">
                <button
                    onClick={() => setActiveTab('student')}
                    className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all ${activeTab === 'student' ? 'bg-white text-[#0B0E14]' : 'text-slate-400 hover:text-white'}`}
                >
                    <GraduationCap size={16} /> Student Section
                </button>
                <button
                    onClick={() => setActiveTab('employee')}
                    className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all ${activeTab === 'employee' ? 'bg-white text-[#0B0E14]' : 'text-slate-400 hover:text-white'}`}
                >
                    <Building2 size={16} /> Employee Section
                </button>
            </div>

            {/* Search + Create */}
            <div className="flex items-center gap-4 mb-6">
                <div className="relative flex-1 max-w-md">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input
                        type="text"
                        placeholder="Search..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 bg-[#151921]/70 border border-white/10 rounded-lg text-white text-sm placeholder-slate-500 focus:border-white/20 focus:outline-none"
                    />
                </div>
                {activeTab === 'student' && (
                    <div className="flex gap-2">
                        <button onClick={() => setShowCreate('team')} className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition-colors">
                            <Plus size={16} /> Create Team
                        </button>
                        <button onClick={() => setShowCreate('classroom')} className="flex items-center gap-2 px-4 py-2.5 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-sm font-medium transition-colors">
                            <Plus size={16} /> Create Classroom
                        </button>
                    </div>
                )}
                {activeTab === 'employee' && (
                    <button onClick={() => setShowCreate('company')} className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-medium transition-colors">
                        <Plus size={16} /> Create Company
                    </button>
                )}
            </div>

            {loading ? (
                <div className="text-center text-slate-400 py-20">Loading...</div>
            ) : (
                <>
                    {/* STUDENT SECTION */}
                    {activeTab === 'student' && (
                        <div className="space-y-8">
                            {/* My Teams */}
                            <Section title="My Teams" icon={<Users size={18} />} count={filteredTeams.filter(t => t.type === 'student').length}>
                                {filteredTeams.filter(t => t.type === 'student').length === 0 ? (
                                    <EmptyState text="No teams yet. Create one or join a public team!" />
                                ) : (
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                        {filteredTeams.filter(t => t.type === 'student').map(team => (
                                            <GroupCard key={team._id} item={team} type="team"
                                                onClick={() => navigate(`/teams/team/${team._id}`)} />
                                        ))}
                                    </div>
                                )}
                            </Section>

                            {/* My Classrooms */}
                            <Section title="My Classrooms" icon={<GraduationCap size={18} />} count={filteredClassrooms.length}>
                                {filteredClassrooms.length === 0 ? (
                                    <EmptyState text="No classrooms. Teachers can create classrooms and add students." />
                                ) : (
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                        {filteredClassrooms.map(c => (
                                            <GroupCard key={c._id} item={c} type="classroom"
                                                onClick={() => navigate(`/teams/classroom/${c._id}`)} />
                                        ))}
                                    </div>
                                )}
                            </Section>

                            {/* Public Teams & Classrooms */}
                            <Section title="Explore Public" icon={<Globe size={18} />} count={publicTeams.length + publicClassrooms.length}>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {publicTeams.map(t => (
                                        <PublicCard key={t._id} item={t} type="team" onJoin={() => handleJoinTeam(t._id)} />
                                    ))}
                                    {publicClassrooms.map(c => (
                                        <PublicCard key={c._id} item={c} type="classroom" onJoin={() => handleJoinClassroom(c._id)} />
                                    ))}
                                    {publicTeams.length === 0 && publicClassrooms.length === 0 && (
                                        <EmptyState text="No public teams or classrooms available." />
                                    )}
                                </div>
                            </Section>
                        </div>
                    )}

                    {/* EMPLOYEE SECTION */}
                    {activeTab === 'employee' && (
                        <div className="space-y-8">
                            {/* My Companies */}
                            <Section title="My Companies" icon={<Building2 size={18} />} count={filteredCompanies.length}>
                                {filteredCompanies.length === 0 ? (
                                    <EmptyState text="No companies yet. Create one or join a public company!" />
                                ) : (
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                        {filteredCompanies.map(c => (
                                            <GroupCard key={c._id} item={c} type="company"
                                                onClick={() => navigate(`/teams/company/${c._id}`)} />
                                        ))}
                                    </div>
                                )}
                            </Section>

                            {/* Employee Teams */}
                            <Section title="Employee Teams" icon={<Users size={18} />} count={filteredTeams.filter(t => t.type === 'employee').length}>
                                {filteredTeams.filter(t => t.type === 'employee').length === 0 ? (
                                    <EmptyState text="No employee teams yet." />
                                ) : (
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                        {filteredTeams.filter(t => t.type === 'employee').map(team => (
                                            <GroupCard key={team._id} item={team} type="team"
                                                onClick={() => navigate(`/teams/team/${team._id}`)} />
                                        ))}
                                    </div>
                                )}
                            </Section>

                            {/* Public Companies */}
                            <Section title="Explore Public Companies" icon={<Globe size={18} />} count={publicCompanies.length}>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {publicCompanies.map(c => (
                                        <PublicCard key={c._id} item={c} type="company" onJoin={() => handleJoinCompany(c._id)} />
                                    ))}
                                    {publicCompanies.length === 0 && (
                                        <EmptyState text="No public companies available." />
                                    )}
                                </div>
                            </Section>
                        </div>
                    )}
                </>
            )}

            {/* Create Modals */}
            {showCreate === 'team' && <CreateTeamModal onClose={() => setShowCreate(null)} onCreate={handleCreateTeam} activeTab={activeTab} />}
            {showCreate === 'classroom' && <CreateClassroomModal onClose={() => setShowCreate(null)} onCreate={handleCreateClassroom} />}
            {showCreate === 'company' && <CreateCompanyModal onClose={() => setShowCreate(null)} onCreate={handleCreateCompany} />}
            {showJoinCode && <JoinByCodeModal onClose={() => setShowJoinCode(false)} onJoin={handleJoinByCode} />}
        </div>
    );
}

function Section({ title, icon, count, children }) {
    return (
        <div>
            <div className="flex items-center gap-2 mb-4">
                <span className="text-slate-400">{icon}</span>
                <h2 className="text-lg font-semibold text-white">{title}</h2>
                <span className="text-xs bg-white/10 text-slate-400 px-2 py-0.5 rounded-full">{count}</span>
            </div>
            {children}
        </div>
    );
}

function EmptyState({ text }) {
    return (
        <div className="col-span-full text-center py-12 text-slate-500 text-sm border border-dashed border-white/10 rounded-xl">
            {text}
        </div>
    );
}

function GroupCard({ item, type, onClick }) {
    const colors = { team: 'blue', classroom: 'purple', company: 'emerald' };
    const icons = { team: <Users size={20} />, classroom: <GraduationCap size={20} />, company: <Building2 size={20} /> };
    const color = colors[type];
    const memberCount = item.members?.length || item.students?.length || item.employees?.length || 0;

    return (
        <div onClick={onClick}
            className="bg-[#151921]/70 border border-white/5 rounded-xl p-5 hover:border-white/15 cursor-pointer transition-all group">
            <div className="flex items-start justify-between mb-3">
                <div className={`w-10 h-10 rounded-lg bg-${color}-500/20 flex items-center justify-center text-${color}-400`}>
                    {icons[type]}
                </div>
                <div className="flex items-center gap-1.5">
                    {item.visibility === 'public' ? <Globe size={12} className="text-emerald-400" /> : <Lock size={12} className="text-slate-500" />}
                    <span className="text-[10px] uppercase tracking-wider text-slate-500">{item.visibility}</span>
                </div>
            </div>
            <h3 className="text-white font-semibold mb-1 group-hover:text-blue-400 transition-colors">{item.name}</h3>
            <p className="text-slate-500 text-xs line-clamp-2 mb-3">{item.description || item.subject || item.industry || 'No description'}</p>
            <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500">{memberCount} member{memberCount !== 1 ? 's' : ''}</span>
                <ChevronRight size={14} className="text-slate-600 group-hover:text-white transition-colors" />
            </div>
        </div>
    );
}

function PublicCard({ item, type, onJoin }) {
    const icons = { team: <Users size={16} />, classroom: <GraduationCap size={16} />, company: <Building2 size={16} /> };
    return (
        <div className="bg-[#151921]/70 border border-white/5 rounded-xl p-5">
            <div className="flex items-center gap-3 mb-3">
                <div className="text-slate-400">{icons[type]}</div>
                <div>
                    <h3 className="text-white font-medium text-sm">{item.name}</h3>
                    <p className="text-slate-500 text-xs">{item.description || item.subject || item.industry || ''}</p>
                </div>
            </div>
            <button onClick={onJoin}
                className="w-full py-2 bg-white/5 hover:bg-white/10 text-white text-xs font-medium rounded-lg transition-colors border border-white/10">
                Join {type}
            </button>
        </div>
    );
}

function CreateTeamModal({ onClose, onCreate, activeTab }) {
    const [form, setForm] = useState({ name: '', description: '', type: activeTab === 'employee' ? 'employee' : 'student', category: 'general', visibility: 'private' });
    return (
        <Modal title="Create Team" onClose={onClose}>
            <div className="space-y-4">
                <Input label="Team Name" value={form.name} onChange={v => setForm({ ...form, name: v })} required />
                <Input label="Description" value={form.description} onChange={v => setForm({ ...form, description: v })} />
                <div>
                    <label className="block text-xs text-slate-400 mb-1.5">Role Type</label>
                    <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}
                        className="w-full px-3 py-2.5 bg-[#0B0E14] border border-white/10 rounded-lg text-white text-sm focus:border-white/20 focus:outline-none">
                        <option value="general">General</option>
                        <option value="classroom">Classroom</option>
                        <option value="study-group">Study Group</option>
                        <option value="department">Department</option>
                        <option value="project">Project</option>
                    </select>
                </div>
                <div className="flex gap-3">
                    <label className="flex items-center gap-2 cursor-pointer">
                        <input type="radio" checked={form.visibility === 'private'} onChange={() => setForm({ ...form, visibility: 'private' })} className="accent-blue-500" />
                        <Lock size={14} className="text-slate-400" /><span className="text-sm text-slate-300">Private</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                        <input type="radio" checked={form.visibility === 'public'} onChange={() => setForm({ ...form, visibility: 'public' })} className="accent-blue-500" />
                        <Globe size={14} className="text-slate-400" /><span className="text-sm text-slate-300">Public</span>
                    </label>
                </div>
                <button onClick={() => onCreate(form)} disabled={!form.name.trim()}
                    className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors">
                    Create Team
                </button>
            </div>
        </Modal>
    );
}

function CreateClassroomModal({ onClose, onCreate }) {
    const [form, setForm] = useState({ name: '', subject: '', description: '', section: '', visibility: 'private' });
    return (
        <Modal title="Create Classroom" onClose={onClose}>
            <div className="space-y-4">
                <Input label="Classroom Name" value={form.name} onChange={v => setForm({ ...form, name: v })} required />
                <Input label="Subject" value={form.subject} onChange={v => setForm({ ...form, subject: v })} />
                <Input label="Section" value={form.section} onChange={v => setForm({ ...form, section: v })} />
                <Input label="Description" value={form.description} onChange={v => setForm({ ...form, description: v })} />
                <div className="flex gap-3">
                    <label className="flex items-center gap-2 cursor-pointer">
                        <input type="radio" checked={form.visibility === 'private'} onChange={() => setForm({ ...form, visibility: 'private' })} className="accent-purple-500" />
                        <Lock size={14} className="text-slate-400" /><span className="text-sm text-slate-300">Private</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                        <input type="radio" checked={form.visibility === 'public'} onChange={() => setForm({ ...form, visibility: 'public' })} className="accent-purple-500" />
                        <Globe size={14} className="text-slate-400" /><span className="text-sm text-slate-300">Public</span>
                    </label>
                </div>
                <button onClick={() => onCreate(form)} disabled={!form.name.trim()}
                    className="w-full py-2.5 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors">
                    Create Classroom
                </button>
            </div>
        </Modal>
    );
}

function CreateCompanyModal({ onClose, onCreate }) {
    const [form, setForm] = useState({ name: '', description: '', industry: '', website: '', size: '1-10', visibility: 'private', departments: [] });
    const [deptInput, setDeptInput] = useState('');
    const addDept = () => { if (deptInput.trim()) { setForm({ ...form, departments: [...form.departments, deptInput.trim()] }); setDeptInput(''); } };
    return (
        <Modal title="Create Company" onClose={onClose}>
            <div className="space-y-4">
                <Input label="Company Name" value={form.name} onChange={v => setForm({ ...form, name: v })} required />
                <Input label="Industry" value={form.industry} onChange={v => setForm({ ...form, industry: v })} />
                <Input label="Website" value={form.website} onChange={v => setForm({ ...form, website: v })} />
                <Input label="Description" value={form.description} onChange={v => setForm({ ...form, description: v })} />
                <div>
                    <label className="block text-xs text-slate-400 mb-1.5">Company Size</label>
                    <select value={form.size} onChange={e => setForm({ ...form, size: e.target.value })}
                        className="w-full px-3 py-2.5 bg-[#0B0E14] border border-white/10 rounded-lg text-white text-sm focus:border-white/20 focus:outline-none">
                        <option value="1-10">1-10</option>
                        <option value="11-50">11-50</option>
                        <option value="51-200">51-200</option>
                        <option value="201-500">201-500</option>
                        <option value="500+">500+</option>
                    </select>
                </div>
                <div>
                    <label className="block text-xs text-slate-400 mb-1.5">Departments</label>
                    <div className="flex gap-2">
                        <input value={deptInput} onChange={e => setDeptInput(e.target.value)} placeholder="Add department..."
                            className="flex-1 px-3 py-2 bg-[#0B0E14] border border-white/10 rounded-lg text-white text-sm placeholder-slate-500 focus:border-white/20 focus:outline-none"
                            onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addDept())} />
                        <button onClick={addDept} className="px-3 py-2 bg-white/10 text-white rounded-lg text-sm">Add</button>
                    </div>
                    {form.departments.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-2">
                            {form.departments.map((d, i) => (
                                <span key={i} className="px-2 py-1 bg-emerald-500/20 text-emerald-400 text-xs rounded-full flex items-center gap-1">
                                    {d}
                                    <button onClick={() => setForm({ ...form, departments: form.departments.filter((_, idx) => idx !== i) })} className="hover:text-white">&times;</button>
                                </span>
                            ))}
                        </div>
                    )}
                </div>
                <div className="flex gap-3">
                    <label className="flex items-center gap-2 cursor-pointer">
                        <input type="radio" checked={form.visibility === 'private'} onChange={() => setForm({ ...form, visibility: 'private' })} className="accent-emerald-500" />
                        <Lock size={14} className="text-slate-400" /><span className="text-sm text-slate-300">Private</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                        <input type="radio" checked={form.visibility === 'public'} onChange={() => setForm({ ...form, visibility: 'public' })} className="accent-emerald-500" />
                        <Globe size={14} className="text-slate-400" /><span className="text-sm text-slate-300">Public</span>
                    </label>
                </div>
                <button onClick={() => onCreate(form)} disabled={!form.name.trim()}
                    className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors">
                    Create Company
                </button>
            </div>
        </Modal>
    );
}

function JoinByCodeModal({ onClose, onJoin }) {
    const [code, setCode] = useState('');
    const [joining, setJoining] = useState(false);
    const handleSubmit = async () => {
        if (!code.trim()) return;
        setJoining(true);
        await onJoin(code.trim());
        setJoining(false);
    };
    return (
        <Modal title="Join with Invite Code" onClose={onClose}>
            <div className="space-y-4">
                <p className="text-slate-400 text-sm">Enter the unique invite code to join a private team, classroom, or company.</p>
                <div>
                    <label className="block text-xs text-slate-400 mb-1.5">Invite Code</label>
                    <input
                        value={code}
                        onChange={e => setCode(e.target.value.toLowerCase())}
                        placeholder="e.g. a1b2c3d4"
                        maxLength={20}
                        className="w-full px-4 py-3 bg-[#0B0E14] border border-white/10 rounded-lg text-white text-center text-lg font-mono tracking-[0.3em] placeholder-slate-600 focus:border-amber-500/50 focus:outline-none"
                        onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                        autoFocus
                    />
                </div>
                <button onClick={handleSubmit} disabled={!code.trim() || joining}
                    className="w-full py-2.5 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2">
                    <KeyRound size={16} /> {joining ? 'Joining...' : 'Join'}
                </button>
            </div>
        </Modal>
    );
}

function Modal({ title, onClose, children }) {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
            <div className="bg-[#151921] border border-white/10 rounded-2xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-5">
                    <h2 className="text-lg font-semibold text-white">{title}</h2>
                    <button onClick={onClose} className="text-slate-500 hover:text-white text-xl">&times;</button>
                </div>
                {children}
            </div>
        </div>
    );
}

function Input({ label, value, onChange, required, placeholder }) {
    return (
        <div>
            <label className="block text-xs text-slate-400 mb-1.5">{label} {required && <span className="text-red-400">*</span>}</label>
            <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder || label}
                className="w-full px-3 py-2.5 bg-[#0B0E14] border border-white/10 rounded-lg text-white text-sm placeholder-slate-500 focus:border-white/20 focus:outline-none" />
        </div>
    );
}
