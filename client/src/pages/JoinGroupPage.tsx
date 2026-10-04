import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { api } from '../lib/api';

export default function JoinGroupPage() {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const [status, setStatus] = useState<'joining' | 'pending_approval' | 'error'>('joining');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (!code) {
      setStatus('error');
      setErrorMessage('No invite code provided.');
      return;
    }

    let isMounted = true;

    const join = async () => {
      try {
        const res = await api.post('/api/groups/join', { code: code.trim() });
        if (isMounted) {
          if (res.data?.id) {
            navigate(`/room/${res.data.id}`);
          } else {
            navigate('/');
          }
        }
      } catch (err: any) {
        if (!isMounted) return;
        const msg = err.response?.data?.error || err.message || 'Failed to join group';
        if (msg.toLowerCase().includes('pending') || msg.toLowerCase().includes('approval') || msg.toLowerCase().includes('removed')) {
          setStatus('pending_approval');
          setErrorMessage(msg);
        } else {
          setStatus('error');
          setErrorMessage(msg);
        }
      }
    };

    join();

    return () => {
      isMounted = false;
    };
  }, [code, navigate]);

  return (
    <div className="min-h-screen bg-neutral-950 flex items-center justify-center p-4 text-white">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md bg-neutral-900 rounded-3xl p-8 border border-neutral-800 shadow-2xl text-center"
      >
        {status === 'joining' && (
          <div className="py-8 space-y-4">
            <div className="w-14 h-14 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto" />
            <h2 className="text-xl font-bold">Joining Listening Room...</h2>
            <p className="text-sm text-neutral-400">Connecting you with synchronized audio...</p>
          </div>
        )}

        {status === 'pending_approval' && (
          <div className="py-6 space-y-4">
            <span className="text-5xl">⏳</span>
            <h2 className="text-xl font-bold text-amber-300">Approval Requested</h2>
            <p className="text-sm text-neutral-300 leading-relaxed bg-amber-500/10 border border-amber-500/20 p-4 rounded-xl">
              {errorMessage}
            </p>
            <p className="text-xs text-neutral-400">
              The room moderators have been notified. Once approved, you can click this invite link again to join.
            </p>
            <button
              onClick={() => navigate('/')}
              className="mt-4 px-6 py-2.5 bg-neutral-800 hover:bg-neutral-700 rounded-xl text-sm font-semibold transition-colors"
            >
              Back to Dashboard
            </button>
          </div>
        )}

        {status === 'error' && (
          <div className="py-6 space-y-4">
            <span className="text-5xl">⚠️</span>
            <h2 className="text-xl font-bold text-rose-400">Unable to Join Room</h2>
            <p className="text-sm text-neutral-400 bg-rose-500/10 border border-rose-500/20 p-4 rounded-xl">
              {errorMessage}
            </p>
            <button
              onClick={() => navigate('/')}
              className="mt-4 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 rounded-xl text-sm font-semibold transition-colors"
            >
              Return Home
            </button>
          </div>
        )}
      </motion.div>
    </div>
  );
}
