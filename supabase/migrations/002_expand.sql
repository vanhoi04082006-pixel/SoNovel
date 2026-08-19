-- =====================================================================
-- Migration 002: Mở rộng schema — dual-track read/listen, favorites,
-- history, settings, audio (per §5.2)
-- ---------------------------------------------------------------------
-- Áp dụng SAU schema.sql. Idempotent — an toàn khi chạy lại nhiều lần.
-- Đảm bảo các bảng: progress (dual-track), favorites, history,
-- user_settings, chapter_audio tồn tại đầy đủ + RLS + trigger.
-- =====================================================================

-- =====================================================================
-- progress: đảm bảo bảng tồn tại + dual-track read/listen đầy đủ
-- =====================================================================

-- Tạo bảng nếu chưa có (trường hợp base schema chỉ có progress tối giản)
create table if not exists public.progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  series_id uuid not null references public.series(id) on delete cascade,
  updated_at timestamptz not null default now(),
  unique (user_id, series_id)
);

-- Track ĐỌC (read_chapter_id, read_char_index, read_percent, last_read_at)
alter table public.progress add column if not exists read_chapter_id uuid references public.chapters(id) on delete set null;
alter table public.progress add column if not exists read_char_index integer not null default 0;
alter table public.progress add column if not exists read_percent numeric not null default 0;
alter table public.progress add column if not exists last_read_at timestamptz;

-- Track NGHE (listen_chapter_id, listen_char_index, audio_sec, playback_speed, last_listened_at)
alter table public.progress add column if not exists listen_chapter_id uuid references public.chapters(id) on delete set null;
alter table public.progress add column if not exists listen_char_index integer not null default 0;
alter table public.progress add column if not exists audio_sec numeric not null default 0;
alter table public.progress add column if not exists playback_speed numeric not null default 1.0;
alter table public.progress add column if not exists last_listened_at timestamptz;

-- Cột updated_at + ràng buộc unique(user_id, series_id)
alter table public.progress add column if not exists updated_at timestamptz not null default now();
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'progress_user_id_series_id_key'
      and conrelid = 'public.progress'::regclass
  ) then
    alter table public.progress
      add constraint progress_user_id_series_id_key unique (user_id, series_id);
  end if;
end $$;

-- =====================================================================
-- favorites: truyện yêu thích (PK kép user_id + series_id)
-- =====================================================================
create table if not exists public.favorites (
  user_id uuid not null references auth.users(id) on delete cascade,
  series_id uuid not null references public.series(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, series_id)
);

-- =====================================================================
-- history: lịch sử mở truyện (PK kép user_id + series_id)
-- =====================================================================
create table if not exists public.history (
  user_id uuid not null references auth.users(id) on delete cascade,
  series_id uuid not null references public.series(id) on delete cascade,
  opened_count integer not null default 1,
  last_opened_at timestamptz not null default now(),
  primary key (user_id, series_id)
);

-- =====================================================================
-- user_settings: cài đặt người dùng
-- =====================================================================
create table if not exists public.user_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  theme text not null default 'light' check (theme in ('light','dark','sepia','amoled')),
  playback_speed numeric not null default 1.0,
  font_size integer not null default 18,
  font_family text not null default 'system',
  line_height numeric not null default 1.7,
  autoplay_next boolean not null default true,
  updated_at timestamptz not null default now()
);

-- =====================================================================
-- chapter_audio: dự phòng cho audio render sau này
-- =====================================================================
create table if not exists public.chapter_audio (
  chapter_id uuid primary key references public.chapters(id) on delete cascade,
  audio_url text not null default '',
  duration_sec numeric not null default 0,
  created_at timestamptz not null default now()
);

-- =====================================================================
-- RLS cho các bảng expand (idempotent qua DO block)
-- =====================================================================

-- progress: chỉ chủ sở hữu
do $$
begin
  alter table public.progress enable row level security;
  if not exists (
    select 1 from pg_policy
    where polname = 'progress_owner_all' and polrelid = 'public.progress'::regclass
  ) then
    create policy "progress_owner_all"
      on public.progress for all
      using (auth.uid() = user_id) with check (auth.uid() = user_id);
  end if;
end $$;

-- favorites: chỉ chủ sở hữu
do $$
begin
  alter table public.favorites enable row level security;
  if not exists (
    select 1 from pg_policy
    where polname = 'favorites_owner_all' and polrelid = 'public.favorites'::regclass
  ) then
    create policy "favorites_owner_all"
      on public.favorites for all
      using (auth.uid() = user_id) with check (auth.uid() = user_id);
  end if;
end $$;

-- history: chỉ chủ sở hữu
do $$
begin
  alter table public.history enable row level security;
  if not exists (
    select 1 from pg_policy
    where polname = 'history_owner_all' and polrelid = 'public.history'::regclass
  ) then
    create policy "history_owner_all"
      on public.history for all
      using (auth.uid() = user_id) with check (auth.uid() = user_id);
  end if;
end $$;

-- user_settings: chỉ chủ sở hữu
do $$
begin
  alter table public.user_settings enable row level security;
  if not exists (
    select 1 from pg_policy
    where polname = 'user_settings_owner_all' and polrelid = 'public.user_settings'::regclass
  ) then
    create policy "user_settings_owner_all"
      on public.user_settings for all
      using (auth.uid() = user_id) with check (auth.uid() = user_id);
  end if;
end $$;

-- chapter_audio: chỉ select public (không có write policy — dự phòng)
do $$
begin
  alter table public.chapter_audio enable row level security;
  if not exists (
    select 1 from pg_policy
    where polname = 'chapter_audio_select_public' and polrelid = 'public.chapter_audio'::regclass
  ) then
    create policy "chapter_audio_select_public"
      on public.chapter_audio for select using (true);
  end if;
end $$;

-- =====================================================================
-- Triggers set_updated_at cho progress + user_settings
-- =====================================================================

-- Hàm set_updated_at (idempotent — tạo hoặc thay thế)
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Trigger cho progress
drop trigger if exists set_updated_at_progress on public.progress;
create trigger set_updated_at_progress
  before update on public.progress
  for each row execute function public.set_updated_at();

-- Trigger cho user_settings
drop trigger if exists set_updated_at_user_settings on public.user_settings;
create trigger set_updated_at_user_settings
  before update on public.user_settings
  for each row execute function public.set_updated_at();

-- =====================================================================
-- Trigger ensure_user_settings sau INSERT progress
-- =====================================================================

-- Hàm ensure_user_settings: security definer — tạo user_settings mặc định
create or replace function public.ensure_user_settings()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.user_settings (user_id) values (new.user_id)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

-- Trigger sau INSERT progress
drop trigger if exists ensure_user_settings_progress on public.progress;
create trigger ensure_user_settings_progress
  after insert on public.progress
  for each row execute function public.ensure_user_settings();

-- =====================================================================
-- Hết migration 002_expand.sql
-- =====================================================================
