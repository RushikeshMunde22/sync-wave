import { MusicProvider, SearchResult, Track } from './provider.interface.js';
import { AudiusProvider } from './audius.provider.js';
import { JamendoProvider } from './jamendo.provider.js';

export class ProviderManager {
  private providers: Map<string, MusicProvider> = new Map();
  private primary: MusicProvider;
  private secondary: MusicProvider | null = null;
  private healthStatuses: Record<string, boolean> = {};

  constructor() {
    this.primary = new AudiusProvider();
    this.providers.set('audius', this.primary);
    
    // Fallback to process.env if env object isn't configured with it
    const jamendoClientId = process.env.JAMENDO_CLIENT_ID;
    if (jamendoClientId) {
      this.secondary = new JamendoProvider(jamendoClientId);
      this.providers.set('jamendo', this.secondary);
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

  private async tryWithFallback<T>(operation: (provider: MusicProvider) => Promise<T>, isSearchResult = false): Promise<T> {
    if (this.healthStatuses['audius'] !== false) {
      try {
        const result = await operation(this.primary);
        if (!isSearchResult || (result as unknown as SearchResult).tracks.length > 0) {
           return result;
        }
      } catch (e) {
        console.error('Primary provider operation failed:', e);
      }
    }
    
    if (this.secondary && this.healthStatuses['jamendo'] !== false) {
      try {
         return await operation(this.secondary);
      } catch (e) {
         console.error('Secondary provider operation failed:', e);
      }
    }

    if (isSearchResult) {
      return { tracks: [], hasMore: false } as unknown as T;
    }
    throw new Error('All providers failed');
  }

  async search(query: string, limit = 20, offset = 0): Promise<SearchResult> {
    return this.tryWithFallback(p => p.search(query, limit, offset), true);
  }

  async trending(limit = 20, offset = 0, genre?: string): Promise<SearchResult> {
    return this.tryWithFallback(p => p.trending(limit, offset, genre), true);
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
