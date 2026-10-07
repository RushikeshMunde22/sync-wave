import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { BrandLogo } from '../components/BrandLogo';
import { Volume2, VolumeX, Play, Sparkles } from 'lucide-react';

export default function LandingPage() {
  const [showIntro, setShowIntro] = useState(true);
  const [quickCode, setQuickCode] = useState('');
  const navigate = useNavigate();

  // Video integration state & refs
  const [introMuted, setIntroMuted] = useState(true);
  const introVideoRef = useRef<HTMLVideoElement | null>(null);

  const [isExtroPlaying, setIsExtroPlaying] = useState(false);
  const extroVideoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setShowIntro(false);
    }, 2400);
    return () => clearTimeout(timer);
  }, []);

  // IntersectionObserver to auto-play intro video when user scrolls down
  useEffect(() => {
    const video = introVideoRef.current;
    if (!video) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            video.play().catch(() => {});
          }
        });
      },
      { threshold: 0.2 }
    );

    observer.observe(video);
    return () => observer.disconnect();
  }, []);

  const toggleIntroMute = () => {
    if (introVideoRef.current) {
      const nextMuted = !introMuted;
      introVideoRef.current.muted = nextMuted;
      setIntroMuted(nextMuted);
    }
  };

  const toggleExtroPlay = () => {
    if (!extroVideoRef.current) return;
    if (isExtroPlaying) {
      extroVideoRef.current.pause();
      setIsExtroPlaying(false);
    } else {
      extroVideoRef.current.play().catch(() => {});
      setIsExtroPlaying(true);
    }
  };

  const handleJoinByCode = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickCode.trim()) return;
    navigate(`/join/${quickCode.trim().toUpperCase()}`);
  };

  return (
    <div className="min-h-screen bg-[#03050a] text-neutral-100 font-sans selection:bg-white/20 selection:text-white overflow-x-hidden relative">
      {/* ============ AMBIENT BACKGROUND GLOWS ============ */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden -z-10">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-white/[0.04] blur-[150px] rounded-full" />
        <div className="absolute top-1/3 -left-40 w-[600px] h-[600px] bg-cyan-500/[0.03] blur-[160px] rounded-full" />
        <div className="absolute top-2/3 -right-40 w-[600px] h-[600px] bg-white/[0.03] blur-[160px] rounded-full" />
      </div>

      {/* ============ INTRO SCREEN (Sync Wave Logo + Perfect 4-Pointed Star) ============ */}
      <AnimatePresence>
        {showIntro && (
          <motion.div
            initial={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.65, ease: [0.16, 1, 0.3, 1] } }}
            onClick={() => setShowIntro(false)}
            className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#03050a] cursor-pointer"
            title="Click to enter SyncWave"
          >
            <div className="relative flex flex-col items-center justify-center p-8">
              <BrandLogo size="hero" animated={true} />
              <motion.span
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 0.5, y: 0 }}
                transition={{ delay: 0.9, duration: 0.6 }}
                className="text-[11px] uppercase tracking-[0.3em] text-neutral-400 font-medium mt-6"
              >
                Synchronized Music Platform
              </motion.span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ============ NAVIGATION HEADER ============ */}
      <header className="sticky top-0 z-40 bg-[#03050a]/80 backdrop-blur-2xl border-b border-white/[0.08] transition-all">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-20 flex items-center justify-between">
          <Link to="/" className="flex items-center group">
            <BrandLogo size="md" animated={false} />
          </Link>

          <nav className="hidden md:flex items-center gap-8 text-xs font-semibold tracking-wider text-neutral-400 uppercase">
            <a href="#how" className="hover:text-white transition-colors duration-200">How it works</a>
            <a href="#features" className="hover:text-white transition-colors duration-200">Features</a>
            <a href="#rooms" className="hover:text-white transition-colors duration-200">Rooms</a>
            <a href="#faq" className="hover:text-white transition-colors duration-200">FAQ</a>
          </nav>

          <div className="flex items-center gap-3">
            <Link
              to="/login"
              className="px-4 py-2 rounded-xl text-xs font-semibold text-neutral-300 hover:text-white border border-white/10 hover:border-white/20 hover:bg-white/[0.04] transition-all duration-200"
            >
              Log in
            </Link>
            <Link
              to="/signup"
              className="px-4 py-2 rounded-xl text-xs font-bold text-[#03050a] bg-white hover:bg-neutral-100 shadow-[0_0_20px_rgba(255,255,255,0.25)] hover:shadow-[0_0_30px_rgba(255,255,255,0.4)] hover:-translate-y-0.5 transition-all duration-200"
            >
              Get Started
            </Link>
          </div>
        </div>
      </header>

      {/* ============ HERO SECTION ============ */}
      <section className="relative pt-16 pb-28 overflow-hidden">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 grid lg:grid-cols-12 gap-12 items-center relative z-10">
          <div className="lg:col-span-7 space-y-6">
            {/* Live badge */}
            <div className="inline-flex items-center gap-2.5 px-3.5 py-1.5 rounded-full bg-white/[0.04] border border-white/10 text-white text-xs font-medium tracking-wide backdrop-blur-md shadow-inner">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
              <span className="text-neutral-300">Free Music Listening • Millisecond Group Sync</span>
            </div>

            <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-white leading-[1.08]">
              Listen to the same song together, <span className="text-transparent bg-clip-text bg-gradient-to-r from-white via-neutral-200 to-neutral-400 drop-shadow-[0_0_30px_rgba(255,255,255,0.2)]">in perfect sync</span>.
            </h1>

            <p className="text-neutral-400 text-sm sm:text-base leading-relaxed max-w-xl">
              Sync Wave is a high-performance audio synchronization platform. Create a listening room, share one simple 10-character code, and experience your music playing across every phone, tab, and speaker at the exact same millisecond.
            </p>

            <div className="flex flex-wrap items-center gap-4 pt-2">
              <Link
                to="/signup"
                className="px-7 py-3.5 rounded-xl font-bold text-sm text-[#03050a] bg-white hover:bg-neutral-100 shadow-[0_0_30px_rgba(255,255,255,0.3)] hover:shadow-[0_0_45px_rgba(255,255,255,0.5)] hover:-translate-y-0.5 transition-all flex items-center gap-2"
              >
                <span>Create a Free Room</span>
                <span className="text-lg">→</span>
              </Link>
              <a
                href="#how"
                className="px-5 py-3.5 rounded-xl font-semibold text-sm text-neutral-300 hover:text-white border border-white/10 hover:border-white/20 bg-white/[0.02] hover:bg-white/[0.05] transition-all flex items-center gap-2"
              >
                How it works <span className="text-neutral-400">↗</span>
              </a>
            </div>

            {/* Quick Join Box */}
            <form onSubmit={handleJoinByCode} className="pt-2 flex items-center gap-2 max-w-md">
              <input
                type="text"
                placeholder="Enter 10-char Room Code (e.g. AFRBAKJSM7)"
                value={quickCode}
                onChange={(e) => setQuickCode(e.target.value)}
                maxLength={10}
                className="flex-1 bg-white/[0.03] border border-white/10 focus:border-white/30 rounded-xl px-4 py-3 text-xs text-white placeholder-neutral-500 font-mono tracking-wider outline-none backdrop-blur-md shadow-inner transition-colors"
              />
              <button
                type="submit"
                className="px-5 py-3 rounded-xl text-xs font-bold bg-white/[0.08] hover:bg-white/[0.15] text-white border border-white/15 transition-all shadow-md"
              >
                Join Room
              </button>
            </form>

            <div className="flex flex-wrap items-center gap-3 pt-2 text-xs font-medium text-neutral-400">
              <span className="px-3 py-1 rounded-full bg-white/[0.03] border border-white/[0.08] text-neutral-300">✓ 100% Free Forever</span>
              <span className="px-3 py-1 rounded-full bg-white/[0.03] border border-white/[0.08] text-neutral-300">✓ Unlimited Room Size</span>
              <span className="px-3 py-1 rounded-full bg-white/[0.03] border border-white/[0.08] text-white font-semibold">✓ Sub-40ms Drift Accuracy</span>
            </div>
          </div>

          {/* Interactive Room Mock Stage (Shiny Glassmorphism) */}
          <div className="lg:col-span-5 relative">
            <div className="relative mx-auto max-w-sm rounded-3xl bg-gradient-to-b from-[#0a0f1d]/90 to-[#04060d]/90 p-6 border border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.8),inset_0_1px_1px_rgba(255,255,255,0.15)] backdrop-blur-2xl group hover:border-white/20 transition-all duration-300">
              {/* Floating Chip A */}
              <div className="absolute -top-3 -right-3 bg-[#03050a] border border-white/20 rounded-full px-3.5 py-1 text-[11px] font-semibold text-white flex items-center gap-2 shadow-2xl">
                <span className="w-2 h-2 rounded-full bg-white animate-ping" />
                <span>One song, every speaker</span>
              </div>

              <div className="flex items-center justify-between pb-4 border-b border-white/[0.08]">
                <div>
                  <h3 className="font-bold text-white text-base">Bollywood Vibez Live</h3>
                  <p className="text-[11px] text-neutral-400">8 friends listening in real-time</p>
                </div>
                <span className="px-2.5 py-0.5 rounded-full bg-white/10 border border-white/20 text-white font-mono text-[10px] font-bold shadow-sm">
                  LIVE
                </span>
              </div>

              {/* Now Playing Widget */}
              <div className="my-5 p-4 rounded-2xl bg-white/[0.03] border border-white/[0.08] flex items-center gap-3.5 backdrop-blur-md">
                <div className="w-12 h-12 rounded-xl bg-white text-[#03050a] flex items-center justify-center gap-1 shadow-[0_0_20px_rgba(255,255,255,0.3)]">
                  <span className="w-1 h-4 bg-[#03050a] rounded-full animate-bounce" />
                  <span className="w-1 h-7 bg-[#03050a] rounded-full animate-bounce [animation-delay:0.2s]" />
                  <span className="w-1 h-5 bg-[#03050a] rounded-full animate-bounce [animation-delay:0.4s]" />
                  <span className="w-1 h-6 bg-[#03050a] rounded-full animate-bounce [animation-delay:0.1s]" />
                </div>
                <div className="min-w-0 flex-1">
                  <strong className="block text-sm font-bold text-white truncate">Apna Bana Le (Bhediya)</strong>
                  <span className="block text-[11px] text-neutral-400 truncate">Arijit Singh • Sachin-Jigar</span>
                </div>
              </div>

              {/* Stats Box */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-black/50 border border-white/[0.08] rounded-xl p-3">
                  <small className="block text-[10px] uppercase font-semibold text-neutral-500">Group Code</small>
                  <b className="font-mono text-base text-white tracking-wider">AFRBAKJSM7</b>
                </div>
                <div className="bg-black/50 border border-white/[0.08] rounded-xl p-3">
                  <small className="block text-[10px] uppercase font-semibold text-neutral-500">Connected</small>
                  <b className="text-base text-white">8 Devices</b>
                </div>
              </div>

              {/* Floating Chip B */}
              <div className="mt-4 pt-3 border-t border-white/[0.08] flex items-center justify-between text-[11px] text-neutral-400">
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]" />
                  NTP Audio Engine Active
                </span>
                <span className="text-white font-mono text-[10px]">0.02s sync lock</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============ INTRO VIDEO SHOWCASE SECTION ============ */}
      <section className="relative py-12 px-4 sm:px-6 max-w-6xl mx-auto">
        <div className="relative rounded-3xl p-1 bg-gradient-to-b from-white/15 via-white/5 to-white/10 shadow-[0_25px_80px_rgba(0,0,0,0.85)] group">
          {/* Ambient background glow behind the video */}
          <div className="absolute -inset-4 bg-gradient-to-r from-cyan-500/10 via-purple-500/10 to-indigo-500/10 blur-2xl rounded-3xl opacity-70 group-hover:opacity-100 transition-opacity pointer-events-none -z-10" />

          <div
            className="relative rounded-[22px] overflow-hidden bg-[#04060d] border border-white/10"
            onMouseEnter={() => {
              if (introVideoRef.current) {
                introVideoRef.current.play().catch(() => {});
              }
            }}
          >
            {/* Top Bar inside the Video Card */}
            <div className="flex items-center justify-between px-5 py-3.5 bg-black/60 backdrop-blur-xl border-b border-white/[0.08] z-20 relative">
              <div className="flex items-center gap-2.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
                <span className="text-xs font-bold text-white tracking-wide uppercase flex items-center gap-1.5">
                  <Sparkles size={13} className="text-cyan-400" />
                  SyncWave In Action • Ultra-HD Preview
                </span>
              </div>

              {/* Mute / Unmute Button */}
              <button
                type="button"
                onClick={toggleIntroMute}
                className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold backdrop-blur-md transition-all border border-white/15 hover:scale-105 shadow-md active:scale-95"
                title={introMuted ? "Click to Unmute" : "Click to Mute"}
              >
                {introMuted ? <VolumeX size={14} className="text-rose-400" /> : <Volume2 size={14} className="text-emerald-400" />}
                <span>{introMuted ? 'Unmute Audio' : 'Mute Audio'}</span>
              </button>
            </div>

            {/* Video Element */}
            <div className="relative aspect-video w-full bg-black flex items-center justify-center overflow-hidden">
              <video
                ref={introVideoRef}
                src="/videos/intro.mp4"
                playsInline
                loop
                muted={introMuted}
                autoPlay
                className="w-full h-full object-cover group-hover:scale-[1.01] transition-transform duration-700"
              />

              {/* Bottom Subtle Overlay */}
              <div className="absolute bottom-0 inset-x-0 p-4 sm:p-6 bg-gradient-to-t from-black/85 via-black/30 to-transparent flex items-center justify-between pointer-events-none">
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-white drop-shadow-md">
                    Seamless Zero-Drift Synchronization
                  </h3>
                  <p className="text-xs text-neutral-300 drop-shadow">
                    Hover to preview • Continuous background loop • Sub-millisecond sync
                  </p>
                </div>
                <span className="hidden sm:inline-flex px-3 py-1 rounded-full bg-black/60 border border-white/20 text-[11px] font-mono text-neutral-300 backdrop-blur-md">
                  1080p 60FPS
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============ HOW IT WORKS ============ */}
      <section id="how" className="py-24 border-t border-white/[0.08] bg-[#050811]/60">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 grid md:grid-cols-2 gap-12 items-center">
          <div>
            <span className="text-xs uppercase font-bold text-neutral-400 tracking-widest">Instant Setup</span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white mt-2 leading-tight">
              Create a room, share the code, and sync up.
            </h2>
            <p className="text-neutral-400 text-sm leading-relaxed mt-4">
              Sync Wave makes group listening seamless. In less than 10 seconds, you can start a room, stream Bollywood or global hits, and sync multiple devices with no audio delay or echo.
            </p>
            <div className="mt-6">
              <Link to="/signup" className="text-xs font-bold text-white hover:text-neutral-300 flex items-center gap-1.5 group">
                <span>Start your first room now</span>
                <span className="group-hover:translate-x-1 transition-transform">→</span>
              </Link>
            </div>
          </div>

          <div className="space-y-4">
            <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/[0.08] hover:border-white/20 transition-all flex items-start gap-4 backdrop-blur-md">
              <span className="w-8 h-8 rounded-full bg-white text-[#03050a] font-mono font-bold flex items-center justify-center shrink-0 shadow-md">
                1
              </span>
              <div>
                <h4 className="text-sm font-bold text-white">Create a Room</h4>
                <p className="text-xs text-neutral-400 mt-1">
                  Name your room, pick an aesthetic theme (Cyberwave, Neon, Midnight), and get your unique 10-character group code.
                </p>
              </div>
            </div>

            <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/[0.08] hover:border-white/20 transition-all flex items-start gap-4 backdrop-blur-md">
              <span className="w-8 h-8 rounded-full bg-white text-[#03050a] font-mono font-bold flex items-center justify-center shrink-0 shadow-md">
                2
              </span>
              <div>
                <h4 className="text-sm font-bold text-white">Share Code or Link</h4>
                <p className="text-xs text-neutral-400 mt-1">
                  Send the invite code or direct URL to friends on WhatsApp, Discord, or Instagram. They can join on mobile or desktop instantly.
                </p>
              </div>
            </div>

            <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/[0.08] hover:border-white/20 transition-all flex items-start gap-4 backdrop-blur-md">
              <span className="w-8 h-8 rounded-full bg-white text-[#03050a] font-mono font-bold flex items-center justify-center shrink-0 shadow-md">
                3
              </span>
              <div>
                <h4 className="text-sm font-bold text-white">Listen In Exact Sync</h4>
                <p className="text-xs text-neutral-400 mt-1">
                  Our NTP-based sync engine locks playback within milliseconds across all connected phones and speakers simultaneously.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============ FEATURES ============ */}
      <section id="features" className="py-24 bg-[#03050a]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center max-w-xl mx-auto mb-14">
            <span className="text-xs uppercase font-bold text-neutral-400 tracking-widest">Engineered for Music Lovers</span>
            <h2 className="text-3xl font-extrabold text-white mt-2">Why Sync Wave is Different</h2>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            <div className="p-7 rounded-2xl bg-white/[0.02] border border-white/[0.08] hover:border-white/25 hover:bg-white/[0.04] transition-all backdrop-blur-xl group">
              <div className="w-12 h-12 rounded-xl bg-white/10 border border-white/20 text-white flex items-center justify-center text-2xl mb-5 shadow-inner group-hover:scale-105 transition-transform">
                🎵
              </div>
              <h3 className="text-base font-bold text-white mb-2">Free Unlimited Streaming</h3>
              <p className="text-xs text-neutral-400 leading-relaxed">
                Search millions of Bollywood, Indian, and international tracks from JioSaavn, MusicAPI, iTunes, and Audius with zero subscription fees.
              </p>
            </div>

            <div className="p-7 rounded-2xl bg-white/[0.02] border border-white/[0.08] hover:border-white/25 hover:bg-white/[0.04] transition-all backdrop-blur-xl group">
              <div className="w-12 h-12 rounded-xl bg-white/10 border border-white/20 text-white flex items-center justify-center text-2xl mb-5 shadow-inner group-hover:scale-105 transition-transform">
                👥
              </div>
              <h3 className="text-base font-bold text-white mb-2">Unlimited Room Capacity</h3>
              <p className="text-xs text-neutral-400 leading-relaxed">
                Connect 2 friends or 200 classmates in the same house party without bandwidth stuttering or member lockouts.
              </p>
            </div>

            <div className="p-7 rounded-2xl bg-white/[0.02] border border-white/[0.08] hover:border-white/25 hover:bg-white/[0.04] transition-all backdrop-blur-xl group">
              <div className="w-12 h-12 rounded-xl bg-white/10 border border-white/20 text-white flex items-center justify-center text-2xl mb-5 shadow-inner group-hover:scale-105 transition-transform">
                ⚡
              </div>
              <h3 className="text-base font-bold text-white mb-2">Real-Time Drift Correction</h3>
              <p className="text-xs text-neutral-400 leading-relaxed">
                Micro-rate clock synchronization smoothly corrects network latency without pitch changes, keeping every phone in tight harmonic phase.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ============ ROOMS USE CASES ============ */}
      <section id="rooms" className="py-24 border-t border-white/[0.08] bg-[#050811]/60">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="flex flex-col md:flex-row md:items-end justify-between mb-12">
            <div>
              <span className="text-xs uppercase font-bold text-neutral-400 tracking-widest">Experiences</span>
              <h2 className="text-3xl font-extrabold text-white mt-2">One Room for Every Moment</h2>
            </div>
            <Link to="/signup" className="text-xs font-semibold text-white hover:text-neutral-300 mt-3 md:mt-0 flex items-center gap-1">
              Create your room now <span>→</span>
            </Link>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            <Link to="/signup" className="p-6 rounded-2xl bg-white/[0.02] border border-white/[0.08] hover:border-white/25 hover:bg-white/[0.04] transition-all group backdrop-blur-md">
              <span className="text-3xl">📚</span>
              <h3 className="text-base font-bold text-white mt-4 group-hover:text-neutral-200 transition-colors">Study Sessions</h3>
              <p className="text-xs text-neutral-400 mt-2 leading-relaxed">
                Host a quiet room for classmates and keep the same lo-fi or classical focus playlist synced across dorm rooms.
              </p>
              <span className="inline-block text-xs font-semibold text-white mt-4">Start study room ↗</span>
            </Link>

            <Link to="/signup" className="p-6 rounded-2xl bg-white/[0.02] border border-white/[0.08] hover:border-white/25 hover:bg-white/[0.04] transition-all group backdrop-blur-md">
              <span className="text-3xl">🚗</span>
              <h3 className="text-base font-bold text-white mt-4 group-hover:text-neutral-200 transition-colors">Road Trips</h3>
              <p className="text-xs text-neutral-400 mt-2 leading-relaxed">
                Traveling in separate vehicles? One person controls the queue, while every car radio plays the exact same road playlist.
              </p>
              <span className="inline-block text-xs font-semibold text-white mt-4">Plan road playlist ↗</span>
            </Link>

            <Link to="/signup" className="p-6 rounded-2xl bg-white/[0.02] border border-white/[0.08] hover:border-white/25 hover:bg-white/[0.04] transition-all group backdrop-blur-md">
              <span className="text-3xl">🎮</span>
              <h3 className="text-base font-bold text-white mt-4 group-hover:text-neutral-200 transition-colors">Game Nights & Hangouts</h3>
              <p className="text-xs text-neutral-400 mt-2 leading-relaxed">
                Keep the same gaming soundtrack or party music pumping while everyone plays together online.
              </p>
              <span className="inline-block text-xs font-semibold text-white mt-4">Host game room ↗</span>
            </Link>
          </div>
        </div>
      </section>

      {/* ============ FAQ SECTION ============ */}
      <section id="faq" className="py-24 bg-[#03050a]">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-12">
            <span className="text-xs uppercase font-bold text-neutral-400 tracking-widest">Got Questions?</span>
            <h2 className="text-3xl font-extrabold text-white mt-2">Frequently Asked Questions</h2>
          </div>

          <div className="space-y-3">
            <details className="p-5 rounded-2xl bg-white/[0.02] border border-white/[0.08] group open:border-white/20 transition-all backdrop-blur-md">
              <summary className="font-semibold text-sm text-white cursor-pointer list-none flex justify-between items-center">
                <span>Is Sync Wave completely free?</span>
                <span className="text-neutral-400 text-lg group-open:rotate-45 transition-transform">+</span>
              </summary>
              <p className="text-xs text-neutral-400 mt-3 leading-relaxed">
                Yes. Sync Wave is 100% free with no hidden charges, paywalls, or limits on track queue sizes.
              </p>
            </details>

            <details className="p-5 rounded-2xl bg-white/[0.02] border border-white/[0.08] group open:border-white/20 transition-all backdrop-blur-md">
              <summary className="font-semibold text-sm text-white cursor-pointer list-none flex justify-between items-center">
                <span>How do friends join my listening room?</span>
                <span className="text-neutral-400 text-lg group-open:rotate-45 transition-transform">+</span>
              </summary>
              <p className="text-xs text-neutral-400 mt-3 leading-relaxed">
                Each room has a unique 10-character code (e.g. AFRBAKJSM7) and a direct link. Friends simply click your link or paste the code into Quick Join on the homepage to start listening immediately.
              </p>
            </details>

            <details className="p-5 rounded-2xl bg-white/[0.02] border border-white/[0.08] group open:border-white/20 transition-all backdrop-blur-md">
              <summary className="font-semibold text-sm text-white cursor-pointer list-none flex justify-between items-center">
                <span>What music catalog is available?</span>
                <span className="text-neutral-400 text-lg group-open:rotate-45 transition-transform">+</span>
              </summary>
              <p className="text-xs text-neutral-400 mt-3 leading-relaxed">
                We aggregate comprehensive global and Indian music search powered by native JioSaavn, MusicAPI worker engines, iTunes, and Audius, giving you access to all trending Bollywood, Hindi, Punjabi, and international tracks.
              </p>
            </details>

            <details className="p-5 rounded-2xl bg-white/[0.02] border border-white/[0.08] group open:border-white/20 transition-all backdrop-blur-md">
              <summary className="font-semibold text-sm text-white cursor-pointer list-none flex justify-between items-center">
                <span>Do my friends need to create an account?</span>
                <span className="text-neutral-400 text-lg group-open:rotate-45 transition-transform">+</span>
              </summary>
              <p className="text-xs text-neutral-400 mt-3 leading-relaxed">
                Signing up takes less than 15 seconds, or guests can join listening rooms directly via invite links to hear music and chat in real-time.
              </p>
            </details>
          </div>
        </div>
      </section>

      {/* ============ FINAL CTA ============ */}
      <section className="py-24 border-t border-white/[0.08] bg-gradient-to-b from-[#050811] to-[#020306]">
        <div className="max-w-4xl mx-auto px-4 text-center space-y-6">
          <h2 className="text-3xl sm:text-5xl font-extrabold text-white">
            Ready to listen together?
          </h2>
          <p className="text-neutral-400 text-sm max-w-lg mx-auto">
            Create a room, invite your friends, and hear every beat synchronized across every device.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4 pt-3">
            <Link
              to="/signup"
              className="px-8 py-4 rounded-xl font-bold text-sm text-[#03050a] bg-white hover:bg-neutral-100 shadow-[0_0_35px_rgba(255,255,255,0.35)] hover:-translate-y-0.5 transition-all"
            >
              Create a Free Room
            </Link>
            <Link
              to="/login"
              className="px-7 py-4 rounded-xl font-semibold text-sm text-neutral-300 hover:text-white border border-white/10 hover:border-white/25 bg-white/[0.03] transition-all"
            >
              Sign In
            </Link>
          </div>
        </div>
      </section>

      {/* ============ EXTRO VIDEO SHOWCASE SECTION ============ */}
      <section className="py-20 px-4 sm:px-6 max-w-5xl mx-auto border-t border-white/[0.08]">
        <div className="text-center mb-10 space-y-3">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/[0.04] border border-white/10 text-neutral-300 text-xs font-semibold">
            <span className="w-2 h-2 rounded-full bg-indigo-400" />
            <span>The Sync Wave Journey</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white">
            Experience Music Like Never Before
          </h2>
          <p className="text-neutral-400 text-xs sm:text-sm max-w-lg mx-auto">
            From solo playlists to unforgettable shared memories. Press play to view the SyncWave showcase.
          </p>
        </div>

        <div className="relative rounded-3xl p-1 bg-gradient-to-b from-white/10 via-white/5 to-white/10 shadow-[0_25px_80px_rgba(0,0,0,0.9)] group">
          <div className="relative rounded-[22px] overflow-hidden bg-black border border-white/10">
            <div className="relative aspect-video w-full bg-black flex items-center justify-center">
              <video
                ref={extroVideoRef}
                src="/videos/extro.mp4"
                playsInline
                preload="metadata"
                controls
                onPlay={() => setIsExtroPlaying(true)}
                onPause={() => setIsExtroPlaying(false)}
                className="w-full h-full object-cover"
              />

              {/* Big Overlay Play Button when paused */}
              {!isExtroPlaying && (
                <div
                  onClick={toggleExtroPlay}
                  className="absolute inset-0 bg-black/40 backdrop-blur-[2px] flex items-center justify-center cursor-pointer transition-all hover:bg-black/25"
                >
                  <div className="relative flex items-center justify-center">
                    <span className="absolute w-24 h-24 rounded-full bg-white/20 animate-ping" />
                    <button
                      type="button"
                      className="w-20 h-20 rounded-full bg-white hover:bg-neutral-100 text-[#03050a] flex items-center justify-center shadow-[0_0_50px_rgba(255,255,255,0.6)] hover:scale-110 active:scale-95 transition-all pl-1.5"
                    >
                      <Play size={32} className="fill-current text-[#03050a]" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ============ FOOTER ============ */}
      <footer className="border-t border-white/[0.06] bg-[#020306] py-10 text-neutral-500 text-xs">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <BrandLogo size="sm" animated={false} />
            <span className="text-neutral-600">|</span>
            <span className="text-neutral-400">Free synchronized music listening</span>
          </div>
          <div className="flex items-center gap-6 text-neutral-400 font-medium">
            <Link to="/login" className="hover:text-white transition-colors">Login</Link>
            <Link to="/signup" className="hover:text-white transition-colors">Register</Link>
            <Link to="/forgot-password" className="hover:text-white transition-colors">Password Recovery</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
