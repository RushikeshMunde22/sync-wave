-- Users
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT,
  google_id TEXT UNIQUE,
  display_name TEXT NOT NULL,
  avatar_emoji TEXT NOT NULL DEFAULT '🎵',
  avatar_color TEXT NOT NULL DEFAULT '#6366f1',
  role TEXT NOT NULL DEFAULT 'user' CHECK(role IN ('user', 'superadmin')),
  is_banned INTEGER NOT NULL DEFAULT 0,
  recovery_code_hash TEXT,
  force_password_change INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_seen_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Sessions
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  user_agent_hash TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_sessions_user ON sessions(user_id);
CREATE INDEX idx_sessions_expires ON sessions(expires_at);

-- Groups
CREATE TABLE IF NOT EXISTS groups (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  owner_id TEXT NOT NULL REFERENCES users(id),
  invite_code TEXT UNIQUE NOT NULL,
  invite_expires_at TEXT,
  invite_revoked INTEGER NOT NULL DEFAULT 0,
  members_can_control INTEGER NOT NULL DEFAULT 0,
  max_members INTEGER NOT NULL DEFAULT 50,
  is_closed INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_groups_invite ON groups(invite_code);
CREATE INDEX idx_groups_owner ON groups(owner_id);

-- Group Members
CREATE TABLE IF NOT EXISTS group_members (
  group_id TEXT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member' CHECK(role IN ('owner', 'admin', 'member')),
  joined_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (group_id, user_id)
);
CREATE INDEX idx_group_members_user ON group_members(user_id);

-- Tracks (cache of API results)
CREATE TABLE IF NOT EXISTS tracks (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  provider_track_id TEXT NOT NULL,
  title TEXT NOT NULL,
  artist TEXT NOT NULL,
  album TEXT,
  artwork_url TEXT,
  duration_ms INTEGER NOT NULL,
  stream_url_cached TEXT,
  license TEXT,
  attribution TEXT,
  cached_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(provider, provider_track_id)
);

-- Playlists
CREATE TABLE IF NOT EXISTS playlists (
  id TEXT PRIMARY KEY,
  group_id TEXT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_by TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_playlists_group ON playlists(group_id);

-- Playlist Tracks
CREATE TABLE IF NOT EXISTS playlist_tracks (
  playlist_id TEXT NOT NULL REFERENCES playlists(id) ON DELETE CASCADE,
  track_id TEXT NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  added_by TEXT NOT NULL REFERENCES users(id),
  added_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (playlist_id, track_id)
);

-- Queue Items
CREATE TABLE IF NOT EXISTS queue_items (
  id TEXT PRIMARY KEY,
  group_id TEXT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  track_id TEXT NOT NULL REFERENCES tracks(id),
  position INTEGER NOT NULL,
  added_by TEXT NOT NULL REFERENCES users(id),
  added_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_queue_group ON queue_items(group_id, position);

-- Playback State
CREATE TABLE IF NOT EXISTS playback_state (
  group_id TEXT PRIMARY KEY REFERENCES groups(id) ON DELETE CASCADE,
  track_id TEXT REFERENCES tracks(id),
  is_playing INTEGER NOT NULL DEFAULT 0,
  position_ms INTEGER NOT NULL DEFAULT 0,
  updated_at_server_ms INTEGER NOT NULL DEFAULT 0,
  version INTEGER NOT NULL DEFAULT 0,
  controlled_by TEXT REFERENCES users(id)
);

-- Reactions Log (short retention)
CREATE TABLE IF NOT EXISTS reactions_log (
  id TEXT PRIMARY KEY,
  group_id TEXT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  track_id TEXT REFERENCES tracks(id),
  emoji TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_reactions_group ON reactions_log(group_id);
CREATE INDEX idx_reactions_created ON reactions_log(created_at);

-- Audit Log
CREATE TABLE IF NOT EXISTS audit_log (
  id TEXT PRIMARY KEY,
  actor_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  target TEXT,
  metadata TEXT,
  ip_hash TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_audit_action ON audit_log(action);
CREATE INDEX idx_audit_created ON audit_log(created_at);

-- Reports
CREATE TABLE IF NOT EXISTS reports (
  id TEXT PRIMARY KEY,
  reporter_id TEXT NOT NULL REFERENCES users(id),
  group_id TEXT REFERENCES groups(id) ON DELETE SET NULL,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'resolved', 'dismissed')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_reports_status ON reports(status);

-- Feature Flags
CREATE TABLE IF NOT EXISTS feature_flags (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Blocked Content
CREATE TABLE IF NOT EXISTS blocked_tracks (
  provider TEXT NOT NULL,
  provider_track_id TEXT NOT NULL,
  reason TEXT,
  blocked_by TEXT REFERENCES users(id),
  blocked_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (provider, provider_track_id)
);

-- Skip Votes
CREATE TABLE IF NOT EXISTS skip_votes (
  group_id TEXT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  track_id TEXT NOT NULL REFERENCES tracks(id),
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (group_id, track_id, user_id)
);
