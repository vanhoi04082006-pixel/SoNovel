-- 0007: thêm width/height cho ảnh minh họa (app dựng khung ngay, khỏi getSize tải trùng)
ALTER TABLE series_illustrations ADD COLUMN width INTEGER NOT NULL DEFAULT 0;
ALTER TABLE series_illustrations ADD COLUMN height INTEGER NOT NULL DEFAULT 0;
