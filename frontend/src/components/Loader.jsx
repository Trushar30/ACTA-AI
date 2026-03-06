import React from 'react';
import { motion } from 'framer-motion';

const Loader = ({ fullScreen = true }) => {
    const containerClass = fullScreen
        ? "fixed inset-0 z-[9999] flex items-center justify-center overflow-hidden"
        : "flex items-center justify-center py-20";

    const bars = 5;
    const barColors = ['#3B82F6', '#6366F1', '#8B5CF6', '#6366F1', '#3B82F6'];

    return (
        <div className={containerClass} style={{ background: fullScreen ? '#0B0E14' : 'transparent' }}>
            {/* Subtle center glow */}
            {fullScreen && (
                <motion.div
                    style={{
                        position: 'absolute',
                        width: 220,
                        height: 220,
                        borderRadius: '50%',
                        background: 'radial-gradient(circle, rgba(99,102,241,0.12) 0%, transparent 70%)',
                        filter: 'blur(40px)',
                    }}
                    animate={{ scale: [1, 1.3, 1], opacity: [0.5, 0.8, 0.5] }}
                    transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
                />
            )}

            {/* Equalizer bars */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, height: 48 }}>
                {Array.from({ length: bars }).map((_, i) => (
                    <motion.div
                        key={i}
                        style={{
                            width: 4,
                            borderRadius: 9999,
                            background: barColors[i],
                            boxShadow: `0 0 12px ${barColors[i]}60`,
                        }}
                        animate={{
                            height: [12, 40, 16, 36, 12],
                        }}
                        transition={{
                            duration: 1.2,
                            repeat: Infinity,
                            delay: i * 0.12,
                            ease: 'easeInOut',
                        }}
                    />
                ))}
            </div>
        </div>
    );
};

export default Loader;
