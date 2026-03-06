import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

const Layout = ({ children }) => {
    const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
    const [hovering, setHovering] = useState(false);

    useEffect(() => {
        const mouseMove = (e) => {
            setMousePosition({ x: e.clientX, y: e.clientY });
        };

        const handleMouseOver = (e) => {
            if (e.target.tagName === 'BUTTON' || e.target.tagName === 'A' || e.target.closest('button')) {
                setHovering(true);
            } else {
                setHovering(false);
            }
        };

        window.addEventListener('mousemove', mouseMove);
        window.addEventListener('mouseover', handleMouseOver);

        return () => {
            window.removeEventListener('mousemove', mouseMove);
            window.removeEventListener('mouseover', handleMouseOver);
        };
    }, []);

    const variants = {
        default: {
            x: mousePosition.x - 20,
            y: mousePosition.y - 20,
            opacity: 1,
        },
        hover: {
            x: mousePosition.x - 20,
            y: mousePosition.y - 20,
            scale: 1.5,
            backgroundColor: 'rgba(204, 255, 0, 0.1)',
            borderColor: 'transparent'
        }
    };

    const dotVariants = {
        default: {
            x: mousePosition.x - 4,
            y: mousePosition.y - 4,
            opacity: 1,
        }
    };

    return (
        <div className="relative min-h-screen p-4 md:p-8 flex flex-col">
            {/* Custom Cursor */}
            <motion.div
                className="cursor-dot hidden md:block"
                variants={dotVariants}
                animate="default"
                transition={{ type: "tween", ease: "backOut", duration: 0 }}
            />
            <motion.div
                className="cursor-outline hidden md:block"
                variants={variants}
                animate={hovering ? "hover" : "default"}
                transition={{ type: "tween", ease: "backOut", duration: 0.15 }}
            />

            {/* Frame Border */}
            <div className="fixed inset-4 border border-[var(--border)] pointer-events-none z-50 hidden md:block opacity-50" />
            <div className="fixed top-4 left-4 w-4 h-4 border-t border-l border-[var(--accent)] z-50" />
            <div className="fixed top-4 right-4 w-4 h-4 border-t border-r border-[var(--accent)] z-50" />
            <div className="fixed bottom-4 left-4 w-4 h-4 border-b border-l border-[var(--accent)] z-50" />
            <div className="fixed bottom-4 right-4 w-4 h-4 border-b border-r border-[var(--accent)] z-50" />

            {/* Content */}
            <main className="relative z-10 flex-1 flex flex-col">
                {children}
            </main>
        </div>
    );
};

export default Layout;
