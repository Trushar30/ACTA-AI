import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
    Save, CheckCircle, XCircle, Loader2, Link as LinkIcon,
    AlertCircle, ExternalLink, RefreshCw, X, Bot, Trello, Box,
    ChevronRight, Globe, Lock, Key, Presentation as PresentationIcon
} from 'lucide-react';
import axios from 'axios';

const API_URL = 'http://localhost:3000';

const Settings = () => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [activeModal, setActiveModal] = useState(null); // 'jira', 'trello', 'bot'

    // Jira State
    const [jiraConfig, setJiraConfig] = useState({ domain: '', email: '', apiToken: '', projectKey: '' });
    const [jiraStatus, setJiraStatus] = useState({ status: 'unknown', message: '' });
    const [testingJira, setTestingJira] = useState(false);
    const [savingJira, setSavingJira] = useState(false);

    // Trello State
    const [trelloConfig, setTrelloConfig] = useState({ apiKey: '', apiToken: '', boardId: '', listId: '' });
    const [trelloStatus, setTrelloStatus] = useState({ status: 'unknown', message: '' });
    const [testingTrello, setTestingTrello] = useState(false);
    const [savingTrello, setSavingTrello] = useState(false);

    // Google Meet Bot Setup State
    const [botConfigured, setBotConfigured] = useState(false);
    const [botLoading, setBotLoading] = useState(false);
    const [botStatus, setBotStatus] = useState({ type: null, message: '' });

    // MS Teams Bot Setup State
    const [teamsBotConfigured, setTeamsBotConfigured] = useState(false);
    const [teamsBotLoading, setTeamsBotLoading] = useState(false);
    const [teamsBotStatus, setTeamsBotStatus] = useState({ type: null, message: '' });

    // Load configurations
    useEffect(() => {
        loadAllConfigs();
    }, []);

    const loadAllConfigs = async () => {
        try {
            setLoading(true);
            const [integrationsRes, botRes, teamsBotRes] = await Promise.all([
                axios.get(`${API_URL}/api/integrations`),
                axios.get(`${API_URL}/api/bot/setup`),
                axios.get(`${API_URL}/api/bot/teams/setup`).catch(() => ({ data: { isConfigured: false } }))
            ]);

            // Set Jira/Trello configs
            if (integrationsRes.data.jiraConfig) {
                setJiraConfig({
                    domain: integrationsRes.data.jiraConfig.domain || '',
                    email: integrationsRes.data.jiraConfig.email || '',
                    apiToken: integrationsRes.data.jiraConfig.apiToken || '',
                    projectKey: integrationsRes.data.jiraConfig.projectKey || ''
                });
            }
            if (integrationsRes.data.trelloConfig) {
                setTrelloConfig({
                    apiKey: integrationsRes.data.trelloConfig.apiKey || '',
                    apiToken: integrationsRes.data.trelloConfig.apiToken || '',
                    boardId: integrationsRes.data.trelloConfig.boardId || '',
                    listId: integrationsRes.data.trelloConfig.listId || ''
                });
            }

            // Set Google Meet Bot config
            setBotConfigured(botRes.data.isConfigured);

            // Set Teams Bot config
            setTeamsBotConfigured(teamsBotRes.data.isConfigured);

        } catch (err) {
            console.error('Failed to load configurations:', err);
        } finally {
            setLoading(false);
        }
    };

    // Test connections when modal opens or after save
    useEffect(() => {
        if (!loading && jiraConfig.domain && jiraConfig.apiToken) testJiraConnection(true);
        if (!loading && trelloConfig.apiKey && trelloConfig.apiToken) testTrelloConnection(true);
    }, [loading]);

    // --- JIRA LOGIC ---
    const testJiraConnection = async (silent = false) => {
        if (!silent) setTestingJira(true);
        try {
            const res = await axios.post(`${API_URL}/api/integrations/test/jira`, jiraConfig);
            setJiraStatus({ status: 'online', message: res.data.message, user: res.data.user });
        } catch (err) {
            setJiraStatus({ status: 'offline', message: err.response?.data?.error || 'Connection failed' });
        } finally {
            if (!silent) setTestingJira(false);
        }
    };

    const saveJira = async () => {
        setSavingJira(true);
        try {
            await axios.post(`${API_URL}/api/integrations/save`, { jiraConfig });
            await testJiraConnection(true);
            setActiveModal(null);
        } catch (err) {
            alert('Failed to save Jira settings');
        } finally {
            setSavingJira(false);
        }
    };

    // --- TRELLO LOGIC ---
    const testTrelloConnection = async (silent = false) => {
        if (!silent) setTestingTrello(true);
        try {
            const res = await axios.post(`${API_URL}/api/integrations/test/trello`, trelloConfig);
            setTrelloStatus({ status: 'online', message: res.data.message, user: res.data.user });
        } catch (err) {
            setTrelloStatus({ status: 'offline', message: err.response?.data?.error || 'Connection failed' });
        } finally {
            if (!silent) setTestingTrello(false);
        }
    };

    const saveTrello = async () => {
        setSavingTrello(true);
        try {
            await axios.post(`${API_URL}/api/integrations/save`, { trelloConfig });
            await testTrelloConnection(true);
            setActiveModal(null);
        } catch (err) {
            alert('Failed to save Trello settings');
        } finally {
            setSavingTrello(false);
        }
    };

    // --- BOT SETUP LOGIC ---
    const handleBotSetup = async () => {
        setBotLoading(true);
        setBotStatus({ type: 'info', message: 'Opening browser...' });

        try {
            const res = await axios.post(`${API_URL}/api/bot/setup/start`);

            if (res.data.success) {
                setBotStatus({
                    type: 'info',
                    message: 'Browser opened! Log into Google. Waiting for completion...'
                });

                // Poll for completion
                const pollInterval = setInterval(async () => {
                    try {
                        const statusRes = await axios.get(`${API_URL}/api/bot/setup`);
                        if (statusRes.data.isConfigured) {
                            clearInterval(pollInterval);
                            setBotConfigured(true);
                            setBotLoading(false);
                            setBotStatus({ type: 'success', message: 'Setup complete!' });
                            setTimeout(() => {
                                setActiveModal(null);
                                setBotStatus({ type: null, message: '' });
                            }, 2000);
                        }
                    } catch (e) { console.error(e); }
                }, 3000);

                // Timeout
                setTimeout(() => {
                    clearInterval(pollInterval);
                    if (botLoading) {
                        setBotLoading(false);
                        setBotStatus({ type: 'error', message: 'Setup timed out. Please try again.' });
                    }
                }, 300000);
            }
        } catch (err) {
            setBotStatus({ type: 'error', message: 'Failed to launch browser' });
            setBotLoading(false);
        }
    };

    const handleBotDisconnect = async () => {
        if (!window.confirm('Are you sure you want to remove the bot configuration?')) return;
        setBotLoading(true);
        try {
            await axios.delete(`${API_URL}/api/bot/setup`);
            setBotConfigured(false);
            setBotStatus({ type: 'success', message: 'Configuration removed' });
        } catch (err) {
            setBotStatus({ type: 'error', message: 'Failed to remove configuration' });
        } finally {
            setBotLoading(false);
        }
    };

    // --- MS TEAMS BOT SETUP LOGIC ---
    const handleTeamsBotSetup = async () => {
        setTeamsBotLoading(true);
        setTeamsBotStatus({ type: 'info', message: 'Opening browser...' });

        try {
            const res = await axios.post(`${API_URL}/api/bot/teams/setup/start`);

            if (res.data.success) {
                setTeamsBotStatus({
                    type: 'info',
                    message: 'Browser opened! Log into Microsoft. Waiting for completion...'
                });

                // Poll for completion
                const pollInterval = setInterval(async () => {
                    try {
                        const statusRes = await axios.get(`${API_URL}/api/bot/teams/setup`);
                        if (statusRes.data.isConfigured) {
                            clearInterval(pollInterval);
                            setTeamsBotConfigured(true);
                            setTeamsBotLoading(false);
                            setTeamsBotStatus({ type: 'success', message: 'Setup complete!' });
                            setTimeout(() => {
                                setActiveModal(null);
                                setTeamsBotStatus({ type: null, message: '' });
                            }, 2000);
                        }
                    } catch (e) { console.error(e); }
                }, 3000);

                // Timeout
                setTimeout(() => {
                    clearInterval(pollInterval);
                    if (teamsBotLoading) {
                        setTeamsBotLoading(false);
                        setTeamsBotStatus({ type: 'error', message: 'Setup timed out. Please try again.' });
                    }
                }, 300000);
            }
        } catch (err) {
            setTeamsBotStatus({ type: 'error', message: 'Failed to launch browser' });
            setTeamsBotLoading(false);
        }
    };

    const handleTeamsBotDisconnect = async () => {
        if (!window.confirm('Are you sure you want to remove the Teams bot configuration?')) return;
        setTeamsBotLoading(true);
        try {
            await axios.delete(`${API_URL}/api/bot/teams/setup`);
            setTeamsBotConfigured(false);
            setTeamsBotStatus({ type: 'success', message: 'Configuration removed' });
        } catch (err) {
            setTeamsBotStatus({ type: 'error', message: 'Failed to remove configuration' });
        } finally {
            setTeamsBotLoading(false);
        }
    };


    // --- UI COMPONENTS ---

    const IntegrationCard = ({ id, title, description, icon: Icon, status, connected, onClick }) => (
        <motion.div
            whileHover={{ y: -3 }}
            className={`cursor-pointer overflow-hidden relative group rounded-xl border ${connected
                ? 'bg-blue-500/5 border-blue-500/20'
                : 'bg-white/5 border-white/10 hover:border-white/20'
                }`}
            onClick={onClick}
        >
            <div className="p-4">
                <div className="flex justify-between items-start mb-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${connected ? 'bg-blue-500/20 text-blue-400' : 'bg-white/10 text-gray-400'
                        }`}>
                        <Icon size={20} />
                    </div>
                    {connected && (
                        <div className="flex flex-col items-end gap-0.5">
                            <div className="px-2 py-0.5 rounded-full bg-green-500/20 border border-green-500/30 flex items-center gap-1">
                                <div className="w-1 h-1 rounded-full bg-green-400 animate-pulse" />
                                <span className="text-[9px] font-bold text-green-400 uppercase tracking-wide">Live</span>
                            </div>
                            <span className="text-[8px] text-green-400/70 font-medium">Connected</span>
                        </div>
                    )}
                </div>

                <h3 className="text-base font-bold mb-1 group-hover:text-blue-400 transition-colors">{title}</h3>
                <p className="text-xs text-gray-400 mb-4 line-clamp-2">{description}</p>

                <div className="flex items-center justify-between mt-auto">
                    <span className={`text-xs font-medium flex items-center gap-1.5 ${connected ? 'text-blue-400' : 'text-gray-500 group-hover:text-gray-300'
                        }`}>
                        {connected ? 'Manage Connection' : 'Connect App'}
                        <ChevronRight size={14} />
                    </span>
                </div>
            </div>
        </motion.div>
    );

    const Modal = ({ title, children, onClose }) => (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={onClose}
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="relative w-full max-w-lg bg-[#141922] border border-white/10 rounded-2xl shadow-2xl overflow-hidden"
            >
                <div className="px-6 py-4 border-b border-white/5 flex justify-between items-start">
                    <h2 className="text-xl font-bold">{title}</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
                        <X size={20} />
                    </button>
                </div>
                <div className="p-6 max-h-[80vh] overflow-y-auto">
                    {children}
                </div>
            </motion.div>
        </div>
    );

    if (loading) {
        return (
            <div className="min-h-[80vh] flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-blue-400" />
            </div>
        );
    }

    return (
        <div className="min-h-screen p-8 max-w-7xl mx-auto">
            <div className="mb-10">
                <h1 className="text-4xl font-bold mb-3">Settings & Integrations</h1>
                <p className="text-gray-400 text-lg">Manage your external connections and bot status</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <IntegrationCard
                    id="jira"
                    title="Jira Software"
                    description="Connect to your Jira workspace to automatically create issues and sync meeting notes."
                    icon={Box}
                    connected={jiraStatus.status === 'online'}
                    onClick={() => setActiveModal('jira')}
                />

                <IntegrationCard
                    id="trello"
                    title="Trello"
                    description="Sync action items to Trello cards and keep your boards updated."
                    icon={Trello}
                    connected={trelloStatus.status === 'online'}
                    onClick={() => setActiveModal('trello')}
                />

                <IntegrationCard
                    id="bot"
                    title="Google Meet Bot"
                    description="Configure the authenticated bot account to join restricted meetings."
                    icon={Bot}
                    connected={botConfigured}
                    onClick={() => setActiveModal('bot')}
                />

                <IntegrationCard
                    id="teamsbot"
                    title="MS Teams Bot"
                    description="Teams supports guest joining - no setup required! Bot joins as guest automatically."
                    icon={Bot}
                    connected={true}
                    onClick={() => setActiveModal('teamsbot')}
                />

                <IntegrationCard
                    id="about"
                    title="About ACTA-AI"
                    description="Learn about our platform's features, architecture, and business impact through an interactive presentation."
                    icon={PresentationIcon}
                    connected={false}
                    onClick={() => navigate('/presentation')}
                />
            </div>

            <AnimatePresence>
                {/* JIRA MODAL */}
                {activeModal === 'jira' && (
                    <Modal title="Configure Jira" onClose={() => setActiveModal(null)}>
                        <div className="space-y-4">
                            <div className="flex items-center justify-between mb-4 p-3 rounded-lg bg-white/5 border border-white/10">
                                <div className="flex items-center gap-2">
                                    <span className={`w-2 h-2 rounded-full ${jiraStatus.status === 'online' ? 'bg-green-400 animate-pulse' : 'bg-red-400'}`} />
                                    <span className="text-sm font-medium">
                                        {jiraStatus.status === 'online' ? 'Connected to Jira' : 'Not Connected'}
                                    </span>
                                </div>
                                {jiraStatus.status === 'online' && (
                                    <div className="px-2.5 py-1 rounded-full bg-green-500/20 border border-green-500/30 flex items-center gap-1.5">
                                        <span className="text-[10px] font-bold text-green-400 uppercase tracking-wide">Live</span>
                                    </div>
                                )}
                            </div>

                            <div className="space-y-3">
                                <label className="block text-sm font-medium text-gray-300">Base URL</label>
                                <div className="relative">
                                    <Globe className="absolute left-3 top-3 text-gray-500" size={16} />
                                    <input
                                        type="text"
                                        value={jiraConfig.domain}
                                        onChange={(e) => setJiraConfig({ ...jiraConfig, domain: e.target.value })}
                                        className="w-full pl-10 pr-4 py-3 bg-white/5 border border-white/10 rounded-lg focus:border-blue-500 outline-none transition-colors"
                                        placeholder="https://your-domain.atlassian.net"
                                    />
                                </div>

                                <label className="block text-sm font-medium text-gray-300">Email</label>
                                <input
                                    type="email"
                                    value={jiraConfig.email}
                                    onChange={(e) => setJiraConfig({ ...jiraConfig, email: e.target.value })}
                                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg focus:border-blue-500 outline-none transition-colors"
                                    placeholder="email@example.com"
                                />

                                <label className="block text-sm font-medium text-gray-300">API Token</label>
                                <div className="relative">
                                    <Key className="absolute left-3 top-3 text-gray-500" size={16} />
                                    <input
                                        type="password"
                                        value={jiraConfig.apiToken}
                                        onChange={(e) => setJiraConfig({ ...jiraConfig, apiToken: e.target.value })}
                                        className="w-full pl-10 pr-4 py-3 bg-white/5 border border-white/10 rounded-lg focus:border-blue-500 outline-none transition-colors"
                                        placeholder="••••••••••••••••"
                                    />
                                </div>

                                <label className="block text-sm font-medium text-gray-300">Project Key (Optional)</label>
                                <input
                                    type="text"
                                    value={jiraConfig.projectKey}
                                    onChange={(e) => setJiraConfig({ ...jiraConfig, projectKey: e.target.value })}
                                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg focus:border-blue-500 outline-none transition-colors"
                                    placeholder="PROJ"
                                />
                            </div>

                            <div className="mt-6">
                                <button
                                    onClick={saveJira}
                                    disabled={savingJira}
                                    className="w-full py-3 rounded-lg bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 transition-all font-semibold flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20"
                                >
                                    {savingJira ? <Loader2 className="animate-spin" size={18} /> : (
                                        <>
                                            <Save size={18} />
                                            Integrate
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </Modal>
                )}

                {/* TRELLO MODAL */}
                {activeModal === 'trello' && (
                    <Modal title="Configure Trello" onClose={() => setActiveModal(null)}>
                        <div className="space-y-4">
                            <div className="flex items-center justify-between mb-4 p-3 rounded-lg bg-white/5 border border-white/10">
                                <div className="flex items-center gap-2">
                                    <span className={`w-2 h-2 rounded-full ${trelloStatus.status === 'online' ? 'bg-green-400 animate-pulse' : 'bg-red-400'}`} />
                                    <span className="text-sm font-medium">
                                        {trelloStatus.status === 'online' ? 'Connected to Trello' : 'Not Connected'}
                                    </span>
                                </div>
                                {trelloStatus.status === 'online' && (
                                    <div className="px-2.5 py-1 rounded-full bg-green-500/20 border border-green-500/30 flex items-center gap-1.5">
                                        <span className="text-[10px] font-bold text-green-400 uppercase tracking-wide">Live</span>
                                    </div>
                                )}
                            </div>

                            <div className="space-y-3">
                                <label className="block text-sm font-medium text-gray-300">API Key</label>
                                <div className="relative">
                                    <Key className="absolute left-3 top-3 text-gray-500" size={16} />
                                    <input
                                        type="text"
                                        value={trelloConfig.apiKey}
                                        onChange={(e) => setTrelloConfig({ ...trelloConfig, apiKey: e.target.value })}
                                        className="w-full pl-10 pr-4 py-3 bg-white/5 border border-white/10 rounded-lg focus:border-indigo-500 outline-none transition-colors"
                                        placeholder="TRELLO_API_KEY"
                                    />
                                </div>
                                <a href="https://trello.com/app-key" target="_blank" rel="noreferrer" className="text-xs text-indigo-400 hover:underline flex items-center gap-1">
                                    Get API Key <ExternalLink size={10} />
                                </a>

                                <label className="block text-sm font-medium text-gray-300">API Token</label>
                                <div className="relative">
                                    <Lock className="absolute left-3 top-3 text-gray-500" size={16} />
                                    <input
                                        type="password"
                                        value={trelloConfig.apiToken}
                                        onChange={(e) => setTrelloConfig({ ...trelloConfig, apiToken: e.target.value })}
                                        className="w-full pl-10 pr-4 py-3 bg-white/5 border border-white/10 rounded-lg focus:border-indigo-500 outline-none transition-colors"
                                        placeholder="TRELLO_TOKEN"
                                    />
                                </div>

                                <label className="block text-sm font-medium text-gray-300">Board ID</label>
                                <input
                                    type="text"
                                    value={trelloConfig.boardId}
                                    onChange={(e) => setTrelloConfig({ ...trelloConfig, boardId: e.target.value })}
                                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg focus:border-indigo-500 outline-none transition-colors"
                                    placeholder="TRELLO_BOARD_ID"
                                />
                                <p className="text-xs text-gray-500 mt-1">Find this in your Trello board URL</p>

                                <label className="block text-sm font-medium text-gray-300">List ID</label>
                                <input
                                    type="text"
                                    value={trelloConfig.listId}
                                    onChange={(e) => setTrelloConfig({ ...trelloConfig, listId: e.target.value })}
                                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg focus:border-indigo-500 outline-none transition-colors"
                                    placeholder="TRELLO_LIST_ID"
                                />
                                <p className="text-xs text-gray-500 mt-1">Find this in your Trello list settings or API response</p>
                            </div>

                            <div className="mt-6">
                                <button
                                    onClick={saveTrello}
                                    disabled={savingTrello}
                                    className="w-full py-3 rounded-lg bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 transition-all font-semibold flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/20"
                                >
                                    {savingTrello ? <Loader2 className="animate-spin" size={18} /> : (
                                        <>
                                            <Save size={18} />
                                            Integrate
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </Modal>
                )}

                {/* BOT SETUP MODAL */}
                {activeModal === 'bot' && (
                    <Modal title="Google Meet Bot Config" onClose={() => setActiveModal(null)}>
                        <div className="space-y-6">
                            <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl">
                                <h4 className="flex items-center gap-2 font-semibold text-blue-400 mb-2">
                                    <Globe size={16} />
                                    Browser Authentication
                                </h4>
                                <p className="text-sm text-blue-200/80 leading-relaxed">
                                    To join Google Meet calls, the bot needs an authenticated browser session.
                                    We'll open a secure browser window for you to log in once.
                                </p>
                            </div>

                            {botConfigured ? (
                                <div className="text-center py-6">
                                    <div className="w-16 h-16 bg-green-500/20 text-green-400 rounded-full flex items-center justify-center mx-auto mb-4">
                                        <CheckCircle size={32} />
                                    </div>
                                    <h3 className="text-xl font-bold mb-2">Bot Ready</h3>
                                    <p className="text-gray-400 mb-6">Your bot is configured and ready to join meetings.</p>

                                    <div className="flex flex-col gap-3">
                                        <button
                                            onClick={handleBotSetup}
                                            disabled={botLoading}
                                            className="w-full py-3 rounded-lg bg-white/5 hover:bg-white/10 transition-colors font-medium text-white flex items-center justify-center gap-2"
                                        >
                                            <RefreshCw size={18} className={botLoading ? "animate-spin" : ""} />
                                            Re-authenticate (Re-connect)
                                        </button>
                                        <button
                                            onClick={handleBotDisconnect}
                                            disabled={botLoading}
                                            className="w-full py-3 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-colors font-medium flex items-center justify-center gap-2"
                                        >
                                            <XCircle size={18} />
                                            Remove Configuration
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div className="text-center py-6">
                                    <div className="w-16 h-16 bg-white/5 text-gray-400 rounded-full flex items-center justify-center mx-auto mb-4">
                                        <UserIconPlaceholder />
                                    </div>
                                    <h3 className="text-xl font-bold mb-2">Not Configured</h3>
                                    <p className="text-gray-400 mb-6">Connect a Google account to enable the bot.</p>

                                    <button
                                        onClick={handleBotSetup}
                                        disabled={botLoading}
                                        className="w-full py-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition-colors font-medium flex items-center justify-center gap-2"
                                    >
                                        {botLoading ? <Loader2 className="animate-spin" size={18} /> : <ExternalLink size={18} />}
                                        Launch Setup Browser
                                    </button>
                                </div>
                            )}

                            {botStatus.message && (
                                <div className={`p-3 rounded-lg text-sm flex items-center gap-2 ${botStatus.type === 'success' ? 'bg-green-500/10 text-green-400' :
                                    botStatus.type === 'error' ? 'bg-red-500/10 text-red-400' :
                                        'bg-blue-500/10 text-blue-400'
                                    }`}>
                                    {botLoading && <Loader2 size={14} className="animate-spin" />}
                                    {botStatus.message}
                                </div>
                            )}
                        </div>
                    </Modal>
                )}
                {/* MS TEAMS BOT INFO MODAL */}
                {activeModal === 'teamsbot' && (
                    <Modal title="MS Teams Bot" onClose={() => setActiveModal(null)}>
                        <div className="space-y-6">
                            <div className="text-center py-6">
                                <div className="w-16 h-16 bg-green-500/20 text-green-400 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <CheckCircle size={32} />
                                </div>
                                <h3 className="text-xl font-bold mb-2">Ready to Use!</h3>
                                <p className="text-gray-400 mb-4">
                                    Microsoft Teams supports <strong className="text-white">guest joining</strong> - no Microsoft account required!
                                </p>
                            </div>

                            <div className="p-4 bg-purple-500/10 border border-purple-500/20 rounded-xl">
                                <h4 className="flex items-center gap-2 font-semibold text-purple-400 mb-2">
                                    <Bot size={16} />
                                    How It Works
                                </h4>
                                <ul className="text-sm text-purple-200/80 leading-relaxed space-y-2">
                                    <li>✓ Bot automatically joins as a guest</li>
                                    <li>✓ Enters bot name and disables camera/mic</li>
                                    <li>✓ Clicks "Join now" to enter meeting</li>
                                    <li>✓ Records audio and provides live transcription</li>
                                </ul>
                            </div>

                            <div className="p-3 rounded-lg text-sm bg-green-500/10 text-green-400 flex items-center gap-2">
                                <CheckCircle size={16} />
                                No setup needed - just paste a Teams meeting link!
                            </div>
                        </div>
                    </Modal>
                )}
            </AnimatePresence>
        </div>
    );
};

// Helper for UI
const UserIconPlaceholder = () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
        <circle cx="12" cy="7" r="4" />
    </svg>
);

export default Settings;
