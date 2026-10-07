import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export interface ReactionParticle {
  id: string;
  emoji: string;
  userName: string;
  laneX: number; // percentage offset: 15% to 85%
  wobbleX: number; // horizontal sway distance
  duration: number;
}

interface FloatingReactionsProps {
  incomingReactions: Array<{ id: string; emoji: string; userName: string; timestamp: number }>;
}

export const FloatingReactions: React.FC<FloatingReactionsProps> = ({ incomingReactions }) => {
  const [particles, setParticles] = useState<ReactionParticle[]>([]);

  // When a new reaction arrives from socket or local click, generate an organic particle trajectory
  useEffect(() => {
    if (!incomingReactions || incomingReactions.length === 0) return;

    const latest = incomingReactions[incomingReactions.length - 1];
    if (!latest) return;

    // Disperse lanes across the screen: 20% to 80%
    const laneX = 20 + Math.random() * 60;
    const wobbleX = (Math.random() - 0.5) * 40;
    const duration = 2.4 + Math.random() * 0.6; // 2.4s to 3.0s smooth drift

    const newParticle: ReactionParticle = {
      id: `${latest.id}-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      emoji: latest.emoji,
      userName: latest.userName,
      laneX,
      wobbleX,
      duration,
    };

    setParticles((prev) => [...prev.slice(-25), newParticle]);
  }, [incomingReactions]);

  const removeParticle = (id: string) => {
    setParticles((prev) => prev.filter((p) => p.id !== id));
  };

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden z-20">
      <AnimatePresence>
        {particles.map((p) => (
          <motion.div
            key={p.id}
            initial={{
              opacity: 0,
              y: 20,
              scale: 0.3,
              x: 0,
            }}
            animate={{
              opacity: [0, 1, 0.95, 0],
              y: -360,
              scale: [0.3, 1.25, 1.05, 0.7],
              x: [0, p.wobbleX, -p.wobbleX * 0.7, p.wobbleX * 0.3],
            }}
            exit={{ opacity: 0 }}
            transition={{
              duration: p.duration,
              times: [0, 0.15, 0.75, 1],
              ease: 'easeOut',
            }}
            onAnimationComplete={() => removeParticle(p.id)}
            style={{
              left: `${p.laneX}%`,
              bottom: '120px',
              willChange: 'transform, opacity',
            }}
            className="absolute flex flex-col items-center gap-1 select-none"
          >
            <span className="text-3xl sm:text-4xl filter drop-shadow-[0_4px_12px_rgba(0,0,0,0.5)] transform hover:scale-125 transition-transform">
              {p.emoji}
            </span>
            {p.userName && (
              <span className="text-[10px] font-medium tracking-tight text-white/90 bg-black/60 backdrop-blur-md px-2 py-0.5 rounded-full border border-white/10 shadow-lg whitespace-nowrap">
                {p.userName}
              </span>
            )}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
};
