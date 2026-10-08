import { useState } from 'react';
import { useAuthStore } from '../../stores/authStore';
import { useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { BrandLogo } from '../../components/BrandLogo';
import { GoogleLoginButton } from '../../components/auth/GoogleLoginButton';
import { TermsModal } from '../../components/TermsModal';

const EMOJI_OPTIONS = ['🎧', '🎵', '⚡', '🔥', '🚀', '✨', '🎸', '🎹'];
const COLOR_OPTIONS = ['#ffffff', '#e2e8f0', '#94a3b8', '#38bdf8', '#818cf8', '#a855f7', '#ec4899', '#10b981'];

export default function SignupPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [emoji, setEmoji] = useState('🎧');
  const [color, setColor] = useState('#ffffff');
  const [error, setError] = useState('');
  const [recoveryCode, setRecoveryCode] = useState('');
  const [copied, setCopied] = useState(false);
  const [termsAgreed, setTermsAgreed] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const { signup, isLoading } = useAuthStore();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!termsAgreed) {
      setError('Please read and agree to the Terms of Service & Privacy Policy to create your account.');
      return;
    }
    try {
      const res = await signup({ 
        email: email.trim(), 
        password, 
        displayName: displayName.trim(), 
        avatarEmoji: emoji, 
        avatarColor: color 
      });
      const searchParams = new URLSearchParams(window.location.search);
      const redirectUrl = searchParams.get('redirect');

      if (res.recoveryCode) {
        setRecoveryCode(res.recoveryCode);
      } else if (redirectUrl && redirectUrl.startsWith('/')) {
        navigate(redirectUrl);
      } else {
        navigate('/');
      }
    } catch (err: any) {
      setError(err.message || 'Signup failed. Please try again.');
    }
  };

  const copyCode = () => {
    navigator.clipboard.writeText(recoveryCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-[#03050a] flex flex-col items-center justify-center p-4 relative overflow-hidden text-white selection:bg-white/20 selection:text-white">
      {/* Ambient background lighting */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[650px] h-[380px] bg-white/[0.03] blur-[140px] rounded-full pointer-events-none -z-10" />

      {/* Brand logo header */}
      <Link to="/" className="mb-8 flex items-center group">
        <BrandLogo size="lg" animated={false} />
      </Link>

      <AnimatePresence>
        {!recoveryCode ? (
          <motion.div 
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="w-full max-w-md bg-gradient-to-b from-[#0a0f1d]/90 to-[#04060d]/90 rounded-3xl p-8 shadow-[0_20px_50px_rgba(0,0,0,0.8),inset_0_1px_1px_rgba(255,255,255,0.15)] border border-white/10 backdrop-blur-2xl relative z-10"
          >
            <div className="text-center mb-6">
              <h1 className="text-2xl font-bold text-white tracking-tight">Create Account</h1>
              <p className="text-xs text-neutral-400 mt-1">
                Join SyncWave to host synchronized music sessions for free
              </p>
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/30 text-red-400 p-3 rounded-xl mb-4 text-xs font-medium">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-neutral-400 text-xs mb-1 font-semibold uppercase tracking-wider">
                  Email Address
                </label>
                <input 
                  type="email"
                  required
                  placeholder="you@example.com"
                  className="w-full bg-black/40 text-white rounded-xl px-4 py-3 border border-white/10 focus:border-white/30 outline-none text-sm transition-colors shadow-inner"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-neutral-400 text-xs mb-1 font-semibold uppercase tracking-wider">
                  Password
                </label>
                <input 
                  type="password"
                  required
                  minLength={10}
                  placeholder="Minimum 10 characters"
                  className="w-full bg-black/40 text-white rounded-xl px-4 py-3 border border-white/10 focus:border-white/30 outline-none text-sm transition-colors shadow-inner"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <span className="text-[11px] text-neutral-500 mt-1 block">At least 10 characters with numbers/symbols</span>
              </div>

              <div>
                <label className="block text-neutral-400 text-xs mb-1 font-semibold uppercase tracking-wider">
                  Display Name
                </label>
                <input 
                  type="text"
                  required
                  placeholder="Your DJ handle or nickname"
                  className="w-full bg-black/40 text-white rounded-xl px-4 py-3 border border-white/10 focus:border-white/30 outline-none text-sm transition-colors shadow-inner"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-neutral-400 text-xs mb-2 font-semibold uppercase tracking-wider">
                  Avatar Emoji
                </label>
                <div className="flex gap-2 flex-wrap">
                  {EMOJI_OPTIONS.map((e) => (
                    <button
                      key={e}
                      type="button"
                      onClick={() => setEmoji(e)}
                      className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg transition-all ${
                        emoji === e 
                          ? 'bg-white text-[#03050a] scale-110 shadow-lg shadow-white/20 font-bold' 
                          : 'bg-black/40 border border-white/10 hover:border-white/25'
                      }`}
                    >
                      {e}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-neutral-400 text-xs mb-2 font-semibold uppercase tracking-wider">
                  Avatar Accent Color
                </label>
                <div className="flex gap-2.5 flex-wrap">
                  {COLOR_OPTIONS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setColor(c)}
                      style={{ backgroundColor: c }}
                      className={`w-7 h-7 rounded-full transition-all ${
                        color === c ? 'ring-2 ring-white scale-110 shadow-md' : 'opacity-60 hover:opacity-100'
                      }`}
                    />
                  ))}
                </div>
              </div>

              <div className="flex items-start gap-2.5 pt-1">
                <input 
                  type="checkbox"
                  id="termsCheckbox"
                  checked={termsAgreed}
                  onChange={(e) => setTermsAgreed(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded border-white/20 bg-black/40 text-indigo-500 focus:ring-0 focus:outline-none cursor-pointer accent-indigo-500"
                />
                <label htmlFor="termsCheckbox" className="text-xs text-neutral-300 leading-tight select-none cursor-pointer">
                  I agree to the{' '}
                  <button
                    type="button"
                    onClick={() => setShowTermsModal(true)}
                    className="text-white underline hover:text-indigo-300 font-medium transition-colors"
                  >
                    Terms of Service & Privacy Policy
                  </button>
                </label>
              </div>

              <button 
                type="submit"
                disabled={isLoading}
                className="w-full bg-white hover:bg-neutral-100 text-[#03050a] rounded-xl py-3.5 font-bold text-sm shadow-[0_0_25px_rgba(255,255,255,0.25)] hover:shadow-[0_0_35px_rgba(255,255,255,0.4)] transition-all disabled:opacity-50 mt-4 cursor-pointer"
              >
                {isLoading ? 'Creating Account...' : 'Sign Up Free'}
              </button>
            </form>

            {/* Google One-Click Account Creation */}
            <div className="mt-5 space-y-3">
              <div className="relative flex items-center justify-center">
                <div className="border-t border-white/10 w-full" />
                <span className="bg-[#070b16] px-3 text-[11px] font-semibold text-neutral-400 uppercase tracking-wider relative">
                  Or Sign Up With
                </span>
                <div className="border-t border-white/10 w-full" />
              </div>

              <GoogleLoginButton text="signup_with" />
            </div>

            <div className="mt-6 text-center text-xs text-neutral-400">
              Already have an account?{' '}
              <Link to="/login" className="text-white hover:underline font-semibold transition-colors">
                Log in
              </Link>
            </div>
          </motion.div>
        ) : (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-md bg-gradient-to-b from-[#0a0f1d]/90 to-[#04060d]/90 rounded-3xl p-8 shadow-2xl border border-white/20 text-center backdrop-blur-2xl relative z-10"
          >
            <div className="w-12 h-12 rounded-2xl bg-white/10 border border-white/20 text-white flex items-center justify-center text-2xl mx-auto mb-4">
              🔑
            </div>
            <h2 className="text-xl font-bold text-white mb-2">Save Your Recovery Code!</h2>
            <p className="text-xs text-neutral-400 mb-5 leading-relaxed">
              Store this secret emergency key somewhere safe. If you ever forget your password, you can instantly recover your account with this code.
            </p>

            <div className="bg-black/60 p-4 rounded-xl text-base font-mono text-white mb-4 select-all border border-white/15 break-all shadow-inner">
              {recoveryCode}
            </div>

            <button
              onClick={copyCode}
              className="text-xs text-neutral-400 hover:text-white mb-6 flex items-center justify-center gap-1.5 mx-auto"
            >
              <span>{copied ? '✓ Copied to clipboard' : '📋 Copy code to clipboard'}</span>
            </button>

            <button 
              onClick={() => {
                const searchParams = new URLSearchParams(window.location.search);
                const redirectUrl = searchParams.get('redirect');
                navigate(redirectUrl && redirectUrl.startsWith('/') ? redirectUrl : '/');
              }}
              className="w-full bg-white hover:bg-neutral-100 text-[#03050a] font-bold rounded-xl py-3.5 text-sm shadow-[0_0_25px_rgba(255,255,255,0.3)] transition-all"
            >
              I've Saved It, Let's Listen! →
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <TermsModal
        isOpen={showTermsModal}
        onClose={() => setShowTermsModal(false)}
        onAccept={() => setTermsAgreed(true)}
      />
    </div>
  );
}
