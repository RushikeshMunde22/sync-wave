import { MusicProvider, SearchResult, Track } from './provider.interface.js';

const ITUNES_SEARCH_URL = 'https://itunes.apple.com/search';
const ITUNES_LOOKUP_URL = 'https://itunes.apple.com/lookup';
const TIMEOUT_MS = 8000;

export class ITunesProvider implements MusicProvider {
  name: 'itunes' = 'itunes';

  private async fetchWithTimeout(url: string): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: { 'Accept': 'application/json' },
      });
      clearTimeout(timeoutId);
      return response;
    } catch (err) {
      clearTimeout(timeoutId);
      throw err;
    }
  }

  async isAvailable(): Promise<boolean> {
    try {
      const res = await this.fetchWithTimeout(`${ITUNES_SEARCH_URL}?term=test&limit=1`);
      return res.ok;
    } catch {
      return false;
    }
  }

  private mapTrack(item: any): Track {
    const artwork = item.artworkUrl100
      ? item.artworkUrl100.replace('100x100bb', '600x600bb')
      : item.artworkUrl60;

    return {
      id: `itunes:${item.trackId}`,
      provider: 'itunes',
      providerTrackId: String(item.trackId),
      title: item.trackName || 'Unknown Title',
      artist: item.artistName || 'Unknown Artist',
      album: item.collectionName || undefined,
      artworkUrl: artwork || undefined,
      durationMs: item.trackTimeMillis || 180000,
      streamUrl: item.previewUrl,
      license: 'Preview / iTunes Catalog',
      attribution: `${item.artistName} • ${item.collectionName || 'Single'}`,
    };
  }

  async search(query: string, limit = 20, offset = 0): Promise<SearchResult> {
    try {
      const url = new URL(ITUNES_SEARCH_URL);
      url.searchParams.set('term', query);
      url.searchParams.set('entity', 'song');
      url.searchParams.set('limit', String(Math.min(limit, 50)));
      if (offset > 0) {
        url.searchParams.set('offset', String(offset));
      }

      const res = await this.fetchWithTimeout(url.toString());
      if (!res.ok) throw new Error(`iTunes search error: ${res.status}`);

      const data = await res.json();
      const results = (data.results || []).filter((r: any) => r.previewUrl && r.trackName);

      return {
        tracks: results.map((r: any) => this.mapTrack(r)),
        hasMore: (data.resultCount || 0) >= limit,
      };
    } catch (err) {
      console.error('iTunes search failed:', err);
      return { tracks: [], hasMore: false };
    }
  }

  async trending(limit = 20, offset = 0, genre?: string): Promise<SearchResult> {
    // Map genre to iTunes-friendly search term, including Indian genres
    const genreMap: Record<string, string> = {
      bollywood: 'bollywood hindi songs 2025',
      hindi: 'hindi songs top 2025',
      punjabi: 'punjabi songs 2025',
      tamil: 'tamil songs 2025',
      telugu: 'telugu songs 2025',
      pop: 'pop hits 2025',
      'hip-hop': 'hip hop 2025',
      electronic: 'electronic dance 2025',
      rock: 'rock hits 2025',
      'r&b': 'r&b soul 2025',
      'lo-fi': 'lofi chill beats',
    };

    const term = genre && genreMap[genre.toLowerCase()]
      ? genreMap[genre.toLowerCase()]
      : genre && genre !== 'All' && genre !== 'Trending'
        ? `${genre} hits 2025`
        : 'top hits 2026';

    return this.search(term ?? 'top hits 2026', limit, offset);
  }

  async getTrack(providerTrackId: string): Promise<Track | null> {
    try {
      const url = `${ITUNES_LOOKUP_URL}?id=${providerTrackId}`;
      const res = await this.fetchWithTimeout(url);
      if (!res.ok) return null;

      const data = await res.json();
      const item = (data.results || [])[0];
      if (!item) return null;

      return this.mapTrack(item);
    } catch (err) {
      console.error(`iTunes getTrack(${providerTrackId}) failed:`, err);
      return null;
    }
  }

  async getStreamUrl(providerTrackId: string): Promise<string | null> {
    const track = await this.getTrack(providerTrackId);
    return track?.streamUrl || null;
  }
}
