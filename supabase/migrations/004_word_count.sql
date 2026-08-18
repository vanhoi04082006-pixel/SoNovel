-- =====================================================================
-- Migration 004: series.word_count + hàm recalc + trigger (per §5.5, §10.6)
-- ---------------------------------------------------------------------
-- Áp dụng SAU 003_tags.sql. Idempotent — an toàn khi chạy lại.
-- Tự động tính lại series.word_count = sum(length(content)/5) cho các
-- chương published mỗi khi chapters đổi (INSERT/UPDATE/DELETE).
-- =====================================================================

-- =====================================================================
-- Thêm cột word_count cho series (nếu chưa có)
-- =====================================================================
alter table public.series
  add column if not exists word_count integer not null default 0;

-- =====================================================================
-- Hàm recalc_series_word_count(p_series): tính lại word_count cho 1 series
-- Công thức: sum(length(content)/5) cho các chương published (§10.6)
-- =====================================================================
create or replace function public.recalc_series_word_count(p_series uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.series
  set word_count = coalesce((
    select sum(length(content) / 5) from public.chapters
    where series_id = p_series and status = 'published'
  ), 0)::integer
  where id = p_series;
end;
$$;

-- =====================================================================
-- Hàm trigger chapters_sync_word_count: sau INSERT/UPDATE/DELETE chapters
-- → gọi recalc_series_word_count cho series bị ảnh hưởng
-- =====================================================================
create or replace function public.chapters_sync_word_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (tg_op = 'DELETE') then
    perform public.recalc_series_word_count(old.series_id);
    return old;
  else
    -- INSERT / UPDATE: dùng new.series_id
    -- Nếu UPDATE đổi series_id thì tính lại cả old và new
    if (tg_op = 'UPDATE' and old.series_id is distinct from new.series_id) then
      perform public.recalc_series_word_count(old.series_id);
    end if;
    perform public.recalc_series_word_count(new.series_id);
    return new;
  end if;
end;
$$;

-- =====================================================================
-- Trigger chapters_sync_word_count sau INSERT/UPDATE/DELETE chapters
-- =====================================================================
drop trigger if exists chapters_sync_word_count on public.chapters;
create trigger chapters_sync_word_count
  after insert or update or delete on public.chapters
  for each row execute function public.chapters_sync_word_count();

-- =====================================================================
-- Tính lại word_count cho tất cả series hiện có (đảm bảo dữ liệu cũ khớp)
-- =====================================================================
do $$
declare
  s record;
begin
  for s in select id from public.series loop
    perform public.recalc_series_word_count(s.id);
  end loop;
end $$;

-- =====================================================================
-- Hết migration 004_word_count.sql
-- =====================================================================
