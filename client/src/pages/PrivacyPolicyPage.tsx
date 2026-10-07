import { Link } from 'react-router-dom';
import { ArrowLeft, Shield, Lock, Eye, Cookie, Info } from 'lucide-react';
import { BrandLogo } from '../components/BrandLogo';
import { BrandFooter } from '../components/BrandFooter';

export default function PrivacyPolicyPage() {
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
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-950/60 border border-cyan-500/30 text-[11px] font-mono text-cyan-300">
            <Shield size={13} /> Legal & Privacy Compliance
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-white font-['Plus_Jakarta_Sans']">
            Privacy Policy
          </h1>
          <p className="text-sm text-neutral-400">
            Last updated: October 8, 2026 • Effective immediately
          </p>
        </div>

        {/* Section 1: Overview */}
        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-white flex items-center gap-2">
            <Lock size={18} className="text-cyan-400" /> 1. Overview & Information We Collect
          </h2>
          <p className="text-sm leading-relaxed text-neutral-300">
            SyncWave (&quot;we&quot;, &quot;our&quot;, or &quot;us&quot;) operates the real-time synchronized music and video web application. We respect your personal privacy. When you create an account or use our service, we collect:
          </p>
          <ul className="list-disc pl-5 space-y-2 text-sm text-neutral-400">
            <li><strong className="text-white">Account Details:</strong> Your display name, email address, and hashed authentication credentials.</li>
            <li><strong className="text-white">Listening & Room Sessions:</strong> Room membership, temporary queue states, and playlists saved to your profile.</li>
            <li><strong className="text-white">Technical Log Data:</strong> Device browser type, operating system, IP address, and connection timestamps to maintain synchronized clock offsets.</li>
          </ul>
        </section>

        {/* Section 2: Google AdSense & Advertising Cookies (MANDATORY FOR GOOGLE ADSENSE) */}
        <section className="space-y-4 rounded-2xl border border-cyan-500/20 bg-cyan-950/20 p-6">
          <h2 className="text-xl font-semibold text-white flex items-center gap-2">
            <Cookie size={18} className="text-cyan-400" /> 2. Google AdSense & Advertising Cookies
          </h2>
          <p className="text-sm leading-relaxed text-neutral-300">
            We use <strong className="text-white">Google AdSense</strong> to display advertisements to support our free synchronized music streaming services. In compliance with Google AdSense Policies:
          </p>
          <div className="space-y-3 text-sm text-neutral-300 pl-2 border-l-2 border-cyan-500/40">
            <p>
              • Third-party vendors, including <strong>Google</strong>, use cookies to serve ads based on your prior visits to our website or other websites across the Internet.
            </p>
            <p>
              • Google&apos;s use of advertising cookies enables it and its partners to serve ads to you based on your visit to SyncWave and/or other websites on the Internet.
            </p>
            <p>
              • You may opt out of personalized advertising by visiting Google&apos;s Ads Settings at{' '}
              <a
                href="https://www.google.com/settings/ads"
                target="_blank"
                rel="noreferrer"
                className="text-cyan-400 hover:underline"
              >
                https://www.google.com/settings/ads
              </a>. Alternatively, you can opt out of a third-party vendor&apos;s use of cookies for personalized advertising by visiting{' '}
              <a
                href="https://www.aboutads.info/choices/"
                target="_blank"
                rel="noreferrer"
                className="text-cyan-400 hover:underline"
              >
                www.aboutads.info
              </a>.
            </p>
          </div>
        </section>

        {/* Section 3: Third-Party Music & Video Services */}
        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-white flex items-center gap-2">
            <Eye size={18} className="text-indigo-400" /> 3. Third-Party Music & Media Services
          </h2>
          <p className="text-sm leading-relaxed text-neutral-300">
            SyncWave interfaces with third-party audio and video APIs to synchronize public media streams, including YouTube IFrame APIs, JioSaavn, Jamendo, and Audius. By using these features, you acknowledge that interaction with third-party embedded players (such as YouTube) is governed by each third party&apos;s respective Terms of Service and Privacy Policy:
          </p>
          <ul className="list-disc pl-5 space-y-1 text-sm text-neutral-400">
            <li><a href="https://www.youtube.com/t/terms" target="_blank" rel="noreferrer" className="text-cyan-400 hover:underline">YouTube Terms of Service</a></li>
            <li><a href="https://policies.google.com/privacy" target="_blank" rel="noreferrer" className="text-cyan-400 hover:underline">Google Privacy Policy</a></li>
          </ul>
        </section>

        {/* Section 4: Data Security */}
        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-white flex items-center gap-2">
            <Info size={18} className="text-emerald-400" /> 4. Data Retention & Contact
          </h2>
          <p className="text-sm leading-relaxed text-neutral-300">
            We employ modern industry standards including Argon2id password hashing, HTTPS/TLS encryption, and strict Content Security Policies. You may delete your account, saved playlists, and stored data at any time via your Profile settings.
          </p>
          <p className="text-sm text-neutral-400">
            For privacy inquiries, DMCA notifications, or data deletion requests, contact our developer team directly at{' '}
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
