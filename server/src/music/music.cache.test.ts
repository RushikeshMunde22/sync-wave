import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { getDb, closeDb } from '../db/database.js';
import { runMigrations } from '../db/migrator.js';
import { musicCache } from './music.cache.js';
import { Track } from './provider.interface.js';

describe('Music Cache Service', () => {
  beforeAll(() => {
    getDb();
    runMigrations();
  });

  afterAll(() => {
    closeDb();
  });

  it('sets and gets in-memory search cache', () => {
    const key = 'search:synthwave:10:0';
    const mockData = { tracks: [{ id: '1', title: 'Resonance' }] };

    musicCache.setSearchCache(key, mockData);
    const cached = musicCache.getSearchCache(key);

    expect(cached).toEqual(mockData);
  });

  it('caches a track in SQLite and retrieves it correctly', async () => {
    const track: Track = {
      id: `audius:track_${Date.now()}`,
      provider: 'audius',
      providerTrackId: `p_${Date.now()}`,
      title: 'Solar Flare',
      artist: 'Cosmic Beats',
      album: 'Galaxy EP',
      artworkUrl: 'https://audius.co/artwork.jpg',
      durationMs: 184000,
      streamUrl: 'https://audius.co/stream.mp3',
      license: 'CC-BY-SA',
      attribution: 'Cosmic Beats via Audius',
    };

    await musicCache.cacheTrack(track);

    const retrieved = await musicCache.getCachedTrack(track.provider, track.providerTrackId);
    expect(retrieved).toBeDefined();
    expect(retrieved?.title).toBe('Solar Flare');
    expect(retrieved?.artist).toBe('Cosmic Beats');
    expect(retrieved?.durationMs).toBe(184000);
    expect(retrieved?.streamUrl).toBe('https://audius.co/stream.mp3');
  });

  it('updates existing cached track on conflict', async () => {
    const providerTrackId = `p_update_${Date.now()}`;
    const track1: Track = {
      id: `audius:${providerTrackId}`,
      provider: 'audius',
      providerTrackId,
      title: 'Original Title',
      artist: 'Artist One',
      durationMs: 120000,
      streamUrl: 'https://stream1.mp3',
    };

    await musicCache.cacheTrack(track1);

    const track2: Track = {
      ...track1,
      title: 'Remastered Title',
      streamUrl: 'https://stream2.mp3',
    };

    await musicCache.cacheTrack(track2);

    const retrieved = await musicCache.getCachedTrack('audius', providerTrackId);
    expect(retrieved?.title).toBe('Remastered Title');
    expect(retrieved?.streamUrl).toBe('https://stream2.mp3');
  });

  it('reports cache statistics', async () => {
    const stats = await musicCache.getCacheStats();
    expect(stats.memoryEntries).toBeGreaterThanOrEqual(0);
    expect(stats.dbEntries).toBeGreaterThanOrEqual(1);
    expect(stats.hitRate).toBeGreaterThan(0);
  });
});
