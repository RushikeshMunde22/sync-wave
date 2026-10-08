import { Link } from 'react-router-dom';
import { ArrowLeft, ShieldAlert, FileText, Mail, CheckCircle2 } from 'lucide-react';
import { BrandLogo } from '../components/BrandLogo';
import { BrandFooter } from '../components/BrandFooter';

export default function DMCAPage() {
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
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-950/60 border border-red-500/30 text-xs font-mono text-red-300">
            <ShieldAlert size={14} /> Intellectual Property & Copyright
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white font-['Plus_Jakarta_Sans']">
            DMCA & Copyright Policy
          </h1>
          <p className="text-sm text-neutral-400">
            SyncWave operates in full compliance with the Digital Millennium Copyright Act (17 U.S.C. § 512) and international copyright directives.
          </p>
        </div>

        {/* Section 1: Introduction */}
        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-white flex items-center gap-2">
            <FileText size={18} className="text-cyan-400" /> 1. Copyright Statement & Public Media Indexing
          </h2>
          <p className="text-sm leading-relaxed text-neutral-300 font-light">
            SyncWave respects the intellectual property rights of artists, publishers, and creators. SyncWave does not host, store, or pirate unauthorized copies of copyrighted audio or video media on its servers. Instead, our technology indexes and synchronizes publicly available media streams via authorized third-party APIs (including the official YouTube IFrame API, Jamendo Music API, and Audius Decentralized Protocol).
          </p>
        </section>

        {/* Section 2: Designated Agent */}
        <section className="space-y-4 rounded-2xl border border-neutral-800 bg-neutral-900/40 p-6">
          <h2 className="text-xl font-semibold text-white flex items-center gap-2">
            <Mail size={18} className="text-indigo-400" /> 2. Designated Copyright Agent
          </h2>
          <p className="text-sm leading-relaxed text-neutral-300 font-light">
            If you are a copyright owner or an agent authorized to act on behalf of one, you may submit a formal takedown notice to our designated copyright agent:
          </p>
          <div className="space-y-1 text-xs text-neutral-400 font-mono bg-black/60 p-4 rounded-xl border border-neutral-800">
            <p><strong className="text-white">Designated Agent:</strong> Rushikesh Munde (SyncWave Operations)</p>
            <p><strong className="text-white">Email:</strong> munderushikesh66@gmail.com</p>
            <p><strong className="text-white">Subject Line:</strong> DMCA Copyright Infringement Notice - SyncWave</p>
            <p><strong className="text-white">Platform Domain:</strong> syncwave.work.gd</p>
          </div>
        </section>

        {/* Section 3: Notice Requirements */}
        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-white flex items-center gap-2">
            <CheckCircle2 size={18} className="text-emerald-400" /> 3. Required Information for DMCA Notices
          </h2>
          <p className="text-sm text-neutral-300 font-light leading-relaxed">
            Pursuant to 17 U.S.C. § 512(c)(3), your notice must include:
          </p>
          <ul className="list-disc pl-5 space-y-2 text-xs sm:text-sm text-neutral-400 font-light">
            <li>A physical or electronic signature of a person authorized to act on behalf of the owner of an exclusive right that is allegedly infringed.</li>
            <li>Identification of the copyrighted work claimed to have been infringed.</li>
            <li>Identification of the material that is claimed to be infringing and information reasonably sufficient to permit us to locate the material (e.g., track title, artist, or specific URL).</li>
            <li>Information reasonably sufficient to permit us to contact you, such as an address, telephone number, and email address.</li>
            <li>A statement that you have a good-faith belief that use of the material in the manner complained of is not authorized by the copyright owner, its agent, or the law.</li>
            <li>A statement that the information in the notification is accurate, and under penalty of perjury, that you are authorized to act on behalf of the copyright owner.</li>
          </ul>
        </section>

        {/* Section 4: Expedited Takedown Process */}
        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-white">4. Expedited Takedown Response</h2>
          <p className="text-sm text-neutral-300 font-light leading-relaxed">
            Upon receipt of a valid and complete DMCA notice, SyncWave will expeditiously disable access to or remove the identified track or video reference from our search index and room queues within 24 to 48 hours.
          </p>
        </section>
      </main>

      <BrandFooter />
    </div>
  );
}
