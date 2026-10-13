-- Resume state and minimal playback diagnostics; no passwords, IPs or stream URLs.
CREATE TABLE IF NOT EXISTS watch_progress (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  media_id TEXT NOT NULL,
  position REAL NOT NULL DEFAULT 0,
  duration REAL NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY(user_id, media_id)
);
CREATE INDEX IF NOT EXISTS idx_watch_progress_updated ON watch_progress(user_id, updated_at DESC);
CREATE TABLE IF NOT EXISTS watch_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  media_id TEXT NOT NULL,
  event_type TEXT NOT NULL CHECK(event_type IN ('play','complete','error')),
  error_code TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_watch_events_created ON watch_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_watch_events_user ON watch_events(user_id, created_at DESC);
