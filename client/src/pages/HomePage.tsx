import { useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';

export default function HomePage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [showJoin, setShowJoin] = useState(false);
  const [joinCode, setJoinCode] = useState('');

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    if (joinCode.trim()) {
      navigate(`/join/${joinCode.trim()}`);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-white p-6 pb-24 md:pb-6">
      <div className="max-w-4xl mx-auto space-y-8">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Welcome back, {user?.displayName || 'Guest'}</h1>
            <p className="text-neutral-400 mt-1">Ready to listen together?</p>
          </div>
          <div className="w-12 h-12 rounded-full flex items-center justify-center text-2xl shadow-lg" style={{ backgroundColor: user?.avatarColor || '#6366f1' }}>
            {user?.avatarEmoji || '🎵'}
          </div>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <motion.div 
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => navigate('/room/new')}
            className="bg-indigo-600/20 border border-indigo-500/30 rounded-2xl p-6 cursor-pointer group transition-colors hover:bg-indigo-600/30"
          >
            <div className="w-12 h-12 bg-indigo-500 rounded-full flex items-center justify-center text-2xl mb-4 group-hover:scale-110 transition-transform">
              ✨
            </div>
            <h2 className="text-xl font-bold mb-2">Create a Group</h2>
            <p className="text-indigo-200/80">Start a new listening room and invite your friends.</p>
          </motion.div>

          <motion.div 
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setShowJoin(true)}
            className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 cursor-pointer group transition-colors hover:bg-neutral-800"
          >
            <div className="w-12 h-12 bg-neutral-800 rounded-full flex items-center justify-center text-2xl mb-4 group-hover:scale-110 transition-transform">
              🤝
            </div>
            <h2 className="text-xl font-bold mb-2">Join a Group</h2>
            <p className="text-neutral-400">Have an invite code? Join an existing room.</p>
          </motion.div>
        </div>

        {showJoin && (
          <motion.form 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            onSubmit={handleJoin}
            className="bg-neutral-900 rounded-2xl p-6 border border-neutral-800 flex gap-4"
          >
            <input 
              type="text"
              placeholder="Enter invite code..."
              className="flex-1 bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-3 outline-none focus:border-indigo-500"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value)}
              autoFocus
            />
            <button type="submit" className="bg-white text-black px-6 py-3 rounded-xl font-semibold hover:bg-neutral-200 transition-colors">
              Join
            </button>
          </motion.form>
        )}

        <section>
          <h3 className="text-xl font-bold mb-4">Your Groups</h3>
          <div className="bg-neutral-900 rounded-2xl p-8 text-center text-neutral-500 border border-neutral-800">
            No active groups right now. Create one to get started!
          </div>
        </section>
      </div>
    </div>
  );
}
