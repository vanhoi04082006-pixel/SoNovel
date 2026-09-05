-- 0004: bảng site_settings cho cài đặt chung (link tải app Android...)
CREATE TABLE IF NOT EXISTS site_settings (
  key TEXT PRIMARY KEY NOT NULL,
  value TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

-- Seed link APK Android mặc định
INSERT INTO site_settings (key, value) VALUES
  ('android_apk_url', 'https://drive.google.com/file/d/1mUEFIWG_dDNxbcfZmiR7O1no6Nql9tdk/view?usp=drive_link')
ON CONFLICT(key) DO NOTHING;
