import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, HelpCircle, ChevronDown, Sparkles } from 'lucide-react';
import { BrandLogo } from '../components/BrandLogo';
import { BrandFooter } from '../components/BrandFooter';

interface FAQItem {
  question: string;
  answer: string;
  category: string;
}

const FAQS: FAQItem[] = [
  {
    category: 'Sync & Performance',
    question: 'How does SyncWave keep music synchronized across different devices?',
    answer: 'SyncWave uses a proprietary Network Time Protocol (NTP)-inspired synchronization engine. When you connect to a room, your browser exchanges timestamped ping pulses with our server to calculate latency, jitter, and clock offsets. When music plays or seeks, all clients calculate the exact target playback offset so everyone hears the same beat at the same millisecond.',
  },
  {
    category: 'Sync & Performance',
    question: 'What happens if my internet connection lags or stutters?',
    answer: 'Our Web Audio player features multi-device drift correction. If your local audio drifts by more than 1.5 seconds due to a momentary packet loss or mobile network fluctuation, the player automatically re-aligns without interrupting other listeners in the room.',
  },
  {
    category: 'Features & Rooms',
    question: 'Can I watch YouTube videos together in sync?',
    answer: 'Yes! SyncWave supports YouTube synchronized watch parties. When you create or join a room in Video or Both mode, everyone in the group watches the same video in real time with play, pause, seek, and track-end synchronization, including true fullscreen mode and floating live emoji reactions.',
  },
  {
    category: 'Features & Rooms',
    question: 'Does the music keep playing if I switch tabs or lock my phone screen?',
    answer: 'Yes. SyncWave implements continuous background audio resilience utilizing Web Audio API oscillators and system MediaSession hooks. Your audio will continue playing seamlessly even when you switch tabs, minimize your browser, or lock your mobile device screen.',
  },
  {
    category: 'Admin & Permissions',
    question: 'Who can control playback, skip songs, or add tracks to the queue?',
    answer: 'SyncWave features WhatsApp-style admin hierarchies. By default, only the Room Creator (👑) and Group Admins (🛡️) can control playback and add songs directly. Regular members can use the "Request to Play" button to submit song or video suggestions, which admins can approve or dismiss with one click in the Requests panel. Creators can also turn on "Party Mode" to let all members control playback.',
  },
  {
    category: 'Audio Quality',
    question: 'What audio quality does SyncWave support?',
    answer: 'SyncWave streams audio at up to 320kbps high-fidelity bitrate. We support studio tracks, synchronized lyrics, and dynamic color art extraction across regional Indian music, global hits, and independent creative catalogs.',
  },
  {
    category: 'Pricing & Monetization',
    question: 'Is SyncWave free to use?',
    answer: 'Yes! SyncWave is completely free for all users. You do not need any paid subscriptions or premium credit cards. We support our server infrastructure and streaming bandwidth through non-intrusive promotional partnerships and Google AdSense advertisements.',
  },
  {
    category: 'Privacy & Security',
    question: 'Is my listening data private and secure?',
    answer: 'Absolutely. We do not sell your personal data or listening history. Passwords are encrypted with state-of-the-art Argon2id hashing, and connections are protected with strict Content Security Policies, TLS encryption, and secure HTTP-only cookies. You can delete your account and playlists anytime.',
  },
  {
    category: 'Rooms & Limits',
    question: 'What is the maximum number of people that can join a room?',
    answer: 'Rooms support up to 50 active listeners simultaneously by default, making SyncWave ideal for parties, study sessions, friend hangouts, and virtual music clubs. Rooms with 0 active members for 5 consecutive minutes are automatically cleaned up to keep server performance optimal.',
  },
  {
    category: 'AdSense & Ads',
    question: 'Why do I see advertisements on the platform?',
    answer: 'SyncWave is powered by community developers and high-bandwidth edge servers. Google AdSense ads help cover our server hosting, CDN audio bandwidth, and real-time synchronization infrastructure so the platform remains 100% free for everyone forever.',
  },
];

export default function FAQPage() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const toggle = (index: number) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  // Structured Data (JSON-LD) for Google Rich FAQ Snippets
  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: FAQS.map((faq) => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: faq.answer,
      },
    })),
  };

  return (
    <div className="min-h-screen bg-[#050811] text-neutral-300">
      {/* Inject FAQPage Schema */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />

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
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-12 sm:py-16 space-y-12">
        <div className="space-y-3 border-b border-neutral-800 pb-8 text-center sm:text-left">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-950/60 border border-indigo-500/30 text-xs font-mono text-indigo-300">
            <Sparkles size={14} /> Knowledge Base & Support
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white font-['Plus_Jakarta_Sans']">
            Frequently Asked Questions
          </h1>
          <p className="text-sm text-neutral-400 max-w-xl">
            Everything you need to know about synchronized music, YouTube watch parties, audio latency, and room permissions.
          </p>
        </div>

        {/* FAQ Accordion List */}
        <div className="space-y-4">
          {FAQS.map((faq, index) => {
            const isOpen = openIndex === index;
            return (
              <div
                key={index}
                className="overflow-hidden rounded-2xl border border-neutral-800/80 bg-neutral-900/40 backdrop-blur-sm transition-all hover:border-neutral-700/80"
              >
                <button
                  onClick={() => toggle(index)}
                  className="w-full flex items-center justify-between p-5 sm:p-6 text-left transition-colors hover:bg-white/[0.02]"
                  aria-expanded={isOpen}
                >
                  <div className="space-y-1 pr-4">
                    <span className="text-[10px] font-mono uppercase tracking-wider text-cyan-400 font-semibold block">
                      {faq.category}
                    </span>
                    <h2 className="text-sm sm:text-base font-semibold text-white">
                      {faq.question}
                    </h2>
                  </div>
                  <ChevronDown
                    size={18}
                    className={`text-neutral-400 shrink-0 transition-transform duration-200 ${
                      isOpen ? 'rotate-180 text-cyan-400' : ''
                    }`}
                  />
                </button>

                {isOpen && (
                  <div className="px-5 sm:px-6 pb-6 pt-1 text-xs sm:text-sm text-neutral-300 leading-relaxed font-light border-t border-neutral-800/40">
                    <p>{faq.answer}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Still have questions */}
        <div className="p-8 rounded-2xl border border-neutral-800 bg-gradient-to-r from-neutral-900/60 to-black text-center space-y-4">
          <HelpCircle size={28} className="mx-auto text-indigo-400" />
          <h2 className="text-lg font-bold text-white font-['Plus_Jakarta_Sans']">
            Still have questions or need assistance?
          </h2>
          <p className="text-xs sm:text-sm text-neutral-400 max-w-md mx-auto font-light">
            We are here to help. Reach out directly to our developer team and we will respond within 24 hours.
          </p>
          <div className="pt-2">
            <Link
              to="/contact"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold shadow-lg shadow-cyan-600/20 transition-all hover:scale-105 active:scale-95"
            >
              Contact Support
            </Link>
          </div>
        </div>
      </main>

      <BrandFooter />
    </div>
  );
}
