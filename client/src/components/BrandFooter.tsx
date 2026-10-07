import { Link } from 'react-router-dom';
import { BrandLogo } from './BrandLogo';
import { Mail, Heart, Sparkles, Shield, Compass, Headphones } from 'lucide-react';

export function BrandFooter() {
  return (
    <footer className="relative mt-20 border-t border-neutral-800/80 bg-black/95 text-neutral-400 backdrop-blur-xl">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10 items-start">
          {/* Brand Info */}
          <div className="md:col-span-2 space-y-4">
            <div className="inline-block">
              <BrandLogo size="md" />
            </div>
            <p className="text-xs sm:text-sm text-neutral-400 max-w-md leading-relaxed font-light">
              The real-time synchronized music platform. Stream full 320kbps studio songs, sing along with live synchronized lyrics, and experience audio simultaneously with friends across any device in the world.
            </p>
            <div className="flex items-center gap-2 text-[11px] text-neutral-500 pt-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Studio Engine Active • Domain: syncwave.work.gd</span>
            </div>
          </div>

          {/* Quick Navigation */}
          <div className="space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-white">Explore SyncWave</h4>
            <ul className="space-y-2 text-xs">
              <li>
                <Link to="/" className="hover:text-white transition-colors flex items-center gap-2">
                  <Headphones size={13} className="text-indigo-400" /> Dashboard & Rooms
                </Link>
              </li>
              <li>
                <Link to="/discover" className="hover:text-white transition-colors flex items-center gap-2">
                  <Compass size={13} className="text-cyan-400" /> Discover Music
                </Link>
              </li>
              <li>
                <Link to="/profile" className="hover:text-white transition-colors flex items-center gap-2">
                  <Sparkles size={13} className="text-purple-400" /> Account & Profile
                </Link>
              </li>
              <li>
                <Link to="/admin" className="hover:text-white transition-colors flex items-center gap-2">
                  <Shield size={13} className="text-emerald-400" /> Admin Console
                </Link>
              </li>
            </ul>
          </div>

          {/* Contact & Support */}
          <div className="space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-white">Direct Founder Support</h4>
            <p className="text-xs text-neutral-400 leading-relaxed">
              Need assistance, have feature ideas, or want to partner with us? Reach out directly:
            </p>
            <a
              href="mailto:munderushikesh66@gmail.com?subject=SyncWave%20Support%20%26%20Feedback"
              className="inline-flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-white text-xs font-semibold transition-all hover:scale-105 active:scale-95 shadow-lg group"
            >
              <Mail size={14} className="text-indigo-400 group-hover:scale-110 transition-transform" />
              <span>munderushikesh66@gmail.com</span>
            </a>
            <p className="text-[11px] text-neutral-500">24/7 direct developer inbox</p>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="mt-12 pt-6 border-t border-neutral-900 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-neutral-500">
          <p>© {new Date().getFullYear()} SyncWave Inc. All rights reserved.</p>
          <div className="flex items-center gap-4 text-xs text-neutral-400">
            <Link to="/privacy" className="hover:text-cyan-400 transition-colors">Privacy Policy</Link>
            <span>•</span>
            <Link to="/terms" className="hover:text-cyan-400 transition-colors">Terms of Service</Link>
          </div>
          <div className="flex items-center gap-1">
            <span>Built with</span>
            <Heart size={12} className="text-red-500 fill-red-500 inline" />
            <span>for music lovers everywhere</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
