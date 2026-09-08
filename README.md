# SoNovel

Ứng dụng **nghe truyện chữ tiếng Việt bằng giọng đọc tổng hợp (TTS)** — web PWA + app Android, đồng bộ tiến độ đa thiết bị.

## Tính năng

### Nghe truyện (TTS)
- **Web**: Web Speech API (`speechSynthesis`) — không cần cài gì.
- **Android**: system TTS qua native module Kotlin `sonovel-tts` (foreground service `mediaPlayback`, điều khiển từ màn hình khóa/notification).
- **Tự động chuyển chương** đa lớp bảo vệ: event `ON_CHAPTER_END` → preload chương kế (tự phát sau 400ms) → tự fetch nội dung qua Worker khi thiếu preload → poll `finished` mỗi giây → JS reconcile theo native → watchdog tiêu đề/re-init engine + busy-timeout 12s.
- **Tiếp tục nghe** đúng vị trí ký tự — lưu tiến độ mỗi 4s, resume chính xác; bấm chương khác khi đang phát thì chuyển ngay (ý định tường minh luôn thắng auto-next).
- Điều khiển: kéo thanh tiến trình tua theo %, tốc độ đọc 0.75x–2x, hẹn giờ ngủ (kể cả "hết chương"), đánh dấu vị trí kèm ghi chú.

### Đọc & duyệt truyện
- **Màn Reader độc lập**: Chương trước/sau (disabled ở đầu/cuối), danh sách chương dạng sheet, cài cỡ chữ, tự lưu tiến độ đọc.
- **Trang chủ**: truyện mới cập nhật, phổ biến, tiếp tục nghe, tìm kiếm.
- Trang chi tiết (web): tab **Chương | Minh Họa** + header thông tin, hiện % đã nghe từng chương; (mobile: tab Thông tin | Chương | Minh họa).
- **Minh họa**: nhiều ảnh mỗi truyện, chia **mục có tên** thu gọn được, mục lục đồng bộ; upload file/link/bulk qua imgBB (giữ full gốc) + thumb preview.
- Dấu **✓ chương đã nghe/đọc** trong mọi danh sách chương.
- Tìm kiếm theo tên/tác giả, lọc thể loại + tag, tìm kiếm gần đây.

### Khác
- Yêu thích · Lịch sử · Đánh dấu · Thống kê (giờ nghe, streak, heatmap, thành tích, thử thách tuần).
- 4 theme: Sáng / Tối / Vàng giấy / Đen tuyền (AMOLED) — palette brand tím `#7c3aed → #a855f7 → #ec4899`.
- Đồng bộ đa thiết bị qua Supabase Auth + Realtime.
- Web là PWA — cài được lên desktop/màn hình chính; trang Giới thiệu có mục **Tải app** (APK Android qua link Drive do admin cấu hình, PWA cho iOS/PC).
- Hiệu năng: API trả metadata chương không kèm nội dung (`?fields=meta`), cache TTL nhiều lớp, prefetch nội dung + ảnh đợt kế, disk cache ảnh (mở lại xem ngay cả offline).

## Kiến trúc

```
SoNovel/
├── src/            # Web + Admin CMS (Next.js 16 App Router, SPA hash-routing tại page.tsx)
│   ├── app/api/    # ~35 route handlers — proxy sang Cloudflare Worker, fallback Supabase
│   ├── screens/    # user + admin screens
│   ├── components/ # sonovel/ + player/ + ui/ (shadcn)
│   └── store/      # Zustand: app-store, player-store, reader-settings
├── mobile/         # App Android v1.1.0 (Expo SDK 57 + RN 0.86.2, versionCode 2)
│   ├── modules/sonovel-tts/   # Native module Kotlin: foreground service + watchdogs
│   └── src/        # navigation, screens, lib (tts.ts, progress.ts, illustrations.ts...)
├── workers/        # REST API thật (Cloudflare Worker + Hono)
│   └── src/        # index.ts, helpers.ts, cache.ts, rate-limit.ts
├── supabase/       # Schema PostgreSQL (Auth + RLS) + migrations
├── d1/             # Schema D1 mirror + migrations (0001→0008)
├── scripts/        # seed + migrate + backfill (thumbs/dims/blurhash/profiles)
└── docs/           # SPEC gốc + ARCHITECTURE + DEPLOY + ADR
```

**Luồng dữ liệu (xem `docs/ARCHITECTURE.md` + `docs/adr/001-dual-write.md`):** Mobile/Web → Cloudflare Worker (**D1 là source of truth**) → Supabase giữ Auth + Realtime mirror. Ảnh bìa/minh họa: upload qua imgBB, serve trực tiếp (thumb/preview + BlurHash placeholder).

## Công nghệ

| Thành phần | Stack |
|---|---|
| Web + Admin | Next.js 16, React 19, TypeScript, Tailwind CSS 4, shadcn/ui, Zustand, Framer Motion |
| Mobile | Expo SDK 57, React Native 0.86.2 New Architecture, expo-image (disk cache), native Kotlin module |
| Backend API | Cloudflare Worker (Hono), D1 SQLite, R2 object storage (covers) |
| Database | D1 SQLite source of truth; Supabase PostgreSQL (Auth, RLS) |
| Data + Auth | `@supabase/supabase-js` + `@supabase/ssr`; service-role key chỉ chạy server |
| TTS web | Web Speech API (+ keepalive + tự nối khi mở lại tab) |
| TTS mobile | Android system TTS qua `sonovel-tts` |

## Chạy thử

Chi tiết đầy đủ xem [`docs/DEPLOY.md`](docs/DEPLOY.md).

### Web

```sh
bun install
# Tạo .env.local theo .env.example
bun run dev          # http://localhost:3000
bun run lint
bun run typecheck
```

### Backend (Cloudflare Worker)

```sh
cd workers
npm install
npx wrangler d1 migrations apply sonovel --remote
npx wrangler deploy
```

### Mobile (Android APK)

> ⚠️ App dùng native module riêng — **không chạy được trên Expo Go**. Chi tiết xem [mobile/README.md](mobile/README.md) và [HANDOFF_AGENT.md](HANDOFF_AGENT.md).

```sh
cd mobile
npm install
npx expo prebuild --platform android --no-install   # chỉ khi đổi native/config/deps native
cd android
.\gradlew.bat assembleRelease --no-daemon           # JDK 17 + Android SDK
# Output: mobile/android/app/build/outputs/apk/release/app-release.apk
```

## Biến môi trường

| Biến | Nơi dùng | Mô tả |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Web (public) | Supabase project + anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Web server (secret) | Ghi DB bỏ qua RLS — không lộ ra client |
| `WORKER_URL` / `SERVICE_TOKEN` | Web server | URL Worker đã deploy + token gọi endpoint admin |
| `IMGBB_API_KEY` | Web server (secret) | Upload ảnh minh họa qua imgBB |
| `SUPABASE_URL` / `SUPABASE_ANON_KEY` / `SERVICE_TOKEN` | workers secrets | Env cho Worker (`wrangler secret put ...`) |

Mobile hardcode `WORKER_URL` + anon key tại `mobile/src/lib/{worker,supabase}.ts`.

## Tài liệu

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — kiến trúc hiện tại (sự thật chuẩn)
- [`docs/DEPLOY.md`](docs/DEPLOY.md) — checklist release web/worker/APK
- [`mobile/README.md`](mobile/README.md) — build app Android
- [`HANDOFF_AGENT.md`](HANDOFF_AGENT.md) — handoff build APK, debug crash, cạm bẫy native
- [`docs/SPEC.md`](docs/SPEC.md) — spec gốc (lưu trữ, một số điểm đã khác thực tế)
- [`docs/adr/`](docs/adr/) — Architecture Decision Records
- [`supabase/README.md`](supabase/README.md) — schema DB + RLS
- [`worklog.md`](worklog.md) — nhật ký triển khai

## License

Dự án cá nhân — chỉ dùng cho mục đích học tập.
