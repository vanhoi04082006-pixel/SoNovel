-- =====================================================================
-- SoNovel — 007: Ẩn draft/hidden khỏi public (RLS)
-- ---------------------------------------------------------------------
-- Trước đây policy select public cho series/chapters là `using (true)` →
-- mọi người (kể cả anon key trong client) đọc được draft/hidden qua REST.
-- Sửa: public chỉ đọc series published/completed + chapters published
-- của series hiển thị; admin đọc được tất cả.
-- Chạy trên Supabase SQL Editor (hoặc `supabase db push`).
-- =====================================================================

-- series: public chỉ thấy published/completed; admin thấy tất cả
drop policy if exists "series_select_public" on public.series;
create policy "series_select_public"
  on public.series for select
  using (
    status in ('published', 'completed')
    or public.is_admin()
  );

-- chapters: public chỉ thấy chapter published của series hiển thị; admin thấy tất cả
drop policy if exists "chapters_select_public" on public.chapters;
create policy "chapters_select_public"
  on public.chapters for select
  using (
    public.is_admin()
    or (
      status = 'published'
      and exists (
        select 1 from public.series s
        where s.id = chapters.series_id
          and s.status in ('published', 'completed')
      )
    )
  );
