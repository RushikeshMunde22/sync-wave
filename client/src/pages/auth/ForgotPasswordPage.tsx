import { useState } from 'react';
import { motion } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';

export default function ForgotPasswordPage() {
  const [activeTab, setActiveTab] = useState<'email' | 'code'>('email');
  const [email, setEmail] = useState('');
  const [recoveryCode, setRecoveryCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

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
        throw new Error(data.error || 'Failed to request password recovery');
      }

      setSuccessMessage(
        'Password sent! If an account exists for this email, a new temporary password has been delivered to your inbox. Check your email and use it to log in.'
      );
    } catch (err: any) {
      setError(err.message || 'Something went wrong. Please try again.');
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
        throw new Error(data.error || 'Failed to reset password');
      }

      setSuccessMessage('Password reset successfully! Redirecting to login...');
      setTimeout(() => navigate('/login'), 2000);
    } catch (err: any) {
      setError(err.message || 'Failed to reset password');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-950 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md bg-neutral-900 rounded-3xl p-8 shadow-2xl border border-neutral-800"
      >
        <div className="text-center mb-6">
          <span className="text-4xl">🔐</span>
          <h1 className="text-2xl font-bold text-white mt-2">Password Recovery</h1>
          <p className="text-xs text-neutral-400 mt-1">Get back into your SyncWave account</p>
        </div>

        {/* Tab switch */}
        <div className="grid grid-cols-2 gap-2 p-1 bg-neutral-950 rounded-xl mb-6 border border-neutral-800 text-xs font-semibold">
          <button
            type="button"
            onClick={() => { setActiveTab('email'); setError(''); setSuccessMessage(''); }}
            className={`py-2 rounded-lg transition-colors ${
              activeTab === 'email' ? 'bg-indigo-600 text-white shadow' : 'text-neutral-400 hover:text-white'
            }`}
          >
            ✉️ Email Me Password
          </button>
          <button
            type="button"
            onClick={() => { setActiveTab('code'); setError(''); setSuccessMessage(''); }}
            className={`py-2 rounded-lg transition-colors ${
              activeTab === 'code' ? 'bg-indigo-600 text-white shadow' : 'text-neutral-400 hover:text-white'
            }`}
          >
            🔑 Use Recovery Code
          </button>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-400 p-3 rounded-xl mb-4 text-xs font-medium">
            {error}
          </div>
        )}
        {successMessage && (
          <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 p-3 rounded-xl mb-4 text-xs font-medium leading-relaxed">
            {successMessage}
          </div>
        )}

        {activeTab === 'email' ? (
          <form onSubmit={handleEmailRecovery} className="space-y-4">
            <div>
              <label className="block text-neutral-400 text-xs mb-1 font-medium">Registered Email Address</label>
              <input
                type="email"
                required
                placeholder="you@example.com"
                className="w-full bg-neutral-950 text-white rounded-xl px-4 py-3 border border-neutral-800 focus:border-indigo-500 outline-none text-sm transition-colors"
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
              className="w-full bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl py-3 font-semibold text-sm transition-colors shadow-lg shadow-indigo-600/20 disabled:opacity-50 mt-2"
            >
              {isLoading ? 'Sending Password...' : 'Send Password to My Email'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleCodeReset} className="space-y-4">
            <div>
              <label className="block text-neutral-400 text-xs mb-1 font-medium">Email Address</label>
              <input
                type="email"
                required
                placeholder="you@example.com"
                className="w-full bg-neutral-950 text-white rounded-xl px-4 py-2.5 border border-neutral-800 focus:border-indigo-500 outline-none text-sm"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-neutral-400 text-xs mb-1 font-medium">12-Character Recovery Code</label>
              <input
                type="text"
                required
                placeholder="e.g. 4a8b9c1d2e3f"
                className="w-full bg-neutral-950 text-white rounded-xl px-4 py-2.5 border border-neutral-800 focus:border-indigo-500 outline-none text-sm font-mono tracking-wider"
                value={recoveryCode}
                onChange={(e) => setRecoveryCode(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-neutral-400 text-xs mb-1 font-medium">New Password</label>
              <input
                type="password"
                required
                placeholder="At least 10 characters"
                className="w-full bg-neutral-950 text-white rounded-xl px-4 py-2.5 border border-neutral-800 focus:border-indigo-500 outline-none text-sm"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl py-3 font-semibold text-sm transition-colors shadow-lg disabled:opacity-50 mt-2"
            >
              {isLoading ? 'Resetting Password...' : 'Reset Password'}
            </button>
          </form>
        )}

        <div className="mt-6 text-center text-xs text-neutral-400">
          Remember your password?{' '}
          <Link to="/login" className="text-indigo-400 hover:text-indigo-300 font-medium">
            Log in
          </Link>
        </div>
      </motion.div>
    </div>
  );
}
