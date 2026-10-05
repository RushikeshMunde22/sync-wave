import { MusicProvider, SearchResult, Track } from './provider.interface.js';

const BASE_URL = 'https://musicapi.x007.workers.dev';
const TIMEOUT_MS = 6000;

export class MusicApiWorkerProvider implements MusicProvider {
  name = 'musicapi' as const;

  private async fetchWithTimeout(url: string): Promise<Response> {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'application/json',
        },
      });
      clearTimeout(id);
      return res;
    } catch (err) {
      clearTimeout(id);
      throw err;
    }
  }

  async isAvailable(): Promise<boolean> {
    try {
      const res = await this.fetchWithTimeout(`${BASE_URL}/search?q=test&searchEngine=seevn`);
      return res.ok;
    } catch {
      return false;
    }
  }

  async search(query: string, limit = 20, _offset = 0): Promise<SearchResult> {
    const engines = ['seevn', 'wunk', 'gaama', 'hunjama'];
    
    for (const engine of engines) {
      try {
        const url = `${BASE_URL}/search?q=${encodeURIComponent(query)}&searchEngine=${engine}`;
        const res = await this.fetchWithTimeout(url);
        if (!res.ok) continue;

        const data = await res.json() as any;
        if (data.status === 200 && Array.isArray(data.response) && data.response.length > 0) {
          const tracks: Track[] = data.response.slice(0, limit).map((item: any) => ({
            id: `musicapi:${item.id}`,
            provider: 'musicapi' as const,
            providerTrackId: String(item.id),
            title: item.title || 'Unknown Title',
            artist: this.extractArtist(item.title) || 'Indian Music',
            artworkUrl: item.img || undefined,
            durationMs: 180000,
            license: 'Streaming',
            attribution: `MusicAPI (${engine})`,
          }));

          return { tracks, hasMore: false };
        }
      } catch {
        // try next engine or fallback
        continue;
      }
    }

    return { tracks: [], hasMore: false };
  }

  async trending(limit = 20, offset = 0, genre?: string): Promise<SearchResult> {
    const query = genre || 'Bollywood Top Trending';
    return this.search(query, limit, offset);
  }

  async getTrack(providerTrackId: string): Promise<Track | null> {
    const streamUrl = await this.getStreamUrl(providerTrackId);
    return {
      id: `musicapi:${providerTrackId}`,
      provider: 'musicapi' as const,
      providerTrackId,
      title: 'Indian Track',
      artist: 'Indian Artist',
      durationMs: 180000,
      streamUrl: streamUrl || undefined,
      attribution: 'MusicAPI Worker',
    };
  }

  async getStreamUrl(providerTrackId: string): Promise<string | null> {
    try {
      const url = `${BASE_URL}/fetch?id=${encodeURIComponent(providerTrackId)}`;
      const res = await this.fetchWithTimeout(url);
      if (!res.ok) return null;

      const data = await res.json() as any;
      if (data.status === 200 && typeof data.response === 'string') {
        return data.response;
      }
      return null;
    } catch {
      return null;
    }
  }

  async getLyrics(providerTrackId: string): Promise<string | null> {
    try {
      const url = `${BASE_URL}/lyrics?id=${encodeURIComponent(providerTrackId)}`;
      const res = await this.fetchWithTimeout(url);
      if (!res.ok) return null;

      const data = await res.json() as any;
      if (data.status === 200 && typeof data.response === 'string') {
        return data.response.replace(/<[^>]+>/g, '\n').trim();
      }
      return null;
    } catch {
      return null;
    }
  }

  private extractArtist(title: string): string | undefined {
    if (!title) return undefined;
    const match = title.match(/from\s+["']([^"']+)["']/i) || title.match(/\(([^)]+)\)/);
    return match ? match[1] : undefined;
  }
}
