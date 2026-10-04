export interface MediaSessionCallbacks {
  onPlay?: () => void;
  onPause?: () => void;
  onSeek?: (positionMs: number) => void;
  onNext?: () => void;
  onPrevious?: () => void;
}

export class MediaSessionManager {
  private callbacks: MediaSessionCallbacks = {};

  constructor() {
    this.initActionHandlers();
  }

  public setCallbacks(callbacks: MediaSessionCallbacks): void {
    this.callbacks = { ...this.callbacks, ...callbacks };
  }

  private initActionHandlers(): void {
    if (!('mediaSession' in navigator)) return;

    try {
      navigator.mediaSession.setActionHandler('play', () => {
        this.callbacks.onPlay?.();
      });

      navigator.mediaSession.setActionHandler('pause', () => {
        this.callbacks.onPause?.();
      });

      navigator.mediaSession.setActionHandler('seekto', (details) => {
        if (details.seekTime !== undefined && details.seekTime !== null) {
          this.callbacks.onSeek?.(details.seekTime * 1000);
        }
      });

      navigator.mediaSession.setActionHandler('nexttrack', () => {
        this.callbacks.onNext?.();
      });

      navigator.mediaSession.setActionHandler('previoustrack', () => {
        this.callbacks.onPrevious?.();
      });
    } catch (e) {
      console.warn('[MediaSession] Failed to attach some action handlers:', e);
    }
  }

  public updateMetadata(track: {
    title: string;
    artist: string;
    album?: string;
    artworkUrl?: string;
  }): void {
    if (!('mediaSession' in navigator)) return;

    const artwork = track.artworkUrl
      ? [
          {
            src: track.artworkUrl,
            sizes: '512x512',
            type: 'image/jpeg',
          },
        ]
      : [];

    navigator.mediaSession.metadata = new MediaMetadata({
      title: track.title,
      artist: track.artist,
      album: track.album || 'SyncWave',
      artwork,
    });
  }

  public updatePositionState(state: {
    durationMs: number;
    positionMs: number;
    playbackRate?: number;
  }): void {
    if (!('mediaSession' in navigator) || !('setPositionState' in navigator.mediaSession)) return;

    try {
      const duration = Math.max(0, state.durationMs / 1000);
      const position = Math.min(duration, Math.max(0, state.positionMs / 1000));
      
      if (duration > 0 && position <= duration) {
        navigator.mediaSession.setPositionState({
          duration,
          playbackRate: state.playbackRate ?? 1.0,
          position,
        });
      }
    } catch (e) {
      // Browsers throw if position > duration or values are invalid
    }
  }

  public clear(): void {
    if (!('mediaSession' in navigator)) return;
    navigator.mediaSession.metadata = null;
  }
}

export const mediaSessionManager = new MediaSessionManager();
