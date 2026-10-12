-- NOCTRA2: users and private catalogue. Only metadata stored here; no movie bytes.
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL COLLATE NOCASE UNIQUE,
  password_hash TEXT NOT NULL,
  salt TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'viewer' CHECK(role IN ('admin','viewer')),
  disabled INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE TABLE IF NOT EXISTS attempts (
  attempt_key TEXT PRIMARY KEY,
  failures INTEGER NOT NULL,
  window_start INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS catalog (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  genre TEXT NOT NULL DEFAULT 'Otros',
  year TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  poster TEXT NOT NULL DEFAULT '',
  file_id TEXT NOT NULL,
  series_name TEXT NOT NULL DEFAULT '',
  path TEXT NOT NULL DEFAULT '',
  height INTEGER,
  size INTEGER,
  updated_at INTEGER NOT NULL
);