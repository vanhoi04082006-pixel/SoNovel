-- 0002_fts5 — FTS5 cho series.title/author (PERF-FTS-01)
-- D1 SQLite FTS5 với unicode61 + remove_diacritics để tìm không dấu
-- NOTE: D1 không hỗ trợ tokenize remove_diacritics → dùng unicode61 thuần (tìm có dấu).
CREATE VIRTUAL TABLE IF NOT EXISTS series_fts USING fts5(
  title, author, content='series', content_rowid='rowid', tokenize='unicode61'
);

-- Backfill existing rows
INSERT INTO series_fts(rowid, title, author)
  SELECT rowid, title, author FROM series
  WHERE rowid NOT IN (SELECT rowid FROM series_fts);

-- Triggers keep FTS in sync
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
