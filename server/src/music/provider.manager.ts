import { MusicProvider, SearchResult, Track } from './provider.interface.js';
import { AudiusProvider } from './audius.provider.js';
import { JamendoProvider } from './jamendo.provider.js';
import { ITunesProvider } from './itunes.provider.js';
import { SaavnProvider } from './saavn.provider.js';

export class ProviderManager {
  private providers: Map<string, MusicProvider> = new Map();
  private audius: AudiusProvider;
  private itunes: ITunesProvider;
  private saavn: SaavnProvider;
  private jamendo: JamendoProvider | null = null;
  private healthStatuses: Record<string, boolean> = {};

  constructor() {
    this.audius = new AudiusProvider();
    this.itunes = new ITunesProvider();
    this.saavn = new SaavnProvider();
    this.providers.set('audius', this.audius);
    this.providers.set('itunes', this.itunes);
    this.providers.set('saavn', this.saavn);

    const jamendoClientId = process.env.JAMENDO_CLIENT_ID;
    if (jamendoClientId) {
      this.jamendo = new JamendoProvider(jamendoClientId);
      this.providers.set('jamendo', this.jamendo);
    }

    this.checkHealth();
    setInterval(() => this.checkHealth(), 5 * 60 * 1000);
  }

  private async checkHealth() {
    for (const [name, provider] of this.providers.entries()) {
      this.healthStatuses[name] = await provider.isAvailable();
    }
  }

  getProviderHealth() {
    return this.healthStatuses;
  }

  async search(query: string, limit = 20, offset = 0): Promise<SearchResult> {
    // Detect Indian language keywords to prioritize Saavn
    const indianKeywords = /bollywood|hindi|punjabi|tamil|telugu|bhojpuri|marathi|gujarati|kannada|malayalam|bengali|rajasthani|haryanvi|saavn|arijit|shreya|sonu|neha|badshah|diljit|ranveer|atif|armaan|tulsi|kumar sanu|lata|kishore|rafi|udit|mohit/i;
    const isIndianQuery = indianKeywords.test(query);

    const promises: Promise<SearchResult>[] = [
      this.itunes.search(query, limit, offset).catch(() => ({ tracks: [], hasMore: false })),
      this.audius.search(query, limit, offset).catch(() => ({ tracks: [], hasMore: false })),
      this.saavn.search(query, limit, offset).catch(() => ({ tracks: [], hasMore: false })),
    ];

    if (this.jamendo) {
      promises.push(this.jamendo.search(query, limit, offset).catch(() => ({ tracks: [], hasMore: false })));
    }

    const results = await Promise.all(promises);
    const combinedTracks: Track[] = [];
    const seenTitles = new Set<string>();

    // For Indian queries, prioritize Saavn results first
    const orderedResults = (isIndianQuery
      ? [results[2], results[0], results[1], ...(results[3] ? [results[3]] : [])]
      : results
    ).filter((result): result is SearchResult => Boolean(result));

    for (const res of orderedResults) {
      for (const track of res.tracks) {
        const key = `${track.title.toLowerCase().trim()}-${track.artist.toLowerCase().trim()}`;
        if (!seenTitles.has(key)) {
          seenTitles.add(key);
          combinedTracks.push(track);
        }
      }
    }

    return {
      tracks: combinedTracks.slice(0, limit),
      hasMore: combinedTracks.length > limit || results.some(r => r.hasMore),
    };
  }

  async trending(limit = 20, offset = 0, genre?: string): Promise<SearchResult> {
    const indianGenres = ['bollywood', 'hindi', 'punjabi', 'tamil', 'telugu', 'bhojpuri', 'indian'];
    const isIndianGenre = genre ? indianGenres.some(g => genre.toLowerCase().includes(g)) : false;

    const promises: Promise<SearchResult>[] = [
      this.itunes.trending(limit, offset, genre).catch(() => ({ tracks: [], hasMore: false })),
      this.audius.trending(limit, offset, genre).catch(() => ({ tracks: [], hasMore: false })),
      this.saavn.trending(limit, offset, genre).catch(() => ({ tracks: [], hasMore: false })),
    ];

    if (this.jamendo) {
      promises.push(this.jamendo.trending(limit, offset, genre).catch(() => ({ tracks: [], hasMore: false })));
    }

    const results = await Promise.all(promises);
    const combinedTracks: Track[] = [];
    const seenTitles = new Set<string>();

    // For Indian genres, prioritize Saavn
    const orderedResults = (isIndianGenre
      ? [results[2], results[0], results[1], ...(results[3] ? [results[3]] : [])]
      : results
    ).filter((result): result is SearchResult => Boolean(result));

    for (const res of orderedResults) {
      for (const track of res.tracks) {
        const key = `${track.title.toLowerCase().trim()}-${track.artist.toLowerCase().trim()}`;
        if (!seenTitles.has(key)) {
          seenTitles.add(key);
          combinedTracks.push(track);
        }
      }
    }

    return {
      tracks: combinedTracks.slice(0, limit),
      hasMore: combinedTracks.length > limit,
    };
  }

  async getTrack(providerName: string, providerTrackId: string): Promise<Track | null> {
    const provider = this.providers.get(providerName);
    if (!provider) return null;
    return provider.getTrack(providerTrackId);
  }

  async getStreamUrl(providerName: string, providerTrackId: string): Promise<string | null> {
    const provider = this.providers.get(providerName);
    if (!provider) return null;
    return provider.getStreamUrl(providerTrackId);
  }
}

export const providerManager = new ProviderManager();
