-- 0003: thêm cột view_count cho ranking theo lượt xem (đổi số từ 0002 trùng với 0002_fts5)
ALTER TABLE series ADD COLUMN view_count INTEGER NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_series_view_count ON series(view_count DESC);
