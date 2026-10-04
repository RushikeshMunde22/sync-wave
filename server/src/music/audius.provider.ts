import { MusicProvider, SearchResult, Track } from './provider.interface.js';

const AUDIUS_BASE_URL = 'https://discoveryprovider.audius.co';
const APP_NAME = 'SyncWave';
const TIMEOUT_MS = 10000;

export class AudiusProvider implements MusicProvider {
  name: 'audius' = 'audius';

  private async fetchWithTimeout(url: string): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);
    
    try {
      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }

  async isAvailable(): Promise<boolean> {
    try {
      const response = await this.fetchWithTimeout(`${AUDIUS_BASE_URL}/health_check`);
      return response.ok;
    } catch (e) {
      console.error('Audius health check failed:', e);
      return false;
    }
  }

  private mapTrack(item: any): Track {
    const artwork = item.artwork || {};
    return {
      id: `audius:${item.id}`,
      provider: 'audius',
      providerTrackId: String(item.id),
      title: item.title,
      artist: item.user?.name || 'Unknown Artist',
      album: undefined,
      artworkUrl: artwork['480x480'] || artwork['1000x1000'] || undefined,
      durationMs: (item.duration || 0) * 1000,
      streamUrl: `${AUDIUS_BASE_URL}/v1/tracks/${item.id}/stream?app_name=${APP_NAME}`,
    };
  }

  async search(query: string, limit = 20, offset = 0): Promise<SearchResult> {
    try {
      const url = new URL(`${AUDIUS_BASE_URL}/v1/tracks/search`);
      url.searchParams.set('query', query);
      url.searchParams.set('app_name', APP_NAME);
      const response = await this.fetchWithTimeout(url.toString());
      if (!response.ok) {
         throw new Error(`Audius search error: ${response.status}`);
      }
      const data = await response.json();
      
      const items = Array.isArray(data.data) ? data.data : [];
      const sliced = items.slice(offset, offset + limit);
      
      return {
        tracks: sliced.map(t => this.mapTrack(t)),
        hasMore: offset + limit < items.length,
      };
    } catch (error) {
      console.error('Audius search failed:', error);
      return { tracks: [], hasMore: false };
    }
  }

  async trending(limit = 20, offset = 0, genre?: string): Promise<SearchResult> {
    try {
      const url = new URL(`${AUDIUS_BASE_URL}/v1/tracks/trending`);
      url.searchParams.set('app_name', APP_NAME);
      if (genre) url.searchParams.set('genre', genre);
      url.searchParams.set('limit', limit.toString());
      url.searchParams.set('offset', offset.toString());

      const response = await this.fetchWithTimeout(url.toString());
      if (!response.ok) throw new Error(`Audius trending error: ${response.status}`);
      
      const data = await response.json();
      const items = Array.isArray(data.data) ? data.data : [];
      return {
        tracks: items.map(t => this.mapTrack(t)),
        hasMore: items.length === limit,
      };
    } catch (error) {
      console.error('Audius trending failed:', error);
      return { tracks: [], hasMore: false };
    }
  }

  async getTrack(providerTrackId: string): Promise<Track | null> {
    try {
      const url = `${AUDIUS_BASE_URL}/v1/tracks/${providerTrackId}?app_name=${APP_NAME}`;
      const response = await this.fetchWithTimeout(url);
      if (!response.ok) return null;
      
      const data = await response.json();
      if (!data.data) return null;
      
      return this.mapTrack(data.data);
    } catch (error) {
      console.error(`Audius getTrack(${providerTrackId}) failed:`, error);
      return null;
    }
  }

  async getStreamUrl(providerTrackId: string): Promise<string | null> {
    return `${AUDIUS_BASE_URL}/v1/tracks/${providerTrackId}/stream?app_name=${APP_NAME}`;
  }
}
