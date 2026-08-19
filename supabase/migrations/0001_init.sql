-- =====================================================================
-- SoNovel — Schema gốc (Supabase) — per SPEC §5.1–§5.6
-- ---------------------------------------------------------------------
-- File này dựng TOÀN BỘ schema cuối cùng: bảng, RLS, storage, hàm, trigger, seed.
-- Có thể chạy một mình để dựng môi trường đầy đủ.
-- Các migration 002/003/004 tồn tại như một đường lối nâng cấp dần (idempotent),
-- chạy sau file này sẽ là no-op an toàn (xem README §5.7).
-- =====================================================================

-- =====================================================================
-- §5.2 — Bảng dữ liệu chính
-- =====================================================================

-- profiles: bảng 1-1 với auth.users, lưu role (user/admin)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'user' check (role in ('user','admin')),
  created_at timestamptz not null default now()
);

-- series: bộ truyện
create table if not exists public.series (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  author text not null default '',
  description text not null default '',
  cover_url text not null default '',
  status text not null default 'published' check (status in ('draft','published','completed','hidden')),
  genres text[] not null default '{}',
  tags text[] not null default '{}',
  word_count integer not null default 0,         -- migration 004 tự cập nhật qua trigger
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- chapters: chương truyện — CHỈ 2 trạng thái draft/published (§10.5)
create table if not exists public.chapters (
  id uuid primary key default gen_random_uuid(),
  series_id uuid not null references public.series(id) on delete cascade,
  order_no integer not null,
  title text not null,
  content text not null default '',               -- nội dung văn bản app sẽ đọc
  status text not null default 'published' check (status in ('draft','published')),
  published_at timestamptz,
  word_count integer not null default 0,
  created_at timestamptz not null default now(),
  unique (series_id, order_no)
);

-- progress: 2 track ĐỌC và NGHE (dual-track per §5.2)
create table if not exists public.progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  series_id uuid not null references public.series(id) on delete cascade,
  -- Track ĐỌC
  read_chapter_id uuid references public.chapters(id) on delete set null,
  read_char_index integer not null default 0,
  read_percent double precision not null default 0,
  last_read_at timestamptz,
  -- Track NGHE
  listen_chapter_id uuid references public.chapters(id) on delete set null,
  listen_char_index integer not null default 0,
  audio_sec double precision not null default 0,
  playback_speed double precision not null default 1.0,
  last_listened_at timestamptz,
  -- Metadata
  updated_at timestamptz not null default now(),
  unique (user_id, series_id)
);

-- favorites: truyện yêu thích (PK kép user_id + series_id)
create table if not exists public.favorites (
  user_id uuid not null references auth.users(id) on delete cascade,
  series_id uuid not null references public.series(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, series_id)
);

-- bookmarks: đánh dấu vị trí trong chương
create table if not exists public.bookmarks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  series_id uuid not null references public.series(id) on delete cascade,
  chapter_id uuid not null references public.chapters(id) on delete cascade,
  char_index integer not null default 0,
  note text not null default '',
  created_at timestamptz not null default now()
);

-- history: lịch sử mở truyện (PK kép user_id + series_id)
create table if not exists public.history (
  user_id uuid not null references auth.users(id) on delete cascade,
  series_id uuid not null references public.series(id) on delete cascade,
  opened_count integer not null default 1,
  last_opened_at timestamptz not null default now(),
  primary key (user_id, series_id)
);

-- user_settings: cài đặt người dùng
create table if not exists public.user_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  theme text not null default 'light' check (theme in ('light','dark','sepia','amoled')),
  playback_speed double precision not null default 1.0,
  font_size integer not null default 18,
  font_family text not null default 'system',
  line_height double precision not null default 1.7,
  autoplay_next boolean not null default true,
  updated_at timestamptz not null default now()
);

-- chapter_audio: dự phòng cho audio render sau này (hiện chưa dùng)
create table if not exists public.chapter_audio (
  chapter_id uuid primary key references public.chapters(id) on delete cascade,
  audio_url text not null default '',
  duration_sec double precision not null default 0,
  created_at timestamptz not null default now()
);

-- tags: bảng master quản lý tag tập trung
create table if not exists public.tags (
  id uuid primary key default gen_random_uuid(),
  name text unique not null,
  created_at timestamptz not null default now()
);

-- =====================================================================
-- §5.5 — Hàm (functions)
-- =====================================================================

-- is_admin(): helper security definer — kiểm tra user hiện tại có role admin không
-- Dùng trong RLS policies của series/chapters/tags và storage bucket covers.
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

-- handle_new_user(): trigger after INSERT trên auth.users → tự tạo profiles
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id) values (new.id)
  on conflict (id) do nothing;
  return new;
end;
$$;

-- set_updated_at(): trigger before UPDATE → cập nhật updated_at = now()
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ensure_user_settings(): trigger after INSERT progress → tạo user_settings mặc định nếu chưa có
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

-- recalc_series_word_count(p_series): tính lại series.word_count
-- = sum(length(content)/5) cho các chương published (§10.6)
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

-- chapters_sync_word_count(): trigger after INSERT/UPDATE/DELETE trên chapters
-- → gọi recalc_series_word_count cho series bị ảnh hưởng
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
    perform public.recalc_series_word_count(new.series_id);
    return new;
  end if;
end;
$$;

-- =====================================================================
-- §5.5 — Triggers
-- =====================================================================

-- Tạo profile tự động khi auth.users có user mới
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Cập nhật updated_at trên progress
drop trigger if exists set_updated_at_progress on public.progress;
create trigger set_updated_at_progress
  before update on public.progress
  for each row execute function public.set_updated_at();

-- Cập nhật updated_at trên user_settings
drop trigger if exists set_updated_at_user_settings on public.user_settings;
create trigger set_updated_at_user_settings
  before update on public.user_settings
  for each row execute function public.set_updated_at();

-- Cập nhật updated_at trên series
drop trigger if exists set_updated_at_series on public.series;
create trigger set_updated_at_series
  before update on public.series
  for each row execute function public.set_updated_at();

-- Tự tạo user_settings khi user tạo progress đầu tiên
drop trigger if exists ensure_user_settings_progress on public.progress;
create trigger ensure_user_settings_progress
  after insert on public.progress
  for each row execute function public.ensure_user_settings();

-- Tự tính lại series.word_count khi chapters đổi (insert/update/delete)
drop trigger if exists chapters_sync_word_count on public.chapters;
create trigger chapters_sync_word_count
  after insert or update or delete on public.chapters
  for each row execute function public.chapters_sync_word_count();

-- =====================================================================
-- §5.3 — Row Level Security (RLS)
-- =====================================================================

-- Bật RLS cho toàn bộ bảng
alter table public.profiles       enable row level security;
alter table public.series         enable row level security;
alter table public.chapters       enable row level security;
alter table public.progress       enable row level security;
alter table public.favorites      enable row level security;
alter table public.bookmarks      enable row level security;
alter table public.history        enable row level security;
alter table public.user_settings  enable row level security;
alter table public.chapter_audio  enable row level security;
alter table public.tags           enable row level security;

-- profiles: select public; insert/update bởi chính chủ
create policy "profiles_select_public"
  on public.profiles for select using (true);
create policy "profiles_insert_owner"
  on public.profiles for insert with check (auth.uid() = id);
create policy "profiles_update_owner"
  on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);

-- series: select public; insert/update/delete chỉ admin
create policy "series_select_public"
  on public.series for select using (true);
create policy "series_write_admin"
  on public.series for all
  using (public.is_admin())
  with check (public.is_admin());

-- chapters: select public; insert/update/delete chỉ admin
create policy "chapters_select_public"
  on public.chapters for select using (true);
create policy "chapters_write_admin"
  on public.chapters for all
  using (public.is_admin())
  with check (public.is_admin());

-- progress: mọi thao tác chỉ chủ sở hữu
create policy "progress_owner_all"
  on public.progress for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- favorites: mọi thao tác chỉ chủ sở hữu
create policy "favorites_owner_all"
  on public.favorites for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- bookmarks: mọi thao tác chỉ chủ sở hữu
create policy "bookmarks_owner_all"
  on public.bookmarks for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- history: mọi thao tác chỉ chủ sở hữu
create policy "history_owner_all"
  on public.history for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- user_settings: mọi thao tác chỉ chủ sở hữu
create policy "user_settings_owner_all"
  on public.user_settings for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- tags: select public; write chỉ admin
create policy "tags_select_public"
  on public.tags for select using (true);
create policy "tags_write_admin"
  on public.tags for all
  using (public.is_admin())
  with check (public.is_admin());

-- chapter_audio: chỉ select public (chưa có write policy — dự phòng)
create policy "chapter_audio_select_public"
  on public.chapter_audio for select using (true);

-- =====================================================================
-- §5.4 — Storage bucket 'covers'
-- =====================================================================

-- Tạo bucket covers (public)
insert into storage.buckets (id, name, public)
values ('covers', 'covers', true)
on conflict (id) do nothing;

-- Policy select public cho bucket covers
create policy "covers_select_public"
  on storage.objects for select
  using (bucket_id = 'covers');

-- Policy insert chỉ admin
create policy "covers_insert_admin"
  on storage.objects for insert
  with check (bucket_id = 'covers' and public.is_admin());

-- Policy update chỉ admin
create policy "covers_update_admin"
  on storage.objects for update
  using (bucket_id = 'covers' and public.is_admin())
  with check (bucket_id = 'covers' and public.is_admin());

-- Policy delete chỉ admin
create policy "covers_delete_admin"
  on storage.objects for delete
  using (bucket_id = 'covers' and public.is_admin());

-- =====================================================================
-- §5.6 — Seed dữ liệu mẫu
-- =====================================================================

-- 15 tag mặc định
insert into public.tags (name) values
  ('hệ thống'), ('xuyên không'), ('sảng văn'), ('ngôn tình'), ('kiếm hiệp'),
  ('tiên hiệp'), ('đô thị'), ('huyền huyễn'), ('đồng nhân'), ('dị giới'),
  ('võng du'), ('trọng sinh'), ('làm ruộng'), ('xây dựng'), ('tình cảm')
on conflict (name) do nothing;

-- 3 bộ truyện mẫu (UUID cố định 00000000-0000-0000-0000-00000000000{1,2,3})
insert into public.series (id, title, author, description, cover_url, status, genres, tags, word_count) values
  ('00000000-0000-0000-0000-000000000001',
   'Hệ Thống Toàn Năng',
   'Nguyễn Văn A',
   'Câu chuyện về một thanh niên vô tình nhận được hệ thống toàn năng, từ đó cuộc đời thay đổi hoàn toàn. Hành trình từ kẻ vô danh trở thành đỉnh phong.',
   '',
   'published',
   array['huyền huyễn', 'xuyên không'],
   array['hệ thống', 'sảng văn'],
   0),
  ('00000000-0000-0000-0000-000000000002',
   'Tiên Đế Trọng Sinh',
   'Trần Thị B',
   'Tiên đế bị phản bội, trọng sinh trở về tuổi 16, mang theo ký ức tiền kiếp lập lại con đường tu tiên. Lần này sẽ không để lịch sử lặp lại.',
   '',
   'published',
   array['tiên hiệp', 'huyền huyễn'],
   array['trọng sinh', 'tiên hiệp'],
   0),
  ('00000000-0000-0000-0000-000000000003',
   'Nông Môn Phú Thê',
   'Lê Văn C',
   'Cô gái hiện đại xuyên về thời cổ đại làm con dâu nông môn, dùng tri thức y học và nấu ăn để làm giàu cho gia đình. Câu chuyện ấm áp về tình thân và nỗ lực.',
   '',
   'published',
   array['ngôn tình', 'đô thị'],
   array['xuyên không', 'làm ruộng', 'ngôn tình'],
   0)
on conflict (id) do nothing;

-- 8 chương mẫu (nội dung tiếng Việt, status published)
-- Trigger chapters_sync_word_count sẽ tự tính word_count khi insert.
insert into public.chapters (id, series_id, order_no, title, content, status, published_at) values
  -- Series 1: Hệ Thống Toàn Năng — 3 chương
  ('11111111-0000-0000-0000-000000000001',
   '00000000-0000-0000-0000-000000000001', 1,
   'Chương 1: Hệ Thống Giáng Lâm',
   'Trần Minh đang ngồi trong phòng trọ chật hẹp, bỗng nhiên một tiếng điện tử vang lên trong đầu: "Hệ thống toàn năng đã kích hoạt". Cậu ta mở tròn mắt, không hiểu chuyện gì đang xảy ra. Trên không trung hiện lên một bảng thông tin màu xanh lục, liệt kê các nhiệm vụ và phần thưởng. Cuộc đời cậu đã bước sang một trang mới.',
   'published', now()),
  ('11111111-0000-0000-0000-000000000002',
   '00000000-0000-0000-0000-000000000001', 2,
   'Chương 2: Nhiệm Vụ Đầu Tiên',
   '"Nhiệm vụ: Đi dạo 1000 bước. Phần thưởng: 100 điểm kinh nghiệm." Trần Minh mỉm cười, đây đúng là cơ hội để thay đổi cuộc đời. Cậu xách giày bước ra ngoài, lòng háo hức khó tả. Mỗi bước đi, mỗi hy vọng mới mở ra trước mắt. Thành phố về đêm nhộn nhịp hơn cậu tưởng.',
   'published', now()),
  ('11111111-0000-0000-0000-000000000003',
   '00000000-0000-0000-0000-000000000001', 3,
   'Chương 3: Cửa Hệ Thống',
   'Sau khi hoàn thành nhiệm vụ, Trần Minh mở được cửa hàng hệ thống. Đủ mọi loại vật phẩm: từ thuốc tăng lực, sách kỹ năng, đến vũ khí thần kỳ. Tuy nhiên giá đều tính bằng điểm kinh nghiệm, thứ mà cậu chưa có nhiều. Cậu quyết định tập trung làm nhiệm vụ để tích lũy.',
   'published', now()),
  -- Series 2: Tiên Đế Trọng Sinh — 3 chương
  ('22222222-0000-0000-0000-000000000001',
   '00000000-0000-0000-0000-000000000002', 1,
   'Chương 1: Trọng Sinh',
   'Tiên đế Lâm Phong mở mắt, nhận ra mình đã trở lại tuổi mười sáu. Ký ức tiền kiếp còn nguyên vẹn: bị đệ tử phản bội, bị bạn bè hãm hại, mất cả tu vi và tánh mệnh. Lần này, hắn sẽ không để lịch sử lặp lại. Hắn nắm chặt tay, ánh mắt lạnh như băng.',
   'published', now()),
  ('22222222-0000-0000-0000-000000000002',
   '00000000-0000-0000-0000-000000000002', 2,
   'Chương 2: Luyện Khí',
   'Lâm Phong bắt đầu tu luyện lại từ đầu. Với kinh nghiệm tiên đế, hắn tránh được mọi sai lầm phổ thông mà đệ tử mới thường mắc phải. Chỉ trong ba ngày, đã đạt tới cảnh giới luyện khí tầng chín, tốc độ mà thiên tài tông môn cũng phải kinh ngạc. Sư phụ hắn không khỏi nghi ngờ.',
   'published', now()),
  ('22222222-0000-0000-0000-000000000003',
   '00000000-0000-0000-0000-000000000002', 3,
   'Chương 3: Báo Thù',
   'Trở lại tông môn, Lâm Phong gặp lại kẻ đã phản bội mình kiếp trước. Hắn không vội, chỉ mỉm cười lạnh. Cuộc trả thù này, hắn đã lên kế hoạch từ kiếp trước, từng bước một sẽ khiến kẻ thù phải trả giá đắt. Hắn bước đi thong thả, lòng dạ sắt đá.',
   'published', now()),
  -- Series 3: Nông Môn Phú Thê — 2 chương
  ('33333333-0000-0000-0000-000000000001',
   '00000000-0000-0000-0000-000000000003', 1,
   'Chương 1: Xuyên Không',
   'Lê Thu Hà mở mắt, thấy mình nằm trên một chiếc giường gỗ cũ kỹ, xung quanh là vách đất và mái tranh. Cô kinh ngạc nhận ra: mình đã xuyên không về thời cổ đại, trở thành cô dâu mới về nhà nông môn họ Trần. Tiếng gà gáy bên ngoài báo hiệu một ngày mới bắt đầu.',
   'published', now()),
  ('33333333-0000-0000-0000-000000000002',
   '00000000-0000-0000-0000-000000000003', 2,
   'Chương 2: Khởi Đầu Mới',
   'Nhà họ Trần nghèo nhưng ấm áp. Chồng cô, Trần Văn Đức, hiền lành chất phác, chăm chỉ làm ruộng. Thu Hà quyết định dùng kiến thức y học và nấu ăn hiện đại để cải thiện cuộc sống, dần dần làm giàu cho gia đình. Bữa tối đầu tiên cô nấu khiến cả nhà phải trầm trồ.',
   'published', now())
on conflict do nothing;

-- Đảm bảo word_count được tính đúng cho các series đã seed
-- (trigger đã tự chạy khi insert, nhưng gọi lại để chắc chắn nếu seed đã tồn tại từ trước)
select public.recalc_series_word_count('00000000-0000-0000-0000-000000000001');
select public.recalc_series_word_count('00000000-0000-0000-0000-000000000002');
select public.recalc_series_word_count('00000000-0000-0000-0000-000000000003');

-- =====================================================================
-- Hết schema.sql
-- =====================================================================
