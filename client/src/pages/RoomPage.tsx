import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { usePlayerStore, QueueItem } from '../stores/playerStore.js';
import { useSocketStore } from '../stores/socketStore.js';
import { useAuthStore } from '../stores/authStore.js';
import { audioEngine } from '../player/AudioEngine.js';
import { mediaSessionManager } from '../player/MediaSessionManager.js';
import { api } from '../lib/api.js';
import { FloatingReactions } from '../components/FloatingReactions';
import { RoomMembersModal } from '../components/RoomMembersModal';
import { YouTubeSyncPlayer } from '../components/YouTubeSyncPlayer';
import { AddToPlaylistModal } from '../components/AddToPlaylistModal';

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
    songRequests,
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
    setSongRequests,
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
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [copiedInvite, setCopiedInvite] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [activeQueueTab, setActiveQueueTab] = useState<'queue' | 'search' | 'youtube' | 'playlists' | 'requests'>('queue');
  const [youtubeQuery, setYoutubeQuery] = useState('');
  const [youtubeResults, setYoutubeResults] = useState<any[]>([]);
  const [searchingYouTube, setSearchingYouTube] = useState(false);
  const [userPlaylists, setUserPlaylists] = useState<any[]>([]);
  const [importingPlaylist, setImportingPlaylist] = useState(false);
  const [pendingRequests, setPendingRequests] = useState<any[]>([]);
  const [showMembersModal, setShowMembersModal] = useState(false);
  const [customControlAllowed, setCustomControlAllowed] = useState<boolean | null>(null);
  const [playlistModalTrack, setPlaylistModalTrack] = useState<any | null>(null);
  const [showAddToPlaylistModal, setShowAddToPlaylistModal] = useState(false);
  const [requestFeedbackNotice, setRequestFeedbackNotice] = useState<string | null>(null);

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
        if (!msg || msg.includes('Empty src attribute')) return;
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
          const errMsg = response?.error || 'Failed to enter listening room.';
          // If not a member, redirect home rather than showing broken room
          if (errMsg.toLowerCase().includes('not a member') || errMsg.toLowerCase().includes('not found')) {
            navigate('/', { replace: true });
          } else {
            setErrorMessage(errMsg);
          }
        }
      });
    };

    if (isConnected) {
      joinRoom();
    }

    socket.on('connect', joinRoom);

    socket.on('room:state', (state: any) => {
      setRoomState(state);
      if (state?.membersCanControl !== undefined) {
        setCustomControlAllowed(state.membersCanControl);
      }
      setErrorMessage(null);
      audioEngine.syncWithState(state.playback);
    });

    socket.on('room:member-joined', (data: any) => {
      if (data?.member) addMember(data.member);
    });

    socket.on('room:member-left', (data: any) => {
      if (data?.userId) removeMember(data.userId);
    });

    socket.on('room:members-updated', (data: any) => {
      if (data?.members) {
        usePlayerStore.getState().setMembers(data.members);
      }
    });

    socket.on('playback:state', (state: any) => {
      setPlayback(state);
      setErrorMessage(null);
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

    socket.on('song-requests:updated', (data: any) => {
      if (data?.requests) {
        setSongRequests(data.requests);
      }
    });

    socket.on('room:deleted', () => {
      navigate('/', { replace: true });
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
      socket.off('room:members-updated');
      socket.off('playback:state');
      socket.off('playback:admin-paused');
      socket.off('playback:admin-resumed');
      socket.off('queue:updated');
      socket.off('reaction:received');
      socket.off('skipvote:updated');
      socket.off('skipvote:passed');
      socket.off('presence:updated');
      socket.off('song-requests:updated');
      socket.off('room:deleted');
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

  // Search YouTube videos for queue
  useEffect(() => {
    if (!showQueueModal || activeQueueTab !== 'youtube') return;
    let active = true;

    const fetchVideos = async () => {
      setSearchingYouTube(true);
      try {
        const query = youtubeQuery.trim() || 'trending music videos';
        const res = await api.get('/api/youtube/search', {
          params: { q: query, limit: 12 },
        });
        if (active) setYoutubeResults(res.data?.videos || []);
      } catch (err) {
        if (active) setYoutubeResults([]);
      } finally {
        if (active) setSearchingYouTube(false);
      }
    };

    const timer = setTimeout(fetchVideos, youtubeQuery.trim() ? 400 : 0);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [showQueueModal, activeQueueTab, youtubeQuery]);

  // Permissions
  const myRole = roomState?.myRole || 'listener';
  const isHostOrAdmin = myRole === 'owner' || myRole === 'admin' || user?.role === 'superadmin';
  const membersCanControl = customControlAllowed ?? roomState?.membersCanControl ?? false;
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
    if (!id) return;
    addReaction({
      emoji,
      userId: user?.id || 'me',
      userName: user?.displayName || 'You',
    });
    if (socket) {
      socket.emit('reaction:send', { groupId: id, emoji });
    }
  };

  const handlePlayTrackNow = (track: any) => {
    if (!socket || !id) return;
    setErrorMessage(null);
    socket.emit('playback:load-track', { groupId: id, trackId: track.id });
    setShowQueueModal(false);
  };

  const handleAddToQueue = (track: any) => {
    if (!socket || !id) return;
    setErrorMessage(null);
    socket.emit('queue:add', { groupId: id, trackId: track.id });
    setShowQueueModal(false);
  };

  const handleToggleMembersCanControl = async (newVal: boolean) => {
    if (!id) return;
    try {
      await api.put(`/api/groups/${id}`, { membersCanControl: newVal });
      setCustomControlAllowed(newVal);
      if (socket) {
        socket.emit('playback:resync', { groupId: id });
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to update room permissions');
    }
  };

  const handleRemoveQueueItem = (queueItemId: string) => {
    if (!socket || !id || !canControlPlayback) return;
    socket.emit('queue:remove', { groupId: id, queueItemId });
  };

  const handleRequestSong = (track: any) => {
    if (!socket || !id) return;
    socket.emit('song-request:submit', { groupId: id, trackId: track.id });
    setRequestFeedbackNotice(`Requested "${track.title}"! Room admins will review it in the Requests queue.`);
    setTimeout(() => setRequestFeedbackNotice(null), 4500);
  };

  const handleApproveSongRequest = (requestId: string, action: 'play-now' | 'queue') => {
    if (!socket || !id) return;
    socket.emit('song-request:approve', { groupId: id, requestId, action });
  };

  const handleRejectSongRequest = (requestId: string) => {
    if (!socket || !id) return;
    socket.emit('song-request:reject', { groupId: id, requestId });
  };

  const handleOpenAddToPlaylist = (track: any) => {
    const isVideo = track.mediaType === 'video' || track.id?.startsWith('youtube:');
    const videoId = track.videoId || (isVideo ? track.id.replace('youtube:', '') : undefined);
    setPlaylistModalTrack({
      id: track.id,
      provider: isVideo ? 'youtube' : (track.provider || (track.id.includes(':') ? track.id.split(':')[0] : 'audius')),
      providerTrackId: isVideo ? videoId : (track.providerTrackId || (track.id.includes(':') ? track.id.split(':')[1] : track.id)),
      title: track.title,
      artist: track.artist || (isVideo ? 'YouTube' : 'Artist'),
      album: track.album,
      artworkUrl: track.artworkUrl || (isVideo && videoId ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` : undefined),
      durationMs: track.durationMs || 180000,
      streamUrl: track.streamUrl,
    });
    setShowAddToPlaylistModal(true);
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
    const inviteCode = roomState?.inviteCode || id || '';
    const inviteUrl = `${window.location.origin}/join/${inviteCode}`;
    navigator.clipboard.writeText(inviteUrl);
    setCopiedInvite(true);
    setTimeout(() => setCopiedInvite(false), 2500);
  };

  const copyRoomCode = () => {
    const inviteCode = roomState?.inviteCode || '';
    if (!inviteCode) return;
    navigator.clipboard.writeText(inviteCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2500);
  };

  const formatTime = (ms: number) => {
    const totalSecs = Math.floor(Math.max(0, ms) / 1000);
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const currentTrack = playback.track;
  const activeVideoId = playback.videoId || currentTrack?.videoId || (playback.trackId?.startsWith('youtube:') ? playback.trackId.replace('youtube:', '') : undefined);
  const isVideoTrack = playback.mediaType === 'video' || currentTrack?.mediaType === 'video' || !!activeVideoId;
  const isPlaying = playback.isPlaying && !isLocallyPaused;
  const progressPercent = durationMs > 0 ? Math.min(100, (currentTimeMs / durationMs) * 100) : 0;

  const roomTheme = roomState?.theme || 'default';
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

      {/* 120 FPS Floating Reaction Particle Engine */}
      <FloatingReactions incomingReactions={reactions} />

      {/* Header */}
      <header className="z-10 px-4 sm:px-6 py-3.5 flex items-center justify-between border-b border-neutral-800/80 bg-neutral-950/60 backdrop-blur-md">
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-1 text-neutral-400 hover:text-white transition-colors text-xs sm:text-sm font-medium"
        >
          <span>←</span> Rooms
        </button>

        <div className="flex flex-col items-center">
          <h1 className="text-sm sm:text-base font-bold truncate max-w-[160px] sm:max-w-xs md:max-w-md">
            {roomState?.groupName || 'Listening Room'}
          </h1>
          <div className="flex items-center gap-2 mt-0.5">
            <button
              onClick={() => setShowMembersModal(true)}
              className="text-[11px] text-neutral-300 hover:text-white bg-white/5 hover:bg-white/10 px-2.5 py-0.5 rounded-full flex items-center gap-1.5 transition-all cursor-pointer border border-white/5"
              title="Click to view Room Members & Roles"
            >
              <span className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-emerald-500' : 'bg-rose-500'}`} />
              <span className="font-medium">{isConnected ? `${members.length} listening` : 'Connecting...'}</span>
            </button>
            {roomState?.inviteCode && (
              <button
                onClick={() => setShowInviteModal(true)}
                className="text-[11px] bg-white/5 border border-white/15 hover:border-white/30 text-white font-mono px-2.5 py-0.5 rounded-full transition-all flex items-center gap-1.5 shadow-sm"
                title="Click to view Room Code & Invite Link"
              >
                <span className="text-[10px] text-neutral-400">Code:</span>
                <span className="font-bold tracking-wider">{roomState.inviteCode}</span>
                <span className="text-[10px]">📋</span>
              </button>
            )}
            {roomState?.mediaMode && (
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                roomState.mediaMode === 'video'
                  ? 'bg-red-500/10 text-red-400 border-red-500/20'
                  : roomState.mediaMode === 'both'
                  ? 'bg-purple-500/10 text-purple-400 border-purple-500/20'
                  : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
              }`}>
                {roomState.mediaMode === 'video' ? '🎬 Video Room' : roomState.mediaMode === 'both' ? '🔀 Music & Video' : '🎵 Music Room'}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowMembersModal(true)}
            className="px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 text-white text-xs font-semibold rounded-full transition-colors flex items-center gap-1.5 shadow"
            title="View & manage room members"
          >
            <span>👥</span>
            <span className="hidden sm:inline">Members</span>
            <span className="text-[10px] bg-white/10 px-1.5 py-0.2 rounded-full">{members.length}</span>
          </button>
          <button
            onClick={() => setShowInviteModal(true)}
            className="px-3 sm:px-3.5 py-1.5 bg-white hover:bg-neutral-200 text-black text-xs font-bold rounded-full transition-colors flex items-center gap-1.5 shadow-md shadow-white/10"
          >
            <span>🔗</span>
            <span>Invite</span>
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
      <main className="z-10 flex-1 flex flex-col items-center justify-center p-6 max-w-xl mx-auto w-full">
        {/* Track Artwork or Synchronized YouTube Video Player */}
        {isVideoTrack && activeVideoId ? (
          <div className="w-full">
            <YouTubeSyncPlayer
              videoId={activeVideoId}
              isPlaying={playback.isPlaying}
              positionMs={playback.positionMs}
              serverTimeMs={playback.serverTimeMs}
              isLocallyPaused={isLocallyPaused}
              canControl={canControlPlayback}
              title={currentTrack?.title}
              onPlay={handlePlay}
              onPause={handlePause}
              onSeek={handleSeek}
              onEnded={handleSkip}
              onTimeUpdate={(cMs, dMs) => setTime(cMs, dMs)}
              onSendReaction={handleSendReaction}
            />
          </div>
        ) : (
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
                <span className="text-6xl">{roomState?.mediaMode === 'video' ? '🎬' : '🎵'}</span>
                <span className="text-xs uppercase tracking-widest font-semibold">
                  {roomState?.mediaMode === 'video' ? 'No video playing' : 'No track active'}
                </span>
              </div>
            )}
          </motion.div>
        )}

        {/* Track Info */}
        <div className="text-center mt-6 w-full">
          <h2 className="text-2xl font-extrabold truncate text-white" title={currentTrack?.title || 'Nothing Playing'}>
            {currentTrack?.title || 'Room is quiet'}
          </h2>
          <p className="text-neutral-400 text-sm mt-1 truncate" title={currentTrack?.artist || ''}>
            {currentTrack?.artist || (roomState?.mediaMode === 'video' ? 'Pick a YouTube video to stream together in sync!' : 'Pick a song to play in sync for everyone!')}
          </p>

          {currentTrack && (
            <div className="mt-2.5 flex items-center justify-center gap-2">
              <button
                onClick={() => handleOpenAddToPlaylist(currentTrack)}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 hover:bg-white/20 text-neutral-300 hover:text-white text-xs font-semibold border border-white/10 transition-all hover:scale-105 active:scale-95 shadow cursor-pointer"
                title="Save current track to personal playlist"
              >
                <span>📑</span>
                <span>Add to Playlist</span>
              </button>
            </div>
          )}

          {!currentTrack && (
            <div className="mt-4 flex flex-col sm:flex-row items-center justify-center gap-3">
              {roomState?.mediaMode !== 'video' && (
                <button
                  onClick={() => {
                    setActiveQueueTab('search');
                    setSearchQuery('');
                    setShowQueueModal(true);
                  }}
                  className="w-full sm:w-auto px-5 py-2.5 bg-white text-black hover:bg-neutral-200 font-bold text-xs rounded-2xl shadow-xl shadow-white/10 flex items-center justify-center gap-2 transition-all hover:scale-105 active:scale-95 cursor-pointer"
                >
                  <span>🎵</span>
                  <span>Search Music</span>
                </button>
              )}
              {roomState?.mediaMode !== 'music' && (
                <button
                  onClick={() => {
                    setActiveQueueTab('youtube');
                    setYoutubeQuery('');
                    setShowQueueModal(true);
                  }}
                  className="w-full sm:w-auto px-5 py-2.5 bg-red-600 hover:bg-red-500 text-white font-bold text-xs rounded-2xl shadow-xl shadow-red-600/25 flex items-center justify-center gap-2 transition-all hover:scale-105 active:scale-95 cursor-pointer"
                >
                  <span>🎬</span>
                  <span>Search YouTube</span>
                </button>
              )}
              {roomState?.mediaMode === 'music' && (
                <button
                  onClick={() => {
                    setActiveQueueTab('search');
                    setSearchQuery('Arijit Singh');
                    setShowQueueModal(true);
                  }}
                  className="w-full sm:w-auto px-4 py-2.5 bg-white/5 hover:bg-white/10 border border-white/15 text-white font-medium text-xs rounded-2xl transition-all hover:scale-105 active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span>🔥</span>
                  <span>Top Bollywood Hits</span>
                </button>
              )}
            </div>
          )}
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
        <div className="flex items-center justify-center gap-3 sm:gap-5 mt-6 w-full">
          {/* Members Button */}
          <button
            onClick={() => setShowMembersModal(true)}
            className="w-12 h-12 rounded-full bg-neutral-900 border border-neutral-800 hover:border-neutral-700 flex items-center justify-center text-lg transition-transform active:scale-95 relative cursor-pointer"
            title="View Room Members & Roles"
          >
            👥
            <span className="absolute -top-1 -right-1 w-5 h-5 bg-white/10 border border-white/20 text-[10px] font-bold rounded-full flex items-center justify-center text-white">
              {members.length}
            </span>
          </button>

          {/* Queue Button */}
          <button
            onClick={() => {
              setActiveQueueTab('queue');
              setShowQueueModal(true);
            }}
            className="w-12 h-12 rounded-full bg-neutral-900 border border-neutral-800 hover:border-neutral-700 flex items-center justify-center text-lg transition-transform active:scale-95 relative cursor-pointer"
            title="Room Queue"
          >
            📜
            {queue.length > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-indigo-600 text-[10px] font-bold rounded-full flex items-center justify-center text-white">
                {queue.length}
              </span>
            )}
          </button>

          {/* Play / Pause / Search Button */}
          <button
            onClick={
              currentTrack
                ? handleTogglePlay
                : () => {
                    setActiveQueueTab('search');
                    setShowQueueModal(true);
                  }
            }
            className={`w-18 h-18 rounded-full flex items-center justify-center text-3xl shadow-xl transition-transform hover:scale-105 active:scale-95 cursor-pointer ${
              !currentTrack
                ? 'bg-white hover:bg-neutral-200 text-black shadow-white/20'
                : isPlaying
                ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/30'
                : 'bg-white hover:bg-neutral-200 text-neutral-950 shadow-white/20'
            }`}
            title={!currentTrack ? 'Search & Play Music' : isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? '⏸' : '▶'}
          </button>

          {/* Search Music Button */}
          <button
            onClick={() => {
              setActiveQueueTab('search');
              setShowQueueModal(true);
            }}
            className="w-12 h-12 rounded-full bg-neutral-900 border border-neutral-800 hover:border-neutral-700 flex items-center justify-center text-lg transition-transform active:scale-95 cursor-pointer"
            title="Search & Add Songs"
          >
            🔍
          </button>

          {/* Skip / Vote Skip Button */}
          <button
            onClick={handleSkip}
            disabled={!currentTrack}
            className={`w-12 h-12 rounded-full bg-neutral-900 border border-neutral-800 hover:border-neutral-700 flex items-center justify-center text-lg transition-transform active:scale-95 ${
              !currentTrack ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'
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
              <div className="grid grid-cols-5 gap-1 bg-neutral-950 p-1 rounded-xl mt-4 text-[11px] font-semibold">
                <button
                  onClick={() => setActiveQueueTab('queue')}
                  className={`py-2 rounded-lg transition-colors truncate ${
                    activeQueueTab === 'queue' ? 'bg-indigo-600 text-white' : 'text-neutral-400 hover:text-white'
                  }`}
                >
                  Queue ({queue.length})
                </button>
                <button
                  onClick={() => setActiveQueueTab('search')}
                  className={`py-2 rounded-lg transition-colors truncate ${
                    activeQueueTab === 'search' ? 'bg-indigo-600 text-white' : 'text-neutral-400 hover:text-white'
                  }`}
                >
                  🎵 Music
                </button>
                <button
                  onClick={() => setActiveQueueTab('youtube')}
                  className={`py-2 rounded-lg transition-colors truncate ${
                    activeQueueTab === 'youtube' ? 'bg-red-600 text-white' : 'text-neutral-400 hover:text-white'
                  }`}
                >
                  🎬 YouTube
                </button>
                <button
                  onClick={() => setActiveQueueTab('playlists')}
                  className={`py-2 rounded-lg transition-colors truncate ${
                    activeQueueTab === 'playlists' ? 'bg-indigo-600 text-white' : 'text-neutral-400 hover:text-white'
                  }`}
                >
                  📁 Playlists
                </button>
                <button
                  onClick={() => setActiveQueueTab('requests')}
                  className={`py-2 rounded-lg transition-colors flex items-center justify-center gap-1 truncate ${
                    activeQueueTab === 'requests' ? 'bg-amber-600 text-white' : 'text-neutral-400 hover:text-white'
                  }`}
                >
                  <span>🔔 Requests</span>
                  {songRequests.length > 0 && (
                    <span className="bg-amber-400 text-black font-extrabold text-[9px] px-1 rounded-full">
                      {songRequests.length}
                    </span>
                  )}
                </button>
              </div>

              {/* Feedback toast */}
              {requestFeedbackNotice && (
                <div className="mt-3 p-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-semibold flex items-center justify-between">
                  <span>✓ {requestFeedbackNotice}</span>
                  <button onClick={() => setRequestFeedbackNotice(null)} className="font-bold ml-2">✕</button>
                </div>
              )}

              {/* Search input (when on search tab) */}
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

              {/* YouTube Search input (when on youtube tab) */}
              {activeQueueTab === 'youtube' && (
                <div className="mt-3 relative">
                  <input
                    type="text"
                    placeholder="Search YouTube videos or paste YouTube URL..."
                    value={youtubeQuery}
                    onChange={(e) => setYoutubeQuery(e.target.value)}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-2.5 pl-10 text-sm outline-none focus:border-red-500 transition-colors text-white"
                    autoFocus
                  />
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-500">🎬</span>
                </div>
              )}

              {/* Scrollable list */}
              <div className="flex-1 overflow-y-auto mt-4 space-y-4 pr-1">
                {activeQueueTab === 'requests' ? (
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
                        Member Song Requests ({songRequests.length})
                      </h3>
                      {isHostOrAdmin && (
                        <span className="text-[10px] font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
                          🛡️ Host Review
                        </span>
                      )}
                    </div>

                    {songRequests.length === 0 ? (
                      <div className="py-10 text-center text-xs text-neutral-500 border border-dashed border-neutral-800 rounded-2xl p-4">
                        No pending song requests. Regular members can click "🙋 Request" in the Music or YouTube tabs to request songs!
                      </div>
                    ) : (
                      <div className="space-y-2.5">
                        {songRequests.map((req) => (
                          <div
                            key={req.id}
                            className="flex items-center justify-between p-3 rounded-2xl bg-neutral-950 border border-neutral-800/80 hover:border-neutral-700 transition-colors"
                          >
                            <div className="flex items-center gap-3 min-w-0 flex-1">
                              {req.artworkUrl ? (
                                <img
                                  src={req.artworkUrl}
                                  alt=""
                                  className="w-10 h-10 rounded-xl object-cover border border-white/10 shrink-0"
                                />
                              ) : (
                                <div className="w-10 h-10 rounded-xl bg-indigo-600/30 flex items-center justify-center text-base border border-white/10 shrink-0">
                                  {req.mediaType === 'video' ? '🎬' : '🎵'}
                                </div>
                              )}
                              <div className="min-w-0 flex-1">
                                <p className="text-xs font-bold text-white truncate">{req.title}</p>
                                <p className="text-[11px] text-neutral-400 truncate">{req.artist}</p>
                                <p className="text-[10px] text-amber-400 font-medium mt-0.5">
                                  Requested by <strong className="text-amber-300">{req.requestedByName}</strong>
                                </p>
                              </div>
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0 ml-2">
                              {canControlPlayback ? (
                                <>
                                  <button
                                    onClick={() => handleApproveSongRequest(req.id, 'play-now')}
                                    className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold rounded-xl shadow transition-all cursor-pointer"
                                    title="Approve and play now"
                                  >
                                    ▶ Play
                                  </button>
                                  <button
                                    onClick={() => handleApproveSongRequest(req.id, 'queue')}
                                    className="px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-semibold rounded-xl shadow transition-all cursor-pointer"
                                    title="Approve and add to queue"
                                  >
                                    + Queue
                                  </button>
                                  <button
                                    onClick={() => handleRejectSongRequest(req.id)}
                                    className="p-1.5 text-neutral-500 hover:text-rose-400 rounded-lg transition-colors text-xs cursor-pointer"
                                    title="Dismiss request"
                                  >
                                    ✕
                                  </button>
                                </>
                              ) : (
                                <span className="text-[10px] bg-neutral-900 text-neutral-400 px-2.5 py-1 rounded-lg border border-neutral-800">
                                  Pending Review
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ) : activeQueueTab === 'playlists' ? (
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
                ) : activeQueueTab === 'youtube' ? (
                  <div>
                    {/* Full-Length Pro-Tip Advisory Callout */}
                    <div className="mb-3 p-3 bg-amber-500/10 border border-amber-500/20 rounded-2xl text-amber-300 text-xs flex items-start gap-2.5">
                      <span className="text-base shrink-0">💡</span>
                      <p className="leading-relaxed text-[11px]">
                        <strong>Full-Length Guarantee:</strong> If audio songs are regional short snippets, play them here on <strong>YouTube</strong> for guaranteed full-length music videos in tight sync!
                      </p>
                    </div>

                    <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-400 mb-2">
                      YouTube Video Results
                    </h3>
                    {searchingYouTube ? (
                      <div className="py-8 text-center text-sm text-neutral-500">Searching YouTube & resolving links...</div>
                    ) : youtubeResults.length === 0 ? (
                      <div className="py-8 text-center text-sm text-neutral-500">
                        {youtubeQuery ? 'No videos found.' : 'Search any video title, artist, or paste a YouTube watch link!'}
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {youtubeResults.map((v) => (
                          <div
                            key={v.id}
                            className="flex items-center justify-between p-2 rounded-xl bg-neutral-950 border border-neutral-800/80 hover:border-neutral-700"
                          >
                            <div className="flex items-center gap-3 min-w-0 flex-1">
                              <img
                                src={v.thumbnailUrl || `https://i.ytimg.com/vi/${v.videoId}/hqdefault.jpg`}
                                alt={v.title}
                                className="w-16 h-10 rounded-lg object-cover bg-neutral-800 flex-shrink-0"
                              />
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-semibold truncate">{v.title}</p>
                                <p className="text-xs text-neutral-400 truncate flex items-center gap-1.5">
                                  <span>{v.channel}</span>
                                  {v.durationMs > 0 && <span>• {formatTime(v.durationMs)}</span>}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
                              {canControlPlayback ? (
                                <>
                                  <button
                                    onClick={() => handlePlayTrackNow({ id: v.id, title: v.title, artist: v.channel, artworkUrl: v.thumbnailUrl, durationMs: v.durationMs, mediaType: 'video', videoId: v.videoId })}
                                    className="px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white text-xs font-bold rounded-xl shadow flex items-center gap-1 transition-all cursor-pointer"
                                    title="Play immediately for everyone in the room"
                                  >
                                    <span>▶</span> Play
                                  </button>
                                  <button
                                    onClick={() => handleAddToQueue({ id: v.id, title: v.title, artist: v.channel, artworkUrl: v.thumbnailUrl, durationMs: v.durationMs, mediaType: 'video', videoId: v.videoId })}
                                    className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white text-xs font-semibold rounded-xl border border-white/10 transition-colors cursor-pointer"
                                    title="Add to queue"
                                  >
                                    + Queue
                                  </button>
                                </>
                              ) : (
                                <button
                                  onClick={() => handleRequestSong({ id: v.id, title: v.title, artist: v.channel, artworkUrl: v.thumbnailUrl, durationMs: v.durationMs, mediaType: 'video', videoId: v.videoId })}
                                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl shadow flex items-center gap-1 transition-all cursor-pointer"
                                  title="Request room admins to play this video"
                                >
                                  <span>🙋</span> Request
                                </button>
                              )}
                              <button
                                onClick={() => handleOpenAddToPlaylist({ id: v.id, title: v.title, artist: v.channel, artworkUrl: v.thumbnailUrl, durationMs: v.durationMs, mediaType: 'video', videoId: v.videoId })}
                                className="p-1.5 hover:bg-white/10 text-neutral-400 hover:text-white rounded-xl transition-colors text-xs border border-white/5"
                                title="Add to personal playlist"
                              >
                                📑
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ) : activeQueueTab === 'search' ? (
                  <div>
                    {/* Pro-Tip Notice */}
                    <div className="mb-3 p-3 bg-amber-500/10 border border-amber-500/20 rounded-2xl text-amber-300 text-xs flex items-start gap-2.5">
                      <span className="text-base shrink-0">💡</span>
                      <p className="leading-relaxed text-[11px]">
                        <strong>Full-Length Tip:</strong> Enjoy worldwide audio streaming! If a track is unavailable in full length in your region, click the <strong>🎬 YouTube</strong> tab above to stream the complete music video!
                      </p>
                    </div>

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
                            <div className="flex items-center gap-3 min-w-0 flex-1">
                              <img
                                src={t.artworkUrl || 'https://picsum.photos/50'}
                                alt={t.title}
                                className="w-10 h-10 rounded-lg object-cover bg-neutral-800 flex-shrink-0"
                              />
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-semibold truncate">{t.title}</p>
                                <p className="text-xs text-neutral-400 truncate">{t.artist}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
                              {canControlPlayback ? (
                                <>
                                  <button
                                    onClick={() => handlePlayTrackNow(t)}
                                    className="px-3 py-1.5 bg-white text-black hover:bg-neutral-200 text-xs font-bold rounded-xl shadow flex items-center gap-1 transition-all cursor-pointer"
                                    title="Play immediately for everyone in the room"
                                  >
                                    <span>▶</span> Play
                                  </button>
                                  <button
                                    onClick={() => handleAddToQueue(t)}
                                    className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white text-xs font-semibold rounded-xl border border-white/10 transition-colors cursor-pointer"
                                    title="Add to queue"
                                  >
                                    + Queue
                                  </button>
                                </>
                              ) : (
                                <button
                                  onClick={() => handleRequestSong(t)}
                                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl shadow flex items-center gap-1 transition-all cursor-pointer"
                                  title="Request room admins to play this song"
                                >
                                  <span>🙋</span> Request
                                </button>
                              )}
                              <button
                                onClick={() => handleOpenAddToPlaylist(t)}
                                className="p-1.5 hover:bg-white/10 text-neutral-400 hover:text-white rounded-xl transition-colors text-xs border border-white/5"
                                title="Add to personal playlist"
                              >
                                📑
                              </button>
                            </div>
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
                        className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold cursor-pointer"
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
                            <div className="flex items-center gap-3 min-w-0 flex-1">
                              <span className="text-xs font-mono text-neutral-500 w-4">{idx + 1}</span>
                              <img
                                src={item.artworkUrl || 'https://picsum.photos/50'}
                                alt={item.title}
                                className="w-9 h-9 rounded-lg object-cover bg-neutral-800 flex-shrink-0"
                              />
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-medium truncate">{item.title}</p>
                                <p className="text-xs text-neutral-400 truncate">{item.artist}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-1.5 ml-2">
                              <button
                                onClick={() => handleOpenAddToPlaylist(item)}
                                className="p-1.5 hover:bg-white/10 text-neutral-400 hover:text-white rounded-lg transition-colors text-xs"
                                title="Add to personal playlist"
                              >
                                📑
                              </button>
                              {canControlPlayback && (
                                <button
                                  onClick={() => handleRemoveQueueItem(item.id)}
                                  className="text-neutral-500 hover:text-rose-400 p-1 text-sm cursor-pointer"
                                  title="Remove from queue"
                                >
                                  ✕
                                </button>
                              )}
                            </div>
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

        {/* Invite Friends Modal */}
        {showInviteModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-neutral-900 border border-neutral-800 rounded-3xl w-full max-w-md p-6 shadow-2xl relative"
            >
              <button
                onClick={() => setShowInviteModal(false)}
                className="absolute top-5 right-5 text-neutral-400 hover:text-white p-2 text-lg leading-none"
              >
                ✕
              </button>

              <div className="text-center mb-6">
                <span className="text-3xl">🎉</span>
                <h2 className="text-xl font-bold text-white mt-2">Invite Friends to Listen</h2>
                <p className="text-xs text-neutral-400 mt-1">
                  Share this room code or link to listen together in sync
                </p>
              </div>

              {/* 10-Character Room Code */}
              <div className="bg-neutral-950 border border-neutral-800 rounded-2xl p-4 mb-4 text-center">
                <span className="text-[11px] uppercase tracking-wider text-neutral-400 font-semibold block mb-1.5">
                  10-Character Room Code
                </span>
                <div className="flex items-center justify-center gap-3">
                  <span className="font-mono text-2xl font-extrabold text-indigo-400 tracking-widest select-all">
                    {roomState?.inviteCode || id?.slice(0, 10).toUpperCase() || 'SYNCWAVE01'}
                  </span>
                  <button
                    onClick={copyRoomCode}
                    className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold transition-colors flex items-center gap-1 shadow"
                  >
                    {copiedCode ? '✓ Copied' : 'Copy Code'}
                  </button>
                </div>
                <p className="text-[11px] text-neutral-500 mt-2">
                  Friends can enter this code in <strong>Quick Join</strong> on the homepage
                </p>
              </div>

              {/* Shareable Link */}
              <div className="bg-neutral-950 border border-neutral-800 rounded-2xl p-4 mb-6">
                <span className="text-[11px] uppercase tracking-wider text-neutral-400 font-semibold block mb-1.5">
                  Direct Shareable Link
                </span>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={`${window.location.origin}/join/${roomState?.inviteCode || id || ''}`}
                    className="flex-1 bg-neutral-900 border border-neutral-700 rounded-xl px-3 py-2 text-xs text-neutral-300 font-mono outline-none select-all"
                  />
                  <button
                    onClick={copyInviteLink}
                    className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-white rounded-xl text-xs font-semibold transition-colors flex-shrink-0"
                  >
                    {copiedInvite ? '✓ Copied' : 'Copy Link'}
                  </button>
                </div>
                <p className="text-[11px] text-neutral-500 mt-2">
                  Anyone with this link can click to immediately enter and synchronize
                </p>
              </div>

              <button
                onClick={() => setShowInviteModal(false)}
                className="w-full py-2.5 bg-neutral-800 hover:bg-neutral-700 text-white rounded-xl text-xs font-semibold transition-colors"
              >
                Done
              </button>
            </motion.div>
          </div>
        )}

        {/* Room Members Modal */}
        <RoomMembersModal
          isOpen={showMembersModal}
          onClose={() => setShowMembersModal(false)}
          groupId={id || ''}
          members={members}
          currentUserId={user?.id}
          currentUserRole={(myRole as any) || 'member'}
          membersCanControl={membersCanControl}
          onToggleMembersCanControl={handleToggleMembersCanControl}
          onMemberActionSuccess={() => {
            if (socket && id) {
              socket.emit('playback:resync', { groupId: id });
            }
          }}
        />

        {/* Add Track to Playlist Modal */}
        <AddToPlaylistModal
          isOpen={showAddToPlaylistModal}
          onClose={() => setShowAddToPlaylistModal(false)}
          track={playlistModalTrack}
        />
      </AnimatePresence>
    </div>
  );
}
