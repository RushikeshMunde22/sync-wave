-- Migration 002: Group Themes, Feedbacks, Playlists, and Access Control

-- Add theme column to groups if not present
-- Note: SQLite does not support ADD COLUMN IF NOT EXISTS in all versions, so we use safe statements
ALTER TABLE groups ADD COLUMN theme TEXT DEFAULT 'default';

-- Feedbacks from users
CREATE TABLE IF NOT EXISTS feedbacks (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  user_email TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  status TEXT NOT NULL DEFAULT 'new'
);
CREATE INDEX IF NOT EXISTS idx_feedbacks_created ON feedbacks(created_at);

-- Kicked users per group
CREATE TABLE IF NOT EXISTS group_kicked_users (
  group_id TEXT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kicked_by TEXT NOT NULL REFERENCES users(id),
  kicked_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (group_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_kicked_group ON group_kicked_users(group_id);

-- Group Join Requests (when kicked user requests to rejoin)
CREATE TABLE IF NOT EXISTS group_join_requests (
  id TEXT PRIMARY KEY,
  group_id TEXT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'approved', 'denied')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  resolved_at TEXT,
  resolved_by TEXT REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_join_requests_group ON group_join_requests(group_id, status);

-- User Personal Playlists
CREATE TABLE IF NOT EXISTS user_playlists (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_user_playlists ON user_playlists(user_id);

-- User Personal Playlist Tracks
CREATE TABLE IF NOT EXISTS user_playlist_tracks (
  id TEXT PRIMARY KEY,
  playlist_id TEXT NOT NULL REFERENCES user_playlists(id) ON DELETE CASCADE,
  track_id TEXT NOT NULL REFERENCES tracks(id),
  position INTEGER NOT NULL,
  added_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_user_playlist_tracks ON user_playlist_tracks(playlist_id, position);
