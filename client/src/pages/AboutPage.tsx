import { Link } from 'react-router-dom';
import { ArrowLeft, Sparkles, Music2, Cpu, Globe2, ShieldCheck, Users, Headphones, Zap } from 'lucide-react';
import { BrandLogo } from '../components/BrandLogo';
import { BrandFooter } from '../components/BrandFooter';

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-[#050811] text-neutral-300">
      {/* Top Navbar */}
      <header className="sticky top-0 z-40 border-b border-neutral-800/80 bg-black/80 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              to="/"
              className="inline-flex items-center gap-2 text-xs font-medium text-neutral-400 hover:text-white transition-colors"
            >
              <ArrowLeft size={16} /> Back to SyncWave
            </Link>
          </div>
          <BrandLogo size="sm" />
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden border-b border-neutral-800/60 bg-gradient-to-b from-indigo-950/20 via-black to-[#050811] py-16 sm:py-24">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center space-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-950/60 border border-cyan-500/30 text-xs font-mono text-cyan-300">
            <Sparkles size={14} /> The Future of Social Audio
          </div>
          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-white font-['Plus_Jakarta_Sans'] leading-tight">
            About <span className="bg-gradient-to-r from-cyan-400 via-indigo-400 to-purple-400 bg-clip-text text-transparent">SyncWave</span>
          </h1>
          <p className="text-base sm:text-lg text-neutral-400 max-w-2xl mx-auto font-light leading-relaxed">
            SyncWave is an ultra-low latency, real-time synchronized music and video platform built to connect people across the globe through music, lyrics, and shared moments.
          </p>
        </div>
      </section>

      {/* Main Narrative */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-12 sm:py-16 space-y-16">
        {/* Mission Statement */}
        <section className="space-y-4">
          <div className="inline-flex items-center gap-2 text-xs font-mono text-indigo-400 uppercase tracking-wider">
            <Music2 size={14} /> Our Mission
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold text-white font-['Plus_Jakarta_Sans']">
            Music is better when heard together.
          </h2>
          <p className="text-sm sm:text-base leading-relaxed text-neutral-300 font-light">
            Streaming platforms isolated the music experience into private headphones and individual playlists. SyncWave was founded on a simple conviction: listening to music with friends, loved ones, and communities should be seamless, instantaneous, and high-fidelity—regardless of physical distance or operating system.
          </p>
        </section>

        {/* Technical Architecture */}
        <section className="space-y-6">
          <div className="inline-flex items-center gap-2 text-xs font-mono text-cyan-400 uppercase tracking-wider">
            <Cpu size={14} /> Technical Architecture
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold text-white font-['Plus_Jakarta_Sans']">
            Engineered for Sub-Millisecond Synchronization
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="p-6 rounded-2xl border border-neutral-800 bg-neutral-900/40 space-y-3">
              <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
                <Zap size={20} />
              </div>
              <h3 className="text-base font-semibold text-white">NTP-Style Clock Synchronization</h3>
              <p className="text-xs sm:text-sm text-neutral-400 leading-relaxed font-light">
                SyncWave runs high-frequency round-trip clock sampling between client devices and our edge sync engine, calculating network flight time and dynamic clock offsets to synchronize audio with sub-10ms precision.
              </p>
            </div>

            <div className="p-6 rounded-2xl border border-neutral-800 bg-neutral-900/40 space-y-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                <Headphones size={20} />
              </div>
              <h3 className="text-base font-semibold text-white">Lossless 320kbps Audio Streams</h3>
              <p className="text-xs sm:text-sm text-neutral-400 leading-relaxed font-light">
                We deliver pure, uninterrupted 320kbps audio alongside time-synchronized Spotify-style lyrics, dynamic color palettes, and Web Audio API background resilience.
              </p>
            </div>

            <div className="p-6 rounded-2xl border border-neutral-800 bg-neutral-900/40 space-y-3">
              <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
                <Globe2 size={20} />
              </div>
              <h3 className="text-base font-semibold text-white">Synchronized YouTube Watch Parties</h3>
              <p className="text-xs sm:text-sm text-neutral-400 leading-relaxed font-light">
                Watch music videos, concerts, and podcasts together with frame-accurate drift correction, true fullscreen scaling, and real-time floating live emoji reactions.
              </p>
            </div>

            <div className="p-6 rounded-2xl border border-neutral-800 bg-neutral-900/40 space-y-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                <ShieldCheck size={20} />
              </div>
              <h3 className="text-base font-semibold text-white">Enterprise-Grade Security</h3>
              <p className="text-xs sm:text-sm text-neutral-400 leading-relaxed font-light">
                Protected by strict Content Security Policies, signed HTTP-only cookies, Argon2id hashing, rate-limiting, and WhatsApp-style admin hierarchies.
              </p>
            </div>
          </div>
        </section>

        {/* Community & Team */}
        <section className="space-y-4 rounded-2xl border border-neutral-800 bg-gradient-to-r from-neutral-900/80 to-black p-8">
          <div className="inline-flex items-center gap-2 text-xs font-mono text-emerald-400 uppercase tracking-wider">
            <Users size={14} /> The Team Behind SyncWave
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-white font-['Plus_Jakarta_Sans']">
            Built by Music Enthusiasts for the Global Web
          </h2>
          <p className="text-sm text-neutral-300 font-light leading-relaxed">
            SyncWave is maintained by founder Rushikesh Munde and a community of open-source contributors. We believe in high performance, transparent privacy, and accessible audio for everyone without paywalls or restrictive lock-ins.
          </p>
          <div className="pt-2">
            <Link
              to="/contact"
              className="inline-flex items-center gap-2 text-xs font-semibold text-cyan-400 hover:text-cyan-300 transition-colors"
            >
              Get in touch with the team &rarr;
            </Link>
          </div>
        </section>
      </main>

      <BrandFooter />
    </div>
  );
}
