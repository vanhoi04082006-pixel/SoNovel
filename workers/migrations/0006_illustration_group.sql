-- 0006: thêm cột group_name cho ảnh minh họa (chia mục có tên, thu gọn được)
ALTER TABLE series_illustrations ADD COLUMN group_name TEXT NOT NULL DEFAULT '';
CREATE INDEX IF NOT EXISTS idx_illustrations_series_group ON series_illustrations(series_id, group_name, order_no);
