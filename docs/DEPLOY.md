# SoNovel — Checklist release

## Quy tắc vàng

1. **Worker KHÔNG tự deploy theo GitHub.** Mọi commit đổi `workers/` → chạy `wrangler deploy` tay + verify. Đã từng 2 lần code nằm trên GitHub mà production chạy code cũ.
2. **Vercel tự deploy** theo push `main` — không cần làm gì thêm, chỉ verify.
3. APK build local là đường chính (EAS free hết quota nhanh).

## Web (Vercel, auto)

```sh
git push origin main
# → Vercel build + deploy production tự động
```

Verify: mở production domain, hard refresh (xóa PWA cũ nếu test PWA — service worker giữ shell cũ).

Env production (Vercel Dashboard → Settings → Environment Variables):

| Biến | Ghi chú |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | public |
| `SUPABASE_SERVICE_ROLE_KEY` | secret, server-only |
| `WORKER_URL` | VD `https://sonovel-api.<sub>.workers.dev` |
| `SERVICE_TOKEN` | secret, trùng Worker secret |
| `IMGBB_API_KEY` | secret, upload minh họa |

Local dev: copy `.env.example` → `.env.local` (web) và `workers/.dev.vars.example` → `workers/.dev.vars`.

## Worker (Cloudflare, MANUAL)

```powershell
cd workers
npm install
npx wrangler d1 migrations apply sonovel --remote   # theo thứ tự 0001→0008, kiểm tra bảng status
npx wrangler secret put SUPABASE_URL
npx wrangler secret put SUPABASE_ANON_KEY
npx wrangler secret put SERVICE_TOKEN
npx wrangler deploy
```

Verify sau deploy (bắt buộc):

```powershell
npx wrangler deployments list          # version mới nhất phải là vừa deploy
# Gọi thử endpoint vừa đổi, VD:
# /api/series/<id>/illustrations phải trả đủ field mới (groupName/width/blurhash...)
```

Cấm kỵ:
- `setInterval`/I/O ở global scope → deploy fail lỗi 10021.
- Đổi response shape mà không check client cũ (mobile parse defensive — giữ backward compatible).
- Tạo lại FTS5 trên D1 (từng gây `SQLITE_CORRUPT_VTAB` làm sập mọi `UPDATE series` — xem `workers/migrations/0002_fts5.sql`).

## APK Android (local, đường chính)

Chi tiết xem `mobile/README.md`. Tóm tắt:

```powershell
cd mobile
npm install
npx expo prebuild --platform android --no-install   # khi đổi native/assets/deps native/app.json
cd android
$env:JAVA_HOME = "C:\Program Files\Eclipse Adoptium\jdk-17.0.20.101-hotspot"
.\gradlew.bat assembleRelease --no-daemon
# Output: mobile/android/app/build/outputs/apk/release/app-release.apk
```

Sau build:
1. Tăng `versionCode` + `version` (`app.json`) mỗi bản release.
2. Copy APK ra `E:\SoNovel\SoNovel.apk` (file này đã gitignore — phân phối qua link Drive trong `site_settings.android_apk_url`, KHÔNG commit binary).
3. `Get-FileHash` ghi SHA256 để đối chiếu.
4. Cài test: **gỡ bản cũ trước** (tránh launcher giữ icon cache), `adb install -r`, check `pidof` + `logcat -b crash` rỗng.
5. Version hiển thị trong app tại màn Tài khoản (dưới nút Đăng xuất) — dùng để xác nhận máy đang chạy bản nào khi user báo lỗi.

Build fail lạ ở worklets/CMake → xóa `.cxx`/transforms cache, restart daemon, build lại (flaky env).

## Dữ liệu & backfill

Scripts một lần trong `scripts/` (đọc header mỗi file trước khi chạy):

| Script | Dùng khi |
|---|---|
| `seed.ts` (`bun run db:seed`) | Dựng data demo local |
| `migrate-supabase-to-d1.ts` | Migrate catalog Supabase → D1 |
| `backfill-d1-profiles.ts` | Đồng bộ `profiles` roles |
| `backfill-illustration-thumbs.ts` | Sinh thumb cho ảnh cũ |
| `backfill-illustration-dims.ts` | Đo width/height ảnh cũ |
| `backfill-illustration-blurhash.ts` | Tính blurhash ảnh cũ |

Nguyên tắc backfill: dry-run/xem trước → backup mapping JSON → chạy → verify count + spot-check API.
