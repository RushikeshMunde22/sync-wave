import React, { useEffect, useRef } from 'react';

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
  client = 'ca-pub-XXXXXXXXXXXXXXXX', // Default placeholder
  slot,
  format = 'auto',
  responsive = true,
  className = '',
  label = 'Advertisement',
}) => {
  const adRef = useRef<HTMLModElement | null>(null);
  const isLoadedRef = useRef(false);

  useEffect(() => {
    // Only attempt to push if slot is provided and client is configured
    if (!slot || client === 'ca-pub-XXXXXXXXXXXXXXXX') return;
    if (isLoadedRef.current) return;

    try {
      if (typeof window !== 'undefined') {
        window.adsbygoogle = window.adsbygoogle || [];
        window.adsbygoogle.push({});
        isLoadedRef.current = true;
      }
    } catch (err) {
      console.warn('[AdSense] Ad push prevented or ad blocker detected:', err);
    }
  }, [slot, client]);

  // If in development or placeholder ID, show placeholder container for layout preview
  if (client === 'ca-pub-XXXXXXXXXXXXXXXX' || !slot) {
    return (
      <div className={`my-4 overflow-hidden rounded-xl border border-dashed border-neutral-800 bg-neutral-900/40 p-4 text-center ${className}`}>
        <span className="text-[10px] font-mono tracking-wider uppercase text-neutral-500 block mb-1">
          {label}
        </span>
        <div className="flex flex-col items-center justify-center py-6 text-xs text-neutral-400">
          <span className="font-medium text-neutral-300">Google AdSense Space</span>
          <span className="text-[11px] text-neutral-500 mt-1">
            Configure your AdSense Publisher ID & Slot ID in production
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className={`my-4 overflow-hidden rounded-xl border border-neutral-800/60 bg-black/40 p-2 min-h-[90px] ${className}`}>
      {label && (
        <span className="text-[9px] font-mono tracking-widest uppercase text-neutral-600 block mb-1 text-center">
          {label}
        </span>
      )}
      <ins
        ref={adRef}
        className="adsbygoogle"
        style={{ display: 'block' }}
        data-ad-client={client}
        data-ad-slot={slot}
        data-ad-format={format}
        data-full-width-responsive={responsive ? 'true' : 'false'}
      />
    </div>
  );
};
