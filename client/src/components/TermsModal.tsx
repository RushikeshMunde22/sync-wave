import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FileText, Shield, Check, X } from 'lucide-react';

interface TermsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAccept: () => void;
}

export function TermsModal({ isOpen, onClose, onAccept }: TermsModalProps) {
  const [tab, setTab] = useState<'terms' | 'privacy'>('terms');

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          className="w-full max-w-2xl bg-[#090d16] border border-white/10 rounded-3xl shadow-2xl flex flex-col max-h-[85vh] overflow-hidden text-neutral-300"
        >
          {/* Header */}
          <div className="p-5 border-b border-white/10 flex items-center justify-between bg-black/40">
            <div className="flex items-center gap-2">
              <span className="p-2 rounded-xl bg-white/10 text-white">
                <FileText className="w-4 h-4" />
              </span>
              <div>
                <h3 className="text-base font-bold text-white">SyncWave Legal & Privacy Terms</h3>
                <p className="text-[11px] text-neutral-400">Please review before continuing registration</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-neutral-400 hover:text-white hover:bg-white/10 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Tab selector */}
          <div className="flex border-b border-white/10 bg-black/20 px-5 pt-2 gap-2 text-xs font-semibold">
            <button
              onClick={() => setTab('terms')}
              className={`pb-2.5 px-3 border-b-2 transition-colors flex items-center gap-1.5 ${
                tab === 'terms'
                  ? 'border-indigo-400 text-white'
                  : 'border-transparent text-neutral-400 hover:text-neutral-200'
              }`}
            >
              <FileText className="w-3.5 h-3.5" /> Terms of Service
            </button>
            <button
              onClick={() => setTab('privacy')}
              className={`pb-2.5 px-3 border-b-2 transition-colors flex items-center gap-1.5 ${
                tab === 'privacy'
                  ? 'border-indigo-400 text-white'
                  : 'border-transparent text-neutral-400 hover:text-neutral-200'
              }`}
            >
              <Shield className="w-3.5 h-3.5" /> Privacy Policy
            </button>
          </div>

          {/* Document Content Scrollable Area */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4 text-xs leading-relaxed text-neutral-300 scrollbar-thin">
            {tab === 'terms' ? (
              <>
                <section className="space-y-2">
                  <h4 className="font-bold text-sm text-white">1. Acceptance of Terms</h4>
                  <p>
                    By creating an account or accessing any synchronized listening room on SyncWave, you agree to comply with and be bound by these Terms of Service. If you do not accept these terms, you must discontinue using SyncWave immediately.
                  </p>
                </section>

                <section className="space-y-2">
                  <h4 className="font-bold text-sm text-white">2. Acceptable Community Conduct</h4>
                  <p>
                    SyncWave is designed for real-time collaborative media enjoyment. Users are strictly prohibited from distributing malicious code, engaging in hate speech or harassment in room chats, attempting unauthorized server access, or abusing synchronized media feeds.
                  </p>
                </section>

                <section className="space-y-2">
                  <h4 className="font-bold text-sm text-white">3. Intellectual Property & Streaming</h4>
                  <p>
                    All music previews, radio streams, and YouTube synchronized video feeds are displayed and rendered using legitimate public APIs and compliant embedded players. SyncWave respects copyright holders and operates a swift DMCA takedown process.
                  </p>
                </section>

                <section className="space-y-2">
                  <h4 className="font-bold text-sm text-white">4. Superadmin Authority & Moderation</h4>
                  <p>
                    Platform administrators reserve the authority to terminate abusive sessions, suspend violating accounts, and moderate public rooms to ensure user safety.
                  </p>
                </section>
              </>
            ) : (
              <>
                <section className="space-y-2">
                  <h4 className="font-bold text-sm text-white">1. Information We Collect</h4>
                  <p>
                    We collect minimal essential information necessary to provide synchronized playback: your email address, display name, and avatar customization preferences. Passwords are cryptographically hashed using Argon2id and never stored in plain text.
                  </p>
                </section>

                <section className="space-y-2">
                  <h4 className="font-bold text-sm text-white">2. Cookies & Local Data</h4>
                  <p>
                    SyncWave uses strictly necessary session cookies (<code className="text-indigo-300 font-mono">syncwave_session</code>) and local browser storage to retain room synchronization preferences and volume levels.
                  </p>
                </section>

                <section className="space-y-2">
                  <h4 className="font-bold text-sm text-white">3. Google Authentication</h4>
                  <p>
                    When logging in with Google, we receive only your verified email, name, and profile picture from Google Identity Services. We never access your Google contacts, Google Drive, or private data.
                  </p>
                </section>

                <section className="space-y-2">
                  <h4 className="font-bold text-sm text-white">4. No Data Selling</h4>
                  <p>
                    We never sell, rent, or monetize your personal information to third-party data brokers.
                  </p>
                </section>
              </>
            )}
          </div>

          {/* Footer Actions */}
          <div className="p-4 border-t border-white/10 bg-black/40 flex items-center justify-between">
            <span className="text-[11px] text-neutral-400">
              Clicking &ldquo;I Accept Terms&rdquo; will check the agreement box.
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-xs text-neutral-300 hover:text-white bg-white/5 hover:bg-white/10 transition-colors"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => {
                  onAccept();
                  onClose();
                }}
                className="px-5 py-2 rounded-xl text-xs font-bold text-black bg-white hover:bg-neutral-100 flex items-center gap-1.5 transition-all shadow-lg shadow-white/20"
              >
                <Check className="w-3.5 h-3.5" /> I Accept Terms
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
