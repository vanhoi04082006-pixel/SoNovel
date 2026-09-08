# SoNovel Worker — REST API production

**Worker URL:** `https://sonovel-api.vanhoi04082006.workers.dev`
**D1:** `sonovel` (`00fd3513-159a-4bbd-b4a7-884980cc54e6`, APAC) — xem `d1/schema.sql`
**R2:** bucket `sonovel-covers` (ảnh bìa)

> ⚠️ Worker **KHÔNG tự deploy theo GitHub**. Mọi commit đổi `workers/` phải chạy `npx wrangler deploy` tay (xem `docs/DEPLOY.md`). Đã từng 2 lần code mới nằm trên GitHub mà production vẫn chạy code cũ (thumb, group) — luôn verify sau deploy.

## Deploy

```powershell
cd workers
npm install
npx wrangler d1 migrations apply sonovel --remote   # theo thứ tự 0001→0008
npx wrangler secret put SUPABASE_URL
npx wrangler secret put SUPABASE_ANON_KEY
npx wrangler secret put SERVICE_TOKEN               # sinh mới, KHÔNG commit token thật
npx wrangler deploy
npx wrangler deploy --dry-run   # kiểm tra không deploy
```

> Cấm `setInterval`/I/O ở global scope — Cloudflare từ chối deploy (lỗi 10021). Rate-limit dùng cleanup lười trong `src/rate-limit.ts`.

## Dev local

```powershell
Copy-Item .dev.vars.example .dev.vars   # điền secrets, file này đã gitignore
npx wrangler dev --port 8787 --remote
# health: http://127.0.0.1:8787/health  (proxy remote D1)
```

## Verify sau deploy

```powershell
npx wrangler deployments list
# Gọi thử endpoint public, VD:
# https://sonovel-api.<subdomain>.workers.dev/api/series/be2d1180-.../illustrations
```

## Endpoints

Auth 3 mức: public (không cần) · user (`Authorization: Bearer <supabase access_token>`, verify qua Supabase + cache, tự tạo `profiles` D1) · admin (`x-service-token` hoặc role admin).

**Catalog (public):** `GET /health`, `GET /api/tags`, `GET /api/series` (q/genre/tag/status/sort/limit/offset; search LIKE + fallback khi FTS lỗi), `GET /api/series/:id`, `GET /api/series/:id/related`, `GET /api/series/:id/chapters` (`?fields=meta` chỉ metadata, `all=1` kèm draft cho admin), `GET /api/chapters/:id`, `GET /api/series/:id/illustrations`, `GET /covers/:key`.

**User (Bearer):** `GET/PUT /api/progress`, `GET /api/progress/all`, `GET /api/following-updates`, `GET/POST /api/favorites`, `GET/POST /api/history`, `GET /api/settings` + `PUT`, `GET /api/continue-listening`, `GET/POST /api/bookmarks` + `DELETE /:id`, `POST /api/stats/session`, `GET /api/stats/{reading,streak,achievements,challenge,history}`, `GET /api/settings/goal`.

**Admin (service-token):** series CRUD (`POST /api/series/create` idempotent, `PATCH/DELETE /api/series/:id`), chapters CRUD + `POST /bulk` (tối đa 500) + import-folder, tags CRUD, `GET /api/admin/users` + `PATCH /:id`, `GET /api/profiles/roles`, `PUT /api/series/:id/illustrations` (bulk replace ≤100), `POST /api/upload` (R2 `covers/`, ≤5MB, sniff magic bytes, rate-limit), `GET/PUT /api/site-settings/:key` (whitelist key), `GET /api/stats` tổng quan.

## R2 covers

- `POST /api/upload` (admin, multipart `file`/`cover`/`image` hoặc JSON base64, ≤5MB, `image/*`) → `COVERS.put(covers/<uuid>.<ext>)` → `{url:"/covers/<key>", key}`.
- `GET /covers/:key` public, `Cache-Control: immutable`, chặn `..`/`/`.
- Ảnh minh họa KHÔNG qua R2 — upload qua imgBB ở web (`src/app/api/illustrations/upload`), DB chỉ lưu URL + thumb + dims + blurhash (+ group).

## Migrations (`migrations/`, D1)

| File | Nội dung |
|---|---|
| `0001_init.sql` | Toàn bộ schema gốc |
| `0002_fts5.sql` | **Vô hiệu hóa (no-op)** — FTS5 từng gây `SQLITE_CORRUPT_VTAB`, đã drop production, search dùng LIKE |
| `0003_add_view_count.sql` | Cột `series.view_count` + index (sort `views`) |
| `0004_site_settings.sql` | Bảng `site_settings` (seed link APK Android, admin sửa được) |
| `0005_illustration_thumb.sql` | Cột `thumb_url` |
| `0006_illustration_group.sql` | Cột `group_name` (chia mục) |
| `0007_illustration_dims.sql` | Cột `width/height` (dựng khung không cần getSize) |
| `0008_illustration_blurhash.sql` | Cột `blurhash` (placeholder) |
