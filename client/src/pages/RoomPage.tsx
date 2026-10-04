import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { usePlayerStore, QueueItem } from '../stores/playerStore.js';
import { useSocketStore } from '../stores/socketStore.js';
import { useAuthStore } from '../stores/authStore.js';
import { audioEngine } from '../player/AudioEngine.js';
import { mediaSessionManager } from '../player/MediaSessionManager.js';
import { api } from '../lib/api.js';

const ALLOWED_EMOJIS = ['❤️', '🔥', '😂', '😮', '👏', '🎶', '😭', '🙌'];

export default function RoomPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { socket, isConnected, connect } = useSocketStore();

  const {
    roomState,
    playback,
    queue,
    members,
    isLocallyPaused,
    isAdminPaused,
    adminPausedBy,
    autoplayBlocked,
    skipVote,
    reactions,
    currentTimeMs,
    durationMs,
    setRoomState,
    setPlayback,
    setQueue,
    addMember,
    removeMember,
    updateMemberStatus,
    setLocallyPaused,
    setAdminPaused,
    setAutoplayBlocked,
    setSkipVote,
    addReaction,
    setTime,
    resetRoom,
  } = usePlayerStore();

  const [showQueueModal, setShowQueueModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [copiedInvite, setCopiedInvite] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [activeQueueTab, setActiveQueueTab] = useState<'queue' | 'search' | 'playlists'>('queue');
  const [userPlaylists, setUserPlaylists] = useState<any[]>([]);
  const [importingPlaylist, setImportingPlaylist] = useState(false);
  const [pendingRequests, setPendingRequests] = useState<any[]>([]);

  // Initialize socket connection
  useEffect(() => {
    connect();
  }, [connect]);

  // AudioEngine callback subscriptions
  useEffect(() => {
    audioEngine.setCallbacks({
      onPresenceChange: (status) => {
        if (socket && id) {
          socket.emit('presence:update', { groupId: id, status });
        }
      },
      onEnded: (payload) => {
        if (socket && id) {
          socket.emit('playback:ended', {
            groupId: id,
            trackId: payload.trackId,
            version: payload.version,
          });
        }
      },
      onAutoplayBlocked: (blocked) => {
        setAutoplayBlocked(blocked);
      },
      onTimeUpdate: (currentMs, durMs) => {
        setTime(currentMs, durMs);
      },
      onError: (msg) => {
        setErrorMessage(msg);
      },
    });

    mediaSessionManager.setCallbacks({
      onPlay: () => handlePlay(),
      onPause: () => handlePause(),
      onSeek: (posMs) => handleSeek(posMs),
      onNext: () => handleSkip(),
    });

    return () => {
      audioEngine.setCallbacks({});
      mediaSessionManager.clear();
      resetRoom();
    };
  }, [socket, id]);

  // Socket room joining and event listeners
  useEffect(() => {
    if (!socket || !id) return;

    const joinRoom = () => {
      socket.emit('room:join', { groupId: id }, (response: any) => {
        if (response?.success && response.state) {
          setRoomState(response.state);
          audioEngine.syncWithState(response.state.playback);
        } else {
          setErrorMessage(response?.error || 'Failed to enter listening room.');
        }
      });
    };

    if (isConnected) {
      joinRoom();
    }

    socket.on('connect', joinRoom);

    socket.on('room:state', (state: any) => {
      setRoomState(state);
      audioEngine.syncWithState(state.playback);
    });

    socket.on('room:member-joined', (data: any) => {
      if (data?.member) addMember(data.member);
    });

    socket.on('room:member-left', (data: any) => {
      if (data?.userId) removeMember(data.userId);
    });

    socket.on('playback:state', (state: any) => {
      setPlayback(state);
      audioEngine.syncWithState(state);
    });

    socket.on('playback:admin-paused', (data: any) => {
      setAdminPaused(true, data.pausedByName);
    });

    socket.on('playback:admin-resumed', () => {
      setAdminPaused(false);
    });

    socket.on('queue:updated', (data: any) => {
      if (data?.queue) setQueue(data.queue);
    });

    socket.on('reaction:received', (data: any) => {
      addReaction(data);
    });

    socket.on('skipvote:updated', (data: any) => {
      setSkipVote(data);
    });

    socket.on('skipvote:passed', () => {
      setSkipVote(null);
    });

    socket.on('presence:updated', (data: any) => {
      updateMemberStatus(data.userId, data.status);
    });

    socket.on('error', (err: any) => {
      setErrorMessage(err.message || 'Operation failed');
    });

    return () => {
      socket.emit('room:leave', { groupId: id });
      socket.off('connect', joinRoom);
      socket.off('room:state');
      socket.off('room:member-joined');
      socket.off('room:member-left');
      socket.off('playback:state');
      socket.off('playback:admin-paused');
      socket.off('playback:admin-resumed');
      socket.off('queue:updated');
      socket.off('reaction:received');
      socket.off('skipvote:updated');
      socket.off('skipvote:passed');
      socket.off('presence:updated');
      socket.off('error');
    };
  }, [socket, isConnected, id]);

  // Search tracks for queue
  useEffect(() => {
    if (!showQueueModal) return;
    let active = true;

    const fetchTracks = async () => {
      setSearching(true);
      try {
        if (searchQuery.trim()) {
          const res = await api.get('/api/music/search', {
            params: { q: searchQuery.trim(), limit: 10 },
          });
          if (active) setSearchResults(res.data.tracks || []);
        } else {
          const res = await api.get('/api/music/trending', {
            params: { limit: 10 },
          });
          if (active) setSearchResults(res.data.tracks || []);
        }
      } catch (err) {
        if (active) setSearchResults([]);
      } finally {
        if (active) setSearching(false);
      }
    };

    const timer = setTimeout(fetchTracks, searchQuery.trim() ? 350 : 0);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [showQueueModal, searchQuery]);

  // Permissions
  const myRole = roomState?.myRole || 'listener';
  const isHostOrAdmin = myRole === 'owner' || myRole === 'admin' || user?.role === 'superadmin';
  const membersCanControl = roomState?.membersCanControl ?? false;
  const canControlPlayback = isHostOrAdmin || membersCanControl;

  const handlePlay = () => {
    if (!socket || !id) return;
    if (isLocallyPaused) {
      handleResync();
      return;
    }
    if (canControlPlayback) {
      socket.emit('playback:play', { groupId: id });
    }
  };

  const handlePause = () => {
    if (!socket || !id) return;
    if (isHostOrAdmin) {
      socket.emit('playback:pause', { groupId: id, forEveryone: true });
    } else {
      // Local pause for regular members
      audioEngine.setLocallyPaused(true);
      setLocallyPaused(true);
    }
  };

  const handleTogglePlay = () => {
    if (isLocallyPaused) {
      handleResync();
    } else if (playback.isPlaying) {
      handlePause();
    } else {
      handlePlay();
    }
  };

  const handleResync = () => {
    audioEngine.setLocallyPaused(false);
    setLocallyPaused(false);
    if (socket && id) {
      socket.emit('playback:resync', { groupId: id });
    }
  };

  const handleSeek = (posMs: number) => {
    if (!socket || !id || !canControlPlayback) return;
    socket.emit('playback:seek', { groupId: id, positionMs: Math.max(0, posMs) });
  };

  const handleSkip = () => {
    if (!socket || !id) return;
    if (canControlPlayback) {
      socket.emit('playback:skip', { groupId: id });
    } else {
      handleVoteSkip();
    }
  };

  const handleVoteSkip = () => {
    if (!socket || !id) return;
    socket.emit('skipvote:cast', { groupId: id });
  };

  const handleSendReaction = (emoji: string) => {
    if (!socket || !id) return;
    socket.emit('reaction:send', { groupId: id, emoji });
  };

  const handleAddToQueue = (track: any) => {
    if (!socket || !id) return;
    socket.emit('queue:add', { groupId: id, trackId: track.id });
    setShowQueueModal(false);
  };

  const handleRemoveQueueItem = (queueItemId: string) => {
    if (!socket || !id || !canControlPlayback) return;
    socket.emit('queue:remove', { groupId: id, queueItemId });
  };

  // Poll join requests if host/admin
  useEffect(() => {
    if (!id || !isHostOrAdmin) return;
    const fetchRequests = async () => {
      try {
        const res = await api.get(`/api/groups/${id}/requests`);
        setPendingRequests(res.data || []);
      } catch (err) {}
    };
    fetchRequests();
    const interval = setInterval(fetchRequests, 6000);
    return () => clearInterval(interval);
  }, [id, isHostOrAdmin]);

  useEffect(() => {
    if (showQueueModal && activeQueueTab === 'playlists') {
      api.get('/api/playlists').then((res) => {
        setUserPlaylists(res.data?.playlists || []);
      }).catch(() => {});
    }
  }, [showQueueModal, activeQueueTab]);

  const handleApproveRequest = async (requestId: string) => {
    try {
      await api.post(`/api/groups/${id}/requests/${requestId}/approve`);
      setPendingRequests((prev) => prev.filter((r) => r.id !== requestId));
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to approve request');
    }
  };

  const handleDenyRequest = async (requestId: string) => {
    try {
      await api.post(`/api/groups/${id}/requests/${requestId}/deny`);
      setPendingRequests((prev) => prev.filter((r) => r.id !== requestId));
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to deny request');
    }
  };

  const handleImportPlaylist = async (playlistId: string) => {
    try {
      setImportingPlaylist(true);
      const res = await api.post(`/api/groups/${id}/queue/import-playlist`, { playlistId });
      alert(`Imported ${res.data?.importedCount || 0} tracks into room queue!`);
      setShowQueueModal(false);
    } catch (err: any) {
      alert(err.message || 'Failed to import playlist');
    } finally {
      setImportingPlaylist(false);
    }
  };

  const copyInviteLink = () => {
    const inviteCode = (roomState as any)?.inviteCode || id;
    const inviteUrl = `https://syncwave.work.gd/join/${inviteCode}`;
    navigator.clipboard.writeText(inviteUrl);
    setCopiedInvite(true);
    setTimeout(() => setCopiedInvite(false), 2500);
  };

  const formatTime = (ms: number) => {
    const totalSecs = Math.floor(Math.max(0, ms) / 1000);
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const currentTrack = playback.track;
  const isPlaying = playback.isPlaying && !isLocallyPaused;
  const progressPercent = durationMs > 0 ? Math.min(100, (currentTimeMs / durationMs) * 100) : 0;

  const roomTheme = (roomState as any)?.theme || 'default';
  const themeGlowStyles: Record<string, string> = {
    default: 'from-indigo-600/15 via-violet-900/10 to-transparent',
    blossom: 'from-pink-500/20 via-rose-600/15 to-transparent',
    blizzard: 'from-cyan-400/20 via-blue-600/15 to-transparent',
    sunset: 'from-amber-500/20 via-rose-600/15 to-transparent',
    cyberwave: 'from-fuchsia-500/25 via-cyan-500/15 to-transparent',
    lofi: 'from-purple-900/20 via-neutral-900/40 to-transparent',
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-white flex flex-col select-none relative overflow-hidden">
      {/* Dynamic Theme Glow Aura */}
      <div
        className={`absolute inset-0 bg-gradient-to-b ${
          themeGlowStyles[roomTheme] || themeGlowStyles.default
        } pointer-events-none transition-all duration-1000`}
      />

      {/* Background artwork blur */}
      {currentTrack?.artworkUrl && (
        <div
          className="absolute inset-0 opacity-25 blur-3xl scale-125 transition-all duration-700 pointer-events-none"
          style={{
            backgroundImage: `url(${currentTrack.artworkUrl})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        />
      )}

      {/* Floating Animated Reactions */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-20">
        <AnimatePresence>
          {reactions.map((r) => (
            <motion.div
              key={r.id}
              initial={{ opacity: 0, y: 50, scale: 0.5, x: Math.random() * 40 - 20 }}
              animate={{ opacity: 1, y: -180, scale: 1.4 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ duration: 2.2, ease: 'easeOut' }}
              className="absolute bottom-28 left-1/2 flex items-center gap-1.5 bg-neutral-900/80 backdrop-blur-md px-3 py-1.5 rounded-full border border-neutral-700 shadow-xl"
            >
              <span className="text-2xl">{r.emoji}</span>
              <span className="text-xs font-semibold text-neutral-300">{r.userName}</span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Header */}
      <header className="z-10 px-6 py-4 flex items-center justify-between border-b border-neutral-800/80 bg-neutral-950/60 backdrop-blur-md">
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-1.5 text-neutral-400 hover:text-white transition-colors text-sm font-medium"
        >
          <span>←</span> Rooms
        </button>

        <div className="flex flex-col items-center">
          <h1 className="text-base font-bold truncate max-w-[200px] md:max-w-md">
            {roomState?.groupName || 'Listening Room'}
          </h1>
          <span className="text-[11px] text-neutral-400 flex items-center gap-1">
            <span className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-emerald-500' : 'bg-rose-500'}`} />
            {isConnected ? `${members.length} listening` : 'Connecting...'}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={copyInviteLink}
            className="px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-xs font-medium rounded-full transition-colors flex items-center gap-1"
          >
            {copiedInvite ? '✓ Copied' : '🔗 Invite'}
          </button>
          {isHostOrAdmin && (
            <button
              onClick={() => navigate(`/room/${id}/settings`)}
              className="p-1.5 text-neutral-400 hover:text-white hover:bg-neutral-800 rounded-full transition-colors"
              title="Room Settings"
            >
              ⚙️
            </button>
          )}
        </div>
      </header>

      {/* Autoplay blocked banner */}
      {autoplayBlocked && (
        <div
          onClick={() => audioEngine.resumeAutoplay()}
          className="z-30 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold py-2.5 px-4 text-center cursor-pointer shadow-lg animate-pulse"
        >
          🔊 Browser blocked audio autoplay. Click anywhere to join live stream.
        </div>
      )}

      {/* Admin Paused Banner */}
      {isAdminPaused && (
        <div className="z-30 bg-amber-500/20 border-b border-amber-500/40 text-amber-300 text-xs font-medium py-2 px-4 text-center">
          ⏸ Playback paused for everyone by {adminPausedBy || 'the room host'}.
        </div>
      )}

      {/* Host Pending Rejoin Requests Banner */}
      {isHostOrAdmin && pendingRequests.length > 0 && (
        <div className="z-30 bg-amber-500/15 border-b border-amber-500/30 px-4 py-2 flex items-center justify-between text-xs text-amber-200">
          <div className="flex items-center gap-2">
            <span>🔔</span>
            <span>
              <strong>{pendingRequests[0].displayName}</strong> requested to rejoin this room
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleApproveRequest(pendingRequests[0].id)}
              className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-lg shadow transition-colors"
            >
              Approve
            </button>
            <button
              onClick={() => handleDenyRequest(pendingRequests[0].id)}
              className="px-2.5 py-1 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-lg transition-colors"
            >
              Deny
            </button>
          </div>
        </div>
      )}

      {/* Member Locally Paused Banner */}
      {isLocallyPaused && (
        <div className="z-30 bg-indigo-950/80 border-b border-indigo-700/60 px-4 py-2 flex items-center justify-between text-xs text-indigo-200">
          <span>You are paused locally. The room is still live.</span>
          <button
            onClick={handleResync}
            className="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-full shadow"
          >
            Resync to Live
          </button>
        </div>
      )}

      {/* Error alert toast */}
      {errorMessage && (
        <div className="z-30 bg-rose-600 text-white text-xs font-medium py-2 px-4 flex items-center justify-between">
          <span>{errorMessage}</span>
          <button onClick={() => setErrorMessage(null)} className="ml-2 font-bold">
            ✕
          </button>
        </div>
      )}

      {/* Main Room View */}
      <main className="z-10 flex-1 flex flex-col items-center justify-center p-6 max-w-lg mx-auto w-full">
        {/* Track Artwork */}
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="relative w-64 h-64 sm:w-72 sm:h-72 rounded-3xl overflow-hidden shadow-2xl bg-neutral-900 border border-neutral-800 flex items-center justify-center"
        >
          {currentTrack?.artworkUrl ? (
            <img
              src={currentTrack.artworkUrl}
              alt={currentTrack.title}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="flex flex-col items-center gap-2 text-neutral-600">
              <span className="text-6xl">🎵</span>
              <span className="text-xs uppercase tracking-widest font-semibold">No track active</span>
            </div>
          )}
        </motion.div>

        {/* Track Info */}
        <div className="text-center mt-6 w-full">
          <h2 className="text-2xl font-extrabold truncate" title={currentTrack?.title || 'Nothing Playing'}>
            {currentTrack?.title || 'Queue is empty'}
          </h2>
          <p className="text-neutral-400 text-sm mt-1 truncate" title={currentTrack?.artist || ''}>
            {currentTrack?.artist || 'Search below to add tracks to the room'}
          </p>
        </div>

        {/* Scrubber / Progress Bar */}
        <div className="w-full mt-6 space-y-1.5">
          <div
            className={`h-2 bg-neutral-800 rounded-full overflow-hidden relative ${
              canControlPlayback ? 'cursor-pointer' : 'cursor-default'
            }`}
            onClick={(e) => {
              if (!canControlPlayback || durationMs <= 0) return;
              const rect = e.currentTarget.getBoundingClientRect();
              const clickX = e.clientX - rect.left;
              const ratio = Math.max(0, Math.min(1, clickX / rect.width));
              handleSeek(ratio * durationMs);
            }}
          >
            <div
              className="h-full bg-gradient-to-r from-indigo-500 to-violet-500 rounded-full transition-all duration-150"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <div className="flex justify-between text-[11px] font-mono text-neutral-500">
            <span>{formatTime(currentTimeMs)}</span>
            <span>{formatTime(durationMs)}</span>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center justify-center gap-6 mt-6 w-full">
          {/* Queue Button */}
          <button
            onClick={() => setShowQueueModal(true)}
            className="w-12 h-12 rounded-full bg-neutral-900 border border-neutral-800 hover:border-neutral-700 flex items-center justify-center text-lg transition-transform active:scale-95"
            title="Room Queue"
          >
            📜
            {queue.length > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-indigo-600 text-[10px] font-bold rounded-full flex items-center justify-center">
                {queue.length}
              </span>
            )}
          </button>

          {/* Play / Pause Button */}
          <button
            onClick={handleTogglePlay}
            disabled={!currentTrack}
            className={`w-18 h-18 rounded-full flex items-center justify-center text-3xl shadow-xl transition-transform hover:scale-105 active:scale-95 ${
              !currentTrack
                ? 'bg-neutral-800 text-neutral-600 cursor-not-allowed'
                : isPlaying
                ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/30'
                : 'bg-white hover:bg-neutral-200 text-neutral-950 shadow-white/20'
            }`}
            title={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? '⏸' : '▶'}
          </button>

          {/* Skip / Vote Skip Button */}
          <button
            onClick={handleSkip}
            disabled={!currentTrack}
            className={`w-12 h-12 rounded-full bg-neutral-900 border border-neutral-800 hover:border-neutral-700 flex items-center justify-center text-lg transition-transform active:scale-95 ${
              !currentTrack ? 'opacity-50 cursor-not-allowed' : ''
            }`}
            title={canControlPlayback ? 'Skip Track' : 'Vote to Skip'}
          >
            ⏭️
          </button>
        </div>

        {/* Skip Vote Status */}
        {skipVote && (
          <div className="mt-4 px-4 py-1.5 bg-neutral-900/90 border border-neutral-800 rounded-full text-xs text-neutral-300 flex items-center gap-2">
            <span>🗳️ Skip Vote:</span>
            <span className="font-bold text-indigo-400">
              {skipVote.currentVotes} / {skipVote.votesNeeded}
            </span>
          </div>
        )}
      </main>

      {/* Footer: Listeners & Reaction Bar */}
      <footer className="z-10 p-4 border-t border-neutral-800/80 bg-neutral-950/80 backdrop-blur-md flex flex-col gap-4">
        {/* Listeners Presence Bar */}
        <div className="flex items-center justify-center gap-2 overflow-x-auto py-1 scrollbar-none">
          {members.map((m) => (
            <div
              key={m.userId}
              className="relative group flex-shrink-0"
              title={`${m.displayName} (${m.role}) - ${m.status}`}
            >
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center text-lg border-2"
                style={{
                  backgroundColor: m.avatarColor || '#312e81',
                  borderColor: m.status === 'listening' ? '#10b981' : m.status === 'buffering' ? '#f59e0b' : '#64748b',
                }}
              >
                {m.avatarEmoji || '👤'}
              </div>
              <div
                className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-neutral-950 ${
                  m.status === 'listening'
                    ? 'bg-emerald-500'
                    : m.status === 'buffering'
                    ? 'bg-amber-500 animate-spin'
                    : 'bg-neutral-500'
                }`}
              />
            </div>
          ))}
          {members.length === 0 && (
            <span className="text-xs text-neutral-500">Connecting listeners...</span>
          )}
        </div>

        {/* Reaction Bar */}
        <div className="flex justify-center gap-3 sm:gap-4 text-2xl">
          {ALLOWED_EMOJIS.map((emoji) => (
            <button
              key={emoji}
              onClick={() => handleSendReaction(emoji)}
              className="hover:scale-130 active:scale-90 transition-transform p-1"
              title={`React with ${emoji}`}
            >
              {emoji}
            </button>
          ))}
        </div>
      </footer>

      {/* Queue & Search Modal */}
      <AnimatePresence>
        {showQueueModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-neutral-900 border border-neutral-800 rounded-3xl w-full max-w-lg p-6 max-h-[85vh] flex flex-col shadow-2xl"
            >
              <div className="flex items-center justify-between pb-4 border-b border-neutral-800">
                <h2 className="text-lg font-bold">Room Queue & Music Search</h2>
                <button
                  onClick={() => setShowQueueModal(false)}
                  className="text-neutral-400 hover:text-white text-lg p-1"
                >
                  ✕
                </button>
              </div>

              {/* Tabs */}
              <div className="grid grid-cols-3 gap-1 bg-neutral-950 p-1 rounded-xl mt-4 text-xs font-semibold">
                <button
                  onClick={() => setActiveQueueTab('queue')}
                  className={`py-2 rounded-lg transition-colors ${
                    activeQueueTab === 'queue' ? 'bg-indigo-600 text-white' : 'text-neutral-400 hover:text-white'
                  }`}
                >
                  Queue ({queue.length})
                </button>
                <button
                  onClick={() => setActiveQueueTab('search')}
                  className={`py-2 rounded-lg transition-colors ${
                    activeQueueTab === 'search' ? 'bg-indigo-600 text-white' : 'text-neutral-400 hover:text-white'
                  }`}
                >
                  🔍 Search Music
                </button>
                <button
                  onClick={() => setActiveQueueTab('playlists')}
                  className={`py-2 rounded-lg transition-colors ${
                    activeQueueTab === 'playlists' ? 'bg-indigo-600 text-white' : 'text-neutral-400 hover:text-white'
                  }`}
                >
                  📁 My Playlists
                </button>
              </div>

              {/* Search input (when on search tab or typing) */}
              {activeQueueTab === 'search' && (
                <div className="mt-3 relative">
                  <input
                    type="text"
                    placeholder="Search iTunes, Audius & Jamendo tracks..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-2.5 pl-10 text-sm outline-none focus:border-indigo-500 transition-colors text-white"
                    autoFocus
                  />
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-500">🔍</span>
                </div>
              )}

              {/* Scrollable list */}
              <div className="flex-1 overflow-y-auto mt-4 space-y-4 pr-1">
                {activeQueueTab === 'playlists' ? (
                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-400 mb-2">
                      Import Personal Playlist Into Room Queue
                    </h3>
                    {userPlaylists.length === 0 ? (
                      <div className="py-8 text-center text-xs text-neutral-500 border border-dashed border-neutral-800 rounded-2xl p-4">
                        No playlists found. Create playlists in your Profile to import them here!
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {userPlaylists.map((pl) => (
                          <div
                            key={pl.id}
                            className="flex items-center justify-between p-3 rounded-2xl bg-neutral-950 border border-neutral-800"
                          >
                            <div className="flex items-center gap-2.5">
                              <span className="text-xl">🎶</span>
                              <div>
                                <p className="text-xs font-bold text-white">{pl.name}</p>
                                <p className="text-[10px] text-neutral-400">{pl.trackCount} tracks</p>
                              </div>
                            </div>
                            <button
                              onClick={() => handleImportPlaylist(pl.id)}
                              disabled={importingPlaylist || pl.trackCount === 0}
                              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl shadow disabled:opacity-40"
                            >
                              {importingPlaylist ? 'Importing...' : '+ Import All'}
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ) : activeQueueTab === 'search' ? (
                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-400 mb-2">
                      Search Results
                    </h3>
                    {searching ? (
                      <div className="py-8 text-center text-sm text-neutral-500">Searching worldwide music...</div>
                    ) : searchResults.length === 0 ? (
                      <div className="py-8 text-center text-sm text-neutral-500">
                        {searchQuery ? 'No tracks found.' : 'Type any song or artist above to search!'}
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {searchResults.map((t) => (
                          <div
                            key={t.id}
                            className="flex items-center justify-between p-2 rounded-xl bg-neutral-950 border border-neutral-800/80 hover:border-neutral-700"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <img
                                src={t.artworkUrl || 'https://picsum.photos/50'}
                                alt={t.title}
                                className="w-10 h-10 rounded-lg object-cover bg-neutral-800 flex-shrink-0"
                              />
                              <div className="min-w-0">
                                <p className="text-sm font-semibold truncate">{t.title}</p>
                                <p className="text-xs text-neutral-400 truncate">{t.artist}</p>
                              </div>
                            </div>
                            <button
                              onClick={() => handleAddToQueue(t)}
                              className="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold rounded-full shadow whitespace-nowrap ml-2"
                            >
                              + Queue
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
                        Upcoming In Queue ({queue.length})
                      </h3>
                      <button
                        onClick={() => setActiveQueueTab('search')}
                        className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold"
                      >
                        + Add Songs
                      </button>
                    </div>
                    {queue.length === 0 ? (
                      <div className="py-8 text-center text-sm text-neutral-500">
                        Queue is empty. Click "+ Add Songs" to search and add tracks!
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {queue.map((item: QueueItem, idx) => (
                          <div
                            key={item.id}
                            className="flex items-center justify-between p-2.5 rounded-xl bg-neutral-950 border border-neutral-800"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <span className="text-xs font-mono text-neutral-500 w-4">{idx + 1}</span>
                              <img
                                src={item.artworkUrl || 'https://picsum.photos/50'}
                                alt={item.title}
                                className="w-9 h-9 rounded-lg object-cover bg-neutral-800 flex-shrink-0"
                              />
                              <div className="min-w-0">
                                <p className="text-sm font-medium truncate">{item.title}</p>
                                <p className="text-xs text-neutral-400 truncate">{item.artist}</p>
                              </div>
                            </div>
                            {canControlPlayback && (
                              <button
                                onClick={() => handleRemoveQueueItem(item.id)}
                                className="text-neutral-500 hover:text-rose-400 p-1 text-sm"
                                title="Remove from queue"
                              >
                                ✕
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
