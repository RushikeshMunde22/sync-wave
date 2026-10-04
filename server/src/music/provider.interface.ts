export interface Track {
  id: string;
  provider: 'audius' | 'jamendo' | 'itunes';
  providerTrackId: string;
  title: string;
  artist: string;
  album?: string;
  artworkUrl?: string;
  durationMs: number;
  streamUrl?: string;
  license?: string;
  attribution?: string;
}

export interface SearchResult {
  tracks: Track[];
  hasMore: boolean;
}

export interface MusicProvider {
  name: 'audius' | 'jamendo' | 'itunes';
  isAvailable(): Promise<boolean>;
  search(query: string, limit?: number, offset?: number): Promise<SearchResult>;
  trending(limit?: number, offset?: number, genre?: string): Promise<SearchResult>;
  getTrack(providerTrackId: string): Promise<Track | null>;
  getStreamUrl(providerTrackId: string): Promise<string | null>;
}
