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
├── prisma/              # schema.prisma (mirror §5) + seed
├── mobile/              # Expo SDK 57 + native Kotlin sonovel-tts (§8.5)
└── supabase/            # SQL schema + migrations (§5)
```

## Công nghệ

| Thành phần | Stack |
|---|---|
| Web + Admin | Next.js 16, React 19, TypeScript, Tailwind CSS 4, shadcn/ui |
| Mobile | Expo SDK 57, React Native 0.86, Kotlin native module |
| Database | Prisma + SQLite (mirror schema Supabase §5) |
| TTS web | Web Speech API (`speechSynthesis`) |
| TTS mobile | Android system TTS qua `sonovel-tts` (foreground service + watchdog) |

## Chạy thử

```sh
bun install
bun run db:push      # sync Prisma schema
bun run prisma/seed.ts   # seed 3 series + 8 chương + 15 tag + admin/user demo
bun run dev          # http://localhost:3000
```

Tài khoản demo:
- Quản trị: `admin@sonovel.app` / `admin123`
- Người dùng: `user@sonovel.app` / `user123`

## Tuân thủ SPEC

- §5 Schema: `chapters.status` chỉ `draft`/`published`; `series.word_count` tự cập nhật qua trigger.
- §8.5 Native TTS: watchdog 2s + retry 2 + re-init engine, init-timeout 6s, SETTLE_MS 200 khi resume, utterance id duy nhất + callback guards, JS safety timeout 12s, resume luôn qua `ACTION_START`. **Không dùng `expo-speech`.**
- UI 100% tiếng Việt, font Be Vietnam Pro.
