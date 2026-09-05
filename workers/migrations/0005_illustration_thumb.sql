-- 0005: thêm cột thumb_url cho ảnh minh họa (bản preview nhẹ ~800px, hiện ngay khi mạng yếu)
ALTER TABLE series_illustrations ADD COLUMN thumb_url TEXT NOT NULL DEFAULT '';
