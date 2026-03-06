import React from 'react';
import { motion } from 'framer-motion';

const Loader = ({ fullScreen = true, message = 'Loading...' }) => {
    const containerClass = fullScreen 
        ? "fixed inset-0 bg-[#0B0E14] z-[9999] flex items-center justify-center"
        : "flex items-center justify-center py-20";

    return (
        <div className={containerClass}>
            <div className="relative flex flex-col items-center gap-6">
                {/* Animated Logo Circle */}
                <div className="relative w-24 h-24">
                    {/* Outer rotating ring */}
                    <motion.div
                        className="absolute inset-0 rounded-full border-4 border-transparent border-t-white border-r-gray-300"
                        animate={{ rotate: 360 }}
                        transition={{
                            duration: 1.5,
                            repeat: Infinity,
                            ease: "linear"
                        }}
                    />
                    
                    {/* Inner rotating ring */}
                    <motion.div
                        className="absolute inset-2 rounded-full border-4 border-transparent border-b-gray-400 border-l-gray-200"
                        animate={{ rotate: -360 }}
                        transition={{
                            duration: 2,
                            repeat: Infinity,
                            ease: "linear"
                        }}
                    />
                    
                    {/* Center pulsing logo */}
                    <motion.div
                        className="absolute inset-0 flex items-center justify-center"
                        animate={{
                            scale: [1, 1.1, 1],
                            opacity: [0.8, 1, 0.8]
                        }}
                        transition={{
                            duration: 2,
                            repeat: Infinity,
                            ease: "easeInOut"
                        }}
                    >
                        <img 
                            src="/logo.svg" 
                            alt="Loading" 
                            className="w-12 h-12"
                        />
                    </motion.div>
                </div>

                {/* Loading text with dots animation */}
                <div className="flex flex-col items-center gap-2">
                    <motion.p 
                        className="text-lg font-semibold text-white"
                        animate={{ opacity: [0.5, 1, 0.5] }}
                        transition={{
                            duration: 1.5,
                            repeat: Infinity,
                            ease: "easeInOut"
                        }}
                    >
                        {message}
                    </motion.p>
                    
                    {/* Animated dots */}
                    <div className="flex gap-2">
                        {[0, 1, 2].map((index) => (
                            <motion.div
                                key={index}
                                className="w-2 h-2 rounded-full bg-white"
                                animate={{
                                    y: [0, -10, 0],
                                    opacity: [0.3, 1, 0.3]
                                }}
                                transition={{
                                    duration: 1,
                                    repeat: Infinity,
                                    delay: index * 0.15,
                                    ease: "easeInOut"
                                }}
                            />
                        ))}
                    </div>
                </div>

                {/* Shimmer effect */}
                <motion.div
                    className="absolute -inset-10 bg-gradient-to-r from-transparent via-white/5 to-transparent"
                    animate={{
                        x: [-200, 200]
                    }}
                    transition={{
                        duration: 2,
                        repeat: Infinity,
                        ease: "linear"
                    }}
                />
            </div>
        </div>
    );
};

export default Loader;
