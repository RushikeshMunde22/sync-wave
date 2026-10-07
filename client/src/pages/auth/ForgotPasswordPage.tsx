import { useState } from 'react';
import { motion } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import { BrandLogo } from '../../components/BrandLogo';

export default function ForgotPasswordPage() {
  const [activeTab, setActiveTab] = useState<'email' | 'code'>('email');
  const [email, setEmail] = useState('');
  const [recoveryCode, setRecoveryCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const formatErr = (err: any, fallback: string) => {
    if (!err) return fallback;
    if (typeof err === 'string') return err;
    if (Array.isArray(err)) {
      return err.map((e: any) => (typeof e === 'string' ? e : e?.message || JSON.stringify(e))).join(', ');
    }
    if (typeof err === 'object') {
      if (Array.isArray(err.errors)) return formatErr(err.errors, fallback);
      if (Array.isArray(err.issues)) return formatErr(err.issues, fallback);
      if (typeof err.message === 'string' && err.message && err.message !== '[object Object]') return err.message;
      if (typeof err.error !== 'undefined') return formatErr(err.error, fallback);
    }
    const str = String(err);
    return str === '[object Object]' ? fallback : str;
  };

  const handleEmailRecovery = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMessage('');
    setIsLoading(true);

    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(formatErr(data.error, 'Failed to request password recovery'));
      }

      setSuccessMessage(
        'Password sent! If an account exists for this email, a new temporary password has been dispatched directly to your inbox. Check your email and use it to log in.'
      );
    } catch (err: any) {
      setError(formatErr(err, 'Something went wrong. Please try again.'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleCodeReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMessage('');
    setIsLoading(true);

    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), recoveryCode: recoveryCode.trim(), newPassword }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(formatErr(data.error, 'Failed to reset password'));
      }

      setSuccessMessage('Password reset successfully! Redirecting to login...');
      setTimeout(() => navigate('/login'), 2000);
    } catch (err: any) {
      setError(formatErr(err, 'Failed to reset password'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#03050a] flex flex-col items-center justify-center p-4 relative overflow-hidden text-white selection:bg-white/20 selection:text-white">
      {/* Ambient background lighting */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[350px] bg-white/[0.03] blur-[140px] rounded-full pointer-events-none -z-10" />

      {/* Brand logo header */}
      <Link to="/" className="mb-8 flex items-center group">
        <BrandLogo size="lg" animated={false} />
      </Link>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-md bg-gradient-to-b from-[#0a0f1d]/90 to-[#04060d]/90 rounded-3xl p-8 shadow-[0_20px_50px_rgba(0,0,0,0.8),inset_0_1px_1px_rgba(255,255,255,0.15)] border border-white/10 backdrop-blur-2xl relative z-10"
      >
        <div className="text-center mb-6">
          <div className="w-12 h-12 rounded-2xl bg-white/10 border border-white/20 text-white flex items-center justify-center text-2xl mx-auto mb-3 shadow-inner">
            🔐
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Password Recovery</h1>
          <p className="text-xs text-neutral-400 mt-1">Get back into your SyncWave account</p>
        </div>

        {/* Tab switch */}
        <div className="grid grid-cols-2 gap-2 p-1.5 bg-black/50 rounded-2xl mb-6 border border-white/10 text-xs font-semibold">
          <button
            type="button"
            onClick={() => { setActiveTab('email'); setError(''); setSuccessMessage(''); }}
            className={`py-2.5 rounded-xl transition-all ${
              activeTab === 'email' 
                ? 'bg-white text-[#03050a] font-bold shadow-lg shadow-white/20' 
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            ✉️ Email Me Password
          </button>
          <button
            type="button"
            onClick={() => { setActiveTab('code'); setError(''); setSuccessMessage(''); }}
            className={`py-2.5 rounded-xl transition-all ${
              activeTab === 'code' 
                ? 'bg-white text-[#03050a] font-bold shadow-lg shadow-white/20' 
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            🔑 Use Recovery Code
          </button>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-400 p-3 rounded-xl mb-4 text-xs font-medium">
            {formatErr(error, 'An error occurred')}
          </div>
        )}
        {successMessage && (
          <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 p-3.5 rounded-xl mb-4 text-xs font-medium leading-relaxed">
            {successMessage}
          </div>
        )}

        {activeTab === 'email' ? (
          <form onSubmit={handleEmailRecovery} className="space-y-4">
            <div>
              <label className="block text-neutral-400 text-xs mb-1 font-semibold uppercase tracking-wider">
                Registered Email Address
              </label>
              <input
                type="email"
                required
                placeholder="you@example.com"
                className="w-full bg-black/40 text-white rounded-xl px-4 py-3 border border-white/10 focus:border-white/30 outline-none text-sm transition-colors shadow-inner"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <p className="text-[11px] text-neutral-500 mt-1.5 leading-relaxed">
                We will generate a new secure password and dispatch it directly to your email inbox via SyncWave's mail delivery system.
              </p>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-white hover:bg-neutral-100 text-[#03050a] font-bold rounded-xl py-3.5 text-sm transition-all shadow-[0_0_25px_rgba(255,255,255,0.25)] hover:shadow-[0_0_35px_rgba(255,255,255,0.4)] disabled:opacity-50 mt-2"
            >
              {isLoading ? 'Dispatching Password...' : 'Send Password to My Email'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleCodeReset} className="space-y-4">
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
                12-Character Recovery Code
              </label>
              <input
                type="text"
                required
                placeholder="e.g. 4a8b9c1d2e3f"
                className="w-full bg-black/40 text-white rounded-xl px-4 py-3 border border-white/10 focus:border-white/30 outline-none text-sm font-mono tracking-wider transition-colors shadow-inner"
                value={recoveryCode}
                onChange={(e) => setRecoveryCode(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-neutral-400 text-xs mb-1 font-semibold uppercase tracking-wider">
                New Password
              </label>
              <input
                type="password"
                required
                minLength={10}
                placeholder="At least 10 characters"
                className="w-full bg-black/40 text-white rounded-xl px-4 py-3 border border-white/10 focus:border-white/30 outline-none text-sm transition-colors shadow-inner"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-white hover:bg-neutral-100 text-[#03050a] font-bold rounded-xl py-3.5 text-sm transition-all shadow-[0_0_25px_rgba(255,255,255,0.25)] hover:shadow-[0_0_35px_rgba(255,255,255,0.4)] disabled:opacity-50 mt-2"
            >
              {isLoading ? 'Resetting Password...' : 'Reset Password'}
            </button>
          </form>
        )}

        <div className="mt-6 text-center text-xs text-neutral-400">
          Remember your password?{' '}
          <Link to="/login" className="text-white hover:underline font-semibold transition-colors">
            Log in
          </Link>
        </div>
      </motion.div>
    </div>
  );
}
