import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronUp, ChevronDown, Plus, Sparkles, Lock, Share2, Volume2, VolumeX } from 'lucide-react';
import { FloatingReactions } from './FloatingReactions';
import { usePlayerStore } from '../stores/playerStore';

interface YouTubeShortsPlayerProps {
  videoId?: string;
  isPlaying: boolean;
  canControl: boolean;
  onPlayShort: (short: { videoId: string; title: string; channel: string }) => void;
  onSendReaction?: (emoji: string) => void;
}

// Curated high-energy trending shorts for instant playback
const DEFAULT_SHORTS = [
  { videoId: 'dQw4w9WgXcQ', title: 'Viral Soundwave', channel: 'Music Official' },
  { videoId: 'kJQP7kiw5Fk', title: 'Despacito Beats', channel: 'Luis Fonsi' },
  { videoId: '9bZkp7q19f0', title: 'Gangnam Style Flash', channel: 'Psy Official' },
  { videoId: 'JGwWNGJdvx8', title: 'Shape of You Acoustic', channel: 'Ed Sheeran' },
  { videoId: 'CevxZvSJLk8', title: 'Roar Anthem', channel: 'Katy Perry' },
  { videoId: 'fJ9rUzIMcZQ', title: 'Bohemian Rhapsody Live', channel: 'Queen' },
];

export function YouTubeShortsPlayer({
  videoId = 'dQw4w9WgXcQ',
  isPlaying,
  canControl,
  onPlayShort,
  onSendReaction,
}: YouTubeShortsPlayerProps) {
  const containerId = useRef(`yt-shorts-${Math.random().toString(36).slice(2, 9)}`).current;
  const playerRef = useRef<any>(null);
  const [isReady, setIsReady] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [shortsList, setShortsList] = useState(DEFAULT_SHORTS);
  const [inputUrl, setInputUrl] = useState('');
  const [pasteError, setPasteError] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [noticeMessage, setNoticeMessage] = useState<string | null>(null);

  const reactions = usePlayerStore((s) => s.reactions);

  // Find active short index
  const currentIndex = shortsList.findIndex((s) => s.videoId === videoId);
  const currentShort = (currentIndex >= 0 && shortsList[currentIndex]) ? shortsList[currentIndex]! : { videoId, title: 'YouTube Short', channel: 'Synced Reel' };

  // 1. Ensure YouTube Iframe API is loaded
  useEffect(() => {
    if (!window.YT) {
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      const firstScriptTag = document.getElementsByTagName('script')[0];
      firstScriptTag?.parentNode?.insertBefore(tag, firstScriptTag);
    }
  }, []);

  // 2. Initialize YouTube player
  useEffect(() => {
    let checkInterval: any = null;

    const initPlayer = () => {
      if (!window.YT?.Player) return;

      if (playerRef.current) {
        try {
          playerRef.current.destroy();
        } catch {}
      }

      try {
        playerRef.current = new window.YT.Player(containerId, {
          videoId,
          playerVars: {
            autoplay: isPlaying ? 1 : 0,
            controls: 1,
            modestbranding: 1,
            rel: 0,
            playsinline: 1,
            loop: 1,
            playlist: videoId,
            origin: window.location.origin,
          },
          events: {
            onReady: (event: any) => {
              setIsReady(true);
              if (isPlaying) {
                event.target.playVideo();
              }
            },
            onStateChange: (event: any) => {
              if (event.data === 0) { // ENDED -> auto-loop current short or advance
                event.target.playVideo();
              }
            },
          },
        });
      } catch (err) {
        console.error('[YouTubeShortsPlayer] Init error:', err);
      }
    };

    if (window.YT?.Player) {
      initPlayer();
    } else {
      checkInterval = setInterval(() => {
        if (window.YT?.Player) {
          clearInterval(checkInterval);
          initPlayer();
        }
      }, 100);
    }

    return () => {
      if (checkInterval) clearInterval(checkInterval);
      try {
        if (playerRef.current) playerRef.current.destroy();
      } catch {}
    };
  }, [containerId, videoId]);

  // 3. Play/Pause sync
  useEffect(() => {
    if (!isReady || !playerRef.current?.playVideo) return;
    try {
      if (isPlaying) {
        playerRef.current.playVideo();
      } else {
        playerRef.current.pauseVideo();
      }
    } catch {}
  }, [isPlaying, isReady]);

  // Scroll / Advance handlers
  const handleNext = () => {
    if (!canControl) {
      showPermissionNotice();
      return;
    }
    const nextIdx = (currentIndex + 1) % shortsList.length;
    const targetShort = shortsList[nextIdx] || shortsList[0];
    if (targetShort) {
      onPlayShort(targetShort);
    }
  };

  const handlePrev = () => {
    if (!canControl) {
      showPermissionNotice();
      return;
    }
    const prevIdx = (currentIndex - 1 + shortsList.length) % shortsList.length;
    const targetShort = shortsList[prevIdx] || shortsList[0];
    if (targetShort) {
      onPlayShort(targetShort);
    }
  };

  const showPermissionNotice = () => {
    setNoticeMessage('🔒 Only Room Host & authorized DJs can scroll shorts. Ask the host for control permission!');
    setTimeout(() => setNoticeMessage(null), 3500);
  };

  // Add / Paste YouTube Short URL
  const handleAddShort = (e: React.FormEvent) => {
    e.preventDefault();
    setPasteError('');
    if (!inputUrl.trim()) return;

    // Extract video ID from youtube.com/shorts/XYZ or standard URL
    let vid: string | null = null;
    const clean = inputUrl.trim();

    const shortsMatch = clean.match(/youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/);
    if (shortsMatch && shortsMatch[1]) vid = shortsMatch[1];

    if (!vid) {
      const watchMatch = clean.match(/[?&]v=([a-zA-Z0-9_-]{11})/);
      if (watchMatch && watchMatch[1]) vid = watchMatch[1];
    }

    if (!vid) {
      const shortUrlMatch = clean.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/);
      if (shortUrlMatch && shortUrlMatch[1]) vid = shortUrlMatch[1];
    }

    if (!vid && /^[a-zA-Z0-9_-]{11}$/.test(clean)) {
      vid = clean;
    }

    if (!vid) {
      setPasteError('Invalid YouTube Shorts link. Please paste a valid youtube.com/shorts/ link.');
      return;
    }

    const newShort = {
      videoId: vid,
      title: `Custom Short (${vid.slice(0, 6)})`,
      channel: 'User Shared',
    };

    setShortsList((prev) => [newShort, ...prev]);
    setInputUrl('');
    setShowAddModal(false);

    if (canControl) {
      onPlayShort(newShort);
    }
  };

  const toggleMute = () => {
    if (!playerRef.current) return;
    try {
      if (isMuted) {
        playerRef.current.unMute();
        setIsMuted(false);
      } else {
        playerRef.current.mute();
        setIsMuted(true);
      }
    } catch {}
  };

  return (
    <div className="relative w-full flex flex-col items-center justify-center p-2 sm:p-4 select-none">
      {/* Floating Reactions Overlay */}
      <FloatingReactions incomingReactions={reactions} />

      {/* Permission Notice Banner */}
      <AnimatePresence>
        {noticeMessage && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            className="absolute top-2 z-50 max-w-sm bg-neutral-900/95 border border-amber-500/40 text-amber-300 text-xs px-4 py-2.5 rounded-2xl shadow-2xl backdrop-blur-md text-center"
          >
            {noticeMessage}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Shorts Container - Vertical 9:16 Aspect Ratio */}
      <div className="relative w-full max-w-[340px] sm:max-w-[380px] aspect-[9/16] bg-black rounded-3xl overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.9),inset_0_1px_1px_rgba(255,255,255,0.15)] border border-white/10 group">
        {/* YouTube Video Embed */}
        <div className="w-full h-full relative">
          <div id={containerId} className="w-full h-full object-cover" />
        </div>

        {/* Top Header Overlay */}
        <div className="absolute top-0 inset-x-0 p-4 bg-gradient-to-b from-black/80 via-black/40 to-transparent flex items-center justify-between z-20 pointer-events-auto">
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-600/90 text-white text-[11px] font-bold shadow-lg shadow-red-600/30">
              <Sparkles className="w-3 h-3" /> Shorts Sync
            </span>
            <span className="text-[11px] font-mono text-white/80 bg-black/60 px-2 py-0.5 rounded-full border border-white/10">
              {currentIndex >= 0 ? `${currentIndex + 1}/${shortsList.length}` : '1/1'}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={toggleMute}
              className="p-2 rounded-full bg-black/60 hover:bg-black/90 text-white border border-white/10 transition-colors"
              title={isMuted ? 'Unmute' : 'Mute'}
            >
              {isMuted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4" />}
            </button>
            <button
              onClick={() => setShowAddModal(true)}
              className="p-2 rounded-full bg-black/60 hover:bg-black/90 text-white border border-white/10 transition-colors"
              title="Add YouTube Short Link"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Bottom Details Overlay */}
        <div className="absolute bottom-0 inset-x-0 p-4 bg-gradient-to-t from-black/95 via-black/60 to-transparent z-20 flex flex-col pointer-events-auto">
          <div className="text-white">
            <h3 className="font-bold text-sm sm:text-base line-clamp-1 text-white drop-shadow">
              {currentShort.title}
            </h3>
            <p className="text-xs text-neutral-300 font-medium line-clamp-1 drop-shadow mt-0.5">
              @{currentShort.channel}
            </p>
          </div>

          {/* Quick Reaction Tray */}
          <div className="flex items-center gap-2 mt-3 pt-2 border-t border-white/10 overflow-x-auto scrollbar-none">
            {['❤️', '🔥', '😂', '👏', '🚀'].map((emoji) => (
              <button
                key={emoji}
                onClick={() => onSendReaction?.(emoji)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 active:scale-95 flex items-center justify-center text-sm transition-transform border border-white/10"
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>

        {/* Floating Side Action Controls (Scroll Navigation) */}
        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex flex-col gap-3 z-30 pointer-events-auto">
          {/* Scroll Up / Prev Short */}
          <button
            onClick={handlePrev}
            className={`w-11 h-11 rounded-full flex items-center justify-center shadow-xl backdrop-blur-md transition-all ${
              canControl
                ? 'bg-neutral-900/90 hover:bg-white text-white hover:text-black border border-white/20 active:scale-90'
                : 'bg-neutral-900/60 text-white/40 border border-white/10 cursor-not-allowed'
            }`}
            title={canControl ? 'Previous Short (Scroll Up)' : 'Host Only Controls'}
          >
            {canControl ? <ChevronUp className="w-6 h-6" /> : <Lock className="w-4 h-4" />}
          </button>

          {/* Scroll Down / Next Short */}
          <button
            onClick={handleNext}
            className={`w-11 h-11 rounded-full flex items-center justify-center shadow-xl backdrop-blur-md transition-all ${
              canControl
                ? 'bg-neutral-900/90 hover:bg-white text-white hover:text-black border border-white/20 active:scale-90'
                : 'bg-neutral-900/60 text-white/40 border border-white/10 cursor-not-allowed'
            }`}
            title={canControl ? 'Next Short (Scroll Down)' : 'Host Only Controls'}
          >
            {canControl ? <ChevronDown className="w-6 h-6" /> : <Lock className="w-4 h-4" />}
          </button>

          {/* Share Room Button */}
          <button
            onClick={() => {
              if (navigator.clipboard) {
                navigator.clipboard.writeText(window.location.href);
                setNoticeMessage('✓ Room link copied to clipboard!');
                setTimeout(() => setNoticeMessage(null), 2500);
              }
            }}
            className="w-11 h-11 rounded-full bg-neutral-900/80 hover:bg-neutral-800 text-white border border-white/20 flex items-center justify-center shadow-xl transition-all active:scale-90"
            title="Share Shorts Room"
          >
            <Share2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Control Banner Indicator */}
      <div className="mt-3 flex items-center gap-2 text-xs text-neutral-400">
        {canControl ? (
          <span className="flex items-center gap-1.5 text-emerald-400 font-semibold bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20">
            <span>🎮</span> You have scroll authority (click ⬆/⬇ to switch for everyone)
          </span>
        ) : (
          <span className="flex items-center gap-1.5 text-neutral-400 bg-neutral-900/80 px-3 py-1 rounded-full border border-white/10">
            <span>🔒</span> Scrolling is synchronized by the Room Host
          </span>
        )}
      </div>

      {/* Add Short Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-neutral-900 rounded-3xl p-6 border border-white/10 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-base font-bold text-white flex items-center gap-2">
                <span>🎬</span> Add YouTube Short Link
              </h4>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-neutral-400 hover:text-white p-1 text-sm"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-neutral-400">
              Paste any YouTube Shorts URL (e.g. <code className="text-indigo-400">youtube.com/shorts/...</code>) or standard YouTube video ID to add it to the room's reels feed.
            </p>

            {pasteError && (
              <div className="p-2.5 rounded-xl bg-red-500/20 border border-red-500/30 text-red-300 text-xs">
                {pasteError}
              </div>
            )}

            <form onSubmit={handleAddShort} className="space-y-4">
              <input
                type="text"
                placeholder="https://www.youtube.com/shorts/..."
                value={inputUrl}
                onChange={(e) => setInputUrl(e.target.value)}
                autoFocus
                className="w-full bg-neutral-950 border border-white/10 rounded-xl px-4 py-3 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-white/30"
              />

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-xl text-xs text-neutral-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs shadow-lg shadow-red-600/30"
                >
                  Play Short
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
