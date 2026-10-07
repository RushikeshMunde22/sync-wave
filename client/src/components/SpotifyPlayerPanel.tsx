import { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Play, 
  Pause, 
  SkipForward, 
  SkipBack, 
  Maximize2, 
  Minimize2, 
  X, 
  Mic2, 
  Sparkles,
  Music2
} from 'lucide-react';
import { api } from '../lib/api';

export interface SpotifyTrack {
  id: string;
  provider: string;
  providerTrackId?: string;
  title: string;
  artist: string;
  album?: string;
  artworkUrl?: string;
  streamUrl?: string;
  durationMs: number;
}

interface LyricLine {
  time: number;
  text: string;
}

interface LyricsData {
  found: boolean;
  synced: boolean;
  lines: LyricLine[];
  plainLyrics?: string;
  source: string;
}

interface SpotifyPlayerPanelProps {
  track: SpotifyTrack | null;
  isPlaying: boolean;
  currentTimeMs: number;
  durationMs: number;
  onPlayPause: () => void;
  onSeek: (positionMs: number) => void;
  onNext?: () => void;
  onPrev?: () => void;
  onClose: () => void;
  initialExpanded?: boolean;
}

export function SpotifyPlayerPanel({
  track,
  isPlaying,
  currentTimeMs,
  durationMs,
  onPlayPause,
  onSeek,
  onNext,
  onPrev,
  onClose,
  initialExpanded = true,
}: SpotifyPlayerPanelProps) {
  const [isExpanded, setIsExpanded] = useState(initialExpanded);
  const [showLyrics, setShowLyrics] = useState(true);
  const [lyricsData, setLyricsData] = useState<LyricsData | null>(null);
  const [loadingLyrics, setLoadingLyrics] = useState(false);

  const lyricsContainerRef = useRef<HTMLDivElement>(null);
  const activeLineRef = useRef<HTMLDivElement>(null);

  // Auto-expand on new track if user previously had it open or by default
  useEffect(() => {
    if (track) {
      setIsExpanded(true);
    }
  }, [track?.id]);

  // Load lyrics whenever track changes
  useEffect(() => {
    if (!track) {
      setLyricsData(null);
      return;
    }

    let isMounted = true;
    setLoadingLyrics(true);
    setLyricsData(null);

    const durSec = track.durationMs ? track.durationMs / 1000 : undefined;
    api
      .get('/music/lyrics', {
        params: {
          title: track.title,
          artist: track.artist,
          duration: durSec,
        },
      })
      .then((res) => {
        if (isMounted) {
          setLyricsData(res.data);
          setLoadingLyrics(false);
        }
      })
      .catch((err) => {
        if (isMounted) {
          console.warn('[Lyrics] Fetch failed:', err);
          setLyricsData({ found: false, synced: false, lines: [], source: 'none' });
          setLoadingLyrics(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [track?.id, track?.title, track?.artist]);

  // Find active lyric line index based on playback time
  const currentSec = currentTimeMs / 1000;
  const lines = lyricsData?.lines || [];
  let activeIndex = -1;

  if (lines.length > 0) {
    for (let i = 0; i < lines.length; i++) {
      const cur = lines[i];
      const next = lines[i + 1];
      if (cur && currentSec >= cur.time && (!next || currentSec < next.time)) {
        activeIndex = i;
        break;
      }
    }
  }

  // Smooth auto-scroll active lyric line to center of lyrics container
  useEffect(() => {
    if (activeLineRef.current && lyricsContainerRef.current && isExpanded && showLyrics) {
      activeLineRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }
  }, [activeIndex, isExpanded, showLyrics]);

  if (!track) return null;

  const effectiveDuration = durationMs > 0 ? durationMs : track.durationMs || 180000;
  const progressPercent = Math.min(100, Math.max(0, (currentTimeMs / effectiveDuration) * 100));

  const formatTime = (ms: number) => {
    const totalSecs = Math.floor(ms / 1000);
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const handleScrubberClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clickRatio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    onSeek(clickRatio * effectiveDuration);
  };

  return (
    <>
      {/* ── EXPANDED SPOTIFY FULL PLAYER MODAL ───────────────────────── */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0, y: 100 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 100 }}
            transition={{ type: 'spring', damping: 26, stiffness: 220 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/90 backdrop-blur-2xl overflow-hidden"
          >
            {/* Ambient Background Glow matching artwork */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-40">
              <img
                src={track.artworkUrl || 'https://picsum.photos/600'}
                alt=""
                className="w-full h-full object-cover filter blur-3xl scale-125 saturate-150"
              />
              <div className="absolute inset-0 bg-neutral-950/80" />
            </div>

            <div className="relative z-10 w-full max-w-5xl h-full max-h-[88vh] bg-neutral-950/90 border border-neutral-800/80 rounded-3xl shadow-2xl flex flex-col overflow-hidden backdrop-blur-xl">
              {/* Top Header */}
              <div className="p-4 sm:p-5 border-b border-neutral-800/60 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                  <div>
                    <h4 className="text-xs uppercase font-mono tracking-widest text-neutral-400 font-semibold">
                      SyncWave Studio Player
                    </h4>
                    <p className="text-[11px] text-emerald-400 font-mono">
                      Full Audio • 320kbps High Fidelity
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowLyrics(!showLyrics)}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5 transition-all ${
                      showLyrics
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                        : 'bg-neutral-800/80 text-neutral-400 hover:text-white border border-neutral-700'
                    }`}
                    title="Toggle Synced Lyrics"
                  >
                    <Mic2 size={13} />
                    <span>Lyrics</span>
                  </button>

                  <button
                    onClick={() => setIsExpanded(false)}
                    className="p-2 rounded-full hover:bg-neutral-800 text-neutral-400 hover:text-white transition-colors"
                    title="Minimize Player"
                  >
                    <Minimize2 size={16} />
                  </button>

                  <button
                    onClick={onClose}
                    className="p-2 rounded-full hover:bg-neutral-800 text-neutral-400 hover:text-red-400 transition-colors"
                    title="Close Player"
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>

              {/* Main Body: Split between Artwork/Controls & Lyrics */}
              <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6 p-6 sm:p-8 overflow-y-auto">
                {/* Left Column: Artwork + Track Meta + Controls */}
                <div className={`space-y-6 flex flex-col justify-between ${showLyrics ? 'lg:col-span-5' : 'lg:col-span-12 max-w-xl mx-auto'}`}>
                  {/* Album Cover */}
                  <div className="relative group max-w-sm mx-auto w-full aspect-square rounded-2xl overflow-hidden shadow-2xl border border-white/10 bg-neutral-900">
                    <img
                      src={track.artworkUrl || 'https://picsum.photos/400'}
                      alt={track.title}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>

                  {/* Title & Artist */}
                  <div className="text-center sm:text-left space-y-1">
                    <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight leading-tight line-clamp-2">
                      {track.title}
                    </h2>
                    <p className="text-sm sm:text-base text-neutral-300 font-medium">
                      {track.artist}
                    </p>
                    {track.album && (
                      <p className="text-xs text-neutral-500 line-clamp-1">{track.album}</p>
                    )}
                  </div>

                  {/* Scrubber & Duration */}
                  <div className="space-y-2">
                    <div
                      onClick={handleScrubberClick}
                      className="group/scrub relative w-full h-2.5 bg-neutral-800 hover:h-3.5 rounded-full cursor-pointer transition-all overflow-hidden"
                    >
                      <div
                        className="h-full bg-gradient-to-r from-emerald-500 to-cyan-400 rounded-full transition-all"
                        style={{ width: `${progressPercent}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-[11px] font-mono text-neutral-400">
                      <span>{formatTime(currentTimeMs)}</span>
                      <span>{formatTime(effectiveDuration)}</span>
                    </div>
                  </div>

                  {/* Controls Bar */}
                  <div className="flex items-center justify-center gap-6">
                    {onPrev && (
                      <button
                        onClick={onPrev}
                        className="p-3 text-neutral-400 hover:text-white transition-colors"
                        title="Previous Track"
                      >
                        <SkipBack size={22} />
                      </button>
                    )}

                    <button
                      onClick={onPlayPause}
                      className="w-16 h-16 rounded-full bg-white text-black hover:scale-105 active:scale-95 flex items-center justify-center shadow-xl shadow-white/20 transition-all"
                      title={isPlaying ? 'Pause' : 'Play'}
                    >
                      {isPlaying ? (
                        <Pause size={28} className="fill-black" />
                      ) : (
                        <Play size={28} className="fill-black ml-1" />
                      )}
                    </button>

                    {onNext && (
                      <button
                        onClick={onNext}
                        className="p-3 text-neutral-400 hover:text-white transition-colors"
                        title="Skip to Next"
                      >
                        <SkipForward size={22} />
                      </button>
                    )}
                  </div>
                </div>

                {/* Right Column: Synced Lyrics */}
                {showLyrics && (
                  <div className="lg:col-span-7 bg-black/40 border border-white/5 rounded-3xl p-6 flex flex-col justify-between overflow-hidden shadow-inner">
                    <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-2">
                      <div className="flex items-center gap-2">
                        <Sparkles size={16} className="text-emerald-400" />
                        <span className="text-xs font-bold uppercase tracking-wider text-white">
                          Synchronized Lyrics
                        </span>
                      </div>
                      <span className="text-[10px] text-neutral-400 font-mono">
                        {lyricsData?.synced ? '● Live Timestamp Sync' : 'Plain Text'}
                      </span>
                    </div>

                    <div
                      ref={lyricsContainerRef}
                      className="flex-1 overflow-y-auto space-y-4 py-8 pr-3 scrollbar-thin scrollbar-thumb-neutral-800"
                    >
                      {loadingLyrics ? (
                        <div className="flex flex-col items-center justify-center h-full text-neutral-500 space-y-3 py-16">
                          <div className="w-6 h-6 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
                          <p className="text-xs">Finding studio lyrics for this song...</p>
                        </div>
                      ) : lyricsData?.lines && lyricsData.lines.length > 0 ? (
                        lyricsData.lines.map((line, idx) => {
                          const isActive = idx === activeIndex;
                          const isPassed = activeIndex > -1 && idx < activeIndex;

                          return (
                            <div
                              key={idx}
                              ref={isActive ? activeLineRef : null}
                              onClick={() => onSeek(line.time * 1000)}
                              className={`cursor-pointer transition-all duration-300 py-1 px-3 rounded-xl ${
                                isActive
                                  ? 'text-white text-lg sm:text-2xl font-black bg-white/10 scale-102 drop-shadow-lg'
                                  : isPassed
                                  ? 'text-neutral-500 text-sm sm:text-base font-medium hover:text-neutral-300'
                                  : 'text-neutral-400 text-sm sm:text-base font-medium hover:text-white'
                              }`}
                            >
                              {line.text || '♪'}
                            </div>
                          );
                        })
                      ) : lyricsData?.plainLyrics ? (
                        <div className="text-neutral-300 text-sm sm:text-base leading-relaxed whitespace-pre-wrap font-sans py-4">
                          {lyricsData.plainLyrics}
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center h-full text-center py-16 space-y-3">
                          <Music2 size={36} className="text-neutral-600" />
                          <p className="text-sm font-semibold text-neutral-300">
                            Looks like this song is an instrumental or lyrics are unlisted.
                          </p>
                          <p className="text-xs text-neutral-500 max-w-sm">
                            Enjoy the crystal-clear 320kbps studio audio stream!
                          </p>
                        </div>
                      )}
                    </div>

                    <div className="pt-3 border-t border-white/5 flex items-center justify-between text-[11px] text-neutral-500 font-mono">
                      <span>Click any lyric line to jump instantly</span>
                      <span>Source: {lyricsData?.source || 'Studio Cache'}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── COMPACT BOTTOM DOCK (ALWAYS VISIBLE WHEN MINI) ─────────── */}
      <AnimatePresence>
        {!isExpanded && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed bottom-4 left-4 right-4 max-w-3xl mx-auto z-40 bg-neutral-950/95 border border-white/15 rounded-2xl p-3 shadow-2xl flex items-center justify-between gap-4 backdrop-blur-xl text-white"
          >
            {/* Scrubber Progress Bar at the very top edge */}
            <div
              onClick={handleScrubberClick}
              className="absolute top-0 left-0 right-0 h-1 bg-neutral-800 hover:h-2 cursor-pointer transition-all rounded-t-2xl overflow-hidden"
            >
              <div
                className="h-full bg-emerald-400 transition-all"
                style={{ width: `${progressPercent}%` }}
              />
            </div>

            {/* Left: Track artwork & titles */}
            <div
              onClick={() => setIsExpanded(true)}
              className="flex items-center gap-3 min-w-0 cursor-pointer group flex-1"
            >
              <img
                src={track.artworkUrl || 'https://picsum.photos/60'}
                alt={track.title}
                className="w-12 h-12 rounded-xl object-cover bg-neutral-900 border border-white/10 group-hover:scale-105 transition-transform shrink-0"
              />
              <div className="min-w-0">
                <p className="text-xs sm:text-sm font-bold truncate group-hover:text-emerald-300 transition-colors">
                  {track.title}
                </p>
                <p className="text-[11px] text-neutral-400 truncate">
                  {track.artist}
                </p>
              </div>
            </div>

            {/* Middle: Controls */}
            <div className="flex items-center gap-3 shrink-0">
              {onPrev && (
                <button
                  onClick={onPrev}
                  className="p-1.5 text-neutral-400 hover:text-white transition-colors hidden sm:block"
                  title="Previous"
                >
                  <SkipBack size={18} />
                </button>
              )}

              <button
                onClick={onPlayPause}
                className="w-10 h-10 rounded-full bg-white text-black hover:scale-105 active:scale-95 flex items-center justify-center shadow-lg transition-transform"
                title={isPlaying ? 'Pause' : 'Play'}
              >
                {isPlaying ? <Pause size={18} className="fill-black" /> : <Play size={18} className="fill-black ml-0.5" />}
              </button>

              {onNext && (
                <button
                  onClick={onNext}
                  className="p-1.5 text-neutral-400 hover:text-white transition-colors"
                  title="Next"
                >
                  <SkipForward size={18} />
                </button>
              )}
            </div>

            {/* Right: Expand / Lyrics / Close */}
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                onClick={() => {
                  setShowLyrics(true);
                  setIsExpanded(true);
                }}
                className="p-2 rounded-xl hover:bg-neutral-800 text-neutral-400 hover:text-emerald-300 transition-colors"
                title="Open Synced Lyrics"
              >
                <Mic2 size={16} />
              </button>

              <button
                onClick={() => setIsExpanded(true)}
                className="p-2 rounded-xl hover:bg-neutral-800 text-neutral-400 hover:text-white transition-colors"
                title="Expand Full Player"
              >
                <Maximize2 size={16} />
              </button>

              <button
                onClick={onClose}
                className="p-2 rounded-xl hover:bg-neutral-800 text-neutral-400 hover:text-red-400 transition-colors"
                title="Close Player"
              >
                <X size={16} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
