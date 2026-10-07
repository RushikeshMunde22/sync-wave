-- Group Song Requests
CREATE TABLE IF NOT EXISTS group_song_requests (
  id TEXT PRIMARY KEY,
  group_id TEXT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  track_id TEXT NOT NULL,
  title TEXT NOT NULL,
  artist TEXT NOT NULL,
  artwork_url TEXT,
  duration_ms INTEGER NOT NULL,
  media_type TEXT DEFAULT 'audio',
  video_id TEXT,
  requested_by TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  requested_by_name TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_group_song_requests_group ON group_song_requests(group_id);
