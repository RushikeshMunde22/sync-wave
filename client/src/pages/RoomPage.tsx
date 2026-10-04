import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { usePlayerStore } from '../stores/playerStore';
import { useSocketStore } from '../stores/socketStore';
import { useAuthStore } from '../stores/authStore';

export default function RoomPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { playbackState, queue, presence, groupInfo } = usePlayerStore();
  const { socket } = useSocketStore();
  const { user } = useAuthStore();

  useEffect(() => {
    if (socket && id) {
      socket.emit('join-room', id);
      return () => {
        socket.emit('leave-room', id);
      };
    }
  }, [socket, id]);

  const togglePlay = () => {
    if (!socket) return;
    if (playbackState.isPlaying) {
      socket.emit('pause', { groupId: id, position: playbackState.position });
    } else {
      socket.emit('play', { groupId: id, position: playbackState.position });
    }
  };

  const handleAdminPause = () => {
    if (socket) {
      socket.emit('admin-pause', { groupId: id });
    }
  };

  const handleResync = () => {
    if (socket) {
      socket.emit('resync', { groupId: id });
    }
  };

  const currentTrack = queue[0];
  const isAdmin = groupInfo?.admins?.includes(user?.id);
  const isPlaying = playbackState.isPlaying;

  return (
    <div className="min-h-screen bg-neutral-950 text-white flex flex-col">
      <header className="p-4 flex items-center justify-between border-b border-neutral-800">
        <button onClick={() => navigate('/')} className="text-neutral-400 hover:text-white p-2">
          ← Back
        </button>
        <div className="text-center font-bold">{groupInfo?.name || 'Listening Room'}</div>
        <button onClick={() => navigate(`/room/${id}/settings`)} className="text-neutral-400 hover:text-white p-2">
          ⚙️
        </button>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center p-6 relative overflow-hidden">
        {/* Dynamic Background */}
        {currentTrack?.artworkUrl && (
          <div 
            className="absolute inset-0 opacity-20 blur-3xl"
            style={{ backgroundImage: `url(${currentTrack.artworkUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' }}
          />
        )}

        <div className="z-10 w-full max-w-md flex flex-col items-center gap-8">
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="w-64 h-64 md:w-80 md:h-80 rounded-2xl overflow-hidden shadow-2xl bg-neutral-900 border border-neutral-800"
          >
            {currentTrack?.artworkUrl ? (
              <img src={currentTrack.artworkUrl} alt="Artwork" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-6xl">🎵</div>
            )}
          </motion.div>

          <div className="text-center">
            <h2 className="text-2xl font-bold line-clamp-1">{currentTrack?.title || 'No track playing'}</h2>
            <p className="text-neutral-400 text-lg">{currentTrack?.artist || 'Unknown Artist'}</p>
          </div>

          {/* Status Indicator */}
          <div className="flex items-center gap-2 text-sm bg-neutral-900/50 backdrop-blur-sm px-4 py-2 rounded-full">
            <div className={`w-2 h-2 rounded-full ${isPlaying ? 'bg-green-500' : 'bg-amber-500'}`} />
            {isPlaying ? 'In Sync' : 'Paused'}
          </div>

          {/* Controls */}
          <div className="flex items-center justify-center gap-6 w-full">
            <button className="text-neutral-400 hover:text-white p-4">⏭️</button>
            <button 
              onClick={togglePlay}
              className="w-20 h-20 bg-indigo-600 hover:bg-indigo-500 rounded-full flex items-center justify-center shadow-lg transition-transform hover:scale-105 active:scale-95 text-3xl"
            >
              {isPlaying ? '⏸' : '▶'}
            </button>
            <button className="text-neutral-400 hover:text-white p-4">⏭️</button>
          </div>

          {/* Admin Controls */}
          {isAdmin && (
            <button onClick={handleAdminPause} className="mt-4 px-6 py-2 bg-red-600/20 text-red-400 rounded-full hover:bg-red-600/30 text-sm font-medium">
              Pause for everyone
            </button>
          )}

          {/* Resync Button */}
          {!isPlaying && !isAdmin && (
            <button onClick={handleResync} className="mt-4 px-6 py-2 bg-indigo-600/20 text-indigo-400 rounded-full hover:bg-indigo-600/30 text-sm font-medium">
              Resync to Live
            </button>
          )}
        </div>
      </main>

      <footer className="p-4 border-t border-neutral-800 bg-neutral-950 flex flex-col gap-4">
        {/* Listeners */}
        <div className="flex items-center justify-center gap-2 overflow-x-auto">
          {presence.map((p, i) => (
            <div key={i} className="w-10 h-10 rounded-full flex items-center justify-center border-2 border-indigo-500 relative bg-neutral-800 text-sm">
              {p.emoji || '👤'}
              <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-green-500 rounded-full border border-neutral-900"></div>
            </div>
          ))}
          {presence.length === 0 && <div className="text-neutral-500 text-sm">You are the only one here.</div>}
        </div>

        {/* Reaction Bar */}
        <div className="flex justify-center gap-4 text-2xl">
          {['❤️', '🔥', '🎉', '😢', '👏'].map((emoji) => (
            <button key={emoji} onClick={() => socket?.emit('reaction', { groupId: id, emoji })} className="hover:scale-125 transition-transform">
              {emoji}
            </button>
          ))}
        </div>
      </footer>
    </div>
  );
}
