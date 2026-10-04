import { useState } from 'react';
import { useAuthStore } from '../../stores/authStore';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { login, isLoading } = useAuthStore();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await login(email, password);
      navigate('/');
    } catch (err: any) {
      setError(err.message || 'Login failed');
    }
  };

  return (
    <div className="min-h-screen bg-neutral-950 flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md bg-neutral-900 rounded-2xl p-8 shadow-xl border border-neutral-800"
      >
        <h1 className="text-3xl font-bold text-white mb-6 text-center">Welcome Back</h1>
        {error && <div className="bg-red-500/10 text-red-400 p-3 rounded-lg mb-4 text-sm">{error}</div>}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-neutral-400 text-sm mb-1">Email</label>
            <input 
              type="email"
              required
              className="w-full bg-neutral-800 text-white rounded-lg px-4 py-3 border border-neutral-700 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-neutral-400 text-sm mb-1">Password</label>
            <input 
              type="password"
              required
              className="w-full bg-neutral-800 text-white rounded-lg px-4 py-3 border border-neutral-700 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <button 
            type="submit"
            disabled={isLoading}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg py-3 font-semibold transition-colors disabled:opacity-50"
          >
            {isLoading ? 'Logging in...' : 'Log In'}
          </button>
        </form>
        <div className="mt-6 text-center text-sm text-neutral-400">
          <Link to="/forgot-password" className="hover:text-white transition-colors">Forgot password?</Link>
        </div>
        <div className="mt-6 text-center text-sm text-neutral-400">
          Don't have an account? <Link to="/signup" className="text-indigo-400 hover:text-indigo-300 transition-colors">Sign up</Link>
        </div>
      </motion.div>
    </div>
  );
}
