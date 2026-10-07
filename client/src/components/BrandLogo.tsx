import React from 'react';
import { motion } from 'framer-motion';
import { LOGO_FULL_WHITE, LOGO_WORDMARK_WHITE, LOGO_STAR_WHITE } from '../assets/logoAssets';

interface BrandLogoProps {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'hero';
  animated?: boolean;
  onAnimationComplete?: () => void;
  className?: string;
  glow?: boolean;
}

export const BrandLogo: React.FC<BrandLogoProps> = ({
  size = 'md',
  animated = false,
  onAnimationComplete,
  className = '',
  glow = true,
}) => {
  // Height presets for different placements
  const heightClasses = {
    xs: 'h-5 sm:h-6',
    sm: 'h-7 sm:h-8',
    md: 'h-9 sm:h-10',
    lg: 'h-12 sm:h-14',
    xl: 'h-16 sm:h-20',
    hero: 'h-14 sm:h-20 md:h-24',
  }[size];

  // If not animated, render the unified pixel-perfect master logo directly
  if (!animated) {
    return (
      <div className={`relative inline-flex items-center select-none group cursor-pointer ${className}`}>
        <img
          src={LOGO_FULL_WHITE}
          alt="Sync Wave"
          className={`${heightClasses} w-auto object-contain transition-all duration-300 group-hover:scale-[1.02] filter drop-shadow-[0_2px_12px_rgba(255,255,255,0.15)]`}
        />
        {glow && (
          <div className="absolute -inset-2 bg-gradient-to-r from-white/10 via-cyan-400/10 to-transparent blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none -z-10" />
        )}
      </div>
    );
  }

  // Animated intro / interactive version with 120fps hardware acceleration
  return (
    <div
      className={`relative inline-flex items-center select-none ${className}`}
      style={{ willChange: 'transform, opacity' }}
    >
      {/* Wordmark "Sync Wave" */}
      <motion.img
        src={LOGO_WORDMARK_WHITE}
        alt="Sync Wave"
        initial={{ opacity: 0, y: 12, filter: 'blur(8px)' }}
        animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
        transition={{
          duration: 0.85,
          ease: [0.16, 1, 0.3, 1], // Apple / cubic fluid ease
        }}
        className={`${heightClasses} w-auto object-contain filter drop-shadow-[0_4px_20px_rgba(255,255,255,0.2)]`}
      />

      {/* The 4-pointed Star: positioned at the exact proportional offset beside 'Wave' */}
      <div className="relative" style={{ marginLeft: '-0.1em', alignSelf: 'flex-start' }}>
        <motion.img
          src={LOGO_STAR_WHITE}
          alt=""
          initial={{
            opacity: 0,
            scale: 0.2,
            rotate: -120,
            x: 20,
            y: -15,
            filter: 'blur(4px)',
          }}
          animate={{
            opacity: 1,
            scale: 1,
            rotate: 0,
            x: 0,
            y: 0,
            filter: 'blur(0px)',
          }}
          transition={{
            delay: 0.5,
            duration: 0.9,
            type: 'spring',
            stiffness: 180,
            damping: 18,
          }}
          onAnimationComplete={onAnimationComplete}
          className="h-[38%] w-auto object-contain filter drop-shadow-[0_0_14px_rgba(255,255,255,0.9)]"
          style={{
            height: 'clamp(14px, 2.2vw, 32px)',
            marginLeft: 'clamp(4px, 0.7vw, 12px)',
            marginTop: 'clamp(2px, 0.4vw, 6px)',
          }}
        />

        {/* Ambient star sheen pulse */}
        <motion.div
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: [0, 0.7, 0.2], scale: [0.8, 1.4, 1] }}
          transition={{ delay: 0.8, duration: 1.2, ease: 'easeOut' }}
          className="absolute inset-0 bg-white/40 blur-md rounded-full pointer-events-none -z-10"
        />
      </div>

      {/* Ambient background illumination */}
      {glow && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.4 }}
          transition={{ delay: 0.4, duration: 1 }}
          className="absolute -inset-4 bg-white/10 blur-2xl rounded-full pointer-events-none -z-10"
        />
      )}
    </div>
  );
};
