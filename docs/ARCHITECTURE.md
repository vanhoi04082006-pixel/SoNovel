# SoNovel — Kiến trúc hiện tại

> Tài liệu sự thật chuẩn. Spec gốc (`SPEC.md`) chỉ còn giá trị lịch sử — nhiều điểm đã khác
> (gộp monolith Next.js thay vì 4 project Vite, thêm Cloudflare Worker, D1 là source of truth).

## Tổng quan luồng dữ liệu

```
┌─────────┐      ┌──────────┐      ┌─────────────────────┐
│ Web+PWA │─────▶│ Next.js  │─────▶│ Cloudflare Worker   │
│ (SPA #) │      │ API proxy│      │ Hono + D1 + R2      │
└─────────┘      └──────────┘      └─────────────────────┘
┌─────────┐             │                     │
│ Android │─────────────┘                     ▼
│ (Expo)  │                          ┌────────────────┐
└─────────┘                          │ Supabase       │
     ▲                               │ Auth + Realtime│
     └────────── đồng bộ ────────────│ (mirror)       │
                                     └────────────────┘
```

- **D1 là source of truth** cho dữ liệu đọc (xem `adr/001-dual-write.md`).
- Supabase giữ **Auth (JWT) + Realtime**; Worker verify Bearer token qua Supabase rồi đọc/ghi D1.
- Web Next.js (`src/app/api/*`, 36 route files) là **proxy mỏng**: gắn auth header → forward sang Worker → trả nguyên status. Không validate lặp — mọi validate nằm ở Worker.
- Mobile gọi **trực tiếp Worker** (`WORKER_URL` hardcode), fallback Supabase khi Worker lỗi mạng.

## Dữ liệu (D1, 12 bảng)

`profiles`, `series` (`status`, `word_count`, `view_count`), `chapters` (chỉ `draft|published`, unique `series_id+order_no`), `progress` (dual-track đọc/nghe), `favorites`, `bookmarks`, `history`, `user_settings`, `chapter_audio` (dự phòng), `tags`, `series_illustrations` (`image_url`, `thumb_url`, `group_name`, `width/height`, `blurhash`, `caption`, `order_no`), `site_settings` (`android_apk_url`...).

- `series.word_count` tự tính lại phía Worker khi write chapters (không dùng trigger như bản Postgres).
- **FTS5 đã bỏ** (từng gây `SQLITE_CORRUPT_VTAB` làm sập mọi `UPDATE series`) — search dùng LIKE.
- Migrations `workers/migrations/0001→0008`; mirror khai báo ở `d1/schema.sql`.

## Ảnh

| Loại | Upload | Serve |
|---|---|---|
| Ảnh bìa | Admin → Worker `POST /api/upload` → R2 `covers/` (≤5MB, sniff magic bytes, rate-limit 20/phút) | `GET /covers/:key`, `Cache-Control: immutable` |
| Minh họa | Admin → Next.js `/api/illustrations/upload` → **imgBB** (giữ full gốc; kèm probe dims + blurhash, không nén) | URL imgBB trực tiếp; thumb/preview cho list, full khi mở |

Ảnh dán link ngoài giữ nguyên URL, không qua xử lý.

## Cache (4 lớp)

1. **Client web** (`api-client.ts`): Map TTL cho GET catalog.
2. **Service Worker** (`public/sw.js`, v2): cache-first static + image-cache riêng (`i.ibb.co`, `/covers`, cap ~100 LRU) + network-first `/api/*`.
3. **Worker** (`cache.ts`): `cachedFetch` TTL theo endpoint; `invalidateAll()` sau mọi write.
4. **App**: `dataCache` RAM + AsyncStorage metadata + `expo-image` disk cache (`memory-disk`) + prefetch đợt kế.

## TTS mobile (state machine)

- **JS** (`lib/tts.ts`): state `chapters/currentIndex/currentChar/rate/isPlaying/busy/seriesEnded` + event bus local; lưu progress throttle 4s (local + Worker + Supabase).
- **Native** (`TtsService.kt`): foreground service, chunk ~900 ký tự, `speakSeq` + utterance guard, watchdog 2s + re-init, init-timeout 6s, title-watchdog 3s, busy-timeout JS 12s, WakeLock khi phát.
- **Auto-next** (theo thứ tự): `ON_CHAPTER_END` → preload (tự phát sau 400ms, single-flight `autoToken`) → tự fetch qua Worker khi thiếu preload → poll `finished` 1s → JS `adoptNativeChapter` (reconcile theo native, bỏ qua khi JS đang tự điều phối).
- **Bất biến:** bấm tay (`playChapterTts`/`PLAY_CHAPTER`) luôn hủy auto/fetch đang treo (`cancelAutoNext/cancelFetch`) và thắng mọi luồng tự động.

## TTS web

Web Speech API, chunk ~800 ký tự, `onboundary` tính tiến độ, MediaSession (metadata + play/pause/prev/next + position), keepalive audio nền (best-effort) + tự nối khi tab visible lại. **Tắt màn hình nghe liên tục chỉ đảm bảo trên APK** (giới hạn trình duyệt) — server render MP3 để dành đợt riêng.

## Auth & phân quyền

- Supabase email/password → session cookie (web) / token (mobile).
- Role `profiles.role`: `user`/`admin`. Admin gate ở cả 3 lớp: UI ẩn menu, Next route `requireAdmin()`, Worker `requireAdmin()` (service-token hoặc role). Service-role key **chỉ server-side**.

## Cấu hình & giới hạn đã biết

- CORS Worker: allowlist (localhost, `*.vercel.app`, `*.workers.dev`, `sonovel.app`).
- Rate-limit: upload 20/phút, series-create 30/phút (in-memory/isolate, cleanup lười — không dùng `setInterval` global, Cloudflare cấm).
- Upload ảnh: ≤5MB, `image/*` + sniff magic bytes (PNG/JPEG/GIF/WEBP/BMP).
- Bulk: chapters ≤500/lần, illustrations ≤100/bộ.
- Playlist native tối đa 3000 id; preload chương ≤60k ký tự (chống `TransactionTooLargeException`).
