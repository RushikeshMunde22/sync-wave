import { Link } from 'react-router-dom';
import { ArrowLeft, FileText, CheckCircle2, AlertTriangle, ShieldCheck } from 'lucide-react';
import { BrandLogo } from '../components/BrandLogo';
import { BrandFooter } from '../components/BrandFooter';

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-[#050811] text-neutral-300">
      {/* Top Navbar */}
      <header className="sticky top-0 z-40 border-b border-neutral-800/80 bg-black/80 backdrop-blur-xl">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
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

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-12 sm:py-16 space-y-10">
        <div className="space-y-3 border-b border-neutral-800 pb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-950/60 border border-indigo-500/30 text-[11px] font-mono text-indigo-300">
            <FileText size={13} /> Terms of Service
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-white font-['Plus_Jakarta_Sans']">
            Terms of Service
          </h1>
          <p className="text-sm text-neutral-400">
            Last updated: October 8, 2026 • Please read carefully before using SyncWave
          </p>
        </div>

        {/* Section 1: Acceptance */}
        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-white flex items-center gap-2">
            <CheckCircle2 size={18} className="text-emerald-400" /> 1. Acceptance of Terms
          </h2>
          <p className="text-sm leading-relaxed text-neutral-300">
            By creating an account, joining a listening room, or otherwise accessing SyncWave, you agree to be bound by these Terms of Service and our Privacy Policy. If you do not agree to these terms, please do not use the service.
          </p>
        </section>

        {/* Section 2: Acceptable Use */}
        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-white flex items-center gap-2">
            <ShieldCheck size={18} className="text-cyan-400" /> 2. Community & Acceptable Use
          </h2>
          <p className="text-sm leading-relaxed text-neutral-300">
            SyncWave is built to connect music and video enthusiasts in real time. You agree not to:
          </p>
          <ul className="list-disc pl-5 space-y-2 text-sm text-neutral-400">
            <li>Engage in abusive, harassing, or hate speech within room chats or member interactions.</li>
            <li>Attempt to reverse-engineer, circumvent authentication, or attack our server infrastructure.</li>
            <li>Use automated bots or scrapers to generate false clicks or artificially inflate ad impressions.</li>
            <li>Transmit copyrighted materials that violate intellectual property rights.</li>
          </ul>
        </section>

        {/* Section 3: Third-Party Content & YouTube */}
        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-white flex items-center gap-2">
            <AlertTriangle size={18} className="text-amber-400" /> 3. Third-Party Media & Intellectual Property
          </h2>
          <p className="text-sm leading-relaxed text-neutral-300">
            All music tracks and video streams belong to their respective copyright holders. SyncWave does not claim ownership over public streams indexed via YouTube, Jamendo, or other music catalogs. Use of YouTube content is subject to the{' '}
            <a href="https://www.youtube.com/t/terms" target="_blank" rel="noreferrer" className="text-cyan-400 hover:underline">
              YouTube Terms of Service
            </a>.
          </p>
        </section>

        {/* Section 4: Advertising Disclosures */}
        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-white flex items-center gap-2">
            <FileText size={18} className="text-purple-400" /> 4. Advertisements & Monetization
          </h2>
          <p className="text-sm leading-relaxed text-neutral-300">
            To provide high-quality synchronized audio without subscription fees, SyncWave displays promotional content and Google AdSense advertisements. Users agree not to artificially manipulate or click on ads deceptively.
          </p>
        </section>

        {/* Section 5: Contact */}
        <section className="space-y-4 border-t border-neutral-800 pt-6">
          <h2 className="text-lg font-semibold text-white">Contact Us</h2>
          <p className="text-sm text-neutral-400">
            Questions regarding these Terms of Service should be directed to{' '}
            <a href="mailto:munderushikesh66@gmail.com" className="text-cyan-400 hover:underline">
              munderushikesh66@gmail.com
            </a>.
          </p>
        </section>
      </main>

      <BrandFooter />
    </div>
  );
}
