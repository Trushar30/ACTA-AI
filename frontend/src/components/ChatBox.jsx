import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { Send, MessageCircle } from 'lucide-react';
import { io } from 'socket.io-client';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export default function ChatBox({ contextType, contextId }) {
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(true);
    const messagesEndRef = useRef(null);
    const socketRef = useRef(null);

    useEffect(() => {
        loadMessages();

        socketRef.current = io(API_URL, { transports: ['websocket', 'polling'] });
        const eventName = `chat:${contextType}:${contextId}`;
        socketRef.current.on(eventName, (msg) => {
            setMessages(prev => [...prev, msg]);
        });

        // Mark messages as read
        axios.post(`${API_URL}/api/chat/${contextType}/${contextId}/read`).catch(() => {});

        return () => {
            if (socketRef.current) {
                socketRef.current.off(eventName);
                socketRef.current.disconnect();
            }
        };
    }, [contextType, contextId]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const loadMessages = async () => {
        try {
            const res = await axios.get(`${API_URL}/api/chat/${contextType}/${contextId}`);
            setMessages(res.data.messages || []);
        } catch (err) {
            console.error('Load messages error:', err);
        }
        setLoading(false);
    };

    const handleSend = async () => {
        if (!input.trim()) return;
        const text = input.trim();
        setInput('');
        try {
            await axios.post(`${API_URL}/api/chat/${contextType}/${contextId}`, { message: text });
        } catch (err) {
            console.error('Send error:', err);
            setInput(text);
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const currentUserEmail = (() => {
        try {
            const token = localStorage.getItem('token');
            if (!token) return null;
            const payload = JSON.parse(atob(token.split('.')[1]));
            return payload.email;
        } catch { return null; }
    })();

    if (loading) return <div className="text-center text-slate-500 py-8">Loading chat...</div>;

    return (
        <div className="flex flex-col h-[500px] bg-[#0B0E14] border border-white/5 rounded-xl overflow-hidden">
            {/* Header */}
            <div className="flex items-center gap-2 px-4 py-3 border-b border-white/5 bg-[#151921]/70">
                <MessageCircle size={16} className="text-emerald-400" />
                <span className="text-white text-sm font-medium">Group Chat</span>
                <span className="text-slate-600 text-xs ml-auto">{messages.length} messages</span>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
                {messages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-slate-500 text-sm">
                        <MessageCircle size={32} className="mb-2 opacity-30" />
                        No messages yet. Start the conversation!
                    </div>
                ) : (
                    messages.map((msg, i) => {
                        const isMe = msg.senderEmail === currentUserEmail;
                        const isSystem = msg.messageType === 'system';

                        if (isSystem) {
                            return (
                                <div key={msg._id || i} className="text-center">
                                    <span className="text-xs text-slate-600 bg-white/5 px-3 py-1 rounded-full">{msg.message}</span>
                                </div>
                            );
                        }

                        return (
                            <div key={msg._id || i} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                                <div className={`max-w-[75%] ${isMe ? 'order-2' : ''}`}>
                                    {!isMe && (
                                        <div className="flex items-center gap-2 mb-1">
                                            {msg.senderPicture ? (
                                                <img src={msg.senderPicture} alt="" className="w-5 h-5 rounded-full" />
                                            ) : (
                                                <div className="w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400 text-[10px] font-bold">
                                                    {(msg.senderName || msg.senderEmail || '?')[0].toUpperCase()}
                                                </div>
                                            )}
                                            <span className="text-xs text-slate-500">{msg.senderName || msg.senderEmail?.split('@')[0]}</span>
                                        </div>
                                    )}
                                    <div className={`px-3.5 py-2 rounded-2xl text-sm leading-relaxed ${
                                        isMe
                                            ? 'bg-emerald-600/90 text-white rounded-br-md'
                                            : 'bg-[#151921] border border-white/5 text-slate-300 rounded-bl-md'
                                    }`}>
                                        {msg.messageType === 'meeting-link' ? (
                                            <div>
                                                <p className="text-xs text-slate-400 mb-1">Meeting Link Shared</p>
                                                <a href={msg.message} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline break-all">{msg.message}</a>
                                            </div>
                                        ) : (
                                            <span className="whitespace-pre-wrap break-words">{msg.message}</span>
                                        )}
                                    </div>
                                    <p className={`text-[10px] text-slate-600 mt-0.5 ${isMe ? 'text-right' : ''}`}>
                                        {msg.createdAt ? new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                                    </p>
                                </div>
                            </div>
                        );
                    })
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="px-4 py-3 border-t border-white/5 bg-[#151921]/50">
                <div className="flex gap-2">
                    <input
                        value={input}
                        onChange={e => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Type a message..."
                        className="flex-1 px-4 py-2.5 bg-[#0B0E14] border border-white/10 rounded-xl text-white text-sm placeholder-slate-600 focus:border-white/20 focus:outline-none"
                    />
                    <button
                        onClick={handleSend}
                        disabled={!input.trim()}
                        className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-30 disabled:hover:bg-emerald-600 text-white rounded-xl transition-colors"
                    >
                        <Send size={16} />
                    </button>
                </div>
            </div>
        </div>
    );
}
