# SoNovel

Ứng dụng **nghe truyện chữ** tiếng Việt bằng giọng đọc tổng hợp (TTS).

> Dựng lại từ đầu theo SPEC — self-contained, không cần repo cũ.

## Tính năng

- **Nghe truyện bằng TTS**: Web dùng Web Speech API (`speechSynthesis`), Mobile (Android) dùng native module Kotlin `sonovel-tts` với foreground service.
- **Tiếp tục nghe**: lưu tiến độ nghe mỗi 4 giây, resume từ đúng vị trí dừng.
- **Duyệt + tìm kiếm**: theo tên, tác giả, thể loại, tag; sort mới/tiêu đề/nhiều chương.
- **Yêu thích · Lịch sử · Đánh dấu** vị trí trong chương.
- **4 theme giao diện**: Sáng / Tối / Vàng giấy / Đen tuyền (AMOLED).
- **Admin CMS**: quản lý truyện, chương (chỉ 2 trạng thái `draft`/`published`), tag, ảnh bìa.

## Kiến trúc

```
SoNovel/
├── src/                 # Next.js 16 app (web người dùng + admin CMS)
│   ├── app/api/         # REST API routes
│   ├── screens/         # user + admin screens
│   ├── components/      # sonovel/ + player/
│   └── store/           # Zustand: app-store + player-store
├── scripts/seed.ts      # seed dữ liệu lên Supabase
├── mobile/              # Expo SDK 57 + native Kotlin sonovel-tts (§8.5)
└── supabase/            # SQL schema + migrations (§5)
```

## Công nghệ

| Thành phần | Stack |
|---|---|
| Web + Admin | Next.js 16, React 19, TypeScript, Tailwind CSS 4, shadcn/ui |
| Mobile | Expo SDK 57, React Native 0.86, Kotlin native module |
| Database | Supabase (PostgreSQL, schema `public`) — dùng chung cho web & mobile |
| Data + Auth | `@supabase/supabase-js` + `@supabase/ssr` (service role cho server, Supabase Auth) |
| TTS web | Web Speech API (`speechSynthesis`) |
| TTS mobile | Android system TTS qua `sonovel-tts` (foreground service + watchdog) |

## Chạy thử

```sh
bun install
# Cấu hình .env.local theo .env.example (SUPABASE_URL, anon key, service role key)
bun run db:seed     # seed tags + 15 series + 43 chương + admin/user demo lên Supabase
bun run dev         # http://localhost:3000
```

Tài khoản demo (tạo qua seed):
- Quản trị: `admin@sonovel.app` / `admin123`
- Người dùng: `user@sonovel.app` / `user123`

## Tuân thủ SPEC

- §5 Schema: `chapters.status` chỉ `draft`/`published`; `series.word_count` tự cập nhật qua trigger `chapters_sync_word_count`.
- §8.5 Native TTS: watchdog 2s + retry 2 + re-init engine, init-timeout 6s, SETTLE_MS 200 khi resume, utterance id duy nhất + callback guards, JS safety timeout 20s, resume luôn qua `ACTION_START`. **Không dùng `expo-speech`.**
- Web & mobile dùng **chung Supabase** (DB + Auth) → tiến độ, yêu thích, lịch sử, đánh dấu đồng bộ 2 chiều.
- UI 100% tiếng Việt, font Be Vietnam Pro.
