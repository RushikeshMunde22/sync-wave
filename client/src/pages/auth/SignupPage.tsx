import { useState } from 'react';
import { useAuthStore } from '../../stores/authStore';
import { useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';

export default function SignupPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [emoji, setEmoji] = useState('🎧');
  const [color, setColor] = useState('#6366f1');
  const [error, setError] = useState('');
  const [recoveryCode, setRecoveryCode] = useState('');
  const { signup, isLoading } = useAuthStore();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      const res = await signup({ email, password, displayName, emoji, color });
      if (res.recoveryCode) {
        setRecoveryCode(res.recoveryCode);
      } else {
        navigate('/');
      }
    } catch (err: any) {
      setError(err.message || 'Signup failed');
    }
  };

  return (
    <div className="min-h-screen bg-neutral-950 flex items-center justify-center p-4">
      <AnimatePresence>
        {!recoveryCode ? (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="w-full max-w-md bg-neutral-900 rounded-2xl p-8 shadow-xl border border-neutral-800"
          >
            <h1 className="text-3xl font-bold text-white mb-6 text-center">Create Account</h1>
            {error && <div className="bg-red-500/10 text-red-400 p-3 rounded-lg mb-4 text-sm">{error}</div>}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-neutral-400 text-sm mb-1">Email</label>
                <input 
                  type="email"
                  required
                  className="w-full bg-neutral-800 text-white rounded-lg px-4 py-3 border border-neutral-700 outline-none"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-neutral-400 text-sm mb-1">Password</label>
                <input 
                  type="password"
                  required
                  className="w-full bg-neutral-800 text-white rounded-lg px-4 py-3 border border-neutral-700 outline-none"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-neutral-400 text-sm mb-1">Display Name</label>
                <input 
                  type="text"
                  required
                  className="w-full bg-neutral-800 text-white rounded-lg px-4 py-3 border border-neutral-700 outline-none"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                />
              </div>
              <button 
                type="submit"
                disabled={isLoading}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg py-3 font-semibold transition-colors disabled:opacity-50 mt-4"
              >
                {isLoading ? 'Creating...' : 'Sign Up'}
              </button>
            </form>
            <div className="mt-6 text-center text-sm text-neutral-400">
              Already have an account? <Link to="/login" className="text-indigo-400 hover:text-indigo-300">Log in</Link>
            </div>
          </motion.div>
        ) : (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-md bg-neutral-900 rounded-2xl p-8 shadow-xl border border-neutral-800 text-center"
          >
            <h2 className="text-2xl font-bold text-white mb-4">Save your recovery code!</h2>
            <p className="text-neutral-400 mb-6">You will need this code to recover your account if you forget your password.</p>
            <div className="bg-neutral-950 p-4 rounded-lg text-lg font-mono text-indigo-400 mb-6 select-all">
              {recoveryCode}
            </div>
            <button 
              onClick={() => navigate('/')}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg py-3 font-semibold"
            >
              I've saved it
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
