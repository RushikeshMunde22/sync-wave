import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { ExternalLink, Sparkles, X, Clock } from 'lucide-react';

interface ActivePromotion {
  id: string;
  headline: string;
  subtext?: string;
  imageUrl: string;
  ctaText: string;
  redirectUrl: string;
  expiresAt?: string | null;
}

interface PromotionalBannerProps {
  allowDismiss?: boolean;
}

export function PromotionalBanner({ allowDismiss = true }: PromotionalBannerProps = {}) {
  const [promo, setPromo] = useState<ActivePromotion | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [timeLeft, setTimeLeft] = useState<string | null>(null);

  useEffect(() => {
    // Check if user dismissed this session
    if (allowDismiss) {
      const isDismissed = sessionStorage.getItem('syncwave_promo_dismissed');
      if (isDismissed) {
        setDismissed(true);
        return;
      }
    }

    api
      .get('/promotions/active')
      .then((res) => {
        if (res.data?.promotion) {
          setPromo(res.data.promotion);
        }
      })
      .catch(() => {
        // Silently fail if not active
      });
  }, [allowDismiss]);

  useEffect(() => {
    if (!promo?.expiresAt) return;

    const updateTimer = () => {
      const diff = new Date(promo.expiresAt!).getTime() - Date.now();
      if (diff <= 0) {
        setTimeLeft(null);
        setPromo(null); // Auto-vanish
        return;
      }

      const hours = Math.floor(diff / (1000 * 60 * 60));
      const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const secs = Math.floor((diff % (1000 * 60)) / 1000);
      setTimeLeft(`${hours}h ${mins}m ${secs}s`);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [promo]);

  if (dismissed || !promo) return null;

  const handleDismiss = () => {
    setDismissed(true);
    sessionStorage.setItem('syncwave_promo_dismissed', '1');
  };

  return (
    <div className="relative mb-8 rounded-2xl overflow-hidden border border-white/10 shadow-2xl bg-neutral-950 group">
      {/* Background Image with Ambient Glow */}
      <div className="absolute inset-0">
        <img
          src={promo.imageUrl}
          alt={promo.headline}
          className="w-full h-full object-cover object-center opacity-35 filter blur-[1px] group-hover:scale-105 transition-transform duration-700"
          onError={(e) => {
            (e.target as HTMLElement).style.display = 'none';
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-r from-black via-black/85 to-black/40" />
        <div className="absolute inset-0 bg-radial-gradient from-transparent to-black/60" />
      </div>

      {/* Dismiss Button (Hidden when allowDismiss is false) */}
      {allowDismiss && (
        <button
          onClick={handleDismiss}
          className="absolute top-3 right-3 z-20 p-1.5 rounded-full bg-black/40 hover:bg-black/80 text-white/50 hover:text-white transition-colors backdrop-blur-sm cursor-pointer"
          title="Dismiss announcement"
        >
          <X size={15} />
        </button>
      )}

      {/* Content */}
      <div className="relative z-10 p-6 sm:p-8 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="max-w-2xl space-y-2.5">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/15 backdrop-blur-md text-[11px] font-semibold text-white tracking-wide uppercase">
            <Sparkles size={12} className="text-amber-400 animate-pulse" />
            <span>Featured Spotlight</span>
            {timeLeft && (
              <span className="flex items-center gap-1 text-amber-300 font-mono pl-1 border-l border-white/20">
                <Clock size={11} /> {timeLeft}
              </span>
            )}
          </div>

          <h3 className="text-xl sm:text-2xl font-black text-white tracking-tight leading-snug drop-shadow-md">
            {promo.headline}
          </h3>

          {promo.subtext && (
            <p className="text-xs sm:text-sm text-neutral-300 leading-relaxed max-w-xl font-normal drop-shadow">
              {promo.subtext}
            </p>
          )}
        </div>

        <div className="shrink-0 flex items-center gap-3">
          <a
            href={promo.redirectUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2.5 px-6 py-3 rounded-full bg-white text-black hover:bg-neutral-200 text-xs sm:text-sm font-bold tracking-tight shadow-xl hover:shadow-white/20 transition-all hover:scale-105 active:scale-95 group/btn"
          >
            <span>{promo.ctaText || 'Explore Now'}</span>
            <ExternalLink size={14} className="group-hover/btn:translate-x-0.5 transition-transform" />
          </a>
        </div>
      </div>
    </div>
  );
}
