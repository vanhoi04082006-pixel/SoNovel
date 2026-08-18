# SoNovel — Supabase Schema

Schema SQL cho backend SoNovel (Postgres + RLS + Auth + Storage) theo **SPEC §5**.

## Cấu trúc thư mục

```
supabase/
├── schema.sql                    # Schema gốc (đầy đủ) — dựng toàn bộ 1 lần
├── migrations/
│   ├── 002_expand.sql            # Mở rộng dual-track read/listen, favorites, history, settings, audio
│   ├── 003_tags.sql              # Bảng tags master + seed 15 tag mặc định
│   └── 004_word_count.sql        # Cột series.word_count + hàm recalc + trigger tự cập nhật
└── README.md                     # Tài liệu này
```

## Thứ tự áp dụng (§5.7)

1. **`schema.sql`** — dựng toàn bộ schema (bảng, RLS, storage, hàm, trigger, seed).
2. **`migrations/002_expand.sql`** — mở rộng: dual-track read/listen trên `progress`, thêm `favorites`, `history`, `user_settings`, `chapter_audio`.
3. **`migrations/003_tags.sql`** — bảng `tags` master + seed 15 tag mặc định.
4. **`migrations/004_word_count.sql`** — cột `series.word_count` + hàm `recalc_series_word_count()` + trigger `chapters_sync_word_count` tự tính lại khi `chapters` đổi.

> **Lưu ý quan trọng:** `schema.sql` đã chứa **toàn bộ** schema cuối cùng (bao gồm phần expand, tags, word_count). Các migration `002/003/004` được viết **idempotent** (`IF NOT EXISTS` / `CREATE OR REPLACE` / `DO $$ ... $$`), nên chạy sau `schema.sql` sẽ là no-op an toàn. Migration tồn tại để:
>
> - Hỗ trợ nâng cấp dần từ base schema tối giản (nếu có cơ sở dữ liệu cũ).
> - Tương thích với Supabase CLI (`supabase db push`).
> - Là tài liệu tham chiếu từng bước nâng cấp theo §5.7.

### Cách chạy (Supabase Dashboard → SQL Editor)

Dán nội dung từng file theo thứ tự **1 → 2 → 3 → 4**, mỗi lần nhấn **Run**.

### Cách chạy (Supabase CLI)

```sh
# Đẩy tất cả migration trong supabase/migrations/
supabase db push

# Nếu 002/003 đã chạy tay qua SQL Editor, mark as applied để CLI không chạy lại:
supabase migration repair --status applied 002_expand 003_tags
supabase db push
```

## Gán admin

Sau khi đăng ký tài khoản đầu tiên (trigger `on_auth_user_created` tự tạo `profiles`), vào Dashboard → **Authentication → Users** → copy **User UID**. Mở SQL Editor và chạy:

```sql
update public.profiles
set role = 'admin'
where id = '<USER_ID>';
```

Sau đó đăng xuất rồi đăng nhập lại (hoặc tải lại trang admin-web) để context Auth đọc lại `role`.

## Bucket Storage `covers`

Bucket `covers` (public) được tạo tự động trong `schema.sql`:

- **Read**: public (ai cũng xem được ảnh bìa).
- **Write** (insert / update / delete): chỉ admin (`public.is_admin()`).

Upload bìa (admin-web): `storage.from('covers').upload('covers/${Date.now()}-${file.name}', file)` → `getPublicUrl` → lưu `cover_url` vào `series.cover_url`.

## Trigger & hàm quan trọng (§5.5)

| Tên | Loại | Vai trò |
| --- | --- | --- |
| `is_admin()` | Function (security definer) | Kiểm tra user hiện tại có `profiles.role = 'admin'`. Dùng trong RLS. |
| `handle_new_user()` | Trigger function (security definer) | Tự tạo `profiles` khi `auth.users` có user mới. |
| `on_auth_user_created` | Trigger AFTER INSERT trên `auth.users` | Gọi `handle_new_user()`. |
| `set_updated_at()` | Trigger function | Set `updated_at = now()` trước UPDATE. Áp cho `progress`, `user_settings`, `series`. |
| `set_updated_at_progress` / `_user_settings` / `_series` | Triggers BEFORE UPDATE | Gọi `set_updated_at()`. |
| `ensure_user_settings()` | Trigger function (security definer) | Tự tạo `user_settings` mặc định nếu chưa có, sau khi INSERT `progress`. |
| `ensure_user_settings_progress` | Trigger AFTER INSERT trên `progress` | Gọi `ensure_user_settings()`. |
| `recalc_series_word_count(p_series)` | Function (security definer) | Tính lại `series.word_count = sum(length(content)/5)` cho chương `published`. |
| `chapters_sync_word_count()` | Trigger function (security definer) | Gọi `recalc_series_word_count` cho series bị ảnh hưởng. |
| `chapters_sync_word_count` | Trigger AFTER INSERT/UPDATE/DELETE trên `chapters` | Đảm bảo `series.word_count` luôn khớp (§10.6). |

## RLS policies (§5.3)

| Bảng | SELECT | INSERT / UPDATE / DELETE |
| --- | --- | --- |
| `profiles` | public | chỉ chủ sở hữu (`auth.uid() = id`) |
| `series` | public | chỉ admin (`is_admin()`) |
| `chapters` | public | chỉ admin |
| `progress` | chỉ chủ sở hữu | chỉ chủ sở hữu |
| `favorites` | chỉ chủ sở hữu | chỉ chủ sở hữu |
| `bookmarks` | chỉ chủ sở hữu | chỉ chủ sở hữu |
| `history` | chỉ chủ sở hữu | chỉ chủ sở hữu |
| `user_settings` | chỉ chủ sở hữu | chỉ chủ sở hữu |
| `tags` | public | chỉ admin |
| `chapter_audio` | public | (chưa có write policy — dự phòng) |
| Storage `covers` | public | chỉ admin |

## Ràng buộc nghiệp vụ

- `chapters.status`: chỉ `draft` hoặc `published` (§10.5 — không có `hidden`).
- `series.status`: `draft` / `published` / `completed` / `hidden`.
- `user_settings.theme`: `light` / `dark` / `sepia` / `amoled`.
- `profiles.role`: `user` / `admin`.
- `chapters`: `unique (series_id, order_no)` — không cho 2 chương cùng số thứ tự trong 1 series.
- `progress`: `unique (user_id, series_id)` — 1 user chỉ có 1 hàng tiến độ trên 1 series.

## Seed dữ liệu mẫu (§5.6)

- 3 bộ truyện mẫu (UUID cố định `00000000-0000-0000-0000-00000000000{1,2,3}`).
- 8 chương mẫu (nội dung tiếng Việt, status `published`).
- 15 tag mặc định (xem §5.6).

Seed không bắt buộc — dùng để test luồng nghe đọc. Có thể xoá bằng `delete from public.chapters; delete from public.series;` (cascade sẽ tự xoá chapter_audio; favorites/history/progress cũng cascade theo user hoặc series).
