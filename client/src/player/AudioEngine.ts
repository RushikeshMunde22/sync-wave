import { mediaSessionManager } from './MediaSessionManager.js';

export interface PlaybackStatePayload {
  trackId: string | null;
  isPlaying: boolean;
  positionMs: number;
  serverTimeMs: number;
  version: number;
  controlledBy: string | null;
  mediaType?: 'audio' | 'video';
  videoId?: string;
  track?: {
    id: string;
    title: string;
    artist: string;
    artworkUrl?: string;
    durationMs: number;
    streamUrl?: string;
    mediaType?: 'audio' | 'video';
    videoId?: string;
  };
}

export type PresenceStatus = 'listening' | 'paused' | 'buffering';

export interface AudioEngineCallbacks {
  onPresenceChange?: (status: PresenceStatus) => void;
  onEnded?: (payload: { trackId: string; version: number }) => void;
  onAutoplayBlocked?: (blocked: boolean) => void;
  onTimeUpdate?: (currentMs: number, durationMs: number) => void;
  onError?: (errorMessage: string) => void;
}

export class AudioEngine {
  private static instance: AudioEngine | null = null;
  private audio: HTMLAudioElement;
  private clockOffset: number = 0;
  private lastPlaybackState: PlaybackStatePayload | null = null;
  private currentTrackId: string | null = null;
  private currentStreamUrl: string | null = null;
  private driftTimer: any = null;
  private isLocallyPaused: boolean = false;
  private autoplayBlocked: boolean = false;
  private callbacks: AudioEngineCallbacks = {};
  private keepAliveCtx: AudioContext | null = null;

  private constructor() {
    this.audio = new Audio();
    this.audio.preload = 'auto';
    this.audio.crossOrigin = 'anonymous';

    // Preserve pitch during rate-based drift adjustments (Tier 2)
    (this.audio as any).preservesPitch = true;
    (this.audio as any).mozPreservesPitch = true;
    (this.audio as any).webkitPreservesPitch = true;

    this.attachEventListeners();
    this.setupBackgroundWakeHandler();
  }

  private setupBackgroundWakeHandler(): void {
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (!document.hidden && this.lastPlaybackState?.isPlaying && !this.isLocallyPaused) {
          if (this.audio.paused) {
            this.playAudio();
          }
          if (this.keepAliveCtx?.state === 'suspended') {
            this.keepAliveCtx.resume().catch(() => {});
          }
        }
      });
    }
  }

  private startKeepAlive(): void {
    // HTML5 <audio> element directly commands native audio focus and MediaSession.
  }

  private stopKeepAlive(): void {
  }

  public static getInstance(): AudioEngine {
    if (!AudioEngine.instance) {
      AudioEngine.instance = new AudioEngine();
    }
    return AudioEngine.instance;
  }

  public setCallbacks(callbacks: AudioEngineCallbacks): void {
    this.callbacks = { ...this.callbacks, ...callbacks };
  }

  public setClockOffset(offsetMs: number): void {
    this.clockOffset = offsetMs;
  }

  public getClockOffset(): number {
    return this.clockOffset;
  }

  public isAutoplayBlocked(): boolean {
    return this.autoplayBlocked;
  }

  public getIsLocallyPaused(): boolean {
    return this.isLocallyPaused;
  }

  public setLocallyPaused(paused: boolean): void {
    this.isLocallyPaused = paused;
    if (paused) {
      this.audio.pause();
      this.callbacks.onPresenceChange?.('paused');
    } else {
      if (this.lastPlaybackState?.isPlaying) {
        this.syncWithState(this.lastPlaybackState);
      }
    }
  }

  private attachEventListeners(): void {
    this.audio.addEventListener('waiting', () => {
      this.callbacks.onPresenceChange?.('buffering');
    });

    this.audio.addEventListener('stalled', () => {
      this.callbacks.onPresenceChange?.('buffering');
    });

    this.audio.addEventListener('playing', () => {
      this.autoplayBlocked = false;
      this.callbacks.onAutoplayBlocked?.(false);
      this.callbacks.onPresenceChange?.('listening');
    });

    this.audio.addEventListener('pause', () => {
      if (!this.lastPlaybackState?.isPlaying || this.isLocallyPaused) {
        this.callbacks.onPresenceChange?.('paused');
      }
    });

    this.audio.addEventListener('timeupdate', () => {
      const currentMs = this.audio.currentTime * 1000;
      const durationMs = (this.audio.duration || 0) * 1000;
      this.callbacks.onTimeUpdate?.(currentMs, durationMs);

      if (this.lastPlaybackState?.track) {
        mediaSessionManager.updatePositionState({
          durationMs: this.lastPlaybackState.track.durationMs || durationMs,
          positionMs: currentMs,
          playbackRate: this.audio.playbackRate,
        });
      }
    });

    this.audio.addEventListener('ended', () => {
      if (this.lastPlaybackState && this.currentTrackId) {
        this.callbacks.onEnded?.({
          trackId: this.currentTrackId,
          version: this.lastPlaybackState.version,
        });
      }
    });

    this.audio.addEventListener('error', () => {
      // If stopped, unloaded, or no active track, ignore benign empty-src clearing
      if (!this.currentTrackId || !this.currentStreamUrl) {
        return;
      }
      const err = this.audio.error;
      // Code 4: MEDIA_ELEMENT_ERROR: Empty src attribute
      if (err?.code === 4 && (!this.audio.src || this.audio.src === window.location.href || this.audio.src === '')) {
        return;
      }

      // If direct stream URL failed, retry via server proxy endpoint
      if (this.currentStreamUrl && !this.currentStreamUrl.includes('/api/music/stream/') && this.currentTrackId?.includes(':')) {
        const [prov, ...r] = this.currentTrackId.split(':');
        const fallbackUrl = `/api/music/stream/${prov}/${r.join(':')}`;
        console.warn('[AudioEngine] Direct stream failed, falling back to server stream proxy:', fallbackUrl);
        this.currentStreamUrl = fallbackUrl;
        this.audio.src = fallbackUrl;
        this.audio.load();
        if (this.lastPlaybackState?.isPlaying && !this.isLocallyPaused) {
          this.audio.play().catch(() => {});
        }
        return;
      }

      const msg = err ? `Audio playback error (code ${err.code}): ${err.message}` : 'Unknown audio error';
      console.error('[AudioEngine]', msg);
      this.callbacks.onError?.(msg);
    });
  }

  public getExpectedPositionMs(): number {
    if (!this.lastPlaybackState) return 0;
    if (!this.lastPlaybackState.isPlaying) {
      return this.lastPlaybackState.positionMs;
    }
    const estimatedServerNow = Date.now() + this.clockOffset;
    const elapsed = Math.max(0, estimatedServerNow - this.lastPlaybackState.serverTimeMs);
    const expected = this.lastPlaybackState.positionMs + elapsed;
    const duration = this.lastPlaybackState.track?.durationMs;
    return duration ? Math.min(expected, duration) : expected;
  }

  public syncWithState(state: PlaybackStatePayload): void {
    this.lastPlaybackState = state;

    if (this.isLocallyPaused) {
      return;
    }

    const track = state.track;

    // 1. If no track or no trackId, stop audio
    if (!state.trackId || !track) {
      this.stop();
      this.currentTrackId = null;
      this.currentStreamUrl = null;
      mediaSessionManager.clear();
      return;
    }

    // If mediaType is video, let YouTubeSyncPlayer handle playback
    if (state.mediaType === 'video' || track.mediaType === 'video') {
      this.stop();
      this.currentTrackId = state.trackId;
      this.currentStreamUrl = null;
      return;
    }

    let streamUrl = track.streamUrl;
    if (!streamUrl && state.trackId.includes(':')) {
      const [prov, ...r] = state.trackId.split(':');
      streamUrl = `/api/music/stream/${prov}/${r.join(':')}`;
    }

    const isNewTrack = this.currentTrackId !== state.trackId || this.currentStreamUrl !== streamUrl;

    if (isNewTrack && streamUrl) {
      this.currentTrackId = state.trackId;
      this.currentStreamUrl = streamUrl;
      this.audio.src = streamUrl;
      this.audio.load();

      mediaSessionManager.updateMetadata({
        title: track.title,
        artist: track.artist,
        artworkUrl: track.artworkUrl,
      });

      // Synchronize currentTime once audio metadata (duration & seekable) is ready
      const onMetadataLoaded = () => {
        if (!this.lastPlaybackState?.isPlaying) return;
        const syncMs = this.getExpectedPositionMs();
        try {
          this.audio.currentTime = Math.max(0, syncMs / 1000);
        } catch {
          // ignore seek error if audio still preparing
        }
        this.performDriftCheck();
      };

      if (this.audio.readyState >= 1) {
        onMetadataLoaded();
      } else {
        this.audio.addEventListener('loadedmetadata', onMetadataLoaded, { once: true });
      }
    }

    const expectedPositionMs = this.getExpectedPositionMs();

    if (!state.isPlaying) {
      // Room is paused
      this.stopDriftLoop();
      this.audio.pause();
      this.stopKeepAlive();
      this.audio.playbackRate = 1.0;
      this.audio.currentTime = Math.max(0, state.positionMs / 1000);
      return;
    }

    // Room is playing
    if (isNewTrack && this.audio.readyState >= 1) {
      this.audio.currentTime = Math.max(0, expectedPositionMs / 1000);
    }

    this.playAudio();
    this.startDriftLoop();
    this.performDriftCheck();
  }

  private playAudio(): void {
    if (this.audio.paused) {
      this.startKeepAlive();
      const playPromise = this.audio.play();
      if (playPromise !== undefined) {
        playPromise.catch((error) => {
          if (error.name === 'NotAllowedError') {
            console.warn('[AudioEngine] Autoplay was prevented by browser policy. User gesture required.');
            this.autoplayBlocked = true;
            this.callbacks.onAutoplayBlocked?.(true);
          } else {
            console.error('[AudioEngine] Error attempting to play audio:', error);
          }
        });
      }
    }
  }

  public async resumeAutoplay(): Promise<void> {
    try {
      this.autoplayBlocked = false;
      this.callbacks.onAutoplayBlocked?.(false);
      await this.audio.play();
      if (this.lastPlaybackState?.isPlaying) {
        this.syncWithState(this.lastPlaybackState);
      }
    } catch (err) {
      console.warn('[AudioEngine] Failed to resume autoplay:', err);
    }
  }

  private startDriftLoop(): void {
    if (this.driftTimer) return;
    this.driftTimer = setInterval(() => {
      this.performDriftCheck();
    }, 1000);
  }

  private stopDriftLoop(): void {
    if (this.driftTimer) {
      clearInterval(this.driftTimer);
      this.driftTimer = null;
    }
  }

  /**
   * Smooth Multi-Device Drift Correction:
   * Tier 1: |drift| < 100ms -> In sync deadband, playbackRate = 1.0 (no audio artifacts)
   * Tier 2: 100ms <= |drift| <= 1800ms -> Gentle pitch-preserved micro-adjust (1.025x if behind, 0.975x if ahead)
   * Tier 3: |drift| > 1800ms -> Hard snap to expected position, restore rate = 1.0
   */
  public performDriftCheck(): void {
    if (!this.lastPlaybackState || !this.lastPlaybackState.isPlaying || this.isLocallyPaused || this.audio.paused) {
      return;
    }

    const expectedMs = this.getExpectedPositionMs();
    const currentMs = this.audio.currentTime * 1000;
    const driftMs = currentMs - expectedMs;
    const absDriftMs = Math.abs(driftMs);

    if (absDriftMs > 1800) {
      // Tier 3: Hard seek only on large discrepancy
      this.audio.currentTime = Math.max(0, expectedMs / 1000);
      this.audio.playbackRate = 1.0;
    } else if (absDriftMs >= 100) {
      // Tier 2: Smooth micro-rate adjustment (100ms - 1800ms)
      if (driftMs < 0) {
        // Audio is behind server -> speed up smoothly
        this.audio.playbackRate = 1.025;
      } else {
        // Audio is ahead of server -> slow down smoothly
        this.audio.playbackRate = 0.975;
      }
    } else {
      // Tier 1: In deadband (< 100ms) - restore normal speed
      if (this.audio.playbackRate !== 1.0) {
        this.audio.playbackRate = 1.0;
      }
    }
  }

  public stop(): void {
    this.stopDriftLoop();
    this.stopKeepAlive();
    this.audio.pause();
    this.audio.currentTime = 0;
    this.currentTrackId = null;
    this.currentStreamUrl = null;
    this.audio.removeAttribute('src');
    try {
      this.audio.load();
    } catch {}
    this.audio.playbackRate = 1.0;
  }

  public getCurrentTime(): number {
    return this.audio.currentTime;
  }

  public getDuration(): number {
    return this.audio.duration || 0;
  }

  public isPlaying(): boolean {
    return !this.audio.paused;
  }
}

export function calculateClockOffset(t0: number, ts: number, t1: number): number {
  const rtt = t1 - t0;
  const oneWayLatency = rtt / 2;
  return ts + oneWayLatency - t1;
}

export const audioEngine = AudioEngine.getInstance();
