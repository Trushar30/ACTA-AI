import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Cloud, Download, Play, Calendar, Clock, FileText, Loader2, RefreshCw } from 'lucide-react';
import { motion } from 'framer-motion';

const API_URL = 'http://localhost:3000';

const ZoomRecordings = () => {
    const [recordings, setRecordings] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [downloading, setDownloading] = useState(null);

    const fetchRecordings = async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await axios.get(`${API_URL}/api/zoom/recordings`);
            setRecordings(res.data.recordings || []);
        } catch (err) {
            console.error(err);
            setError(err.response?.data?.error || 'Failed to fetch recordings from Zoom');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchRecordings();
    }, []);

    const formatDuration = (minutes) => {
        const hrs = Math.floor(minutes / 60);
        const mins = minutes % 60;
        return hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`;
    };

    return (
        <div className="max-w-6xl mx-auto w-full px-6 py-8">
            <header className="flex justify-between items-center mb-12">
                <div>
                    <h1 className="text-4xl font-bold mb-2 flex items-center gap-3">
                        <Cloud className="text-blue-400" />
                        Zoom Cloud Recordings
                    </h1>
                    <p className="text-gray-400 font-light">
                        Browse all cloud recordings from your Zoom account
                    </p>
                </div>
                <button
                    onClick={fetchRecordings}
                    disabled={loading}
                    className="p-3 rounded-full bg-white/5 hover:bg-white/10 transition-colors"
                >
                    <RefreshCw className={loading ? 'animate-spin' : ''} size={20} />
                </button>
            </header>

            {loading && (
                <div className="flex justify-center py-20">
                    <Loader2 className="animate-spin text-purple-500" size={40} />
                </div>
            )}

            {error && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-6 text-center">
                    <p className="text-red-400">{error}</p>
                    <button
                        onClick={fetchRecordings}
                        className="mt-4 px-4 py-2 bg-red-500/20 rounded-lg hover:bg-red-500/30 transition-colors"
                    >
                        Retry
                    </button>
                </div>
            )}

            {!loading && !error && recordings.length === 0 && (
                <div className="text-center py-20 text-gray-500">
                    <Cloud size={60} className="mx-auto mb-4 opacity-30" />
                    <p className="text-xl mb-2">No cloud recordings found</p>
                    <p className="text-sm">Cloud recordings from your Zoom meetings will appear here</p>
                </div>
            )}

            {!loading && !error && recordings.length > 0 && (
                <div className="space-y-4">
                    {recordings.map((recording, i) => (
                        <motion.div
                            key={recording.uuid}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.05 }}
                            className="glass rounded-xl p-6 border border-white/5 hover:border-white/10 transition-colors"
                        >
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                <div className="flex-1">
                                    <h3 className="text-xl font-semibold mb-2">{recording.topic}</h3>
                                    <div className="flex flex-wrap items-center gap-4 text-sm text-gray-400">
                                        <span className="flex items-center gap-1">
                                            <Calendar size={14} />
                                            {new Date(recording.start_time).toLocaleDateString()}
                                        </span>
                                        <span className="flex items-center gap-1">
                                            <Clock size={14} />
                                            {new Date(recording.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                        <span className="flex items-center gap-1">
                                            <Play size={14} />
                                            {formatDuration(recording.duration)}
                                        </span>
                                    </div>
                                </div>

                                <div className="flex items-center gap-2">
                                    {recording.recording_files?.length > 0 && (
                                        <div className="text-xs text-gray-500">
                                            {recording.recording_files.length} file(s)
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Recording Files */}
                            {recording.recording_files && recording.recording_files.length > 0 && (
                                <div className="mt-4 pt-4 border-t border-white/5">
                                    <p className="text-xs text-gray-500 mb-3">Available Files:</p>
                                    <div className="flex flex-wrap gap-2">
                                        {recording.recording_files.map((file, j) => (
                                            <div
                                                key={j}
                                                className="px-3 py-2 bg-white/5 rounded-lg text-xs flex items-center gap-2"
                                            >
                                                {file.file_type === 'MP4' && <Play size={12} className="text-blue-400" />}
                                                {file.file_type === 'M4A' && <Play size={12} className="text-green-400" />}
                                                {file.file_type === 'TRANSCRIPT' && <FileText size={12} className="text-purple-400" />}
                                                <span>{file.file_type}</span>
                                                <span className="text-gray-600">
                                                    {file.file_size ? `${(file.file_size / 1024 / 1024).toFixed(1)} MB` : ''}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </motion.div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default ZoomRecordings;
