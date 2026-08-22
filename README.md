# SoNovel

Ứng dụng **nghe truyện chữ tiếng Việt bằng giọng đọc tổng hợp (TTS)** — web PWA + app Android, đồng bộ tiến độ đa thiết bị.

## Tính năng

### Nghe truyện (TTS)
- **Web**: Web Speech API (`speechSynthesis`) — không cần cài gì.
- **Android**: system TTS qua native module Kotlin `sonovel-tts` (foreground service `mediaPlayback`, điều khiển từ màn hình khóa/notification).
- **Tự động chuyển chương** với 3 lớp bảo vệ độc lập:
  1. Event `ON_CHAPTER_END` từ native → JS advance
  2. Title-watchdog trong engine (tiêu đề bị nuốt → retry → bỏ qua, phát thẳng nội dung)
  3. Poll-based safety net qua cờ `finished` mỗi giây
- **Tiếp tục nghe** đúng vị trí ký tự — lưu tiến độ mỗi 4s, resume chính xác.
- Điều khiển: tua ±10%, tốc độ đọc 0.75x–2x, hẹn giờ ngủ (kể cả "hết chương"), đánh dấu vị trí kèm ghi chú.
- Chuyển chương từ media notification trên lock-screen.

### Đọc & duyệt truyện
- **Màn Reader độc lập**: Chương trước/sau (disabled ở đầu/cuối), danh sách chương dạng sheet, cài cỡ chữ, tự lưu tiến độ đọc, cuộn ≥95% tự đánh dấu đã đọc.
- **Trang chủ**: Bảng xếp hạng (Mới cập nhật / Nhiều chương) + lối "Xem tất cả".
- **Màn Tất cả truyện**: lưới vô hạn (infinite scroll), sort mới/tiêu đề/nhiều chương.
- Trang chi tiết bộ truyện với tab **Thông tin | Chương**, hiện % đã nghe từng chương.
- Dấu **✓ chương đã nghe/đọc** trong mọi danh sách chương.
- Tìm kiếm theo tên/tác giả, lọc thể loại + tag, tìm kiếm gần đây.

### Khác
- Yêu thích · Lịch sử · Đánh dấu · Thống kê (giờ nghe, streak, thành tích, thử thách tuần).
- 4 theme: Sáng / Tối / Vàng giấy / Đen tuyền (AMOLED).
- Đồng bộ đa thiết bị: cùng Supabase Auth + DB → tiến độ/yêu thích/cài đặt theo user; Supabase Realtime đẩy thay đổi giữa các tab/thiết bị.
- Web là PWA — cài được lên desktop/màn hình chính.
- Hiệu năng: API trả metadata chương không kèm nội dung (`?fields=meta`, ~188KB/818 chương thay vì hàng chục MB), cache TTL client 60s, prefetch nội dung chương kế.

## Kiến trúc

```
SoNovel/
├── src/            # Web + Admin CMS (Next.js 16 App Router)
│   ├── app/api/    # ~33 route handlers — proxy sang Cloudflare Worker, fallback Supabase
│   ├── screens/    # user + admin screens (SPA hash-routing tại src/app/page.tsx)
│   ├── components/ # sonovel/ + player/ + ui/ (shadcn)
│   └── store/      # Zustand: app-store, player-store, reader-settings
├── mobile/         # App Android (Expo SDK 57 + RN 0.86.2)
│   ├── modules/sonovel-tts/   # Native module Kotlin: foreground service + watchdogs
│   └── src/        # navigation, screens, lib (tts.ts, progress.ts, readMarkers.ts...)
├── workers/        # REST API thật (Cloudflare Worker + Hono)
│   └── src/index.ts           # ~25+ endpoints, D1 (SQLite) + R2 (ảnh bìa)
├── supabase/       # Schema PostgreSQL gốc + migrations + RLS
├── d1/             # Schema D1 mirror + migration scripts
├── scripts/        # seed Supabase, migrate Supabase→D1, backfill
└── docs/SPEC.md    # Spec gốc của dự án
```

**Luồng dữ liệu:** Mobile/Web → Cloudflare Worker (D1 + R2, cache server-side) → fallback trực tiếp Supabase (PostgreSQL). Supabase là DB gốc dùng chung; D1 là mirror phục vụ Worker.

## Công nghệ

| Thành phần | Stack |
|---|---|
| Web + Admin | Next.js 16, React 19, TypeScript, Tailwind CSS 4, shadcn/ui, Zustand, Framer Motion |
| Mobile | Expo SDK 57, React Native 0.86.2, New Architecture, native Kotlin module |
| Backend API | Cloudflare Worker (Hono), D1 SQLite, R2 object storage |
| Database | Supabase PostgreSQL (10 bảng, RLS, trigger đồng bộ `word_count`) |
| Data + Auth | `@supabase/supabase-js` + `@supabase/ssr`; service-role key chỉ chạy server |
| TTS web | Web Speech API |
| TTS mobile | Android system TTS qua `sonovel-tts` |

## Chạy thử

### Web

```sh
bun install
# Tạo .env.local theo .env.example (Supabase URL/anon/service key + WORKER_URL/SERVICE_TOKEN)
bun run dev          # http://localhost:3000
bun run lint
```

### Backend (Cloudflare Worker)

```sh
cd workers
cp .dev.vars.example .dev.vars   # điền SUPABASE_URL, ANON_KEY, SERVICE_TOKEN
npm install
npx wrangler dev                 # dev local
npx wrangler deploy              # deploy production (D1 + R2 đã bind sẵn trong wrangler.toml)
```

### Mobile (Android APK)

> ⚠️ App dùng native module riêng — **không chạy được trên Expo Go**. Xem chi tiết môi trường build + các cạm bẫy tại [HANDOFF_AGENT.md](HANDOFF_AGENT.md).

```sh
cd mobile
npm install
npx expo prebuild --platform android --clean --no-install   # chỉ cần khi đổi native/config
cd android
.\gradlew.bat assembleRelease --no-daemon                   # JDK 17 + Android SDK
# Output: mobile/android/app/build/outputs/apk/release/app-release.apk
```

Chỉ đổi JS thuần thì bỏ qua prebuild, chạy thẳng gradlew (Metro rebundle).

## Biến môi trường

| Biến | Nơi dùng | Mô tả |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Web (public) | Supabase project + anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Web server (secret) | Ghi DB bỏ qua RLS — không lộ ra client |
| `WORKER_URL` / `SERVICE_TOKEN` | Web server | URL Worker đã deploy + token gọi endpoint admin |
| `SUPABASE_URL` / `SUPABASE_ANON_KEY` / `SERVICE_TOKEN` | workers/.dev.vars | Env cho Worker |

Mobile hardcode `WORKER_URL` + anon key tại `mobile/src/lib/{worker,supabase}.ts`.

## Tài liệu

- [`HANDOFF_AGENT.md`](HANDOFF_AGENT.md) — hướng dẫn build APK, debug crash qua adb, các cạm bẫy native
- [`worklog.md`](worklog.md) — nhật ký triển khai đầy đủ theo phase
- [`docs/SPEC.md`](docs/SPEC.md) — spec gốc
- [`supabase/schema.sql`](supabase/schema.sql) — schema DB + RLS

## License

Dự án cá nhân — chỉ dùng cho mục đích học tập.
