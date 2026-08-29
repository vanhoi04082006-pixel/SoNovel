-- SoNovel D1 migration: bảng ảnh minh họa theo bộ truyện (2026-08-23)
-- Worker là nguồn chuẩn dữ liệu (dual-backend Supabase mirror có thể thêm sau).

CREATE TABLE IF NOT EXISTS series_illustrations (
  id TEXT PRIMARY KEY NOT NULL,
  series_id TEXT NOT NULL REFERENCES series(id) ON DELETE CASCADE,
  order_no INTEGER NOT NULL DEFAULT 0,
  image_url TEXT NOT NULL,
  caption TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE INDEX IF NOT EXISTS idx_illustrations_series ON series_illustrations(series_id, order_no);
