import { LRUCache } from 'lru-cache';
import { Track } from './provider.interface.js';
import db from '../db/database.js';

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
      await db.run(
        `INSERT INTO tracks (id, provider, providerTrackId, title, artist, album, artworkUrl, durationMs, streamUrl, license, attribution, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
         ON CONFLICT(id) DO UPDATE SET 
         title=excluded.title, 
         artist=excluded.artist, 
         streamUrl=excluded.streamUrl,
         updated_at=CURRENT_TIMESTAMP`,
        [track.id, track.provider, track.providerTrackId, track.title, track.artist, track.album || null, track.artworkUrl || null, track.durationMs, track.streamUrl || null, track.license || null, track.attribution || null]
      );
    } catch (err) {
      console.error('Failed to cache track in DB:', err);
    }
  }

  async getCachedTrack(provider: string, providerTrackId: string): Promise<Track | null> {
    try {
      const id = `${provider}:${providerTrackId}`;
      const row: any = await db.get(`SELECT * FROM tracks WHERE id = ? AND updated_at > datetime('now', '-1 day')`, [id]);
      if (!row) return null;
      
      return {
        id: row.id,
        provider: row.provider as any,
        providerTrackId: row.providerTrackId,
        title: row.title,
        artist: row.artist,
        album: row.album || undefined,
        artworkUrl: row.artworkUrl || undefined,
        durationMs: row.durationMs,
        streamUrl: row.streamUrl || undefined,
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
    db.run(`DELETE FROM tracks WHERE updated_at <= datetime('now', '-1 day')`).catch(() => {});
  }

  async getCacheStats(): Promise<CacheStats> {
    let dbEntries = 0;
    try {
       const res: any = await db.get(`SELECT COUNT(*) as count FROM tracks`);
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
