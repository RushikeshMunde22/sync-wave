import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { api } from '../lib/api';
import { useAuthStore } from '../stores/authStore';

export default function JoinGroupPage() {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const { user, isAuthenticated, isLoading: authLoading } = useAuthStore();
  const [status, setStatus] = useState<'joining' | 'needs_auth' | 'pending_approval' | 'error'>('joining');
  const [roomName, setRoomName] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState('');

  // Sanitize code: if it's a UUID (has dashes or >15 chars), keep it; otherwise 10-char uppercase alphanumeric
  const cleanCode = code
    ? (code.includes('-') || code.length > 15 ? code.trim() : code.trim().toUpperCase().replace(/[^A-Z2-9]/g, ''))
    : '';

  useEffect(() => {
    if (!cleanCode) {
      setStatus('error');
      setErrorMessage('No invite code or room ID provided.');
      return;
    }

    if (authLoading) return;

    let isMounted = true;

    // If user is not authenticated, fetch room preview and show join invitation card
    if (!isAuthenticated || !user) {
      setStatus('needs_auth');
      api.get(`/api/groups/join/${cleanCode}`)
        .then((res) => {
          if (isMounted && res.data?.name) {
            setRoomName(res.data.name);
          }
        })
        .catch(() => {
          // If public lookup fails, room might be private or ID-based; still allow them to log in to attempt joining
          if (isMounted) setRoomName('Listening Room');
        });
      return;
    }

    // User is authenticated: attempt joining
    const join = async () => {
      try {
        setStatus('joining');
        const res = await api.post('/api/groups/join', { code: cleanCode });
        if (isMounted) {
          if (res.data?.id) {
            navigate(`/room/${res.data.id}`, { replace: true });
          } else {
            navigate('/', { replace: true });
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
  }, [cleanCode, isAuthenticated, user, authLoading, navigate]);

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
            <h2 className="text-xl font-bold">Entering Listening Room...</h2>
            <p className="text-sm text-neutral-400">Connecting you with live synchronized audio...</p>
          </div>
        )}

        {status === 'needs_auth' && (
          <div className="py-6 space-y-5">
            <div className="w-16 h-16 bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 rounded-2xl flex items-center justify-center text-3xl mx-auto shadow-inner">
              🎵
            </div>
            <div>
              <span className="text-xs uppercase tracking-wider text-indigo-400 font-semibold">Room Invitation</span>
              <h2 className="text-2xl font-bold text-white mt-1">
                {roomName || 'Listening Room'}
              </h2>
              <p className="text-xs text-neutral-400 mt-2 leading-relaxed">
                You've been invited to listen together in real time. Log in or create an account to jump straight into the room.
              </p>
            </div>

            <div className="bg-neutral-950/80 border border-neutral-800 rounded-2xl p-4 font-mono text-center">
              <span className="text-xs text-neutral-500 uppercase block mb-1">Invite Code</span>
              <span className="text-indigo-400 font-bold tracking-widest text-lg select-all">{cleanCode}</span>
            </div>

            <div className="space-y-3 pt-2">
              <Link
                to={`/login?redirect=/join/${cleanCode}`}
                className="block w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-semibold text-sm transition-colors shadow-lg shadow-indigo-600/20"
              >
                Log In to Join Room
              </Link>
              <Link
                to={`/signup?redirect=/join/${cleanCode}`}
                className="block w-full py-3 bg-neutral-800 hover:bg-neutral-700 text-white rounded-xl font-semibold text-sm transition-colors border border-neutral-700"
              >
                Create Account & Join
              </Link>
            </div>

            <div className="pt-2">
              <Link to="/" className="text-xs text-neutral-500 hover:text-neutral-400 transition-colors">
                ← Back to SyncWave Home
              </Link>
            </div>
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
              The room host has been notified. Once approved, you can click this invite link again to join.
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
