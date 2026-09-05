-- 0002_fts5 — VÔ HIỆU HÓA (2026-09-05): bảng series_fts bị SQLITE_CORRUPT_VTAB trên D1
-- production, làm mọi UPDATE series sập. Đã DROP TABLE + triggers trực tiếp.
-- Search dùng LIKE fallback trong workers/src/index.ts (xem catch 'no such table').
-- KHÔNG tạo lại FTS tại đây; muốn dùng lại phải migration mới + test kỹ.
SELECT 1;
