CREATE TABLE IF NOT EXISTS promotions (
  id TEXT PRIMARY KEY,
  headline TEXT NOT NULL,
  subtext TEXT,
  image_url TEXT NOT NULL,
  cta_text TEXT NOT NULL DEFAULT 'Learn More',
  redirect_url TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1,
  start_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_promotions_active ON promotions(is_active, expires_at);
