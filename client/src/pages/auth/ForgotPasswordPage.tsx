import { useState } from 'react';
import { motion } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [recoveryCode, setRecoveryCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, recoveryCode, newPassword }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to reset password');
      }
      setSuccess(true);
      setTimeout(() => navigate('/login'), 2000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-950 flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md bg-neutral-900 rounded-2xl p-8 shadow-xl border border-neutral-800"
      >
        <h1 className="text-3xl font-bold text-white mb-6 text-center">Reset Password</h1>
        {error && <div className="bg-red-500/10 text-red-400 p-3 rounded-lg mb-4 text-sm">{error}</div>}
        {success && <div className="bg-green-500/10 text-green-400 p-3 rounded-lg mb-4 text-sm">Password reset successfully! Redirecting...</div>}
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-neutral-400 text-sm mb-1">Email</label>
            <input 
              type="email" required
              className="w-full bg-neutral-800 text-white rounded-lg px-4 py-3 outline-none"
              value={email} onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-neutral-400 text-sm mb-1">Recovery Code</label>
            <input 
              type="text" required
              className="w-full bg-neutral-800 text-white rounded-lg px-4 py-3 outline-none font-mono"
              value={recoveryCode} onChange={(e) => setRecoveryCode(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-neutral-400 text-sm mb-1">New Password</label>
            <input 
              type="password" required
              className="w-full bg-neutral-800 text-white rounded-lg px-4 py-3 outline-none"
              value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
            />
          </div>
          <button 
            type="submit" disabled={isLoading}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg py-3 font-semibold transition-colors mt-4"
          >
            {isLoading ? 'Resetting...' : 'Reset Password'}
          </button>
        </form>
        <div className="mt-6 text-center text-sm text-neutral-400">
          Remember your password? <Link to="/login" className="text-indigo-400 hover:text-indigo-300">Log in</Link>
        </div>
      </motion.div>
    </div>
  );
}
