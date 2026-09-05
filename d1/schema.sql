-- =====================================================================
-- SoNovel — D1 (SQLite) schema — port từ supabase/schema.sql
-- ---------------------------------------------------------------------
-- Thay đổi so với Postgres:
--   - uuid -> TEXT (dùng crypto.randomUUID() trong Worker)
--   - text[] (genres/tags) -> TEXT chứa JSON array (lọc qua json_each)
--   - timestamptz -> TEXT (ISO 8601 UTC) hoặc INTEGER (epoch ms)
--   - triggers/functions/RLS -> logic nằm trong Worker API
--   - word_count tự tính trong code Worker khi write chapters
-- =====================================================================

PRAGMA foreign_keys = ON;

-- profiles: 1-1 với auth.users (Supabase Auth giữ users, D1 giữ role)
CREATE TABLE IF NOT EXISTS profiles (
  id TEXT PRIMARY KEY NOT NULL,            -- = auth.users.id
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user','admin')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

-- series: bộ truyện
CREATE TABLE IF NOT EXISTS series (
  id TEXT PRIMARY KEY NOT NULL,
  title TEXT NOT NULL,
  author TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  cover_url TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('draft','published','completed','hidden')),
  genres TEXT NOT NULL DEFAULT '[]',       -- JSON array ["a","b"]
  tags TEXT NOT NULL DEFAULT '[]',         -- JSON array ["a","b"]
  word_count INTEGER NOT NULL DEFAULT 0,
  view_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE INDEX IF NOT EXISTS idx_series_status_updated ON series(status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_series_title ON series(title);
CREATE INDEX IF NOT EXISTS idx_series_author ON series(author);
CREATE INDEX IF NOT EXISTS idx_series_view_count ON series(view_count DESC);

-- chapters: chương truyện — CHỈ draft/published
CREATE TABLE IF NOT EXISTS chapters (
  id TEXT PRIMARY KEY NOT NULL,
  series_id TEXT NOT NULL REFERENCES series(id) ON DELETE CASCADE,
  order_no INTEGER NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('draft','published')),
  published_at TEXT,
  word_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE (series_id, order_no)
);

CREATE INDEX IF NOT EXISTS idx_chapters_series_order ON chapters(series_id, order_no);

-- progress: 2 track ĐỌC và NGHE
CREATE TABLE IF NOT EXISTS progress (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  series_id TEXT NOT NULL REFERENCES series(id) ON DELETE CASCADE,
  read_chapter_id TEXT REFERENCES chapters(id) ON DELETE SET NULL,
  read_char_index INTEGER NOT NULL DEFAULT 0,
  read_percent REAL NOT NULL DEFAULT 0,
  last_read_at TEXT,
  listen_chapter_id TEXT REFERENCES chapters(id) ON DELETE SET NULL,
  listen_char_index INTEGER NOT NULL DEFAULT 0,
  audio_sec REAL NOT NULL DEFAULT 0,
  playback_speed REAL NOT NULL DEFAULT 1.0,
  last_listened_at TEXT,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE (user_id, series_id)
);

CREATE INDEX IF NOT EXISTS idx_progress_user ON progress(user_id, last_listened_at DESC);

-- favorites
CREATE TABLE IF NOT EXISTS favorites (
  user_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  series_id TEXT NOT NULL REFERENCES series(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  PRIMARY KEY (user_id, series_id)
);

-- bookmarks
CREATE TABLE IF NOT EXISTS bookmarks (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  series_id TEXT NOT NULL REFERENCES series(id) ON DELETE CASCADE,
  chapter_id TEXT NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
  char_index INTEGER NOT NULL DEFAULT 0,
  note TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE INDEX IF NOT EXISTS idx_bookmarks_user ON bookmarks(user_id, created_at DESC);

-- history
CREATE TABLE IF NOT EXISTS history (
  user_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  series_id TEXT NOT NULL REFERENCES series(id) ON DELETE CASCADE,
  opened_count INTEGER NOT NULL DEFAULT 1,
  last_opened_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  PRIMARY KEY (user_id, series_id)
);

-- user_settings
CREATE TABLE IF NOT EXISTS user_settings (
  user_id TEXT PRIMARY KEY NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  theme TEXT NOT NULL DEFAULT 'light' CHECK (theme IN ('light','dark','sepia','amoled')),
  playback_speed REAL NOT NULL DEFAULT 1.0,
  font_size INTEGER NOT NULL DEFAULT 18,
  font_family TEXT NOT NULL DEFAULT 'system',
  line_height REAL NOT NULL DEFAULT 1.7,
  autoplay_next INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

-- chapter_audio: dự phòng
CREATE TABLE IF NOT EXISTS chapter_audio (
  chapter_id TEXT PRIMARY KEY NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
  audio_url TEXT NOT NULL DEFAULT '',
  duration_sec REAL NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

-- tags: bảng master
CREATE TABLE IF NOT EXISTS tags (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT UNIQUE NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
-- series_illustrations: ?nh minh h?a theo b? truy?n (tab Minh h?a)
CREATE TABLE IF NOT EXISTS series_illustrations (
  id TEXT PRIMARY KEY NOT NULL,
  series_id TEXT NOT NULL REFERENCES series(id) ON DELETE CASCADE,
  order_no INTEGER NOT NULL DEFAULT 0,
  image_url TEXT NOT NULL,
  caption TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_illustrations_series ON series_illustrations(series_id, order_no);

-- FTS5 cho tìm kiếm title/author (mirror workers/migrations/0002_fts5.sql)
CREATE VIRTUAL TABLE IF NOT EXISTS series_fts USING fts5(
  title, author, content='series', content_rowid='rowid', tokenize='unicode61 "remove_diacritics 2"'
);
CREATE TRIGGER IF NOT EXISTS trg_series_fts_insert AFTER INSERT ON series BEGIN
  INSERT INTO series_fts(rowid, title, author) VALUES (new.rowid, new.title, new.author);
END;
CREATE TRIGGER IF NOT EXISTS trg_series_fts_delete AFTER DELETE ON series BEGIN
  INSERT INTO series_fts(series_fts, rowid, title, author) VALUES('delete', old.rowid, old.title, old.author);
END;
CREATE TRIGGER IF NOT EXISTS trg_series_fts_update AFTER UPDATE ON series BEGIN
  INSERT INTO series_fts(series_fts, rowid, title, author) VALUES('delete', old.rowid, old.title, old.author);
  INSERT INTO series_fts(rowid, title, author) VALUES (new.rowid, new.title, new.author);
END;
