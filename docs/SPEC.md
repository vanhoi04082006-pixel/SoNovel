# SoNovel — Tài liệu giao việc (Spec dựng lại từ đầu) cho z.code

> Mục tiêu: dựng **toàn bộ** ứng dụng nghe truyện "SoNovel" (Vietnamese audiobook/story-listening app) từ con số 0, theo đúng spec dưới đây. Đây là tài liệu tự chứa (self-contained) — không cần repo cũ, nhưng nếu có repo cũ thì code mới phải tương đương về tính năng.

---

## 1. Tổng quan dự án

SoNovel là app **đọc + nghe truyện chữ** (truyện Trung Quốc/Việt được nhập nội dung chữ) bằng **giọng đọc tổng hợp (TTS)**. Không có file audio được render sẵn — toàn bộ audio là **TTS client-side, phát trực tiếp**:

- `web` + `admin-web`: dùng **Web Speech API** (`speechSynthesis`) của trình duyệt.
- `mobile` (Android): dùng **Android system TTS engine** thông qua native module Kotlin `sonovel-tts`.

Toàn bộ dữ liệu qua **Supabase (Postgres + RLS + Auth + Storage)** bằng REST. **KHÔNG có backend Node/Express riêng.**

Giao diện người dùng: **tiếng Việt hoàn toàn** (mọi chuỗi UI, lỗi, toast…). Font ưu tiên **Be Vietnam Pro**.

---

## 2. Kiến trúc tổng thể

```
admin-web (Vercel)  ─┐
                     ├─► Supabase (Postgres + RLS + Auth + Storage bucket 'covers')
web (Vercel)        ─┤
mobile (Expo/Android)──┘
  └── modules/sonovel-tts/ (Kotlin native module — Android system TTS)
```

Không có monorepo root chung — 4 thư mục con, mỗi thư mục là một project Node độc lập: `admin-web/`, `web/`, `mobile/`, `supabase/`.

---

## 3. Cấu trúc thư mục

```
SoNovel/
├── admin-web/        # React + Vite — CMS (quản lý truyện, chương, tag, ảnh bìa)
├── web/              # React + Vite — app người dùng (duyệt + nghe qua Web Speech API)
├── mobile/           # Expo React Native (TypeScript) — app Android, native TTS
└── supabase/
    ├── schema.sql               # Bảng nền + RLS + storage + seed
    └── migrations/
        ├── 002_expand.sql       # Schema 2-track đọc/nghe, favorites, history, settings, audio
        ├── 003_tags.sql         # Bảng tags master
        └── 004_word_count.sql   # series.word_count + trigger
```

---

## 4. Công nghệ & phiên bản

| App | Stack | Phiên bản tham chiếu |
|---|---|---|
| `admin-web` | React + Vite + react-router-dom 6 + `@supabase/supabase-js` v2 | React 18.x, Vite 5.x |
| `web` | React + Vite + react-router-dom 6 + `@supabase/supabase-js` v2 | React 18.x, Vite 5.x |
| `mobile` | Expo SDK 57 + React Native 0.86 + TypeScript | expo ~57, react-native 0.86.2, react 19 |
| Backend | Supabase free tier (Postgres + RLS + Auth email/password + Storage) | — |
| Deploy | Vercel (2 web apps), EAS (mobile APK) | — |

CSS: **viết tay thuần**, không Tailwind/CSS-in-JS. Dùng CSS custom properties làm "design tokens" + đổi theme qua `data-theme` trên `<html>`.

---

## 5. Backend — Supabase

### 5.1 Auth
- **Chỉ email/password** (`signInWithPassword` / `signUp`). Không OAuth, không magic link, không UI reset password.
- Tự tạo `profiles` khi đăng ký (trigger trên `auth.users`).
- Phân quyền **admin** qua `profiles.role` (`user`/`admin`); helper `public.is_admin()` security definer.

### 5.2 Bảng dữ liệu (đầy đủ cột, ràng buộc)

**`profiles`**
- `id uuid PK → auth.users(id) on delete cascade`
- `role text default 'user' check (role in ('user','admin'))`
- `created_at timestamptz default now()`

**`series`** (bộ truyện)
- `id uuid PK default gen_random_uuid()`
- `title text not null`
- `author text not null default ''`
- `description text not null default ''`
- `cover_url text not null default ''`
- `status text not null default 'published' check (status in ('draft','published','completed','hidden'))`
- `genres text[] not null default '{}'`
- `tags text[] not null default '{}'`
- `word_count integer not null default 0` (tổng từ của các chương published — migration 004)
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

**`chapters`**
- `id uuid PK default gen_random_uuid()`
- `series_id uuid not null → series(id) on delete cascade`
- `order_no integer not null`
- `title text not null`
- `content text not null default ''` (chính là văn bản app sẽ đọc)
- `status text not null default 'published' check (status in ('draft','published'))` ← **CHỈ 2 trạng thái**
- `published_at timestamptz`
- `word_count integer not null default 0`
- `created_at timestamptz not null default now()`
- `unique (series_id, order_no)`

**`progress`** — 2 track ĐỌC và NGHE (dual-track):
- `id uuid PK default gen_random_uuid()`
- `user_id uuid not null → auth.users(id) on delete cascade`
- `series_id uuid not null → series(id) on delete cascade`
- Track ĐỌC: `read_chapter_id uuid → chapters(id) on delete set null`, `read_char_index int default 0`, `read_percent numeric default 0`, `last_read_at timestamptz`
- Track NGHE: `listen_chapter_id uuid → chapters(id) on delete set null`, `listen_char_index int default 0`, `audio_sec numeric default 0`, `playback_speed numeric default 1.0`, `last_listened_at timestamptz`
- `updated_at timestamptz default now()` (trigger `set_updated_at`)
- `unique (user_id, series_id)`

**`favorites`** — `user_id + series_id` PK, `created_at`.

**`bookmarks`** — `id, user_id, series_id, chapter_id, char_index int default 0, note text default '', created_at`.

**`history`** — `user_id + series_id` PK, `opened_count int default 1`, `last_opened_at timestamptz`.

**`user_settings`** — `user_id PK → auth.users`, `theme text default 'light' check (theme in ('light','dark','sepia','amoled'))`, `playback_speed numeric default 1.0`, `font_size int default 18`, `font_family text default 'system'`, `line_height numeric default 1.7`, `autoplay_next boolean default true`, `updated_at`.

**`chapter_audio`** — `chapter_id PK → chapters(id) on delete cascade`, `audio_url text default ''`, `duration_sec numeric default 0`, `created_at`. *(dự phòng cho phase sau — hiện chưa dùng)*

**`tags`** (master, quản lý tập trung) — `id uuid PK`, `name text unique not null`, `created_at`. Seed 15 tag mặc định: hệ thống, xuyên không, sảng văn, ngôn tình, kiếm hiệp, tiên hiệp, đô thị, huyền huyễn, đồng nhân, dị giới, võng du, trọng sinh, làm ruộng, xây dựng, tình cảm.

### 5.3 RLS policies
- `profiles`: select public; insert/update bởi chính chủ (`auth.uid() = id`).
- `series`: select public (true); insert/update/delete chỉ khi `is_admin()`.
- `chapters`: select public; insert/update/delete chỉ `is_admin()`.
- `progress`, `favorites`, `bookmarks`, `history`, `user_settings`: mọi thao tác chỉ chủ sở hữu (`auth.uid() = user_id`).
- `tags`: select public; write chỉ `is_admin()`.
- `chapter_audio`: select public.
- Storage `covers`: select public; write chỉ `is_admin()`.

### 5.4 Storage
- Bucket **`covers`** public (`id='covers'`, public=true) — chứa ảnh bìa. Policy: select public, insert/update/delete admin.

### 5.5 Hàm & trigger
- `handle_new_user()` — trigger `on_auth_user_created` trên `auth.users`: tự tạo `profiles`.
- `is_admin()` — security definer: `exists(profiles where id=auth.uid() and role='admin')`.
- `set_updated_at()` — trigger trước UPDATE trên `progress`, `user_settings`, `series`: set `updated_at=now()`.
- `ensure_user_settings()` — trigger sau INSERT `progress`: tự tạo hàng `user_settings` nếu chưa có.
- `recalc_series_word_count(series_uuid)` + trigger `chapters_sync_word_count` sau INSERT/UPDATE/DELETE `chapters`: tính lại `series.word_count = sum(length(content)/5)` cho các chương `published`.

### 5.6 Seed mẫu
- 3 bộ truyện mẫu (id cố định `00000000-...-0001..0003`) + 8 chương mẫu.
- Không bắt buộc; dùng để test luồng nghe.
- Gán admin: `update public.profiles set role='admin' where id='<USER_ID>'` (lấy UUID trong Authentication → Users).

### 5.7 Thứ tự áp dụng
1. `schema.sql` → 2. `migrations/002_expand.sql` → 3. `migrations/003_tags.sql` → 4. `migrations/004_word_count.sql`. (Với Supabase CLI: `supabase migration repair --status applied 002 003` rồi `supabase db push` nếu 002/003 đã chạy tay qua SQL Editor.)

---

## 6. admin-web — CMS

React + Vite + react-router-dom 6. 2 file CSS token/theme (`data-theme="light"|"dark"`). Dùng Context (Auth, Toast) + state local. Components: `Toast` (auto 3.5s, success/danger), `Confirm` (modal xác nhận xóa), `Skeleton`, `EmptyState`.

**Auth & role**: `getSession()` + `onAuthStateChange`. Nếu chưa đăng nhập → chỉ render trang Login. Role đọc 1 lần từ `profiles.role`, lưu Context `useAuth()`. Sidebar ẩn "Thêm truyện" + "Tag" nếu không phải admin; trang Tags có guard cứng (non-admin thấy thông báo tĩnh).

**Login**: email+password, 2 mode Đăng nhập/Đăng ký (signUp xong quay về login kèm thông báo). Show/hide password. Lỗi inline.

**Dashboard** (`/dashboard`, mặc định):
- 4 thẻ thống kê (head count): Bộ truyện, Chương, Người dùng, Người nghe (`progress`).
- Thanh tìm kiếm theo `title` (ilike, debounce 300ms).
- Filter tabs theo status: Tất cả / Đang ra (published) / Nháp (draft) / Hoàn thành (completed) / Ẩn (hidden) — kèm số lượng.
- Lưới truyện: bìa, tiêu đề, tác giả, status badge, số chương, nút "Quản lý" và (admin) "Xóa" (Confirm → cascade delete).
- **Pagination kiểu progressive**: mặc định hiện 12, nút "Tải thêm (N còn lại)" +12. Reset khi đổi filter/search.

**SeriesForm** (`/series/new`, `/series/:id/edit`):
- Fields: Tên truyện* (required), Tác giả, Trạng thái (4 status), Thể loại (comma-separated → array `genres`, preview chip), Tag (comma-separated → array `tags`, chip `#`), Mô tả textarea, Ảnh bìa.
- **Tag suggestions**: fetch master `tags`, gợi ý tối đa 12 tag chưa chọn, click để thêm vào input.
- **Upload bìa**: `storage.from('covers').upload('covers/${Date.now()}-${file.name}', file)` → `getPublicUrl` → `cover_url`. Hoặc dán link ảnh. Xem trước + nút "✕ Bỏ ảnh". Disable nút Lưu khi đang upload/saving.

**SeriesDetail** (`/series/:id`):
- Breadcrumb + header (tên, tác giả, status badge, genre/tag badges, mô tả) + "Sửa thông tin" (admin).
- **Form chương** (admin): Số thứ tự (`order_no`, mặc định `chapters.length+1`), Tiêu đề chương*, Trạng thái (**chỉ draft/published**), Nội dung textarea. Hiển thị "N ký tự · ~M phút nghe" (`content.length/270`). Save → insert/update, toast, reload. Trùng `order_no` → lỗi DB.
- **Danh sách chương**: sort `order_no asc`; badge status; Sửa/Xóa (Confirm); filter tabs Tất cả/Nháp/Đã đăng; tìm theo tiêu đề hoặc số thứ tự.
- **KHÔNG có reorder** (không drag, không mũi tên lên/xuống).

**Tags**:
- Guard admin. Liệt kê `tags` sort theo tên.
- Thêm (input + button, trùng name → lỗi inline). Sửa inline (Enter lưu, Escape hủy, empty → hủy). Xóa (Confirm, ghi chú: không ảnh hưởng series đang dùng tag).

**Toast/Confirm patterns**: sau mọi mutation thành công → toast success "✓ ..."; lỗi → toast danger "✕ ..."; xóa → Confirm modal.

---

## 7. web — User web app

React + Vite + react-router-dom 6. Context: `AuthContext`, `ThemeContext`, `PlayerContext`. Plain CSS, 4 theme (`light`/`dark`/`sepia`/`amoled`) qua `data-theme`, lưu `localStorage['sonovel-theme']`, đồng bộ `user_settings.theme` khi có session.

**Shell**: TopBar (desktop: logo, nav Trang chủ/Tìm kiếm + Yêu thích/Lịch sử khi đăng nhập, ô search header → `/search?q=`, ThemeMenu, Đăng nhập/UserMenu dropdown). Mobile: bottom nav 4 tab. `PlayerBar` hiện khi có session phát.

**Trang:**

- **Home** `/`: 1 query toàn catalogue `series` (`status IN ('published','completed')`, order `updated_at desc`, select `*, chapters(count)`), tự suy 3 section: "Truyện mới cập nhật" (top 10), "Phổ biến" (sort theo `chapters(count)` desc, top 10), "Thể loại" (12 genre chips → `/search?genre=`). Hero + CTA. **Continue listening**: progress người dùng (listen columns), lọc có `listen_chapter_id` hợp lệ, top 5, thẻ hiện bìa + "Chương X · còn ~N phút" + progress bar + nút play → tải chapters published → `playChapter({index, startChar: listen_char_index})`.
- **Search** `/search`: query params `q`/`genre`/`tag`, debounce 350ms ghi lại URL. **Recent searches** `localStorage['sonovel-recent-searches']` max 8. Facet chips (genres + tags từ tối đa 500 series). Kết quả: `ilike` title/author, `contains` genres/tags, sort `new` (updated_at desc)/`title`/`chapters` (word_count desc), **phân trang 24/trang**.
- **StoryDetail** `/story/:id`: song song load series + chapters published + progress + favorite + `recordHistory`. Sidebar: progress nghe (nếu có) → CTA "▶ Tiếp tục · Chương X" từ `listen_char_index`; ngược lại "🎧 Nghe từ đầu". Favorite toggle (🤍/❤️). Share (`navigator.share`/clipboard). Status badge, genre/tag chips, description. Danh sách chương: filter title/order, từ đếm `word_count`, phút nghe ước tính, click → play; chương hiện tại 🔊, chương đã nghe 🎧 %.
- **Favorites** `/favorites`: gate đăng nhập (EmptyState + nút login). Query `favorites` join `series` order `created_at desc`. Lưới `StoryCard`.
- **History** `/history`: gate đăng nhập. `history` join `series` order `last_opened_at desc` limit 20. Label "time ago".
- **Login** `/login`: email/password, 2 mode, không auto-login sau signup, không cần confirm email.

**Khách không đăng nhập**: vẫn duyệt, tìm kiếm, mở truyện, **nghe được**. Mọi helper dữ liệu cá nhân (`getProgress`, `getFavorites`, `saveListenProgress`…) tự no-op khi chưa đăng nhập.

**Player (Web Speech API)**:
- `speechSynthesis` + `SpeechSynthesisUtterance`, `lang='vi-VN'`.
- **Chunking 3000 ký tự** cố định; mỗi chunk 1 utterance; progress qua `onboundary` (`e.charIndex` + offset chunk).
- Đọc tiêu đề "Chương N. Title" khi bắt đầu chương (`startChar === 0`).
- Controls: play/pause/toggle/stop/seekTo(frac)/next/prev/replay/playChapter.
- Rate presets `[0.75, 1, 1.25, 1.5, 2]` → lưu `user_settings.playback_speed`, restart vị trí.
- Autoplay next (mặc định true, lưu `autoplay_next`); hết series → "Đã nghe hết bộ truyện!" + nút "🔁 Nghe lại".
- Sleep timer: Tắt/10/15/30/60 phút/Hết chương (poll 1s hoặc dừng cuối chương).
- `navigator.mediaSession`: metadata + play/pause/previoustrack/nexttrack.
- **Lưu tiến độ**: upsert `progress` (listen track: `listen_chapter_id`, `listen_char_index`, `audio_sec=0`, `playback_speed`, `last_listened_at`) — mỗi **4 giây** khi phát, + khi pause/stop/seek/đổi rate/hết chương.
- Hotkeys: Space, ←/→ seek ±5%, ↑/↓ prev/next (khi overlay đóng, focus không nằm trong input).

**PlayerBar**: mini bar (seek, bìa, "Chương N. Title", "N / M ký tự", prev/play/next, rate cycle, sleep indicator, expand, stop) + **full overlay** 3 tab:
1. **📋 Chương** — danh sách chương, search.
2. **📄 Xem chữ** — text chương hiện tại, tách đoạn theo `\n`, **highlight đoạn đang đọc**, auto-scroll theo playback (toggle "↓ Theo dõi", tắt khi user scroll).
3. **⚙️ Cài đặt** — rate chips, sleep chips, autoplay toggle, stop.

**KHÔNG có chế độ đọc riêng** (không trang Reader, không lưu tiến độ đọc `read_*`). Web chỉ viết cột `listen_*` của progress.

---

## 8. mobile — Expo React Native (Android)

**LƯU Ý QUAN TRỌNG**: dùng custom native module Kotlin (`sonovel-tts`) — **KHÔNG chạy được trong Expo Go**, phải dùng dev build (EAS development profile).

### 8.1 Cấu trúc code (tham chiếu)
```
mobile/
├── app.json                  # package com.sonovel.app, permissions foreground service
├── eas.json                  # profiles: development (developmentClient), preview (internal), production
├── src/
│   ├── lib/
│   │   ├── supabase.ts       # client Supabase (credential hardcode — không cần .env)
│   │   ├── session.ts        # useAuth() = {session, ready} — useSyncExternalStore + onAuthStateChange; initSession()
│   │   ├── tts.ts            # JS state manager native TTS (xem §8.5)
│   │   ├── progress.ts       # saveListenProgress, favorites, history, progress queries
│   │   ├── recentSearch.ts   # tìm kiếm gần đây (AsyncStorage)
│   │   ├── searchFilter.ts   # external store: chip thể loại ở Home → tab Search
│   │   ├── layout.ts + useMiniPlayerPad.ts   # đo chiều cao tab bar + mini player → bottom padding
│   ├── navigation/           # types.ts + index.tsx (RootStack: Tabs / Series / Player / Login modal)
│   ├── screens/              # Home, Search, Series, Favorites, History, Profile, Player, Login
│   ├── components/
│   │   ├── ui/               # SheetModal, SeriesCard, Chip, LoginCTA
│   │   └── player/           # PlayerControls, TextSheet, ChaptersSheet, SleepSheet, SeriesEndOverlay
│   └── theme/                # useTheme() — 2 theme light/dark (không sync user_settings)
└── modules/sonovel-tts/      # native module (Kotlin)
    ├── index.js / expo-module.config.json
    └── android/src/main/java/expo/modules/sonoveltts/
        ├── TtsService.kt     # foreground service + TextToSpeech + MediaSession + notification
        ├── TtsChunker.kt     # chia text ~900 ký tự theo câu/đoạn
        └── SonovelTtsModule.kt  # bridge: speak/pause/resume/stop/seekTo/... + events
```

### 8.2 Điều hướng
- **RootStack** (`@react-navigation/native-stack` + bottom-tabs): luôn hiện `Tabs` (5 tab: **Home / Search / Favorites / History / Profile**); `Series`, `Player` là stack screen; `Login` là **modal**.
- **Khách duyệt tự do**: đủ tab, xem chi tiết, mở Player. **Login chỉ bắt buộc** khi: bấm Yêu thích, vào Favorites/History, lưu tiến độ nghe, thẻ "Tiếp tục nghe".
- FloatingMiniPlayer nằm trên tab bar; màn hình dùng pad hook để nội dung không bị che.

### 8.3 Màn hình & tính năng
- **Home**: hero, thẻ **"Tiếp tục nghe"** (progress cá nhân: bìa, "Chương X · %", progress bar; bấm → tải chapters → mở Player với `initialIndex`/`initialCharIndex` từ `listen_*`), chips thể loại (→ Search qua `searchFilter`), "Mới cập nhật" + "Phổ biến" (SeriesCard).
- **Search**: recent searches (xóa được), chips genre/tag, sort (Mới/Tiêu đề/Nhiều chương), phân trang.
- **Series**: thông tin, nút "▶ Tiếp tục nghe"/"Nghe từ đầu", Yêu thích (gate login), **chia sẻ**, danh sách chương có **tìm kiếm** + badge chương đang nghe.
- **Favorites**: gate login (LoginCTA nếu chưa đăng nhập), lưới SeriesCard.
- **History**: gate login, lịch sử đã mở (time ago).
- **Profile**: nếu chưa đăng nhập → LoginCTA; nếu có → email + Đăng xuất.
- **Player** (xem §8.4): điều khiển, "Xem chữ", danh sách chương, sleep timer, overlay hết series.
- **Login**: email/password, 2 mode, đóng modal sau khi đăng nhập thành công.

### 8.4 Màn hình Player (quan trọng)
- Điều khiển: play/pause (nút hiện **ActivityIndicator khi `busy`**), prev/next, seek ±15s, thanh seek, rate, sleep timer, nút "Xem chữ", stop.
- **"Xem chữ" (TextSheet)**: bottom sheet **88% chiều cao màn hình**, tách đoạn theo `\n`, **auto-scroll + highlight vị trí đang đọc** (`onRangeStart` → `listen_char_index`), toggle "Theo dõi".
- `ChaptersSheet`: danh sách chương + search; chọn chương → `playChapterTts(idx, 0)`.
- `SleepSheet`: tắt / 10 / 15 / 30 / 60 phút / hết chương.
- `SeriesEndOverlay`: hết bộ truyện → "🔁 Nghe lại".
- **Init logic Player**: nếu native đang THỰC SỰ phát cùng series → chỉ sync UI; mọi trường hợp khác (paused/stopped/service chết/series khác) → **luôn `startTts()`** (khởi động lại hoàn toàn từ vị trí đã lưu) — đảm bảo "Tiếp tục nghe" luôn phát.

### 8.5 Native TTS module — **PHẦN DỄ SAI NHẤT, ĐÃ TỐN NHIỀU VÒNG SỬA. ĐỌC KỸ.**

**Kiến trúc:**
- `TtsService.kt`: **foreground service** (`foregroundServiceType="mediaPlayback"`) — phát nền khi khóa màn hình/ra nền. **MediaSession** + **notification** (prev / play-pause / next / stop) điều khiển được từ màn hình khóa + notification drawer.
- `TtsChunker.kt`: chia content thành chunk **~900 ký tự** tại biên câu/đoạn (`TtsChunker.chunk(content)`), `findChunkIndex(chunks, charIndex)`.
- `SonovelTtsModule.kt`: `AsyncFunction`: `play(seriesTitle, coverUrl, chaptersJson, startChapterIndex, startCharIndex, rate)`, `playChapter(idx, startChar)`, `pause`, `resume`, `stop`, `seekTo(char)`, `setRate(r)`, `nextChapter`, `prevChapter`, `getState()`, `requestNotificationPermission()`. `Events`: `onStateChange` (playing/paused/stopped), `onProgress`, `onChunkDone`, `onChapterEnd`, `onChapterChange`, `onSeriesEnd`, `onError`.
- Manifest module: `FOREGROUND_SERVICE`, `FOREGROUND_SERVICE_MEDIA_PLAYBACK`, `POST_NOTIFICATIONS` (+ queries `TTS_SERVICE`). Chạy trên Android 14+ phải đủ permission, nếu thiếu `FOREGROUND_SERVICE_MEDIA_PLAYBACK` → `startForeground` ném `SecurityException` → service chết.
- `TtsService.module` (companion) được set trong `OnCreate`/`OnDestroy` của module; mọi lệnh JS gọi qua static companion `main.post { instance?.onXxx() }` (chạy trên main thread).

**Luồng phát:**
- `play()` → `ContextCompat.startForegroundService` với `ACTION_START` + extras → `onStartCommand` parse chapters, `startForegroundNow()`, `requestAudioFocus()`, `ensureTts { playFrom(charIndex) }`.
- `ensureTts`: nếu `ttsReady` → gọi ngay; nếu chưa → lưu `pendingPlay`, gọi `initTts()` (tạo `TextToSpeech`), chờ `onInit`.
- `onInit(SUCCESS)` → set `ttsReady=true`, cấu hình audio attributes `USAGE_MEDIA`/`CONTENT_TYPE_SPEECH`, language **vi-VN** (nếu thiếu → fallback locale mặc định + `onError` code 1 "Thiếu giọng tiếng Việt"), `setSpeechRate`, `setOnUtteranceProgressListener`, rồi `pendingPlay?.invoke()`. `onInit(ERROR)` → **reset `tts=null` + `pendingPlay=null`** + emit onError code 0.
- `playFrom(targetChar)`: coerce vị trí, đọc tiêu đề chương khi bắt đầu (`announceTitle && clamped==0`), chia chunk, `tts?.speak(text, QUEUE_FLUSH, params, chunkId)`. Mỗi utterance có id **DUY NHẤT** `sonovel_${chapterIndex}_${chunkIdx}_${++speakSeq}` (hoặc `sonovel_title_...`).

**Các bug đã từng gặp — bắt buộc xử lý đúng (đừng tái phạm):**
1. **Resume sau pause bị "im lặng"** — Android TTS hay **"nuốt" speak() gọi ngay sau stop()**. Fix đã áp dụng:
   - **JS không còn dựa vào native resume()**. `resumePlayback()`: native đang `playing` → chỉ sync UI; còn lại → **luôn `startTts()` khởi động lại hoàn toàn từ vị trí đang nhớ** (con đường `ACTION_START` đáng tin cậy nhất — phát lần đầu luôn chạy).
   - Native `onResume` (notification play) giữ `SETTLE_MS=200` trễ một nhịp trước khi speak sau stop.
2. **Callback lạc/trùng** — onDone/onError trễ của utterance bị pause tái sử dụng id → tưởng là utterance mới. Fix: **`speakSeq` tăng dần** để id luôn duy nhất; mọi callback (`onStart`/`onRangeStart`/`onDone`/`onError`) **guard `if (utteranceId != currentUtteranceId) return`**. `onStateChange 'playing'` chỉ phát từ `onStart` THẬT.
3. **Watchdog chống "im lặng"**: mỗi `playFrom` schedule watchdog `WATCHDOG_MS=2000`; nếu speak trả OK mà engine không `onStart` → retry `MAX_RETRY=2` lần (`ensureTts { playFrom(pendingTargetChar) }`), sau đó **re-init engine** (`tts.shutdown()` + tạo mới), hết cách → `onErrorInternal` báo lỗi rõ ràng.
4. **Init timeout**: `initTts()` arm timeout `INIT_TIMEOUT_MS=6000`; nếu engine **không bao giờ gọi `onInit`** (binding/hang sau shutdown) → tự emit `onError` (không treo mãi).
5. **JS safety net**: `startTts()`/`playChapterTts()` set `busy=true` + arm timeout **12 giây**; nếu native im lặng (không `onStateChange`/`onProgress`/`onError`) → tự xoá busy + `stop()` service + emit error. → **NÚT PLAY KHÔNG BAO GIỜ XOAY MÃI.**
6. `playFrom` khi `!ttsReady` không được return im lặng — phải nối qua `ensureTts` (return im lặng làm watchdog mất dấu → treo).

**JS `tts.ts` (state manager):**
- Biến global module: `seriesId, seriesTitle, coverUrl, chapters[], currentIndex, currentChar, rate, isPlaying, busy, seriesEnded`.
- Hàm: `getNowPlaying()` (snapshot), `startTts(opts)`, `playChapterTts(idx, startChar)`, `pauseTts()`, `resumePlayback()`, `togglePlayPause()` (đang phát→pause; busy→stop; còn lại→resumePlayback), `stopTts()`, `seekToTts`, `setRateTts`, `nextChapterTts`, `prevChapterTts`, `flushTtsSave`, `getTtsState()`, `onTtsEvent(type, cb)`.
- Lắng nghe events native → cập nhật state + emit local events (`stateChange`, `progress`, `chunkDone`, `chapterEnd`, `chapterChange`, `seriesEnd`, `error`, `nowPlaying`).
- **Lưu tiến độ**: `scheduleSave()` throttle 4 giây (mỗi lần phát 1 timer), `flushTtsSave()` upsert `progress` (listen track: `listen_chapter_id`, `listen_char_index`, `playback_speed`, `last_listened_at`) — **chạy cả khi app ở nền** (foreground service phát tiếp). Bỏ qua nếu chưa đăng nhập / lỗi mạng.
- Rate lưu `AsyncStorage['sonovel.playbackRate']`.

---

## 9. Yêu cầu phi chức năng / ràng buộc

- **Khách vẫn nghe được** (không bắt buộc đăng nhập để dùng app).
- **Mobile là nền tảng chính**; web/admin chỉ chỉnh khi thật cần thiết.
- **KHÔNG có chế độ đọc (reading mode)** — chỉ có sheet "Xem chữ" đồng bộ trong Player.
- **2 theme** trên mobile (light/dark), **không** sync qua `user_settings`. Web dùng 4 theme có sync.
- Tiến độ nghe chỉ cần **gần đúng** — không yêu cầu chính xác từng ký tự khi resume.
- Mọi text UI tiếng Việt, không dấu "English" xen kẽ trừ tên kỹ thuật.
- Không commit secret (anon key là public, ok).

---

## 10. Tiêu chí nghiệm thu (acceptance)

1. `admin-web`: đăng nhập → thêm/sửa/xóa truyện (kèm upload bìa), quản lý chương (2 trạng thái), quản lý tag, dashboard thống kê. Không phải admin không quản lý được.
2. `web`: duyệt/tìm kiếm/lọc, mở truyện, **nghe từ đầu**, **resume từ gần vị trí dừng**, yêu thích, lịch sử, đổi theme, sleep timer, rate, "Xem chữ" highlight.
3. `mobile` (Android): đủ các tính năng trên + **nghe nền khi khóa màn hình**, notification điều khiển được (play/pause/next/prev/stop), mini player.
4. **Kịch bản "Tiếp tục" phải đạt** (đây là yêu cầu cốt lõi):
   - Đang nghe → pause → bấm play (in-app / mini player) → phát tiếp từ ~vị trí dừng, **nút không xoay mãi**.
   - Về Home → bấm thẻ "Tiếp tục nghe" → vào Player và **tự phát**.
   - Khóa màn hình → bấm play trên notification → phát tiếp.
   - Kill app → mở lại → "Tiếp tục nghe" → mở lại ~vị trí đã lưu.
   - Nếu máy thực sự không phát được (thiếu TTS) → hiện **hộp thoại lỗi rõ ràng**, không xoay vô hạn.
5. Chỉ có 2 trạng thái chương (`draft`/`published`); không tồn tại `hidden`.
6. `series.word_count` tự cập nhật khi thêm/sửa/xóa chương (trigger).

---

## 11. Quy trình build & deploy

### admin-web & web (giống nhau)
```sh
cd admin-web   # hoặc: cd web
npm install
npm run dev          # dev server (Vite)
npm run build        # build production → dist/
```
Cần `.env.local` với:
```
VITE_SUPABASE_URL=https://<project>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon key>
```
Deploy: **Vercel**, 2 project riêng từ cùng repo GitHub — đặt **Root Directory** là `admin-web` hoặc `web`; thêm 2 biến env ở Vercel settings.

### mobile
```sh
cd mobile
npm install
npx expo start            # cần dev build APK trên máy (KHÔNG chạy được trong Expo Go)
npm run android           # mở trên device/emulator đã cắm
```
Build cloud qua EAS:
```sh
npx eas-cli build --profile development --platform android   # dev client (~5–10 phút)
npx eas-cli build -p android --profile preview               # APK phân phối internal
```
Build **local** (khi hết quota EAS / muốn build nhanh):
```sh
npx expo prebuild --platform android --no-install
cd android
.\gradlew.bat assembleRelease     # cần JDK 17 + Android SDK (compileSdk 36, build-tools 36.0.0)
# APK: android\app\build\outputs\apk\release\app-release.apk (release build dùng debug keystore → cài được)
```
Credentials mobile hardcode trong `mobile/src/lib/supabase.ts` (không cần `.env`).

### supabase
Áp dụng theo thứ tự §5.7. Edge functions: **không có / không bắt buộc**.

---

## 12. Checklist triển khai (thứ tự gợi ý)

1. Tạo 4 project + cấu hình Vite/Expo base, env.
2. `supabase`: chạy 4 SQL, tạo bucket `covers`, tạo tài khoản admin + gán role. Seed nếu cần.
3. `admin-web`: auth/role → Dashboard → SeriesForm → SeriesDetail → Tags.
4. `web`: auth/theme/player context → Home → Search → StoryDetail → PlayerBar → Favorites/History/Login.
5. `mobile`: navigation + theme + session → lib (supabase/progress/tts/searchFilter/recentSearch/layout) → màn hình (Home/Search/Series/Favorites/History/Profile/Login) → Player + components/player.
6. Native `sonovel-tts`: module bridge → TtsChunker → TtsService (đầy đủ watchdog/settle/init-timeout/unique-id — §8.5).
7. Build & test đầy đủ acceptance criteria (§10), đặc biệt kịch bản "Tiếp tục".
8. Deploy web + admin-web lên Vercel; build APK EAS hoặc local.

---

## 13. Lưu ý khi làm việc với z.code

- Ưu tiên đúng spec native TTS §8.5 — đây là phần dễ hỏng nhất; **đừng** thay bằng `expo-speech` hay thư viện TTS khác, phải giữ foreground service + watchdog + safety net.
- Typecheck/build trước khi báo xong: `npx tsc --noEmit` (mobile), `npm run build` (web/admin), `npx expo export --platform android` (mobile bundle).
- Nếu gặp "nút play xoay mãi khi tiếp tục" khi test → nguyên nhân là `busy` không được xoá (native im lặng); xử lý theo §8.5 các mục 3-6.
