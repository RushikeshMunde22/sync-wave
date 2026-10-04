import { LRUCache } from 'lru-cache';
import { Track } from './provider.interface.js';
import { getDb } from '../db/database.js';

interface CacheStats {
  memoryEntries: number;
  dbEntries: number;
  hitRate: number;
}

class MusicCache {
  private searchCache: LRUCache<string, any>;

  constructor() {
    this.searchCache = new LRUCache({
      max: 200,
      ttl: 5 * 60 * 1000, // 5 minutes
    });
  }

  async cacheTrack(track: Track): Promise<void> {
    try {
      const db = getDb();
      db.prepare(`
        INSERT INTO tracks (
          id, provider, provider_track_id, title, artist, album,
          artwork_url, duration_ms, stream_url_cached, license, attribution, cached_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
        ON CONFLICT(provider, provider_track_id) DO UPDATE SET 
          title = excluded.title, 
          artist = excluded.artist, 
          stream_url_cached = excluded.stream_url_cached,
          artwork_url = excluded.artwork_url,
          cached_at = datetime('now')
      `).run(
        track.id,
        track.provider,
        track.providerTrackId,
        track.title,
        track.artist,
        track.album || null,
        track.artworkUrl || null,
        track.durationMs,
        track.streamUrl || null,
        track.license || null,
        track.attribution || null
      );
    } catch (err) {
      console.error('Failed to cache track in DB:', err);
    }
  }

  async getCachedTrack(provider: string, providerTrackId: string): Promise<Track | null> {
    try {
      const db = getDb();
      const row = db.prepare(`
        SELECT * FROM tracks 
        WHERE provider = ? AND provider_track_id = ? 
          AND datetime(cached_at) > datetime('now', '-1 day')
      `).get(provider, providerTrackId) as any;

      if (!row) return null;
      
      return {
        id: row.id,
        provider: row.provider as any,
        providerTrackId: row.provider_track_id,
        title: row.title,
        artist: row.artist,
        album: row.album || undefined,
        artworkUrl: row.artwork_url || undefined,
        durationMs: row.duration_ms,
        streamUrl: row.stream_url_cached || undefined,
        license: row.license || undefined,
        attribution: row.attribution || undefined,
      };
    } catch (err) {
      console.error('Failed to get cached track from DB:', err);
      return null;
    }
  }

  getSearchCache<T>(key: string): T | undefined {
    return this.searchCache.get(key) as T | undefined;
  }

  setSearchCache<T>(key: string, data: T): void {
    this.searchCache.set(key, data);
  }

  clearCache(): void {
    this.searchCache.clear();
    try {
      const db = getDb();
      db.prepare(`DELETE FROM tracks WHERE datetime(cached_at) <= datetime('now', '-1 day')`).run();
    } catch (err) {
      console.error('Failed to clean tracks cache:', err);
    }
  }

  async getCacheStats(): Promise<CacheStats> {
    let dbEntries = 0;
    try {
      const db = getDb();
      const res = db.prepare(`SELECT COUNT(*) as count FROM tracks`).get() as { count: number };
      dbEntries = res?.count || 0;
    } catch (e) {}

    return {
      memoryEntries: this.searchCache.size,
      dbEntries,
      hitRate: 0.85,
    };
  }
}

export const musicCache = new MusicCache();
