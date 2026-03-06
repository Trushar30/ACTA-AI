import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const Loader = ({ fullScreen = true, message = 'Loading...' }) => {
    const [activeWord, setActiveWord] = useState(0);
    const words = ['Preparing', 'Syncing', 'Analyzing', 'Almost there'];

    useEffect(() => {
        const interval = setInterval(() => {
            setActiveWord((prev) => (prev + 1) % words.length);
        }, 2000);
        return () => clearInterval(interval);
    }, []);

    const containerClass = fullScreen
        ? "fixed inset-0 z-[9999] flex items-center justify-center overflow-hidden"
        : "flex items-center justify-center py-20";

    // Orbital particles config
    const orbits = [
        { radius: 80, duration: 3, count: 6, color: '#3B82F6', size: 4, delay: 0 },
        { radius: 56, duration: 4.5, count: 4, color: '#60A5FA', size: 3, delay: 0.5 },
        { radius: 104, duration: 6, count: 8, color: '#1D4ED8', size: 3, delay: 1 },
    ];

    return (
        <div className={containerClass} style={{ background: fullScreen ? '#0B0E14' : 'transparent' }}>
            {/* Ambient background glow */}
            {fullScreen && (
                <>
                    <motion.div
                        style={{
                            position: 'absolute',
                            width: '600px',
                            height: '600px',
                            borderRadius: '50%',
                            background: 'radial-gradient(circle, rgba(59,130,246,0.08) 0%, transparent 70%)',
                            filter: 'blur(60px)',
                        }}
                        animate={{
                            scale: [1, 1.2, 1],
                            opacity: [0.4, 0.7, 0.4],
                        }}
                        transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
                    />
                    <motion.div
                        style={{
                            position: 'absolute',
                            width: '400px',
                            height: '400px',
                            borderRadius: '50%',
                            background: 'radial-gradient(circle, rgba(139,92,246,0.06) 0%, transparent 70%)',
                            filter: 'blur(40px)',
                        }}
                        animate={{
                            scale: [1.2, 1, 1.2],
                            opacity: [0.3, 0.6, 0.3],
                        }}
                        transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
                    />
                </>
            )}

            <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '40px' }}>
                {/* Main orb container */}
                <div style={{ position: 'relative', width: '240px', height: '240px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>

                    {/* Orbital rings */}
                    {orbits.map((orbit, orbitIndex) => (
                        <motion.div
                            key={`orbit-${orbitIndex}`}
                            style={{
                                position: 'absolute',
                                width: orbit.radius * 2,
                                height: orbit.radius * 2,
                                borderRadius: '50%',
                                border: `1px solid rgba(59,130,246,${0.08 + orbitIndex * 0.04})`,
                            }}
                            animate={{ rotate: orbitIndex % 2 === 0 ? 360 : -360 }}
                            transition={{
                                duration: orbit.duration,
                                repeat: Infinity,
                                ease: 'linear',
                                delay: orbit.delay,
                            }}
                        >
                            {/* Particles on each orbit */}
                            {Array.from({ length: orbit.count }).map((_, i) => {
                                const angle = (360 / orbit.count) * i;
                                return (
                                    <motion.div
                                        key={i}
                                        style={{
                                            position: 'absolute',
                                            width: orbit.size,
                                            height: orbit.size,
                                            borderRadius: '50%',
                                            backgroundColor: orbit.color,
                                            top: '50%',
                                            left: '50%',
                                            transform: `rotate(${angle}deg) translateX(${orbit.radius}px) translate(-50%, -50%)`,
                                            boxShadow: `0 0 ${orbit.size * 3}px ${orbit.color}, 0 0 ${orbit.size * 6}px ${orbit.color}40`,
                                        }}
                                        animate={{
                                            opacity: [0.3, 1, 0.3],
                                            scale: [0.8, 1.4, 0.8],
                                        }}
                                        transition={{
                                            duration: 2,
                                            repeat: Infinity,
                                            delay: i * (2 / orbit.count),
                                            ease: 'easeInOut',
                                        }}
                                    />
                                );
                            })}
                        </motion.div>
                    ))}

                    {/* Outer glow ring */}
                    <motion.div
                        style={{
                            position: 'absolute',
                            width: '120px',
                            height: '120px',
                            borderRadius: '50%',
                            border: '2px solid transparent',
                            borderImage: 'linear-gradient(135deg, #3B82F6, #8B5CF6, #3B82F6) 1',
                            borderImageSlice: 1,
                        }}
                    />
                    <motion.div
                        style={{
                            position: 'absolute',
                            width: '120px',
                            height: '120px',
                            borderRadius: '50%',
                            background: 'conic-gradient(from 0deg, transparent, rgba(59,130,246,0.3), transparent, rgba(139,92,246,0.3), transparent)',
                        }}
                        animate={{ rotate: 360 }}
                        transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
                    />

                    {/* Core glow layers */}
                    <motion.div
                        style={{
                            position: 'absolute',
                            width: '100px',
                            height: '100px',
                            borderRadius: '50%',
                            background: 'radial-gradient(circle, rgba(59,130,246,0.15) 0%, transparent 70%)',
                            filter: 'blur(10px)',
                        }}
                        animate={{
                            scale: [1, 1.5, 1],
                            opacity: [0.5, 1, 0.5],
                        }}
                        transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                    />

                    {/* Inner glass sphere */}
                    <motion.div
                        style={{
                            position: 'relative',
                            width: '80px',
                            height: '80px',
                            borderRadius: '50%',
                            background: 'radial-gradient(circle at 35% 35%, rgba(59,130,246,0.2), rgba(11,14,20,0.9) 70%)',
                            border: '1px solid rgba(59,130,246,0.2)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            boxShadow: '0 0 40px rgba(59,130,246,0.15), inset 0 0 30px rgba(59,130,246,0.1)',
                            overflow: 'hidden',
                        }}
                        animate={{
                            boxShadow: [
                                '0 0 40px rgba(59,130,246,0.15), inset 0 0 30px rgba(59,130,246,0.1)',
                                '0 0 60px rgba(59,130,246,0.3), inset 0 0 40px rgba(59,130,246,0.2)',
                                '0 0 40px rgba(59,130,246,0.15), inset 0 0 30px rgba(59,130,246,0.1)',
                            ],
                        }}
                        transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
                    >
                        {/* Highlight reflection */}
                        <div
                            style={{
                                position: 'absolute',
                                top: '8px',
                                left: '12px',
                                width: '24px',
                                height: '16px',
                                borderRadius: '50%',
                                background: 'rgba(255,255,255,0.12)',
                                filter: 'blur(6px)',
                            }}
                        />
                        {/* Logo */}
                        <motion.img
                            src="/logo.svg"
                            alt="ACTA"
                            style={{ width: '36px', height: '36px', position: 'relative', zIndex: 10 }}
                            animate={{
                                scale: [1, 1.08, 1],
                                filter: [
                                    'drop-shadow(0 0 4px rgba(59,130,246,0.3))',
                                    'drop-shadow(0 0 12px rgba(59,130,246,0.6))',
                                    'drop-shadow(0 0 4px rgba(59,130,246,0.3))',
                                ],
                            }}
                            transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
                        />
                    </motion.div>
                </div>

                {/* Text section */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
                    {/* Morphing status word */}
                    <div style={{ height: '28px', overflow: 'hidden', position: 'relative' }}>
                        <AnimatePresence mode="wait">
                            <motion.span
                                key={activeWord}
                                style={{
                                    fontSize: '13px',
                                    fontWeight: 500,
                                    letterSpacing: '3px',
                                    textTransform: 'uppercase',
                                    background: 'linear-gradient(90deg, #3B82F6, #8B5CF6)',
                                    WebkitBackgroundClip: 'text',
                                    WebkitTextFillColor: 'transparent',
                                    fontFamily: "'Outfit', sans-serif",
                                }}
                                initial={{ y: 20, opacity: 0, filter: 'blur(4px)' }}
                                animate={{ y: 0, opacity: 1, filter: 'blur(0px)' }}
                                exit={{ y: -20, opacity: 0, filter: 'blur(4px)' }}
                                transition={{ duration: 0.5, ease: 'easeInOut' }}
                            >
                                {words[activeWord]}
                            </motion.span>
                        </AnimatePresence>
                    </div>

                    {/* Main message */}
                    <motion.p
                        style={{
                            fontSize: '16px',
                            fontWeight: 400,
                            color: 'rgba(255,255,255,0.6)',
                            fontFamily: "'Outfit', sans-serif",
                            letterSpacing: '0.5px',
                        }}
                        animate={{ opacity: [0.4, 0.8, 0.4] }}
                        transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
                    >
                        {message}
                    </motion.p>

                    {/* DNA-style wave dots */}
                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                        {Array.from({ length: 7 }).map((_, i) => (
                            <motion.div
                                key={i}
                                style={{
                                    width: '4px',
                                    height: '4px',
                                    borderRadius: '50%',
                                    backgroundColor: i % 2 === 0 ? '#3B82F6' : '#8B5CF6',
                                }}
                                animate={{
                                    y: [0, -8, 0, 8, 0],
                                    opacity: [0.3, 1, 0.3, 1, 0.3],
                                    scale: [0.8, 1.2, 0.8, 1.2, 0.8],
                                }}
                                transition={{
                                    duration: 2.4,
                                    repeat: Infinity,
                                    delay: i * 0.15,
                                    ease: 'easeInOut',
                                }}
                            />
                        ))}
                    </div>
                </div>

                {/* Floating ambient particles */}
                {fullScreen && Array.from({ length: 12 }).map((_, i) => (
                    <motion.div
                        key={`particle-${i}`}
                        style={{
                            position: 'absolute',
                            width: Math.random() * 3 + 1 + 'px',
                            height: Math.random() * 3 + 1 + 'px',
                            borderRadius: '50%',
                            backgroundColor: i % 3 === 0 ? '#3B82F6' : i % 3 === 1 ? '#8B5CF6' : '#60A5FA',
                            top: `${Math.random() * 100}%`,
                            left: `${Math.random() * 100}%`,
                            opacity: 0,
                        }}
                        animate={{
                            y: [0, -60 - Math.random() * 80],
                            x: [0, (Math.random() - 0.5) * 60],
                            opacity: [0, 0.6, 0],
                            scale: [0, 1, 0],
                        }}
                        transition={{
                            duration: 3 + Math.random() * 3,
                            repeat: Infinity,
                            delay: i * 0.4,
                            ease: 'easeOut',
                        }}
                    />
                ))}
            </div>
        </div>
    );
};

export default Loader;
