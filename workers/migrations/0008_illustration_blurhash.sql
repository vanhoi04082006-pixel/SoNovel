-- 0008: thêm cột blurhash cho ảnh minh họa (placeholder tức thì, ~28 ký tự)
ALTER TABLE series_illustrations ADD COLUMN blurhash TEXT NOT NULL DEFAULT '';
