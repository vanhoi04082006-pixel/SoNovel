-- =====================================================================
-- SoNovel — 005_realtime.sql
-- Bật Supabase Realtime cho các bảng cần đồng bộ 2 chiều web ↔ app.
-- Cách áp dụng: Supabase Dashboard → SQL Editor → dán và chạy, HOẶC
--   supabase db push (cần mật khẩu DB).
-- =====================================================================

-- REPLICA IDENTITY FULL để Realtime gửi đủ nội dung dòng cho RLS filter
-- (các bảng có RLS theo user_id).
alter table public.progress       replica identity full;
alter table public.favorites      replica identity full;
alter table public.history        replica identity full;
alter table public.bookmarks      replica identity full;
alter table public.user_settings  replica identity full;

-- Thêm bảng vào publication supabase_realtime (idempotent).
alter publication supabase_realtime add table public.progress;
alter publication supabase_realtime add table public.favorites;
alter publication supabase_realtime add table public.history;
alter publication supabase_realtime add table public.bookmarks;
alter publication supabase_realtime add table public.user_settings;
alter publication supabase_realtime add table public.series;
alter publication supabase_realtime add table public.chapters;
alter publication supabase_realtime add table public.tags;
