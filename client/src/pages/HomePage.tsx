import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { api } from '../lib/api';
import { BrandLogo } from '../components/BrandLogo';
import { PromotionalBanner } from '../components/PromotionalBanner';
import { BrandFooter } from '../components/BrandFooter';
import { SpotifyPlayerPanel } from '../components/SpotifyPlayerPanel';
import { AdSenseSlot } from '../components/AdSenseSlot';

interface Track {
  id: string;
  provider: string;
  providerTrackId: string;
  title: string;
  artist: string;
  album?: string;
  artworkUrl?: string;
  streamUrl?: string;
  durationMs: number;
}

interface GroupMeta {
  id: string;
  name: string;
  inviteCode: string;
  memberCount: number;
  maxMembers: number;
  theme: string;
  mediaMode?: 'music' | 'video' | 'both';
  currentTrackTitle?: string;
  isPlaying?: boolean;
}

const THEMES = [
  { id: 'default', name: 'Default Dark', emoji: '🌌', desc: 'Sleek obsidian deep space', color: 'from-indigo-600 to-violet-900' },
  { id: 'blossom', name: 'Floral Blossom', emoji: '🌸', desc: 'Gentle sakura pastel ambience', color: 'from-pink-500 to-rose-900' },
  { id: 'blizzard', name: 'Snow Blizzard', emoji: '❄️', desc: 'Frosted cyan crystal air', color: 'from-cyan-400 to-blue-900' },
  { id: 'sunset', name: 'Summer Sunset', emoji: '☀️', desc: 'Amber gold & twilight crimson', color: 'from-amber-500 to-purple-900' },
  { id: 'cyberwave', name: 'Neon Cyberwave', emoji: '⚡', desc: 'Electric synthwave violet pulse', color: 'from-fuchsia-500 to-cyan-800' },
  { id: 'lofi', name: 'Midnight Lo-Fi', emoji: '🌙', desc: 'Nocturnal dusty charcoal mood', color: 'from-violet-600 to-neutral-900' },
];

const GENRES = ['Trending', 'Bollywood', 'Hindi', 'Punjabi', 'Pop', 'Hip-Hop', 'Electronic', 'Rock', 'Lo-Fi', 'R&B', 'Tamil', 'Telugu'];

export default function HomePage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();

  // Rooms & Music state
  const [groups, setGroups] = useState<GroupMeta[]>([]);
  const [loadingGroups, setLoadingGroups] = useState(true);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [loadingMusic, setLoadingMusic] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGenre, setSelectedGenre] = useState('Trending');

  // Create room modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newRoomName, setNewRoomName] = useState('');
  const [newRoomCapacity, setNewRoomCapacity] = useState(50);
  const [newRoomTheme, setNewRoomTheme] = useState('default');
  const [newRoomMediaMode, setNewRoomMediaMode] = useState<'music' | 'video' | 'both'>('music');
  const [creatingRoom, setCreatingRoom] = useState(false);

  // Quick join state
  const [joinCode, setJoinCode] = useState('');
  const [joinError, setJoinError] = useState('');

  // Audio Playback & Spotify Panel
  const [previewTrack, setPreviewTrack] = useState<Track | null>(null);
  const [isPlayingPreview, setIsPlayingPreview] = useState(false);
  const [currentPlayTimeMs, setCurrentPlayTimeMs] = useState(0);
  const [currentDurationMs, setCurrentDurationMs] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Copy notification toast
  const [copyToast, setCopyToast] = useState<string | null>(null);

  // Fetch user groups
  const loadGroups = async () => {
    try {
      setLoadingGroups(true);
      const res = await api.get('/api/groups');
      setGroups(res.data || []);
    } catch (err) {
      console.error('Failed to load groups:', err);
    } finally {
      setLoadingGroups(false);
    }
  };

  // Fetch worldwide songs / search
  const loadMusic = async (query = '', genre = 'Trending') => {
    try {
      setLoadingMusic(true);
      if (query.trim()) {
        const res = await api.get('/api/music/search', { params: { q: query.trim(), limit: 24 } });
        setTracks(res.data?.tracks || []);
      } else {
        const gParam = genre === 'Trending' ? '' : genre.toLowerCase();
        const res = await api.get('/api/music/trending', { params: { limit: 24, genre: gParam } });
        setTracks(res.data?.tracks || []);
      }
    } catch (err) {
      console.error('Failed to load songs:', err);
      setTracks([]);
    } finally {
      setLoadingMusic(false);
    }
  };

  useEffect(() => {
    loadGroups();
    loadMusic('', 'Trending');
  }, []);

  // Debounced search
  useEffect(() => {
    const handler = setTimeout(() => {
      if (searchQuery.trim()) {
        loadMusic(searchQuery.trim(), selectedGenre);
      } else {
        loadMusic('', selectedGenre);
      }
    }, 400);

    return () => clearTimeout(handler);
  }, [searchQuery]);

  // Audio Playback & Navigation Controls
  const togglePlayTrack = (track: Track) => {
    if (previewTrack?.id === track.id) {
      if (isPlayingPreview) {
        audioRef.current?.pause();
        setIsPlayingPreview(false);
      } else {
        audioRef.current?.play();
        setIsPlayingPreview(true);
      }
      return;
    }

    setPreviewTrack(track);
    setIsPlayingPreview(true);
    setCurrentPlayTimeMs(0);
    setCurrentDurationMs(track.durationMs || 0);

    if (audioRef.current) {
      const streamUrl = track.streamUrl || `/api/music/stream/${track.provider}/${track.providerTrackId}`;
      audioRef.current.src = streamUrl;
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch((err) => {
        console.warn('Track playback failed:', err);
        setIsPlayingPreview(false);
      });
    }
  };

  const handleAutoPlayNext = () => {
    if (!previewTrack || tracks.length === 0) return;
    const currentIndex = tracks.findIndex((t) => t.id === previewTrack.id);
    const nextTrack = tracks[(currentIndex + 1) % tracks.length];
    if (nextTrack) {
      togglePlayTrack(nextTrack);
    }
  };

  const handlePlayPrev = () => {
    if (!previewTrack || tracks.length === 0) return;
    const currentIndex = tracks.findIndex((t) => t.id === previewTrack.id);
    const prevIndex = (currentIndex - 1 + tracks.length) % tracks.length;
    const prevTrack = tracks[prevIndex];
    if (prevTrack) {
      togglePlayTrack(prevTrack);
    }
  };

  const handleSeek = (posMs: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = posMs / 1000;
      setCurrentPlayTimeMs(posMs);
    }
  };

  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoomName.trim()) return;

    try {
      setCreatingRoom(true);
      const res = await api.post('/api/groups', {
        name: newRoomName.trim(),
        maxMembers: Number(newRoomCapacity),
        theme: newRoomTheme,
        mediaMode: newRoomMediaMode,
      });

      setShowCreateModal(false);
      setNewRoomName('');
      setNewRoomMediaMode('music');
      if (res.data?.id) {
        navigate(`/room/${res.data.id}`);
      } else {
        loadGroups();
      }
    } catch (err: any) {
      alert(err.message || 'Failed to create room');
    } finally {
      setCreatingRoom(false);
    }
  };

  const handleQuickJoin = (e: React.FormEvent) => {
    e.preventDefault();
    setJoinError('');
    const code = joinCode.trim().toUpperCase().replace(/\s+/g, '');
    if (!code) return;
    if (code.length !== 10) {
      setJoinError('Invite codes are exactly 10 characters.');
      return;
    }
    navigate(`/join/${code}`);
  };

  const copyInvite = (code: string) => {
    const url = `https://syncwave.work.gd/join/${code}`;
    navigator.clipboard.writeText(url);
    setCopyToast(`Copied invite link: ${url}`);
    setTimeout(() => setCopyToast(null), 3000);
  };

  const formatMs = (ms: number) => {
    const secs = Math.floor(ms / 1000);
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-white p-4 sm:p-6 lg:p-8 pb-32">
      {/* Audio Engine element */}
      <audio
        ref={audioRef}
        onTimeUpdate={() => {
          if (audioRef.current) {
            const currentMs = audioRef.current.currentTime * 1000;
            const durMs = (audioRef.current.duration || 0) * 1000;
            setCurrentPlayTimeMs(currentMs);
            if (durMs > 0) setCurrentDurationMs(durMs);
          }
        }}
        onEnded={handleAutoPlayNext}
      />

      {/* Copy Toast Alert */}
      <AnimatePresence>
        {copyToast && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-5 left-1/2 -translate-x-1/2 z-50 bg-indigo-600 text-white text-xs font-semibold px-4 py-2.5 rounded-full shadow-2xl flex items-center gap-2"
          >
            <span>✓</span> {copyToast}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="max-w-6xl mx-auto space-y-10">
        {/* Header Greeting */}
        <header className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-neutral-800/80 pb-6">
          <div>
            <div className="flex items-center gap-3">
              <BrandLogo size="md" animated={false} />
              <span className="text-[10px] bg-white/10 text-white/80 border border-white/20 px-2.5 py-0.5 rounded-full font-mono uppercase font-semibold tracking-wider">
                Live Rooms
              </span>
            </div>
            <p className="text-neutral-400 text-sm mt-1">
              Listen together with friends in zero-latency synchronized audio rooms.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div
              onClick={() => navigate('/profile')}
              className="flex items-center gap-3 bg-neutral-900 border border-neutral-800 hover:border-neutral-700 px-3.5 py-2 rounded-2xl cursor-pointer transition-all"
            >
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center text-lg shadow"
                style={{ backgroundColor: user?.avatarColor || '#6366f1' }}
              >
                {user?.avatarEmoji || '🎧'}
              </div>
              <div className="text-left hidden sm:block">
                <p className="text-xs font-bold leading-tight truncate max-w-[120px]">{user?.displayName || 'Music Fan'}</p>
                <p className="text-[11px] text-neutral-400 capitalize">{user?.role || 'Listener'}</p>
              </div>
            </div>

            {user?.role === 'superadmin' && (
              <button
                onClick={() => navigate('/admin/dashboard')}
                className="px-3.5 py-2 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/40 rounded-2xl text-xs font-semibold flex items-center gap-1.5 transition-colors"
                title="Admin Console"
              >
                <span>🛡️</span> Admin
              </button>
            )}
          </div>
        </header>

        {/* Dynamic Promotional Hero Spotlight Banner */}
        <PromotionalBanner />

        {/* Pre-Join / Pre-Create Pro-Tip Advisory Callout */}
        <div className="bg-gradient-to-r from-amber-500/10 via-purple-500/10 to-indigo-500/10 border border-amber-500/30 rounded-2xl p-3.5 flex items-start gap-3 shadow-lg">
          <span className="text-xl shrink-0">💡</span>
          <div className="text-xs">
            <p className="font-bold text-amber-300">Pro-Tip for Full-Length Playback:</p>
            <p className="text-neutral-300 mt-0.5 leading-relaxed">
              If an audio song snippet is short or regionally restricted, choose <strong className="text-white">Video Only</strong> or <strong className="text-white">Music & Video</strong> mode (or search directly on YouTube) to enjoy full-length, uninterrupted music videos with all friends in real-time sync!
            </p>
          </div>
        </div>

        {/* Action Banners (Create Room / Join Room) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <motion.div
            whileHover={{ scale: 1.015 }}
            whileTap={{ scale: 0.985 }}
            onClick={() => setShowCreateModal(true)}
            className="md:col-span-2 bg-gradient-to-br from-indigo-900/40 via-neutral-900 to-neutral-900 border border-indigo-500/30 hover:border-indigo-500/60 rounded-3xl p-6 cursor-pointer relative overflow-hidden group shadow-xl transition-all"
          >
            <div className="absolute right-0 top-0 translate-x-8 -translate-y-8 w-44 h-44 bg-indigo-600/10 rounded-full blur-2xl group-hover:bg-indigo-600/20 transition-all pointer-events-none" />
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-indigo-600 text-white rounded-2xl flex items-center justify-center text-3xl shadow-lg shadow-indigo-600/30 group-hover:scale-105 transition-transform">
                ✨
              </div>
              <div>
                <h2 className="text-xl font-bold text-white group-hover:text-indigo-200 transition-colors">
                  Create a Listening Room
                </h2>
                <p className="text-xs text-neutral-400 mt-1 max-w-md">
                  Choose room themes (Blossom, Blizzard, Sunset, Neon Cyberwave), customize capacity (up to 100 listeners), and invite friends with one link.
                </p>
              </div>
            </div>
          </motion.div>

          {/* Quick Join Card */}
          <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-6 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xl">🔗</span>
                <h3 className="font-bold text-sm">Join with Code</h3>
              </div>
              <p className="text-xs text-neutral-400">Enter an 8-character invite code to hop directly into an active room.</p>
            </div>

            <form onSubmit={handleQuickJoin} className="mt-4 flex gap-2">
              <input
                type="text"
                placeholder="10-character invite code"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase().replace(/[^A-Z2-9]/g, '').slice(0, 10))}
                className="w-full bg-neutral-950 border border-neutral-800 focus:border-indigo-500 px-3.5 py-2.5 rounded-xl text-xs font-mono uppercase tracking-wider outline-none text-white transition-colors"
              />
              <button
                type="submit"
                className="bg-white hover:bg-neutral-200 text-black px-4 py-2.5 rounded-xl text-xs font-bold transition-colors whitespace-nowrap shadow"
              >
                Join
              </button>
            </form>
            {joinError && <p className="text-[11px] text-rose-400 mt-2">{joinError}</p>}
          </div>
        </div>

        {/* User's Active Listening Rooms */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold flex items-center gap-2">
              <span>📻</span> Your Active Rooms
              {groups.length > 0 && (
                <span className="text-xs bg-neutral-800 text-neutral-400 px-2 py-0.5 rounded-full font-mono">
                  {groups.length}
                </span>
              )}
            </h2>
            <button
              onClick={loadGroups}
              className="text-xs text-neutral-400 hover:text-white transition-colors flex items-center gap-1"
            >
              🔄 Refresh
            </button>
          </div>

          {loadingGroups ? (
            <div className="h-28 bg-neutral-900/50 border border-neutral-800 rounded-2xl animate-pulse flex items-center justify-center text-xs text-neutral-500">
              Loading your rooms...
            </div>
          ) : groups.length === 0 ? (
            <div className="bg-neutral-900/40 border border-neutral-800/80 rounded-2xl p-8 text-center text-neutral-400 space-y-2">
              <p className="text-sm font-medium">You don't have any active rooms right now.</p>
              <p className="text-xs text-neutral-500">
                Create your first room above to start listening with friends!
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {groups.map((group) => {
                const themeObj = THEMES.find((t) => t.id === group.theme) || THEMES[0];
                const emoji = themeObj?.emoji || '🌌';
                const themeName = themeObj?.name || 'Default';
                return (
                  <motion.div
                    key={group.id}
                    whileHover={{ y: -2 }}
                    className="bg-neutral-900 border border-neutral-800 hover:border-neutral-700 rounded-2xl p-5 flex flex-col justify-between space-y-4 transition-all shadow"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h3 className="font-bold text-base truncate max-w-[180px]">{group.name}</h3>
                          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                            <span className="text-[11px] text-neutral-400 flex items-center gap-1">
                              {emoji} {themeName} • {group.memberCount} / {group.maxMembers} listening
                            </span>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                              group.mediaMode === 'video'
                                ? 'bg-red-500/10 text-red-400 border-red-500/20'
                                : group.mediaMode === 'both'
                                ? 'bg-purple-500/10 text-purple-400 border-purple-500/20'
                                : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                            }`}>
                              {group.mediaMode === 'video' ? '🎬 Video' : group.mediaMode === 'both' ? '🔀 Music & Video' : '🎵 Music'}
                            </span>
                          </div>
                        </div>
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse mt-1" />
                      </div>

                      {group.currentTrackTitle ? (
                        <div className="mt-3 bg-neutral-950/80 border border-neutral-800/80 p-2.5 rounded-xl flex items-center gap-2 text-xs">
                          <span className="text-indigo-400 animate-bounce">🎵</span>
                          <span className="truncate text-neutral-300 font-medium">
                            {group.currentTrackTitle}
                          </span>
                        </div>
                      ) : (
                        <div className="mt-3 text-[11px] text-neutral-500 italic">No track playing</div>
                      )}
                    </div>

                    <div className="flex items-center gap-2 pt-2 border-t border-neutral-800/60">
                      <button
                        onClick={() => navigate(`/room/${group.id}`)}
                        className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold py-2 px-3 rounded-xl transition-colors text-center"
                      >
                        Enter Room →
                      </button>
                      <button
                        onClick={() => copyInvite(group.inviteCode)}
                        className="bg-neutral-800 hover:bg-neutral-700 text-xs px-3 py-2 rounded-xl text-neutral-300 hover:text-white transition-colors"
                        title="Copy Invite Link"
                      >
                        🔗 Copy Link
                      </button>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </section>

        {/* Global Music Catalog Section */}
        <section className="space-y-6 pt-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl font-extrabold flex items-center gap-2">
                <span>🌍</span> Worldwide Music Catalog
              </h2>
              <p className="text-xs text-neutral-400 mt-1">
                Millions of songs across Apple iTunes, Audius, and Jamendo. Play any preview or queue it into your room!
              </p>
            </div>

            {/* Global Search Bar */}
            <div className="relative w-full md:w-96">
              <input
                type="text"
                placeholder="Search any song, artist, album..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-neutral-900 border border-neutral-800 focus:border-indigo-500 rounded-2xl py-3 pl-11 pr-4 text-xs outline-none text-white transition-colors shadow-inner"
              />
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-500 text-sm">🔍</span>
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-white text-xs p-1"
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          {/* Genre / Filter Chips */}
          <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
            {GENRES.map((genre) => (
              <button
                key={genre}
                onClick={() => {
                  setSelectedGenre(genre);
                  setSearchQuery('');
                  loadMusic('', genre);
                }}
                className={`px-4 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
                  selectedGenre === genre && !searchQuery
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                    : 'bg-neutral-900 text-neutral-400 hover:text-white hover:bg-neutral-800 border border-neutral-800'
                }`}
              >
                {genre}
              </button>
            ))}
          </div>

          {/* Songs Grid */}
          {loadingMusic ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {Array.from({ length: 12 }).map((_, i) => (
                <div key={i} className="bg-neutral-900/60 rounded-2xl p-3 border border-neutral-800 animate-pulse space-y-2">
                  <div className="w-full aspect-square bg-neutral-800 rounded-xl" />
                  <div className="h-3 bg-neutral-800 rounded w-3/4" />
                  <div className="h-2.5 bg-neutral-800/80 rounded w-1/2" />
                </div>
              ))}
            </div>
          ) : tracks.length === 0 ? (
            <div className="bg-neutral-900/40 border border-neutral-800 rounded-2xl p-12 text-center text-neutral-500">
              <span className="text-4xl">🔍</span>
              <p className="mt-3 text-sm font-semibold">No tracks found</p>
              <p className="text-xs text-neutral-600 mt-1">Try another search term like "Coldplay", "Taylor Swift", or "EDM".</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {tracks.map((track) => {
                const isThisPlaying = previewTrack?.id === track.id && isPlayingPreview;
                return (
                  <motion.div
                    key={track.id}
                    whileHover={{ y: -3 }}
                    className="group bg-neutral-900 border border-neutral-800/80 hover:border-neutral-700 rounded-2xl p-3 flex flex-col justify-between transition-all shadow relative"
                  >
                    <div>
                      {/* Artwork & Play button overlay */}
                      <div className="relative aspect-square rounded-xl overflow-hidden bg-neutral-950 shadow mb-3">
                        <img
                          src={track.artworkUrl || 'https://picsum.photos/300'}
                          alt={track.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          loading="lazy"
                        />
                        <button
                          onClick={() => togglePlayTrack(track)}
                          className={`absolute inset-0 m-auto w-12 h-12 rounded-full flex items-center justify-center text-lg shadow-xl transition-all ${
                            isThisPlaying
                              ? 'bg-indigo-600 text-white scale-100 opacity-100'
                              : 'bg-black/70 hover:bg-indigo-600 text-white opacity-0 group-hover:opacity-100 scale-90 group-hover:scale-100'
                          }`}
                          title={isThisPlaying ? 'Pause Preview' : 'Play Preview'}
                        >
                          {isThisPlaying ? '⏸' : '▶'}
                        </button>

                        <span className="absolute bottom-1.5 right-1.5 bg-black/70 backdrop-blur-sm text-[10px] font-mono px-1.5 py-0.5 rounded text-neutral-300">
                          {formatMs(track.durationMs)}
                        </span>
                      </div>

                      {/* Title & Artist */}
                      <h4 className="text-xs font-bold text-white truncate" title={track.title}>
                        {track.title}
                      </h4>
                      <p className="text-[11px] text-neutral-400 truncate mt-0.5" title={track.artist}>
                        {track.artist}
                      </p>
                    </div>

                    <div className="mt-3 pt-2 border-t border-neutral-800/60 flex items-center justify-between text-[10px] text-neutral-500">
                      <span className="capitalize font-mono">{track.provider}</span>
                      <button
                        onClick={() => togglePlayTrack(track)}
                        className="text-indigo-400 hover:text-indigo-300 font-semibold"
                      >
                        {isThisPlaying ? 'Playing' : 'Listen'}
                      </button>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </section>

        {/* Google AdSense Responsive Display Slot */}
        <div className="mt-8">
          <AdSenseSlot className="max-w-5xl mx-auto" />
        </div>
      </div>

      {/* Spotify-Style Studio Player Panel & Synced Lyrics */}
      {previewTrack && (
        <SpotifyPlayerPanel
          track={previewTrack}
          isPlaying={isPlayingPreview}
          currentTimeMs={currentPlayTimeMs}
          durationMs={currentDurationMs || previewTrack.durationMs}
          onPlayPause={() => togglePlayTrack(previewTrack)}
          onSeek={handleSeek}
          onNext={handleAutoPlayNext}
          onPrev={handlePlayPrev}
          onClose={() => {
            if (audioRef.current) {
              audioRef.current.pause();
              audioRef.current.src = '';
            }
            setIsPlayingPreview(false);
            setPreviewTrack(null);
          }}
        />
      )}

      {/* Global Brand Footer */}
      <div className="-mx-4 sm:-mx-6 lg:-mx-8">
        <BrandFooter />
      </div>

      {/* Create Room Modal */}
      <AnimatePresence>
        {showCreateModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-neutral-900 border border-neutral-800 rounded-3xl w-full max-w-lg p-6 sm:p-8 shadow-2xl relative"
            >
              <div className="flex items-center justify-between pb-4 border-b border-neutral-800">
                <div>
                  <h2 className="text-xl font-bold">Create Listening Room</h2>
                  <p className="text-xs text-neutral-400 mt-0.5">Customize your vibe, capacity, and start streaming</p>
                </div>
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="text-neutral-400 hover:text-white p-1 text-lg"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleCreateRoom} className="space-y-6 mt-6">
                {/* Room Name */}
                <div>
                  <label className="block text-xs font-semibold text-neutral-300 mb-1.5">Room Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Midnight Chillwave Lounge"
                    value={newRoomName}
                    onChange={(e) => setNewRoomName(e.target.value)}
                    className="w-full bg-neutral-950 border border-neutral-800 focus:border-indigo-500 rounded-xl px-4 py-3 text-sm outline-none text-white transition-colors"
                  />
                </div>

                {/* Member Capacity Slider */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-semibold text-neutral-300">Room Member Capacity</label>
                    <span className="text-xs font-bold text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-full border border-indigo-500/30">
                      {newRoomCapacity} listeners
                    </span>
                  </div>
                  <input
                    type="range"
                    min="2"
                    max="100"
                    step="1"
                    value={newRoomCapacity}
                    onChange={(e) => setNewRoomCapacity(Number(e.target.value))}
                    className="w-full accent-indigo-500 cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-neutral-500 mt-1">
                    <span>2 (Intimate duo)</span>
                    <span>50 (Party)</span>
                    <span>100 (Full Arena)</span>
                  </div>
                </div>

                {/* Media Playback Mode Selection */}
                <div>
                  <label className="block text-xs font-semibold text-neutral-300 mb-2">Room Media Mode</label>
                  <div className="grid grid-cols-3 gap-2.5">
                    {[
                      { id: 'music', label: 'Music Only', icon: '🎵', desc: 'HQ audio & lyrics sync' },
                      { id: 'video', label: 'Video Only', icon: '🎬', desc: 'YouTube watch party' },
                      { id: 'both', label: 'Music & Video', icon: '🔀', desc: 'Both songs & videos' },
                    ].map((mode) => {
                      const isSelected = newRoomMediaMode === mode.id;
                      return (
                        <div
                          key={mode.id}
                          onClick={() => setNewRoomMediaMode(mode.id as any)}
                          className={`p-3 rounded-2xl border cursor-pointer transition-all flex flex-col justify-between ${
                            isSelected
                              ? 'bg-indigo-600/20 border-indigo-500 shadow-md shadow-indigo-600/20 ring-1 ring-indigo-500'
                              : 'bg-neutral-950 border-neutral-800 hover:border-neutral-700'
                          }`}
                        >
                          <div className="flex items-center gap-1.5 mb-1">
                            <span className="text-base">{mode.icon}</span>
                            <span className="text-xs font-bold leading-tight">{mode.label}</span>
                          </div>
                          <p className="text-[10px] text-neutral-400 leading-tight">{mode.desc}</p>
                        </div>
                      );
                    })}
                  </div>
                  <div className="mt-2.5 bg-amber-500/10 border border-amber-500/25 rounded-xl p-3 flex items-start gap-2.5">
                    <span className="text-sm shrink-0">💡</span>
                    <p className="text-[11px] text-amber-200/90 leading-relaxed">
                      <strong>Full-Song Guarantee:</strong> If audio tracks are regional snippets, select <strong>Video Only</strong> or <strong>Music & Video</strong> to stream complete YouTube music videos in real-time sync with friends!
                    </p>
                  </div>
                </div>

                {/* Visual Vibe Theme Selection */}
                <div>
                  <label className="block text-xs font-semibold text-neutral-300 mb-2">Room Vibe Theme</label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                    {THEMES.map((theme) => {
                      const isSelected = newRoomTheme === theme.id;
                      return (
                        <div
                          key={theme.id}
                          onClick={() => setNewRoomTheme(theme.id)}
                          className={`p-3 rounded-2xl border cursor-pointer transition-all flex flex-col justify-between ${
                            isSelected
                              ? 'bg-indigo-600/20 border-indigo-500 shadow-md shadow-indigo-600/20'
                              : 'bg-neutral-950 border-neutral-800 hover:border-neutral-700'
                          }`}
                        >
                          <div className="flex items-center gap-1.5 mb-1">
                            <span className="text-base">{theme.emoji}</span>
                            <span className="text-xs font-bold leading-tight truncate">{theme.name}</span>
                          </div>
                          <p className="text-[10px] text-neutral-400 leading-tight">{theme.desc}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Submit button */}
                <button
                  type="submit"
                  disabled={creatingRoom || !newRoomName.trim()}
                  className="w-full bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl py-3.5 font-bold text-sm transition-all shadow-xl shadow-indigo-600/25 disabled:opacity-50"
                >
                  {creatingRoom ? 'Launching Room...' : 'Launch Room & Get Invite Link 🚀'}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
