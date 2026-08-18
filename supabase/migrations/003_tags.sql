-- =====================================================================
-- Migration 003: Bảng tags master + seed 15 tag mặc định (per §5.2, §5.6)
-- ---------------------------------------------------------------------
-- Áp dụng SAU 002_expand.sql. Idempotent — an toàn khi chạy lại.
-- Yêu cầu: hàm public.is_admin() đã tồn tại (từ schema.sql).
-- =====================================================================

-- =====================================================================
-- Bảng tags (master, quản lý tập trung)
-- =====================================================================
create table if not exists public.tags (
  id uuid primary key default gen_random_uuid(),
  name text unique not null,
  created_at timestamptz not null default now()
);

-- =====================================================================
-- RLS cho tags: select public; write chỉ admin
-- =====================================================================
do $$
begin
  alter table public.tags enable row level security;

  -- Policy select public
  if not exists (
    select 1 from pg_policy
    where polname = 'tags_select_public' and polrelid = 'public.tags'::regclass
  ) then
    create policy "tags_select_public"
      on public.tags for select using (true);
  end if;

  -- Policy write (insert/update/delete) chỉ admin
  if not exists (
    select 1 from pg_policy
    where polname = 'tags_write_admin' and polrelid = 'public.tags'::regclass
  ) then
    create policy "tags_write_admin"
      on public.tags for all
      using (public.is_admin())
      with check (public.is_admin());
  end if;
end $$;

-- =====================================================================
-- Seed 15 tag mặc định (theo §5.6)
-- =====================================================================
insert into public.tags (name) values
  ('hệ thống'),
  ('xuyên không'),
  ('sảng văn'),
  ('ngôn tình'),
  ('kiếm hiệp'),
  ('tiên hiệp'),
  ('đô thị'),
  ('huyền huyễn'),
  ('đồng nhân'),
  ('dị giới'),
  ('võng du'),
  ('trọng sinh'),
  ('làm ruộng'),
  ('xây dựng'),
  ('tình cảm')
on conflict (name) do nothing;

-- =====================================================================
-- Hết migration 003_tags.sql
-- =====================================================================
