import React, { useEffect, useRef, useState } from 'react';
import { Sparkles, Radio } from 'lucide-react';
import { Link } from 'react-router-dom';

declare global {
  interface Window {
    adsbygoogle?: any[];
  }
}

interface AdSenseSlotProps {
  /** Google AdSense Client ID (e.g., 'ca-pub-XXXXXXXXXXXXXXXX') */
  client?: string;
  /** Google AdSense Ad Slot ID (e.g., '1234567890') */
  slot?: string;
  /** Format of the ad: 'auto', 'fluid', 'rectangle', 'horizontal' */
  format?: 'auto' | 'fluid' | 'rectangle' | 'horizontal';
  /** Responsive full width option */
  responsive?: boolean;
  /** Custom wrapper CSS classes */
  className?: string;
  /** Label to display above ad (Google policy requires 'Advertisement' or 'Sponsored') */
  label?: string;
}

export const AdSenseSlot: React.FC<AdSenseSlotProps> = ({
  client = 'ca-pub-XXXXXXXXXXXXXXXX',
  slot,
  format = 'auto',
  responsive = true,
  className = '',
  label = 'Sponsored',
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const adRef = useRef<HTMLModElement | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [adFailed, setAdFailed] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  const isConfigured = slot && client && client !== 'ca-pub-XXXXXXXXXXXXXXXX';

  // 1. IntersectionObserver for zero-overhead lazy loading
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry && entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: '200px' }
    );
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // 2. Load AdSense ad when visible and configured
  useEffect(() => {
    if (!isVisible || !isConfigured || isLoaded || adFailed) return;

    try {
      if (typeof window !== 'undefined') {
        window.adsbygoogle = window.adsbygoogle || [];
        window.adsbygoogle.push({});
        setIsLoaded(true);

        // Fallback check: if ad container remains empty after 3 seconds, show house banner
        const timer = setTimeout(() => {
          if (adRef.current && (adRef.current.offsetHeight === 0 || adRef.current.getAttribute('data-ad-status') === 'unfilled')) {
            setAdFailed(true);
          }
        }, 3000);
        return () => clearTimeout(timer);
      }
    } catch (err) {
      console.warn('[AdSense] Ad blocked or script missing, falling back to house banner:', err);
      setAdFailed(true);
    }
  }, [isVisible, isConfigured, isLoaded, adFailed]);

  // Fallback: Elegant SyncWave House Sponsor Banner (Zero layout shift, exactly 90px min-height)
  if (!isConfigured || adFailed) {
    return (
      <div
        ref={containerRef}
        className={`my-4 overflow-hidden rounded-2xl border border-white/[0.08] bg-gradient-to-r from-[#070b18]/90 via-[#0a1128]/80 to-[#040711]/90 p-4 min-h-[90px] flex items-center justify-between shadow-lg backdrop-blur-md transition-all hover:border-white/20 group ${className}`}
      >
        <div className="flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
            <Radio size={20} className="text-cyan-400 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded-full border border-cyan-500/20">
                {label}
              </span>
              <strong className="text-xs sm:text-sm font-semibold text-white">
                Host your own SyncWave Room
              </strong>
            </div>
            <p className="text-[11px] text-neutral-400 mt-0.5 font-light">
              Watch YouTube and listen to music together with friends worldwide.
            </p>
          </div>
        </div>

        <Link
          to="/signup"
          className="shrink-0 px-3.5 py-1.5 rounded-xl text-xs font-bold bg-white/10 hover:bg-white text-white hover:text-black border border-white/20 transition-all flex items-center gap-1.5 shadow-md ml-3"
        >
          <span>Start Free</span>
          <Sparkles size={12} />
        </Link>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={`my-4 overflow-hidden rounded-2xl border border-neutral-800/60 bg-black/40 p-2 min-h-[90px] ${className}`}
    >
      {label && (
        <span className="text-[9px] font-mono tracking-widest uppercase text-neutral-500 block mb-1 text-center">
          {label}
        </span>
      )}
      {isVisible && (
        <ins
          ref={adRef}
          className="adsbygoogle"
          style={{ display: 'block', minHeight: '90px' }}
          data-ad-client={client}
          data-ad-slot={slot}
          data-ad-format={format}
          data-full-width-responsive={responsive ? 'true' : 'false'}
        />
      )}
    </div>
  );
};
