import { MusicProvider, SearchResult, Track } from './provider.interface.js';

const JAMENDO_BASE_URL = 'https://api.jamendo.com/v3.0';
const TIMEOUT_MS = 10000;

export class JamendoProvider implements MusicProvider {
  name: 'jamendo' = 'jamendo';
  private clientId: string | undefined;

  constructor(clientId?: string) {
    this.clientId = clientId;
  }

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
    return !!this.clientId;
  }

  private mapTrack(item: any): Track {
    const license = item.license_ccurl;
    return {
      id: `jamendo:${item.id}`,
      provider: 'jamendo',
      providerTrackId: String(item.id),
      title: item.name,
      artist: item.artist_name || 'Unknown Artist',
      album: item.album_name || undefined,
      artworkUrl: item.image || undefined,
      durationMs: (item.duration || 0) * 1000,
      streamUrl: item.audio,
      license: license,
      attribution: `${item.artist_name} - ${item.name} (Jamendo, ${license})`,
    };
  }

  async search(query: string, limit = 20, offset = 0): Promise<SearchResult> {
    if (!this.clientId) return { tracks: [], hasMore: false };

    try {
      const url = new URL(`${JAMENDO_BASE_URL}/tracks/`);
      url.searchParams.set('client_id', this.clientId);
      url.searchParams.set('namesearch', query);
      url.searchParams.set('format', 'json');
      url.searchParams.set('audioformat', 'mp32');
      url.searchParams.set('limit', limit.toString());
      url.searchParams.set('offset', offset.toString());

      const response = await this.fetchWithTimeout(url.toString());
      if (!response.ok) throw new Error(`Jamendo search error: ${response.status}`);
      
      const data = await response.json();
      const items = Array.isArray(data.results) ? data.results : [];
      
      return {
        tracks: items.map((t: any) => this.mapTrack(t)),
        hasMore: items.length === limit,
      };
    } catch (error) {
      console.error('Jamendo search failed:', error);
      return { tracks: [], hasMore: false };
    }
  }

  async trending(limit = 20, offset = 0, genre?: string): Promise<SearchResult> {
    if (!this.clientId) return { tracks: [], hasMore: false };

    try {
      const url = new URL(`${JAMENDO_BASE_URL}/tracks/`);
      url.searchParams.set('client_id', this.clientId);
      url.searchParams.set('order', 'popularity_total');
      url.searchParams.set('format', 'json');
      url.searchParams.set('audioformat', 'mp32');
      url.searchParams.set('limit', limit.toString());
      url.searchParams.set('offset', offset.toString());
      if (genre) {
        url.searchParams.set('tags', genre);
      }

      const response = await this.fetchWithTimeout(url.toString());
      if (!response.ok) throw new Error(`Jamendo trending error: ${response.status}`);
      
      const data = await response.json();
      const items = Array.isArray(data.results) ? data.results : [];
      
      return {
        tracks: items.map((t: any) => this.mapTrack(t)),
        hasMore: items.length === limit,
      };
    } catch (error) {
      console.error('Jamendo trending failed:', error);
      return { tracks: [], hasMore: false };
    }
  }

  async getTrack(providerTrackId: string): Promise<Track | null> {
    if (!this.clientId) return null;

    try {
      const url = new URL(`${JAMENDO_BASE_URL}/tracks/`);
      url.searchParams.set('client_id', this.clientId);
      url.searchParams.set('id', providerTrackId);
      url.searchParams.set('format', 'json');

      const response = await this.fetchWithTimeout(url.toString());
      if (!response.ok) return null;
      
      const data = await response.json();
      const item = (data.results && data.results[0]) ? data.results[0] : null;
      if (!item) return null;
      
      return this.mapTrack(item);
    } catch (error) {
      console.error(`Jamendo getTrack(${providerTrackId}) failed:`, error);
      return null;
    }
  }

  async getStreamUrl(providerTrackId: string): Promise<string | null> {
    const track = await this.getTrack(providerTrackId);
    return track?.streamUrl || null;
  }
}
