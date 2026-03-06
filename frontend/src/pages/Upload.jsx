import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { io } from 'socket.io-client';
import { Upload as UploadIcon, File, FileAudio, FileVideo, X, Loader2, CheckCircle2, AlertCircle, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Loader from '../components/Loader';

const API_URL = 'http://localhost:3000';

const Upload = () => {
    const [selectedFile, setSelectedFile] = useState(null);
    const [uploading, setUploading] = useState(false);
    const [processing, setProcessing] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [result, setResult] = useState(null);
    const [error, setError] = useState(null);
    const [meetingTitle, setMeetingTitle] = useState('');
    const [currentMeetingId, setCurrentMeetingId] = useState(null);
    const [processingStatus, setProcessingStatus] = useState('');

    const acceptedFormats = [
        '.mp3', '.wav', '.m4a', '.aac', '.ogg', '.flac', // Audio
        '.mp4', '.webm', '.mov', '.avi', '.mkv' // Video
    ];

    // Socket.IO connection for real-time updates
    useEffect(() => {
        const socket = io(API_URL, {
            transports: ['websocket', 'polling']
        });

        socket.on('connect', () => {
            console.log('[Upload] Socket connected:', socket.id);
        });

        socket.on('meetingUpdate', (data) => {
            console.log('[Upload] Meeting update:', data);
            
            if (currentMeetingId && data.meetingId === currentMeetingId) {
                if (data.status === 'processing') {
                    setProcessingStatus(data.message || 'Processing...');
                } else if (data.status === 'completed') {
                    setProcessing(false);
                    setResult({
                        success: true,
                        meetingId: data.meetingId,
                        transcription: data.transcription,
                        speakers: data.speakers?.length || data.totalSpeakers || 0,
                        timeline: data.timeline
                    });
                } else if (data.status === 'failed') {
                    setProcessing(false);
                    setError(data.message || 'Processing failed');
                }
            }
        });

        return () => {
            socket.disconnect();
        };
    }, [currentMeetingId]);

    const handleFileSelect = (e) => {
        const file = e.target.files[0];
        if (file) {
            // Check file size (max 500MB)
            if (file.size > 500 * 1024 * 1024) {
                setError('File size must be less than 500MB');
                return;
            }
            setSelectedFile(file);
            setError(null);
            setResult(null);
        }
    };

    const handleDrop = (e) => {
        e.preventDefault();
        const file = e.dataTransfer.files[0];
        if (file) {
            if (file.size > 500 * 1024 * 1024) {
                setError('File size must be less than 500MB');
                return;
            }
            setSelectedFile(file);
            setError(null);
            setResult(null);
        }
    };

    const handleDragOver = (e) => {
        e.preventDefault();
    };

    const removeFile = () => {
        setSelectedFile(null);
        setUploadProgress(0);
        setError(null);
        setResult(null);
    };

    const handleUpload = async () => {
        if (!selectedFile) return;

        setUploading(true);
        setProcessing(false);
        setError(null);
        setUploadProgress(0);

        const formData = new FormData();
        formData.append('audio', selectedFile);
        formData.append('title', meetingTitle || selectedFile.name);

        try {
            const response = await axios.post(`${API_URL}/api/meetings/upload`, formData, {
                headers: {
                    'Content-Type': 'multipart/form-data'
                },
                onUploadProgress: (progressEvent) => {
                    const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
                    setUploadProgress(progress);
                }
            });

            setUploading(false);
            setProcessing(true);
            setCurrentMeetingId(response.data.meetingId);
            setProcessingStatus('Processing started...');

            console.log('[Upload] File uploaded successfully. Meeting ID:', response.data.meetingId);

        } catch (err) {
            console.error('Upload error:', err);
            setError(err.response?.data?.error || 'Upload failed. Please try again.');
            setUploading(false);
            setProcessing(false);
        }
    };

    // Timeout handling (15 minutes)
    useEffect(() => {
        if (processing && currentMeetingId) {
            const timeout = setTimeout(() => {
                setProcessing(false);
                setError('Processing timeout. Please check the Archive Meetings page.');
            }, 15 * 60 * 1000);

            return () => clearTimeout(timeout);
        }
    }, [processing, currentMeetingId]);

    const getFileIcon = (file) => {
        if (!file) return <File size={40} />;
        const ext = file.name.split('.').pop().toLowerCase();
        if (['mp4', 'webm', 'mov', 'avi', 'mkv'].includes(ext)) {
            return <FileVideo size={40} className="text-white" />;
        }
        return <FileAudio size={40} className="text-blue-400" />;
    };

    const formatFileSize = (bytes) => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
    };

    return (
        <div className="max-w-4xl mx-auto w-full px-6 py-8">
            <header className="mb-8">
                <h1 className="text-4xl font-bold mb-2 flex items-center gap-3">
                    <UploadIcon className="text-white" />
                    Upload Recording
                </h1>
                <p className="text-gray-400 font-light">
                    Upload your meeting audio or video for AI transcription and speaker identification
                </p>
            </header>

            {/* Upload Area */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="glass rounded-2xl p-8 mb-6"
            >
                {!selectedFile ? (
                    <div
                        onDrop={handleDrop}
                        onDragOver={handleDragOver}
                        className="border-2 border-dashed border-white/30 rounded-xl p-12 text-center hover:border-white/60 transition-colors cursor-pointer"
                        onClick={() => document.getElementById('fileInput').click()}
                    >
                        <UploadIcon size={60} className="mx-auto mb-4 text-white opacity-50" />
                        <h3 className="text-xl font-semibold mb-2">Drop your file here</h3>
                        <p className="text-gray-400 mb-4">or click to browse</p>
                        <p className="text-sm text-gray-500">
                            Supports: MP3, WAV, M4A, MP4, WebM, MOV (Max 500MB)
                        </p>
                        <input
                            id="fileInput"
                            type="file"
                            accept={acceptedFormats.join(',')}
                            onChange={handleFileSelect}
                            className="hidden"
                        />
                    </div>
                ) : (
                    <div className="space-y-4">
                        {/* Meeting Title Input */}
                        <div>
                            <label className="block text-sm text-gray-400 mb-2">Meeting Title (Optional)</label>
                            <input
                                type="text"
                                value={meetingTitle}
                                onChange={(e) => setMeetingTitle(e.target.value)}
                                placeholder="e.g., Q1 Planning Meeting"
                                className="w-full px-4 py-3 bg-black/30 border border-white/10 rounded-lg focus:outline-none focus:border-white text-white"
                            />
                        </div>

                        {/* Selected File */}
                        <div className="flex items-center gap-4 p-4 bg-white/5 rounded-xl">
                            <div className="flex-shrink-0">
                                {getFileIcon(selectedFile)}
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-white font-medium truncate">{selectedFile.name}</p>
                                <p className="text-sm text-gray-400">{formatFileSize(selectedFile.size)}</p>
                            </div>
                            {!uploading && !processing && (
                                <button
                                    onClick={removeFile}
                                    className="flex-shrink-0 p-2 hover:bg-red-500/20 rounded-lg transition-colors"
                                >
                                    <X size={20} className="text-red-400" />
                                </button>
                            )}
                        </div>

                        {/* Upload Progress */}
                        {uploading && (
                            <div>
                                <div className="flex justify-between text-sm text-gray-400 mb-2">
                                    <span>Uploading...</span>
                                    <span>{uploadProgress}%</span>
                                </div>
                                <div className="w-full bg-white/5 rounded-full h-2 overflow-hidden">
                                    <motion.div
                                        initial={{ width: 0 }}
                                        animate={{ width: `${uploadProgress}%` }}
                                        className="h-full bg-gradient-to-r from-white to-gray-200"
                                    />
                                </div>
                            </div>
                        )}

                        {/* Processing Status */}
                        {processing && (
                            <div className="p-4 bg-white/10 border border-white/20 rounded-lg">
                                <div className="flex items-center gap-3">
                                    <Loader2 className="animate-spin text-white" size={24} />
                                    <div>
                                        <p className="text-white font-medium">Processing your recording...</p>
                                        <p className="text-sm text-gray-400">
                                            {processingStatus || 'AI transcription and speaker identification in progress'}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Upload Button */}
                        {!uploading && !processing && !result && (
                            <button
                                onClick={handleUpload}
                                className="w-full py-4 bg-gradient-to-r from-white to-gray-200 hover:from-gray-100 hover:to-gray-300 text-black rounded-xl font-semibold transition-all flex items-center justify-center gap-2"
                            >
                                <Sparkles size={20} />
                                Start AI Transcription
                            </button>
                        )}
                    </div>
                )}
            </motion.div>

            {/* Error Message */}
            <AnimatePresence>
                {error && (
                    <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="glass rounded-xl p-4 mb-6 border border-red-500/30"
                    >
                        <div className="flex items-center gap-3">
                            <AlertCircle className="text-red-400" size={24} />
                            <p className="text-red-400">{error}</p>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Success Result */}
            <AnimatePresence>
                {result && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="glass rounded-2xl p-8 border border-green-500/30"
                    >
                        <div className="text-center">
                            <CheckCircle2 size={60} className="text-green-400 mx-auto mb-4" />
                            <h2 className="text-2xl font-bold mb-2">Transcription Complete! 🎉</h2>
                            <p className="text-gray-400 mb-6">Your recording has been processed successfully</p>
                            
                            <div className="grid grid-cols-2 gap-4 mb-6">
                                <div className="p-4 bg-white/5 rounded-xl">
                                    <p className="text-sm text-gray-400 mb-1">Speakers Detected</p>
                                    <p className="text-2xl font-bold text-white">{result.speakers || 'N/A'}</p>
                                </div>
                                <div className="p-4 bg-white/5 rounded-xl">
                                    <p className="text-sm text-gray-400 mb-1">Meeting ID</p>
                                    <p className="text-sm font-mono text-gray-300">{result.meetingId?.slice(-8)}</p>
                                </div>
                            </div>

                            <div className="flex gap-3 justify-center">
                                <button
                                    onClick={removeFile}
                                    className="px-6 py-3 bg-white/5 hover:bg-white/10 rounded-xl font-semibold transition-colors"
                                >
                                    Upload Another
                                </button>
                                <a
                                    href="/dashboard"
                                    className="px-6 py-3 bg-gradient-to-r from-white to-gray-200 hover:from-gray-100 hover:to-gray-300 text-black rounded-xl font-semibold transition-all"
                                >
                                    View in Dashboard
                                </a>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Info Section */}
            <div className="glass rounded-xl p-6 mt-6">
                <h3 className="text-lg font-semibold mb-4">What happens after upload?</h3>
                <div className="space-y-3 text-sm text-gray-400">
                    <div className="flex items-start gap-3">
                        <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                            <span className="text-white font-semibold">1</span>
                        </div>
                        <p>Your file is uploaded securely to our server</p>
                    </div>
                    <div className="flex items-start gap-3">
                        <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                            <span className="text-white font-semibold">2</span>
                        </div>
                        <p>AI transcribes the audio using Deepgram's Nova-2 model (95%+ accuracy)</p>
                    </div>
                    <div className="flex items-start gap-3">
                        <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                            <span className="text-white font-semibold">3</span>
                        </div>
                        <p>Assembly AI identifies individual speakers and creates a timeline</p>
                    </div>
                    <div className="flex items-start gap-3">
                        <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                            <span className="text-white font-semibold">4</span>
                        </div>
                        <p>Results appear in your Dashboard alongside bot-recorded meetings</p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Upload;
