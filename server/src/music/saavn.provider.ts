import { MusicProvider, SearchResult, Track } from './provider.interface.js';
import { decryptSaavnMediaUrl } from './saavn.decrypt.js';

// JioSaavn internal API — same endpoints the web app uses, no API key required
const SAAVN_API = 'https://www.jiosaavn.com/api.php';
const TIMEOUT_MS = 10000;

export class SaavnProvider implements MusicProvider {
  name = 'saavn' as const;

  private async fetchWithTimeout(url: string): Promise<Response> {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'application/json, text/javascript, */*',
          'Referer': 'https://www.jiosaavn.com/',
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
      const url = `${SAAVN_API}?__call=webapi.getLaunchData&api_version=4&_format=json&_marker=0`;
      const res = await this.fetchWithTimeout(url);
      return res.ok;
    } catch {
      return false;
    }
  }

  private extractStreamUrl(song: any): string | undefined {
    // Priority 1: Full-length decrypted studio 320kbps / 160kbps stream
    const encrypted = song.more_info?.encrypted_media_url || song.encrypted_media_url;
    if (encrypted) {
      const fullUrl = decryptSaavnMediaUrl(encrypted);
      if (fullUrl) return fullUrl;
    }

    // Priority 2: Direct media_url if available
    if (song.media_url && typeof song.media_url === 'string' && song.media_url.startsWith('http')) {
      return song.media_url;
    }
    if (song.more_info?.media_url && typeof song.more_info.media_url === 'string' && song.more_info.media_url.startsWith('http')) {
      return song.more_info.media_url;
    }

    // Priority 3: Media preview upgraded to full AAC stream
    const previewUrl = song.media_preview_url || song.more_info?.media_preview_url;
    if (previewUrl && typeof previewUrl === 'string' && previewUrl.startsWith('http')) {
      return previewUrl.replace('preview', 'aac').replace('_96_p.mp4', '_320.mp4');
    }

    // Priority 4: Fallback vlink
    if (song.more_info?.vlink) {
      return song.more_info.vlink;
    }
    return undefined;
  }

  private getArtwork(song: any): string | undefined {
    const img = song.image || song.more_info?.image;
    if (!img) return undefined;
    // Upgrade to 500x500 from 150x150
    return img.replace('150x150', '500x500').replace('50x50', '500x500');
  }

  private mapSearchSong(song: any): Track {
    const artists = song.more_info?.primary_artists || song.subtitle || song.primary_artists || 'Unknown Artist';
    const streamUrl = this.extractStreamUrl(song);
    return {
      id: `saavn:${song.id}`,
      provider: 'saavn' as any,
      providerTrackId: String(song.id),
      title: this.htmlDecode(song.title || song.song || 'Unknown Title'),
      artist: this.htmlDecode(artists),
      album: song.more_info?.album || song.album || undefined,
      artworkUrl: this.getArtwork(song),
      durationMs: Number(song.more_info?.duration || song.duration || 0) * 1000 || 180000,
      streamUrl,
      license: 'JioSaavn Streaming',
      attribution: `${this.htmlDecode(artists)} • JioSaavn`,
    };
  }

  private mapDetailSong(song: any): Track {
    const artists = song.primary_artists || song.more_info?.primary_artists || song.singers || 'Unknown Artist';
    const streamUrl = this.extractStreamUrl(song);
    return {
      id: `saavn:${song.id}`,
      provider: 'saavn' as any,
      providerTrackId: String(song.id),
      title: this.htmlDecode(song.song || song.title || 'Unknown Title'),
      artist: this.htmlDecode(artists),
      album: song.album || song.more_info?.album || undefined,
      artworkUrl: this.getArtwork(song),
      durationMs: Number(song.more_info?.duration || song.duration || 0) * 1000 || 180000,
      streamUrl,
      license: 'JioSaavn Streaming',
      attribution: `${this.htmlDecode(artists)} • JioSaavn`,
    };
  }

  private htmlDecode(str: string): string {
    if (!str) return '';
    return str
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&#039;/g, "'")
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&apos;/g, "'");
  }

  async search(query: string, limit = 20, _offset = 0): Promise<SearchResult> {
    try {
      // Priority: use search.getResults for complete song data and encrypted URLs
      const url = new URL(SAAVN_API);
      url.searchParams.set('__call', 'search.getResults');
      url.searchParams.set('q', query);
      url.searchParams.set('_format', 'json');
      url.searchParams.set('_marker', '0');
      url.searchParams.set('api_version', '4');
      url.searchParams.set('ctx', 'web6dot0');
      url.searchParams.set('n', String(limit));
      url.searchParams.set('p', '1');

      const res = await this.fetchWithTimeout(url.toString());
      if (res.ok) {
        const data = await res.json();
        const results = data?.results || [];
        if (Array.isArray(results) && results.length > 0) {
          const tracks: Track[] = results
            .filter((s: any) => s.id)
            .slice(0, limit)
            .map((s: any) => this.mapSearchSong(s));

          return { tracks, hasMore: results.length >= limit };
        }
      }

      // Fallback: autocomplete.get
      return this.searchAutocomplete(query, limit);
    } catch (err) {
      console.error('[Saavn] search error:', err);
      return this.searchAutocomplete(query, limit);
    }
  }

  private async searchAutocomplete(query: string, limit: number): Promise<SearchResult> {
    try {
      const url = new URL(SAAVN_API);
      url.searchParams.set('__call', 'autocomplete.get');
      url.searchParams.set('query', query);
      url.searchParams.set('_format', 'json');
      url.searchParams.set('_marker', '0');
      url.searchParams.set('api_version', '4');
      url.searchParams.set('ctx', 'web6dot0');

      const res = await this.fetchWithTimeout(url.toString());
      if (!res.ok) throw new Error(`Saavn autocomplete error: ${res.status}`);

      const data = await res.json();
      const songs = data?.songs?.data || [];

      // If songs found, batch fetch details for top songs
      const pids = songs.map((s: any) => s.id).filter(Boolean).slice(0, limit);
      if (pids.length > 0) {
        const detailUrl = new URL(SAAVN_API);
        detailUrl.searchParams.set('__call', 'song.getDetails');
        detailUrl.searchParams.set('pids', pids.join(','));
        detailUrl.searchParams.set('_format', 'json');
        detailUrl.searchParams.set('_marker', '0');
        detailUrl.searchParams.set('api_version', '4');
        detailUrl.searchParams.set('ctx', 'web6dot0');

        const detailRes = await this.fetchWithTimeout(detailUrl.toString());
        if (detailRes.ok) {
          const detailData = await detailRes.json();
          const detailTracks: Track[] = [];
          for (const pid of pids) {
            const raw = detailData[pid];
            if (raw) {
              detailTracks.push(this.mapDetailSong(raw));
            }
          }
          if (detailTracks.length > 0) {
            return { tracks: detailTracks, hasMore: songs.length > limit };
          }
        }
      }

      const tracks: Track[] = songs.slice(0, limit).map((s: any) => this.mapSearchSong(s));
      return { tracks, hasMore: songs.length > limit };
    } catch (err) {
      console.error('[Saavn] searchAutocomplete error:', err);
      return { tracks: [], hasMore: false };
    }
  }

  async trending(limit = 20, _offset = 0, genre?: string): Promise<SearchResult> {
    // Map genre names to Indian music queries
    const indianGenreQueries: Record<string, string> = {
      bollywood: 'bollywood hits 2025',
      hindi: 'hindi hits 2025',
      punjabi: 'punjabi hits 2025',
      tamil: 'tamil hits 2025',
      telugu: 'telugu hits 2025',
      bhojpuri: 'bhojpuri superhit 2025',
      'lo-fi': 'hindi lofi chill',
      pop: 'hindi pop 2025',
      'r&b': 'hindi romantic 2025',
      'hip-hop': 'hindi rap 2025',
      rock: 'indian rock 2025',
      electronic: 'indian edm 2025',
    };

    const query = genre
      ? (indianGenreQueries[genre.toLowerCase()] || `${genre} hindi songs 2025`)
      : 'top bollywood hindi songs 2025';

    return this.search(query, limit);
  }

  async getTrack(providerTrackId: string): Promise<Track | null> {
    try {
      const url = new URL(SAAVN_API);
      url.searchParams.set('__call', 'song.getDetails');
      url.searchParams.set('pids', providerTrackId);
      url.searchParams.set('_format', 'json');
      url.searchParams.set('_marker', '0');
      url.searchParams.set('api_version', '4');
      url.searchParams.set('ctx', 'web6dot0');

      const res = await this.fetchWithTimeout(url.toString());
      if (!res.ok) return null;

      const data = await res.json();
      const song = data?.[providerTrackId] || Object.values(data || {})[0];
      if (!song) return null;

      return this.mapDetailSong(song as any);
    } catch (err) {
      console.error(`[Saavn] getTrack(${providerTrackId}) error:`, err);
      return null;
    }
  }

  async getStreamUrl(providerTrackId: string): Promise<string | null> {
    const track = await this.getTrack(providerTrackId);
    if (!track?.streamUrl) return null;

    const url = track.streamUrl;
    if (url.includes('_320.')) {
      try {
        const headCheck = await fetch(url, { method: 'HEAD' });
        if (headCheck.ok) return url;

        // Try 160kbps fallback
        const url160 = url.replace('_320.', '_160.');
        const check160 = await fetch(url160, { method: 'HEAD' });
        if (check160.ok) return url160;

        // Try 96kbps fallback
        return url.replace('_320.', '_96.');
      } catch {
        return url;
      }
    }
    return url;
  }
}
