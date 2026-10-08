import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Maximize2, Minimize2, Settings, Star } from 'lucide-react';
import { FloatingReactions } from './FloatingReactions';
import { usePlayerStore } from '../stores/playerStore';
import { mediaSessionManager } from '../player/MediaSessionManager.js';

declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: () => void;
  }
}

interface YouTubeSyncPlayerProps {
  videoId: string;
  isPlaying: boolean;
  positionMs: number;
  serverTimeMs: number;
  isLocallyPaused?: boolean;
  canControl: boolean;
  title?: string;
  onEnded?: () => void;
  onPlay?: () => void;
  onPause?: () => void;
  onSeek?: (posMs: number) => void;
  onTimeUpdate?: (currentMs: number, durationMs: number) => void;
  onSendReaction?: (emoji: string) => void;
}

const ALLOWED_EMOJIS = ['❤️', '🔥', '😂', '😮', '👏', '🎶', '😭', '🙌'];

const QUALITY_OPTIONS = [
  { label: 'Auto', value: 'default' },
  { label: '1080p HD', value: 'hd1080' },
  { label: '720p HD', value: 'hd720' },
  { label: '480p', value: 'large' },
  { label: '360p', value: 'medium' },
  { label: '240p', value: 'small' },
];

export function YouTubeSyncPlayer({
  videoId,
  isPlaying,
  positionMs,
  serverTimeMs,
  isLocallyPaused = false,
  canControl,
  title,
  onEnded,
  onPlay,
  onPause,
  onSeek: _onSeek,
  onTimeUpdate,
  onSendReaction,
}: YouTubeSyncPlayerProps) {
  const containerId = useRef(`yt-player-${Math.random().toString(36).slice(2, 9)}`).current;
  const playerWrapperRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<any>(null);
  const silentAudioRef = useRef<HTMLAudioElement | null>(null);

  const [isPlayerReady, setIsPlayerReady] = useState(false);
  const [autoplayBlocked, setAutoplayBlocked] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showReactionTray, setShowReactionTray] = useState(false);
  const [showQualityMenu, setShowQualityMenu] = useState(false);
  const [currentQuality, setCurrentQuality] = useState('default');
  const [recentEmojiFeedback, setRecentEmojiFeedback] = useState<string | null>(null);

  const isSyncingProgrammatically = useRef(false);
  const checkTimerRef = useRef<any>(null);
  const keepAliveCtxRef = useRef<AudioContext | null>(null);
  const keepAliveOscRef = useRef<OscillatorNode | null>(null);

  const reactions = usePlayerStore((s) => s.reactions);

  // 1-second inaudible WAV loop to retain mobile OS Audio Focus across iOS & Android screen-locks
  const SILENT_WAV_URI = 'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA';

  // 1. Load YouTube Iframe API script once
  useEffect(() => {
    if (!window.YT) {
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      const firstScriptTag = document.getElementsByTagName('script')[0];
      firstScriptTag?.parentNode?.insertBefore(tag, firstScriptTag);
    }
  }, []);

  // 2. Fullscreen event listener
  useEffect(() => {
    const handleFullscreenChange = () => {
      const isFull = !!(
        document.fullscreenElement ||
        (document as any).webkitFullscreenElement ||
        (document as any).mozFullScreenElement
      );
      setIsFullscreen(isFull);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('mozfullscreenchange', handleFullscreenChange);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
    };
  }, []);

  // 3. Audio & Web Audio Background Keep-Alive for Screen-Off / Background Tab Playback
  useEffect(() => {
    if (isPlaying && !isLocallyPaused) {
      try {
        // Start silent HTML5 audio loop to keep audio hardware & networking active
        if (!silentAudioRef.current) {
          const aud = new Audio(SILENT_WAV_URI);
          aud.loop = true;
          aud.volume = 0.01;
          silentAudioRef.current = aud;
        }
        silentAudioRef.current.play().catch(() => {});

        // Secondary Web Audio oscillator keep-alive
        if (!keepAliveCtxRef.current) {
          const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
          if (AudioCtx) {
            keepAliveCtxRef.current = new AudioCtx();
          }
        }
        if (keepAliveCtxRef.current?.state === 'suspended') {
          keepAliveCtxRef.current.resume().catch(() => {});
        }
        if (!keepAliveOscRef.current && keepAliveCtxRef.current) {
          const osc = keepAliveCtxRef.current.createOscillator();
          const gain = keepAliveCtxRef.current.createGain();
          gain.gain.value = 0.00001; // Inaudible
          osc.connect(gain);
          gain.connect(keepAliveCtxRef.current.destination);
          osc.start();
          keepAliveOscRef.current = osc;
        }
      } catch {}
    } else {
      if (silentAudioRef.current) {
        silentAudioRef.current.pause();
      }
      if (keepAliveOscRef.current) {
        try {
          keepAliveOscRef.current.stop();
          keepAliveOscRef.current.disconnect();
        } catch {}
        keepAliveOscRef.current = null;
      }
    }

    const handleVisibility = () => {
      if (document.hidden) {
        // Mobile screen locked or tab switched: ensure audio session persists
        if (isPlaying && !isLocallyPaused) {
          silentAudioRef.current?.play().catch(() => {});
          if (playerRef.current && typeof playerRef.current.playVideo === 'function') {
            try {
              playerRef.current.playVideo();
            } catch {}
          }
        }
      } else {
        // Mobile screen turned back on: restore web audio and sync position
        if (keepAliveCtxRef.current?.state === 'suspended') {
          keepAliveCtxRef.current.resume().catch(() => {});
        }
        if (isPlaying && !isLocallyPaused && playerRef.current) {
          try {
            const expectedSec = getExpectedSeconds();
            const curSec = typeof playerRef.current.getCurrentTime === 'function' ? playerRef.current.getCurrentTime() : 0;
            if (Math.abs(curSec - expectedSec) > 1.5) {
              playerRef.current.seekTo(expectedSec, true);
            }
            playerRef.current.playVideo();
          } catch {}
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [isPlaying, isLocallyPaused]);

  // Compute expected playback position
  const getExpectedSeconds = () => {
    if (!isPlaying || isLocallyPaused) {
      return Math.max(0, positionMs / 1000);
    }
    const elapsed = Math.max(0, Date.now() - serverTimeMs);
    return Math.max(0, (positionMs + elapsed) / 1000);
  };

  // 4. Initialize or update YouTube Player
  useEffect(() => {
    let isCancelled = false;

    const initPlayer = () => {
      if (isCancelled) return;
      if (!window.YT || !window.YT.Player) {
        setTimeout(initPlayer, 100);
        return;
      }

      if (playerRef.current) {
        try {
          playerRef.current.destroy();
        } catch {}
        playerRef.current = null;
        setIsPlayerReady(false);
      }

      const initialSec = getExpectedSeconds();

      playerRef.current = new window.YT.Player(containerId, {
        videoId,
        playerVars: {
          autoplay: isPlaying && !isLocallyPaused ? 1 : 0,
          controls: canControl ? 1 : 0,
          modestbranding: 1,
          rel: 0,
          start: Math.floor(initialSec),
          playsinline: 1,
          origin: window.location.origin,
        },
        events: {
          onReady: (event: any) => {
            if (isCancelled) return;
            setIsPlayerReady(true);
            setAutoplayBlocked(false);

            // Enable picture-in-picture and background playback on iframe
            try {
              const iframe = event.target.getIframe?.();
              if (iframe) {
                iframe.setAttribute('allow', 'autoplay; encrypted-media; picture-in-picture; accelerometer; clipboard-write; gyroscope');
                iframe.setAttribute('allowfullscreen', '1');
              }
            } catch {}

            // Register with mobile OS lock-screen MediaSession
            try {
              mediaSessionManager.updateMetadata({
                title: title || 'YouTube Live Sync',
                artist: 'YouTube Watch Party • SyncWave',
                artworkUrl: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
              });
              mediaSessionManager.setCallbacks({
                onPlay: () => {
                  if (canControl) onPlay?.();
                  else event.target.playVideo();
                },
                onPause: () => {
                  if (canControl) onPause?.();
                  else event.target.pauseVideo();
                },
                onSeek: (posMs) => {
                  _onSeek?.(posMs);
                },
                onNext: () => {
                  onEnded?.();
                },
              });
            } catch {}

            const expected = getExpectedSeconds();
            isSyncingProgrammatically.current = true;
            try {
              event.target.seekTo(expected, true);
              if (isPlaying && !isLocallyPaused) {
                event.target.playVideo();
              } else {
                event.target.pauseVideo();
              }
            } catch {}
            setTimeout(() => {
              isSyncingProgrammatically.current = false;
            }, 600);
          },
          onStateChange: (event: any) => {
            if (isCancelled || isSyncingProgrammatically.current) return;

            // YT.PlayerState: ENDED = 0, PLAYING = 1, PAUSED = 2, BUFFERING = 3
            if (event.data === 0) {
              onEnded?.();
            } else if (event.data === 1 && canControl && !isPlaying) {
              onPlay?.();
            } else if (event.data === 2 && canControl && isPlaying) {
              // Screen lock / tab switch on mobile automatically causes YouTube iframe to pause.
              // Crucial: do NOT pause the room for everyone! Keep playing audio.
              if (document.hidden) {
                try {
                  event.target.playVideo();
                } catch {}
                return;
              }
              onPause?.();
            }
          },
          onError: (err: any) => {
            console.warn('[YouTubeSyncPlayer] YouTube player error:', err);
          },
        },
      });
    };

    if (window.YT && window.YT.Player) {
      initPlayer();
    } else {
      const prevCallback = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        if (prevCallback) prevCallback();
        initPlayer();
      };
    }

    return () => {
      isCancelled = true;
      if (playerRef.current) {
        try {
          playerRef.current.destroy();
        } catch {}
        playerRef.current = null;
      }
    };
  }, [videoId, containerId]);

  // 5. React to isPlaying and positionMs updates from the room
  useEffect(() => {
    if (!isPlayerReady || !playerRef.current) return;
    const player = playerRef.current;
    if (typeof player.getPlayerState !== 'function') return;

    isSyncingProgrammatically.current = true;

    try {
      const expectedSec = getExpectedSeconds();
      const currentSec = typeof player.getCurrentTime === 'function' ? player.getCurrentTime() : 0;
      const drift = Math.abs(currentSec - expectedSec);

      if (drift > 1.5) {
        player.seekTo(expectedSec, true);
      }

      if (isPlaying && !isLocallyPaused) {
        player.playVideo();
      } else {
        player.pauseVideo();
      }
    } catch (err) {
      console.warn('[YouTubeSyncPlayer] Sync error:', err);
    } finally {
      setTimeout(() => {
        isSyncingProgrammatically.current = false;
      }, 500);
    }
  }, [isPlaying, positionMs, serverTimeMs, isLocallyPaused, isPlayerReady]);

  // 6. Continuous Drift Check & Time Reporting
  useEffect(() => {
    if (!isPlayerReady || !playerRef.current) return;

    checkTimerRef.current = setInterval(() => {
      const player = playerRef.current;
      if (!player || typeof player.getCurrentTime !== 'function') return;

      try {
        const curSec = player.getCurrentTime() || 0;
        const durSec = (typeof player.getDuration === 'function' ? player.getDuration() : 0) || 0;
        onTimeUpdate?.(curSec * 1000, durSec * 1000);

        if (durSec > 0) {
          mediaSessionManager.updatePositionState({
            durationMs: durSec * 1000,
            positionMs: curSec * 1000,
            playbackRate: 1.0,
          });
        }

        if (isPlaying && !isLocallyPaused && !isSyncingProgrammatically.current) {
          const expectedSec = getExpectedSeconds();
          const drift = Math.abs(curSec - expectedSec);
          if (drift > 2.0) {
            isSyncingProgrammatically.current = true;
            player.seekTo(expectedSec, true);
            setTimeout(() => {
              isSyncingProgrammatically.current = false;
            }, 500);
          }
        }
      } catch {}
    }, 500);

    return () => {
      if (checkTimerRef.current) {
        clearInterval(checkTimerRef.current);
        checkTimerRef.current = null;
      }
    };
  }, [isPlaying, isLocallyPaused, isPlayerReady, serverTimeMs, positionMs]);

  const handleManualPlay = () => {
    if (playerRef.current && typeof playerRef.current.playVideo === 'function') {
      setAutoplayBlocked(false);
      playerRef.current.playVideo();
    }
  };

  const handleToggleFullscreen = async () => {
    try {
      if (!isFullscreen) {
        const elem = playerWrapperRef.current;
        if (!elem) return;
        if (elem.requestFullscreen) {
          await elem.requestFullscreen();
        } else if ((elem as any).webkitRequestFullscreen) {
          await (elem as any).webkitRequestFullscreen();
        } else if ((elem as any).mozRequestFullScreen) {
          await (elem as any).mozRequestFullScreen();
        }
      } else {
        if (document.exitFullscreen) {
          await document.exitFullscreen();
        } else if ((document as any).webkitExitFullscreen) {
          await (document as any).webkitExitFullscreen();
        } else if ((document as any).mozCancelFullScreen) {
          await (document as any).mozCancelFullScreen();
        }
      }
    } catch (err) {
      console.warn('[YouTubeSyncPlayer] Fullscreen toggle error:', err);
    }
  };

  const handleChangeQuality = (qValue: string) => {
    setCurrentQuality(qValue);
    setShowQualityMenu(false);
    if (playerRef.current && typeof playerRef.current.setPlaybackQuality === 'function') {
      try {
        playerRef.current.setPlaybackQuality(qValue);
      } catch {}
    }
  };

  const handleSendEmoji = (emoji: string) => {
    setRecentEmojiFeedback(emoji);
    setTimeout(() => setRecentEmojiFeedback(null), 1000);
    onSendReaction?.(emoji);
  };

  return (
    <div
      ref={playerWrapperRef}
      className={`relative w-full aspect-video rounded-3xl overflow-hidden bg-black shadow-2xl border border-white/10 group ${
        isFullscreen ? 'fixed inset-0 !w-screen !h-screen !rounded-none z-[9999] border-none' : ''
      }`}
    >
      {/* Underlying IFrame Player */}
      <div id={containerId} className="w-full h-full" />

      {/* Floating Live Reactions Over Video Layer (Works in normal and fullscreen modes!) */}
      <FloatingReactions incomingReactions={reactions} />

      {/* Top Banner Header */}
      {title && (
        <div className="absolute top-0 inset-x-0 bg-gradient-to-b from-black/85 via-black/40 to-transparent p-3 sm:p-4 opacity-90 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity pointer-events-none z-30">
          <div className="flex items-center gap-2">
            <span className="text-red-500 text-xs sm:text-sm font-bold flex items-center gap-1">
              ▶ YouTube Live Sync
            </span>
            <span className="text-white text-xs font-semibold truncate max-w-md">{title}</span>
          </div>
        </div>
      )}

      {/* Interactive Floating Action Bar (Top Right) */}
      <div className="absolute top-3 right-3 flex items-center gap-2 z-40 opacity-90 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
        {/* Quality Selector */}
        <div className="relative">
          <button
            onClick={() => {
              setShowQualityMenu(!showQualityMenu);
              setShowReactionTray(false);
            }}
            className="p-2 rounded-xl bg-black/70 hover:bg-black/90 text-white/90 hover:text-white border border-white/15 backdrop-blur-md transition-all shadow-lg flex items-center gap-1 text-xs font-semibold"
            title="Video Quality"
          >
            <Settings className="w-3.5 h-3.5" />
            <span className="text-[10px]">
              {QUALITY_OPTIONS.find((q) => q.value === currentQuality)?.label || 'Auto'}
            </span>
          </button>

          <AnimatePresence>
            {showQualityMenu && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9, y: -5 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: -5 }}
                className="absolute right-0 mt-1.5 w-32 bg-neutral-900/95 border border-white/15 rounded-xl shadow-2xl p-1 backdrop-blur-xl z-50 flex flex-col gap-0.5"
              >
                {QUALITY_OPTIONS.map((q) => (
                  <button
                    key={q.value}
                    onClick={() => handleChangeQuality(q.value)}
                    className={`text-left px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center justify-between ${
                      currentQuality === q.value
                        ? 'bg-indigo-600 text-white font-bold'
                        : 'text-neutral-300 hover:bg-white/10'
                    }`}
                  >
                    <span>{q.label}</span>
                    {currentQuality === q.value && <span className="text-[10px]">✓</span>}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Fullscreen Toggle Button */}
        <button
          onClick={handleToggleFullscreen}
          className="p-2 rounded-xl bg-black/70 hover:bg-black/90 text-white/90 hover:text-white border border-white/15 backdrop-blur-md transition-all shadow-lg flex items-center gap-1 text-xs font-semibold"
          title={isFullscreen ? 'Exit Fullscreen (Esc)' : 'Scale to Fullscreen'}
        >
          {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
        </button>
      </div>

      {/* Floating SYNC WAVE STAR (⭐) Reaction Button (Bottom-Right / In-Fullscreen) */}
      <div className="absolute bottom-4 right-4 z-40 flex flex-col items-end gap-2">
        <AnimatePresence>
          {showReactionTray && (
            <motion.div
              initial={{ opacity: 0, scale: 0.85, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.85, y: 10 }}
              className="bg-black/80 border border-white/20 backdrop-blur-xl rounded-2xl p-2 shadow-2xl flex items-center gap-1.5"
            >
              {ALLOWED_EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => handleSendEmoji(emoji)}
                  className="w-9 h-9 rounded-xl hover:bg-white/15 active:scale-125 transition-all text-xl flex items-center justify-center filter drop-shadow hover:scale-110"
                >
                  {emoji}
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        <button
          onClick={() => {
            setShowReactionTray(!showReactionTray);
            setShowQualityMenu(false);
          }}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-2xl backdrop-blur-md border transition-all shadow-xl font-bold text-xs select-none ${
            showReactionTray
              ? 'bg-amber-500 text-black border-amber-300 shadow-amber-500/30 ring-2 ring-amber-400'
              : 'bg-black/70 hover:bg-black/90 text-amber-300 hover:text-amber-200 border-amber-400/30 hover:border-amber-400/60'
          }`}
          title="Send Live Emoji Reaction"
        >
          <Star className="w-4 h-4 fill-amber-400 text-amber-400 animate-spin-slow" />
          <span>Sync Star</span>
          {recentEmojiFeedback && (
            <span className="text-base animate-ping">{recentEmojiFeedback}</span>
          )}
        </button>
      </div>

      {/* Autoplay blocked fallback banner */}
      {autoplayBlocked && (
        <div
          onClick={handleManualPlay}
          className="absolute inset-0 bg-black/85 flex flex-col items-center justify-center gap-3 cursor-pointer z-50 backdrop-blur-sm"
        >
          <div className="w-16 h-16 rounded-full bg-red-600 flex items-center justify-center text-white text-2xl shadow-xl animate-pulse">
            ▶
          </div>
          <p className="text-white font-bold text-sm">Click to start synchronized video</p>
        </div>
      )}
    </div>
  );
}
