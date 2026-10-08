import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Cookie, ShieldCheck, X } from 'lucide-react';

export function CookieConsent() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Check if user already consented
    const consent = localStorage.getItem('syncwave_cookie_consent');
    if (!consent) {
      // Delay display slightly for smooth page entry
      const timer = setTimeout(() => setIsVisible(true), 1200);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleAccept = () => {
    localStorage.setItem('syncwave_cookie_consent', 'accepted');
    setIsVisible(false);
  };

  const handleDecline = () => {
    localStorage.setItem('syncwave_cookie_consent', 'essential_only');
    setIsVisible(false);
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: 50, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 50, scale: 0.95 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
          className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-6 sm:max-w-md z-50 rounded-2xl border border-neutral-700/80 bg-neutral-950/95 p-5 shadow-2xl backdrop-blur-xl text-neutral-200"
          role="region"
          aria-label="Cookie consent banner"
        >
          <div className="flex items-start gap-3.5">
            <div className="p-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 shrink-0">
              <Cookie size={20} />
            </div>
            <div className="space-y-2 flex-1">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-white flex items-center gap-1.5 font-['Plus_Jakarta_Sans']">
                  <ShieldCheck size={14} className="text-cyan-400" /> Cookie & Privacy Preferences
                </h3>
                <button
                  onClick={handleDecline}
                  className="text-neutral-500 hover:text-white transition-colors p-1"
                  aria-label="Dismiss cookie notice"
                >
                  <X size={14} />
                </button>
              </div>
              <p className="text-xs text-neutral-400 leading-relaxed">
                SyncWave uses cookies and local storage to maintain clock synchronization, room memberships, and to serve advertisements via Google AdSense. Learn more in our{' '}
                <Link to="/privacy" className="text-cyan-400 hover:underline">
                  Privacy Policy
                </Link>.
              </p>
              <div className="flex items-center gap-2 pt-1">
                <button
                  onClick={handleAccept}
                  className="px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white text-xs font-semibold shadow-md shadow-cyan-500/20 transition-all hover:scale-105 active:scale-95"
                >
                  Accept All
                </button>
                <button
                  onClick={handleDecline}
                  className="px-3 py-1.5 rounded-lg bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-neutral-300 text-xs font-medium transition-colors"
                >
                  Essential Only
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
