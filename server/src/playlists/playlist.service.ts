import { getDb } from '../db/database.js';
import { v4 as uuidv4 } from 'uuid';
import { musicCache } from '../music/music.cache.js';
import { Track } from '../music/provider.interface.js';

export interface UserPlaylist {
  id: string;
  userId: string;
  name: string;
  description?: string;
  trackCount: number;
  createdAt: string;
  updatedAt: string;
}

export function getUserPlaylists(userId: string): UserPlaylist[] {
  const db = getDb();
  const rows = db.prepare(`
    SELECT p.id, p.user_id as userId, p.name, p.description, p.created_at as createdAt, p.updated_at as updatedAt,
           COUNT(pt.id) as trackCount
    FROM user_playlists p
    LEFT JOIN user_playlist_tracks pt ON p.id = pt.playlist_id
    WHERE p.user_id = ?
    GROUP BY p.id
    ORDER BY p.updated_at DESC
  `).all(userId) as any[];

  return rows.map(r => ({
    id: r.id,
    userId: r.userId,
    name: r.name,
    description: r.description || undefined,
    trackCount: Number(r.trackCount || 0),
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  }));
}

export function createPlaylist(userId: string, name: string, description?: string): UserPlaylist {
  const db = getDb();
  const id = uuidv4();
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO user_playlists (id, user_id, name, description, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, userId, name, description || null, now, now);

  return {
    id,
    userId,
    name,
    description,
    trackCount: 0,
    createdAt: now,
    updatedAt: now,
  };
}

export function getPlaylistDetails(userId: string, playlistId: string) {
  const db = getDb();
  const playlist = db.prepare(`
    SELECT id, user_id as userId, name, description, created_at as createdAt, updated_at as updatedAt
    FROM user_playlists
    WHERE id = ? AND user_id = ?
  `).get(playlistId, userId) as any;

  if (!playlist) return null;

  const tracks = db.prepare(`
    SELECT pt.id as playlistTrackId, pt.position, t.id, t.provider, t.provider_track_id as providerTrackId,
           t.title, t.artist, t.album, t.artwork_url as artworkUrl, t.duration_ms as durationMs, t.stream_url_cached as streamUrl
    FROM user_playlist_tracks pt
    JOIN tracks t ON pt.track_id = t.id
    WHERE pt.playlist_id = ?
    ORDER BY pt.position ASC
  `).all(playlistId) as any[];

  return {
    ...playlist,
    tracks,
  };
}

export async function addTrackToPlaylist(userId: string, playlistId: string, track: Track): Promise<boolean> {
  const db = getDb();
  const playlist = db.prepare('SELECT id FROM user_playlists WHERE id = ? AND user_id = ?').get(playlistId, userId);
  if (!playlist) return false;

  // Cache track in tracks table
  await musicCache.cacheTrack(track);

  // Position calculation
  const maxPosRow = db.prepare('SELECT MAX(position) as maxPos FROM user_playlist_tracks WHERE playlist_id = ?').get(playlistId) as any;
  const nextPos = (maxPosRow?.maxPos ?? -1) + 1;

  const id = uuidv4();
  db.prepare(`
    INSERT INTO user_playlist_tracks (id, playlist_id, track_id, position)
    VALUES (?, ?, ?, ?)
  `).run(id, playlistId, track.id, nextPos);

  db.prepare("UPDATE user_playlists SET updated_at = datetime('now') WHERE id = ?").run(playlistId);
  return true;
}

export function removeTrackFromPlaylist(userId: string, playlistId: string, playlistTrackId: string): boolean {
  const db = getDb();
  const playlist = db.prepare('SELECT id FROM user_playlists WHERE id = ? AND user_id = ?').get(playlistId, userId);
  if (!playlist) return false;

  db.prepare('DELETE FROM user_playlist_tracks WHERE id = ? AND playlist_id = ?').run(playlistTrackId, playlistId);
  db.prepare("UPDATE user_playlists SET updated_at = datetime('now') WHERE id = ?").run(playlistId);
  return true;
}

export function deletePlaylist(userId: string, playlistId: string): boolean {
  const db = getDb();
  const result = db.prepare('DELETE FROM user_playlists WHERE id = ? AND user_id = ?').run(playlistId, userId);
  return result.changes > 0;
}

export function getPlaylistTracksForQueue(playlistId: string): any[] {
  const db = getDb();
  return db.prepare(`
    SELECT t.id, t.title, t.artist, t.artwork_url as artworkUrl, t.duration_ms as durationMs, t.stream_url_cached as streamUrl
    FROM user_playlist_tracks pt
    JOIN tracks t ON pt.track_id = t.id
    WHERE pt.playlist_id = ?
    ORDER BY pt.position ASC
  `).all(playlistId);
}
