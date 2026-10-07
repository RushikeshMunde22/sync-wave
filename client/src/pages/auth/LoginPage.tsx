import { useState } from 'react';
import { useAuthStore } from '../../stores/authStore';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { BrandLogo } from '../../components/BrandLogo';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [groupCode, setGroupCode] = useState('');
  const { login, isLoading } = useAuthStore();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await login(email, password);
      const currentUser = useAuthStore.getState().user;
      const searchParams = new URLSearchParams(window.location.search);
      const redirectUrl = searchParams.get('redirect');

      if (currentUser?.role === 'superadmin') {
        navigate(redirectUrl && redirectUrl.startsWith('/admin') ? redirectUrl : '/admin/dashboard');
      } else if (redirectUrl && redirectUrl.startsWith('/')) {
        navigate(redirectUrl);
      } else {
        navigate('/');
      }
    } catch (err: any) {
      setError(err.message || 'Login failed. Please verify your credentials.');
    }
  };

  const handleJoinDirect = (e: React.FormEvent) => {
    e.preventDefault();
    if (!groupCode.trim()) return;
    navigate(`/join/${groupCode.trim().toUpperCase()}`);
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
          <h1 className="text-2xl font-bold text-white tracking-tight">Welcome Back</h1>
          <p className="text-xs text-neutral-400 mt-1">
            Sign in to access your listening rooms and playlists
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
            <div className="flex justify-between items-center mb-1">
              <label className="block text-neutral-400 text-xs font-semibold uppercase tracking-wider">
                Password
              </label>
              <Link to="/forgot-password" className="text-xs text-neutral-400 hover:text-white transition-colors">
                Forgot password?
              </Link>
            </div>
            <input
              type="password"
              required
              placeholder="••••••••••••"
              className="w-full bg-black/40 text-white rounded-xl px-4 py-3 border border-white/10 focus:border-white/30 outline-none text-sm transition-colors shadow-inner"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-white hover:bg-neutral-100 text-[#03050a] rounded-xl py-3.5 font-bold text-sm shadow-[0_0_25px_rgba(255,255,255,0.25)] hover:shadow-[0_0_35px_rgba(255,255,255,0.4)] transition-all disabled:opacity-50 mt-2"
          >
            {isLoading ? 'Signing In...' : 'Sign In'}
          </button>
        </form>

        {/* Quick Join without account */}
        <div className="mt-6 pt-6 border-t border-white/[0.08]">
          <span className="block text-[11px] font-semibold text-neutral-400 uppercase tracking-wider text-center mb-3">
            Or Join Room with Code
          </span>
          <form onSubmit={handleJoinDirect} className="flex gap-2">
            <input
              type="text"
              placeholder="10-char Group Code"
              maxLength={10}
              className="flex-1 bg-black/40 text-white rounded-xl px-3.5 py-2.5 border border-white/10 focus:border-white/30 outline-none text-xs font-mono tracking-wider shadow-inner"
              value={groupCode}
              onChange={(e) => setGroupCode(e.target.value)}
            />
            <button
              type="submit"
              className="bg-white/[0.06] hover:bg-white/[0.12] text-white border border-white/15 px-4 py-2.5 rounded-xl text-xs font-semibold transition-colors"
            >
              Join
            </button>
          </form>
        </div>

        <div className="mt-6 text-center text-xs text-neutral-400">
          Don't have an account?{' '}
          <Link to="/signup" className="text-white hover:underline font-semibold transition-colors">
            Sign up for free
          </Link>
        </div>
      </motion.div>
    </div>
  );
}
