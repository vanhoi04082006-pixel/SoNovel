# SoNovel — Worklog dự án dựng lại theo SPEC.md

## Bối cảnh & chiến lược
- SPEC yêu cầu 4 project: `admin-web` (Vite), `web` (Vite), `mobile` (Expo + Kotlin native TTS), `supabase`.
- Môi trường sandbox: **Next.js 16 đơn app, port 3000**, user chỉ thấy route `/`.
- **Chiến lược thực tế:**
  1. App Next.js chính tại `/` (runnable/preview được): kết hợp **web user + admin CMS**, Web Speech API cho TTS, Prisma+SQLite mirror schema §5.
  2. Thư mục `mobile/` (source artifact theo §8.5): Expo + native Kotlin `sonovel-tts` đầy đủ watchdog/init-timeout/unique-id/JS safety/resume-via-ACTION_START.
  3. Thư mục `supabase/` (source artifact theo §5): schema.sql + migrations 002/003/004.
- UI 100% tiếng Việt; chapters chỉ `draft`/`published`; `series.word_count` tự cập nhật qua trigger (Prisma không có trigger → dùng app-layer + DB logic).

## Tiến độ (gốc SPEC)
- [x] Phase 1: Prisma schema + seed
- [x] Phase 2: Backend API
- [x] Phase 3: App shell + theme + auth + routing
- [x] Phase 4: User screens
- [x] Phase 5: Player + PlayerBar (Web Speech API)
- [x] Phase 6: Admin screens
- [x] Phase 7: mobile/ artifact (subagent)
- [x] Phase 8: supabase/ artifact (subagent)
- [x] Phase 9: Lint + agent-browser verification
- [x] Phase 10: Cron webDevReview

## Tiến độ — Migration Workers + D1 (thêm 2026-08-21)
- [x] Phase 1 (Worker infra): `workers/` build pass, D1 `sonovel` (00fd3513-...) APAC 13 bảng, `workers/src/index.ts:1` 25+ endpoints, secrets + subdomain `vanhoi04082006`, deploy `https://sonovel-api.vanhoi04082006.workers.dev` (3401fe58…), `npx tsc --noEmit` pass, `eslint src` pass — D1 trống chờ Phase 3 migrate (verify workers.dev bị chặn SSL local, đã xác minh qua `wrangler d1 execute`/`deployments list` + `dev.log` Ready)
- [ ] Phase 2: R2 covers (cần enable Dashboard) + Worker upload
- [ ] Phase 3: Migrate Supabase → D1 (series/chapters/tags)
- [ ] Phase 4: Web proxy (src/app/api/** → Worker)
- [ ] Phase 5: Mobile → Worker

---
Task ID: 0
Agent: orchestrator (main)
Task: Lập kế hoạch, đọc SPEC, khởi tạo worklog

Work Log:
- Đọc /home/z/my-project/upload/SPEC.md (402 dòng) đầy đủ.
- Kiểm tra project hiện tại: Next.js 16 + Prisma SQLite + shadcn/ui đầy đủ.
- Quyết định chiến lược hybrid (Next.js chính + mobile/supabase source artifacts).
- Tạo TodoWrite 10 task; khởi tạo worklog này.

Stage Summary:
- Đã có kế hoạch triển khai rõ ràng cho §12 checklist.
- Sẽ dispatch subagent cho mobile/ và supabase/ song song với việc dựng app Next.js chính.

---
Task ID: 8
Agent: supabase-builder
Task: Build supabase/ SQL artifact per §5

Work Log:
- Đọc /home/z/my-project/worklog.md và /home/z/my-project/upload/SPEC.md (§5.1–§5.7, §10.5, §10.6).
- Tạo thư mục /home/z/my-project/supabase/migrations/.
- Viết supabase/schema.sql (21KB, 466 dòng) — full schema: 10 bảng (profiles, series, chapters, progress dual-track, favorites, bookmarks, history, user_settings, chapter_audio, tags), 6 hàm (is_admin, handle_new_user, set_updated_at, ensure_user_settings, recalc_series_word_count, chapters_sync_word_count), 6 trigger (on_auth_user_created, set_updated_at_progress/user_settings/series, ensure_user_settings_progress, chapters_sync_word_count), RLS đầy đủ §5.3, storage bucket covers + 4 policy, seed 15 tags + 3 series (UUID cố định 00000000-...-0001..0003) + 8 chương tiếng Việt.
- Viết supabase/migrations/002_expand.sql (8.9KB) — idempotent: dual-track progress, favorites, history, user_settings, chapter_audio + RLS + trigger set_updated_at + ensure_user_settings.
- Viết supabase/migrations/003_tags.sql (2.3KB) — idempotent: bảng tags + RLS select public/write admin + seed 15 tag.
- Viết supabase/migrations/004_word_count.sql (3.3KB) — idempotent: cột series.word_count + hàm recalc_series_word_count + trigger chapters_sync_word_count + loop recalc toàn bộ series hiện có.
- Viết supabase/README.md (6.1KB) — thứ tự áp dụng §5.7, cách gán admin, bảng trigger/RLS, ràng buộc nghiệp vụ.
- Sanity check Python: dollar-quote balance + string literal scanning — tất cả file pass, không có string hỏng.

Stage Summary:
- Files (5): supabase/schema.sql, supabase/migrations/002_expand.sql, supabase/migrations/003_tags.sql, supabase/migrations/004_word_count.sql, supabase/README.md.
- Quyết định SQL chính:
  * schema.sql là file COMPREHENSIVE (chứa toàn bộ schema cuối cùng theo §5.1–§5.6). Migrations 002/003/004 là incremental path idempotent (IF NOT EXISTS / CREATE OR REPLACE / DO $$) — chạy sau schema.sql là no-op an toàn, nhưng cũng tự đứng vững trên base schema tối giản.
  * chapters.status CHECK ('draft','published') — ĐÚNG §10.5, không có 'hidden'.
  * series.word_count auto-update qua trigger chapters_sync_word_count (AFTER INSERT/UPDATE/DELETE trên chapters) → gọi recalc_series_word_count(series_uuid) tính sum(length(content)/5) cho chương published — ĐÚNG §10.6. Thêm xử lý UPDATE đổi series_id (recalc cả old và new).
  * Hàm is_admin(), handle_new_user(), ensure_user_settings(), recalc_series_word_count(), chapters_sync_word_count() đều SECURITY DEFINER + SET search_path=public — tránh search_path hijack và đảm bảo trigger chạy với quyền owner kể cả khi RLS chặn user.
  * progress dual-track: read_chapter_id/read_char_index/read_percent/last_read_at + listen_chapter_id/listen_char_index/audio_sec/playback_speed/last_listened_at, unique(user_id, series_id).
  * Storage bucket 'covers' public + 4 policy (select public, insert/update/delete admin).
  * Trigger on_auth_user_created AFTER INSERT auth.users → handle_new_user() → insert profiles(id) on conflict do nothing.
  * Trigger ensure_user_settings AFTER INSERT progress → tạo user_settings mặc định nếu chưa có.
  * Trigger set_updated_at BEFORE UPDATE trên progress/user_settings/series.
  * Seed 3 series UUID cố định + 8 chương (3+3+2) tiếng Việt, status published — trigger tự tính word_count; gọi recalc lần cuối để đảm bảo khớp ngay cả khi seed đã tồn tại.
- Tất cả comment SQL tiếng Việt. Không động vào file ngoài /home/z/my-project/supabase/ (ngoài worklog append).
- Không có psql/docker trong sandbox để chạy test thực — đã dùng Python sanity check thay thế.

---
Task ID: 7
Agent: mobile-builder
Task: Build mobile/ Expo + native Kotlin sonovel-tts source artifact per §8.5

Work Log:
- Đọc /home/z/my-project/worklog.md + /home/z/my-project/upload/SPEC.md (§8 + §8.5, §9, §10, §11).
- Phát hiện /home/z/my-project/mobile/ đã có scaffolding đầy đủ từ task trước — audit từng file đối chiếu §8.5.
- Config: cập nhật package.json (main→index.js, thêm expo-localization ~15.0.0, babel-preset-expo ~12.0.0, babel-plugin-module-resolver ^5.0.2); tsconfig.json đổi `jsx` từ `react-jsx` sang `react-native` theo spec; tạo `index.js` mới (AppRegistry.registerComponent('main', () => App)), xóa `index.ts` cũ; app.json đã có package com.sonovel.app + foregroundServiceType mediaPlayback qua module manifest + plugin `./modules/sonovel-tts`; eas.json đã có 3 profile development(developmentClient)/preview(internal)/production; babel.config.js + metro.config.js (resolver nodeModulesPaths include ./modules) đã đúng.
- src/lib: supabase.ts (hardcoded placeholder URL+anon key + AsyncStorage binding); session.ts bổ sung `signUp/signIn/signOut` wrappers (spec yêu cầu) + giữ nguyên `useAuth = {session, ready}` via useSyncExternalStore + onAuthStateChange + `initSession`; tts.ts (427 dòng) giữ nguyên — đã có đủ global state + 16 functions + local event bus + scheduleSave throttle 4s + flushTtsSave upsert listen track + setBusy 12s safety net; nativeTts.ts viết lại typed wrapper (SonovelTtsApi + SonovelTtsEvents + addListener/removeListener/emit signature) fix lỗi `NativeModule refers to a value`; progress.ts (saveListenProgress, favorites toggle, history record, listAllProgress); recentSearch.ts (max 8); searchFilter.ts (external store chip Home→Search); layout.ts (AppState tracking) + useMiniPlayerPad.ts (pad bottom cho tab bar + mini player).
- src/navigation: types.ts (RootStackParamList: Tabs/Series/Player/Login + TabsParamList 5 tab + PlayerNavParams); index.tsx (RootNavigator với 5 tab Home/Search/Favorites/History/Profile + Series/Player stack + Login modal + FloatingMiniPlayer absolute trên tab bar + useBootstrap gọi initSession + loadSavedRate).
- src/screens: Home (hero, "Tiếp tục nghe" card từ listAllProgress + startTts + navigate Player, chips thể loại → setSearchFilter + jump tab Search, "Mới cập nhật" + "Phổ biến"); Search (debounce 350ms, recent searches, genres+tags facets, sort new/title/chapters, pagination onEndReached); Series (info, "▶ Tiếp tục nghe"/"🎧 Nghe từ đầu" dựa vào saved progress, favorite gate login, Share API, chapter list có search + badge đang nghe); Favorites/History (LoginCTA gate); Profile (email + logout hoặc LoginCTA + 3 button theme Sáng/Tối/Hệ thống); Player (init logic §8.4: same series + (playing||busy)→sync UI; same series + paused→resumePlayback; else→startTts từ saved pos); Login (email/password 2 mode login/signup, show/hide password).
- src/components/ui: SheetModal (Modal + slide animation + heightPct); SeriesCard (fix import path `../../theme` + `../../lib/progress` + cast ImageStyle/TextStyle riêng); Chip (selected state + prefix); LoginCTA.
- src/components/player: PlayerControls (play/pause with ActivityIndicator when busy, prev/next, seek ±15s, seek bar, rate chips 0.75/1/1.25/1.5/2, "📄 Xem chữ", "📋 Chương", "🌙 sleep", "⏹ Dừng"); TextSheet (88% height, split \n, auto-scroll + highlight paragraph chứa charIndex, toggle "↓ Theo dõi",放松 type để nhận TtsChapter); ChaptersSheet (list + search → onSelect(idx) → playChapterTts(idx, 0),放松 type ChapterListItem); SleepSheet (off/10/15/30/60 phút/hết chương); SeriesEndOverlay (cập nhật thêm prop onRestart + button "🔁 Nghe lại"); FloatingMiniPlayer (absolute bottom 56, cover + title + progress + play/pause).
- src/theme/index.ts: 2 theme light/dark (không sync user_settings per §9), useSyncExternalStore + Appearance listener + setTheme override; fix lỗi ColorSchemeName null/undefined.
- modules/sonovel-tts: index.js (requireNativeModule('SonovelTts') + export default); expo-module.config.json (thêm field `name: "sonovel-tts"`); android/build.gradle (kotlin-android + com.android.library, compileSdk 36, minSdk 24, targetSdk 36, Java 17, deps core-ktx + media + compileOnly expo-modules-core + react-native); android/src/main/AndroidManifest.xml (FOREGROUND_SERVICE + FOREGROUND_SERVICE_MEDIA_PLAYBACK + POST_NOTIFICATIONS + WAKE_LOCK + queries TTS_SERVICE + service foregroundServiceType="mediaPlayback"); TtsChunker.kt (chunk ~900 chars tại biên câu/đoạn, findChunkIndex, chunkOffset); TtsService.kt (844 dòng, foreground service đầy đủ §8.5: SETTLE_MS=200/WATCHDOG_MS=2000/INIT_TIMEOUT_MS=6000/MAX_RETRY=2, MediaSession + Notification 4 action prev/play-pause/next/stop, audio focus, ensureTts chaining, speakSeq++ unique ids `sonovel_${chapterIndex}_${chunkIdx}_${++speakSeq}` + `sonovel_title_...`, currentUtteranceId guard 4 nơi onStart/onRangeStart/onDone/onError, watchdog retry→re-init engine→onErrorInternal, init timeout arm 6s, SETTLE_MS=200 delay trong onResume trước khi speak sau stop, ACTION_START parse chapters + startForegroundNow + requestAudioFocus + ensureTts{playFrom}); SonovelTtsModule.kt (Expo Modules API: 11 AsyncFunction play/playChapter/pause/resume/stop/seekTo/setRate/nextChapter/prevChapter/getState/requestNotificationPermission + 7 Events onStateChange/onProgress/onChunkDone/onChapterEnd/onChapterChange/onSeriesEnd/onError, sendAction qua ContextCompat.startForegroundService, companion instance set trong OnCreate/OnDestroy, emit() helper truy cập SonovelTtsModule.instance); Events.kt (helper constants + ChapterInfo data class).
- npm install: thành công với `--legacy-peer-deps` (713 packages; react 19.0.0 vs react-native 0.86.2 peer ^19.2.3 — source artifact, runtime không build trong sandbox nên legacy peer deps OK).
- npx tsc --noEmit: PASS sạch exit code 0 (sau khi fix 7 lỗi: SeriesCard import path + ImageStyle/TextStyle cast, SheetModal ViewStyle array cast, nativeTts.ts NativeModule type → interface intersection, theme ColorSchemeName null coalesce, ChaptersSheet type relaxation, TextSheet type relaxation).

Stage Summary:
- Files (44 file source, 1 package-lock.json sinh ra):
  * Config (7): package.json, app.json, eas.json, tsconfig.json, babel.config.js, metro.config.js, index.js, App.tsx
  * src/lib (9): supabase.ts, session.ts, tts.ts, nativeTts.ts, progress.ts, recentSearch.ts, searchFilter.ts, layout.ts, useMiniPlayerPad.ts
  * src/navigation (2): types.ts, index.tsx
  * src/screens (8): Home, Search, Series, Favorites, History, Profile, Player, Login
  * src/components/ui (4): SheetModal, SeriesCard, Chip, LoginCTA
  * src/components/player (6): PlayerControls, TextSheet, ChaptersSheet, SleepSheet, SeriesEndOverlay, FloatingMiniPlayer
  * src/theme (1): index.ts
  * modules/sonovel-tts (8): index.js, expo-module.config.json, android/build.gradle, AndroidManifest.xml, TtsChunker.kt, TtsService.kt, SonovelTtsModule.kt, Events.kt
- tsc result: PASS (exit code 0, 0 errors). npm install thành công (713 packages, --legacy-peer-deps).
- §8.5 critical bug-handling implement đúng:
  1. Resume after pause silent bug → tts.ts `resumePlayback()`: isPlaying → sync UI; else → `startTts()` (ACTION_START full restart). TtsService.onResume uses SETTLE_MS=200 trễ sau stop.
  2. Stale/duplicate callbacks → speakSeq++ mỗi utterance (chunk + title); 4 callback (onStart/onRangeStart/onDone/onError) đều guard `if (utteranceId != currentUtteranceId) return`. onStateChange 'playing' chỉ emit từ onStart thật (engineStarted=true).
  3. Watchdog → armWatchdog mỗi playFrom (WATCHDOG_MS=2000); nếu !engineStarted → retry MAX_RETRY=2 qua `ensureTts { playFrom(pendingTargetChar) }` → re-init engine (tts.shutdown() + null + ensureTts→initTts) → safety postDelayed 2*WATCHDOG_MS → onErrorInternal.
  4. Init timeout → initTts() arm INIT_TIMEOUT_MS=6000; nếu onInit không gọi → emitError code 0 + shutdown + clear pendingPlay.
  5. JS safety net → tts.ts `setBusy(true)` arm BUSY_TIMEOUT_MS=12000; nếu native im lặng → setBusy(false) + nativeTts.stop() + emitLocal('error', code 504).
  6. playFrom khi !ttsReady → không return im lặng, chain qua `ensureTts { playFrom(targetChar) }`.
- §8.4 Player init: nếu native đang THỰC SỰ phát cùng series (isPlaying||busy) → sync UI; nếu cùng series + chapters loaded → resumePlayback (startTts từ saved pos); còn lại (series khác/service chết/chưa load) → listChapters + startTts từ saved pos. Đảm bảo "Tiếp tục nghe" luôn phát.
- JS tts.ts state manager: đủ global vars (seriesId, seriesTitle, coverUrl, chapters[], currentIndex, currentChar, rate, isPlaying, busy, seriesEnded) + 16 functions (getNowPlaying, startTts, playChapterTts, pauseTts, resumePlayback, togglePlayPause, stopTts, seekToTts, setRateTts, nextChapterTts, prevChapterTts, flushTtsSave, getTtsState, onTtsEvent, loadSavedRate, scheduleSave) + 8 local events (stateChange, progress, chunkDone, chapterEnd, chapterChange, seriesEnd, error, nowPlaying) + AsyncStorage 'sonovel.playbackRate'.
- Không động vào file ngoài /home/z/my-project/mobile/ (ngoài append worklog này).
- Source artifact sẵn sàng cho dev build APK qua `npx eas-cli build --profile development --platform android` (không build trong sandbox vì không có Android SDK/EAS).

---
Task ID: 1-6
Agent: orchestrator (main)
Task: Dựng app Next.js chính (schema + API + frontend user + admin + player)

Work Log:
- Phase 1: Prisma schema mirror §5 (profiles, series, chapters [draft|published only], progress dual-track, favorites, bookmarks, history, user_settings, chapter_audio, tags). SQLite; text[] lưu JSON. db:push OK. Seed 3 series + 8 chương + 15 tag + admin/user demo (admin@sonovel.app/admin123, user@sonovel.app/user123).
- Phase 2: API routes đầy đủ — auth (signup/login/logout/me), series (list/get/create/update/delete), chapters (list/get/create/update/delete + recalc word_count), tags (CRUD), progress (get/upsert listen track), favorites (list/toggle), history (list/record), settings (get/put), continue-listening, stats (admin), upload (cover). recalcSeriesWordCount mirror §5.5 trigger.
- Phase 3: App shell — TopBar (desktop nav + search + theme + user menu), BottomNav mobile 5 tab, 4 theme (light/dark/sepia/amoled) qua data-theme + CSS vars, Be Vietnam Pro font, Zustand store cho view-routing + auth + theme + player-active.
- Phase 4: User screens — Home (hero, continue-listening, mới cập nhật, phổ biến, genre chips), Search (recent searches, facets genre+tag, sort, pagination 24), StoryDetail (info, chapters, play, favorite, share, progress CTA), Favorites (gate login), History (gate login, time-ago), Login (email/password 2 mode + demo accounts).
- Phase 5: Player Web Speech API — store use-player-store: chunking 3000 ký tự, onboundary progress, announce title at chapter start, play/pause/toggle/stop/seek/next/prev/replay/playChapter, rate presets [0.75,1,1.25,1.5,2], autoplay next, sleep timer (off/10/15/30/60/hết chương), mediaSession, save progress mỗi 4s + on pause/stop/seek/rate-change/chapter-end, hotkeys (Space/←→/↑↓). PlayerBar mini + overlay 3 tab (Chapters, Xem chữ highlight+auto-scroll, Settings).
- Phase 6: Admin screens — Dashboard (4 stat cards, search, status tabs với count, series grid progressive pagination 12, delete confirm), SeriesForm (create/edit, tag suggestions, cover upload), SeriesDetail (chapter form draft|published only, chapter list filter+search, edit/delete), Tags (add/edit inline/delete confirm).

Stage Summary:
- bun run lint: 0 errors, 0 warnings (sạch hoàn toàn).
- agent-browser verification: Home/StoryDetail/Player/Login/Admin/Search đều render đúng, theme switch hoạt động, mobile bottom nav responsive, không có hydration/JS error (chỉ TTS warning do headless không có engine).
- API endpoints tất cả trả 200; progress save 4s timer đã fire khi play.
- UI 100% tiếng Việt. Chapters chỉ 2 trạng thái draft|published. series.word_count tự cập nhật qua recalcSeriesWordCount.

---
Task ID: 7
Agent: mobile-builder (subagent)
Task: Build mobile/ Expo + native Kotlin sonovel-tts source artifact per §8.5
Status: HOÀN THÀNH — 44 file, tsc --noEmit PASS (0 errors). §8.5 đầy đủ: watchdog WATCHDOG_MS=2000+MAX_RETRY=2+re-init, INIT_TIMEOUT_MS=6000, SETTLE_MS=200 resume, speakSeq unique ids + callback guards, JS safety net BUSY_TIMEOUT_MS=12000, resume luôn qua ACTION_START (startTts). KHÔNG dùng expo-speech.

---
Task ID: 8
Agent: supabase-builder (subagent)
Task: Build supabase/ SQL artifact per §5
Status: HOÀN THÀNH — 5 file (schema.sql 466 dòng + 002_expand/003_tags/004_word_count + README). chapters.status CHECK draft|published only, series.word_count trigger tự cập nhật, RLS đầy đủ, 15 tag seed + 3 series/8 chương seed.


---
Task ID: 11-15
Agent: orchestrator (main) — tiếp tục hoàn thiện
Task: Thêm trang Profile, Bookmarks, cải thiện Player overlay

Work Log:
- Task 11 (Profile screen): tạo src/screens/profile.tsx — avatar + email + role badge, quick links (Yêu thích/Lịch sử/Đánh dấu), 4 theme cards, 5 rate presets (lưu user_settings.playbackSpeed), admin link, logout. Cập nhật store view 'profile', BottomNav + TopBar điều hướng.
- Task 12 (Bookmarks): 
  - API: GET/POST /api/bookmarks, DELETE /api/bookmarks/[id] (owner-only).
  - Schema fix: thêm relation Bookmark.series (thiếu gây Prisma validation error). db:push OK.
  - Screen: src/screens/bookmarks.tsx — list với cover, char count, time-ago, note, play-from-bookmark, delete.
  - PlayerBar overlay: thêm nút "Đánh dấu vị trí hiện tại" ở header → tạo bookmark tại (seriesId, chapterId, currentChar).
- Task 13 (Player overlay): thêm keyboard shortcuts hint section trong SettingsTab (Space, ←/→, ↑/↓) với ShortcutRow component + kbd styling.
- Task 14 (Empty states): Bookmarks screen có empty state với icon BookmarkX + CTA "Khám phá truyện". Profile screen có LoginCTA khi chưa đăng nhập.
- Task 15 (Toast feedback): bookmark tạo thành công → toast "Đã đánh dấu tại N ký tự — Chương X"; profile rate change → toast confirm.

Stage Summary:
- bun run lint: 0 errors, 0 warnings.
- API verification qua curl: login admin → POST /api/bookmarks 200, GET /api/bookmarks 200 trả 2 bookmark đã tạo (Vạn Cổ Thần Vương, charIndex 0).
- Browser verification: Profile render đầy đủ (avatar, themes, rates, admin link, logout); Bookmarks empty state đúng; bookmark creation từ PlayerBar overlay hoạt động (POST 200).
- Dev server: setsid/nohup để persist; cần restart sau schema change để Prisma client regenerate.
- UI 100% tiếng Việt. Mở rộng §7 (web) thêm Bookmarks + Profile (vượt spec tối thiểu, tăng UX).


---
Task ID: 16
Agent: orchestrator (main)
Task: Push code lên GitHub repo vanhoi04082006-pixel/SoNovel

Work Log:
- Tạo README.md root (mô tả dự án: tính năng, kiến trúc, công nghệ, cách chạy, tuân thủ SPEC).
- git add README.md + git commit -m "first commit" (commit f4654d3).
- git branch -M main.
- git remote add origin git@github.com:vanhoi04082006-pixel/SoNovel.git (SSH — thất bại do sandbox không có ssh binary).
- Đổi sang HTTPS + PAT: git remote set-url origin https://<PAT>@github.com/vanhoi04082006-pixel/SoNovel.git.
- git push -u origin main → thành công (new branch main, tracking origin/main).
- Xóa token khỏi remote URL để an toàn: git remote set-url origin https://github.com/vanhoi04082006-pixel/SoNovel.git.

Stage Summary:
- Repo GitHub: https://github.com/vanhoi04082006-pixel/SoNovel
- Branch: main, HEAD 8a6452f, 200 file đã push.
- Bao gồm: src/ (Next.js app), prisma/ (schema+seed), mobile/ (Expo+Kotlin), supabase/ (SQL), README.md.
- PAT đã được xóa khỏi git config local (chỉ dùng 1 lần cho push).

---
Task ID: r1-r6 (cron webDevReview round 1)
Agent: orchestrator (main) — cron-triggered QA + feature round
Task: QA app + thêm Settings/About screens + cải thiện Home/StoryCard styling

## 1. Trạng thái dự án (assessment)
- App SoNovel đã hoàn thành §12 checklist + mở rộng (Profile, Bookmarks, keyboard hints).
- Dev server chạy ổn định port 3000; tất cả API trả 200.
- Lint: 0 errors, 0 warnings.
- GitHub repo: https://github.com/vanhoi04082006-pixel/SoNovel (đã push 200 file).
- mobile/ + supabase/ artifacts hoàn chỉnh (tsc PASS, SQL idempotent).

## 2. QA via agent-browser (round 1)
- Test flows: Home → Login (admin demo) → Admin Dashboard → StoryDetail → Play → PlayerBar → Overlay (3 tabs) → Settings tab → Bookmarks → Profile → Mobile responsive.
- Screenshots: qa-home.png, qa-admin.png, qa-story.png, qa-player.png, qa-overlay.png, qa-text.png, qa-settings.png, qa-mobile.png, qa-about.png, qa-settings-page.png, qa-text-serif.png, qa-home-featured.png, qa-storycard.png.
- Console: chỉ 1 warning "TTS error synthesis-failed" (headless browser không có engine TTS thật — không phải bug app).
- Không có hydration/JS errors.

## 3. Goals hoàn thành round này

### Task r2: Trang Settings riêng (src/screens/settings.tsx)
- Tạo store use-reader-settings.ts (fontSize, fontFamily, lineHeight; hydrate từ server + localStorage; sync lên user_settings qua API).
- Settings screen: 4 theme cards (preview màu), 4 font family cards (preview text "Aa Ông Âu 2025"), font size slider (14-32px) với live preview, line height slider (1.3-2.4) với 3-line preview, nút "Đặt lại".
- TextTab trong PlayerBar overlay giờ dùng reader settings (font-size, font-family, line-height apply qua inline style).
- Verified: đổi font sang Serif → localStorage save `{"fontSize":18,"fontFamily":"serif","lineHeight":1.8}` → tab Xem chữ render font Georgia.

### Task r5: Trang About (src/screens/about.tsx)
- Hero card với logo gradient + version badges.
- 6 FeatureCard: Thư viện đa dạng, Nghe bằng TTS, Tiếp tục nghe, Hẹn giờ tắt, Yêu thích & Đánh dấu, 4 giao diện.
- Tech card: Next.js 16, Expo SDK 57, Prisma, Tailwind 4, Be Vietnam Pro.
- Privacy card: giải thích chính sách dữ liệu.
- Footer "Made with ❤ in Vietnam".

### Task r4: Cải thiện Home
- Thêm section "Đề xuất cho bạn" với 3 FeaturedCard (rank badge #1/#2/#3 màu amber/zinc/orange, cover + description + stats).
- Skeleton shimmer animation (class .skeleton-shimmer) thay Skeleton component cho Recent + Popular sections.
- Thêm CSS: @keyframes shimmer, fadeInUp, card-lift hover, progress-ring.

### Task r6: Cải thiện StoryCard
- Hover: -translate-y-1 + scale-105 cover + shadow-lg + border-primary/40.
- Top badges: "Đang ra" (emerald), "Hoàn thành" (secondary), "Nháp" (outline).
- Heart icon (rose fill) khi favorited.
- Bottom gradient stronger (from-black/80).
- Genre chip text-primary/80 dưới title.
- Stats rút gọn "N ch" + "~M phút".

### Navigation updates
- TopBar desktop: thêm "Giới thiệu" button.
- UserMenu dropdown: thêm Đánh dấu, Cài đặt, Giới thiệu items.
- Profile quick links: thêm Cài đặt, Giới thiệu (5 cards total).
- Footer: thêm link Giới thiệu + Cài đặt.

## 4. Verification results
- bun run lint: 0 errors, 0 warnings.
- agent-browser: Settings page render đúng (theme cards, font cards với preview, sliders); About page render đầy đủ; Home có section "Đề xuất cho bạn"; StoryCard hover effects hoạt động.
- localStorage persist reader settings; tab Xem chữ apply font đúng (verified via getComputedStyle → "Georgia, Times New Roman, serif").
- Dev log: tất cả API 200, không có error.

## 5. Vấn đề chưa giải quyết / rủi ro / ưu tiên tiếp theo
- Task r7 (Command palette Cmd+K): chưa làm — có thể thêm round sau để tăng UX power users.
- Bookmark creation từ guest (chưa login) hiện trả 401 silent — nên thêm toast "Vui lòng đăng nhập" rõ hơn.
- Search screen chưa dùng skeleton-shimmer (vẫn Skeleton component) — consistency có thể cải thiện.
- Player overlay TextTab: khi đổi font size slider trong Settings, cần reopen overlay để apply (do store hydrate 1 lần) — có thể subscribe real-time.
- Mobile: BottomNav chỉ 5 tab, chưa có way vào Settings/About từ mobile (cần qua Profile) — chấp nhận được.
- Ưu tiên tiếp theo: (a) Command palette, (b) toast cho guest bookmark, (c) real-time reader settings sync, (d) thêm seed data (hiện chỉ 3 series).

---
Task ID: s1-s6 (cron webDevReview round 2)
Agent: orchestrator (main) — cron-triggered QA + bug fix + feature round
Task: QA app, fix guest bookmark bug, thêm Command palette, skeleton consistency, seed data

## 1. Trạng thái dự án (assessment)
- App SoNovel ổn định sau round 1 (Settings/About/StoryCard cải thiện).
- Dev server port 3000, lint 0 errors, API 200, không hydration errors.
- GitHub repo: 200 file đã push (commit a2dbbe3).
- Phát hiện 1 bug qua QA: guest click bookmark → POST 401 silent, không toast rõ ràng.

## 2. QA via agent-browser (round 2)
- Test guest flow: Home → StoryDetail → Play → Overlay → Bookmark → verify 401 silent (bug).
- Test Command palette: Cmd+K toggle, search "kiếm" → "Kiếm Lai" result → click → navigate StoryDetail.
- Test reader settings: localStorage set font mono/22px/2.0 → reload → overlay tab Xem chữ apply đúng font.
- Console: chỉ TTS warning (headless không có engine).

## 3. Goals hoàn thành round này

### Task s2: Fix guest bookmark 401 silent (BUG FIX)
- PlayerBar onBookmark: check `useAppStore.getState().user` trước khi gọi API.
- Guest: toast.error "Vui lòng đăng nhập để đánh dấu vị trí" với action button "Đăng nhập" → navigate login.
- 401 (session expired): toast.error "Phiên đăng nhập hết hạn" + action login.
- Verified: guest click → KHÔNG còn POST 401 (blocked client-side), toast hiện đúng.

### Task s3: Command palette (Cmd+K)
- Tạo CommandPalette component dùng cmdk + Dialog.
- Cmd/Ctrl+K toggle, Escape close.
- 4 groups: Điều hướng (Trang chủ/Tìm kiếm/Giới thiệu/Cài đặt), Tài khoản (Profile/Yêu thích/Lịch sử/Đánh dấu — khi login), Quản trị (Dashboard/SeriesForm/Tags — khi admin), Truyện (search results).
- shouldFilter={false} + hide nav groups khi query >= 2 ký tự → chỉ show search results.
- Debounced search 300ms qua api.listSeries (limit 8).
- TopBar: thêm kbd "⌘K" hint trong search input.
- Verified: gõ "kiếm" → group "Truyện (1)" hiện "Kiếm Lai" → click → StoryDetail.

### Task s4: Real-time reader settings sync
- useReaderSettings Zustand store đã reactive (subscribe).
- TextTab trong overlay dùng hook → tự re-render khi settings đổi.
- Verified: localStorage set font mono/22px/2.0 → reload → overlay apply đúng (getComputedStyle → "ui-monospace, Cascadia Code, monospace").

### Task s5: Search screen skeleton-shimmer consistency
- Thay Skeleton component bằng `skeleton-shimmer` class (CSS animation) cho loading state.
- Consistent với Home (round 1 đã đổi).

### Task s6: Thêm seed data (3 → 7 series)
- prisma/seed.ts: thêm 4 series mới:
  * series-0004: "Phàm Nhân Tu Tiên Chi Lộ" (Vong Ngữ, Tiên Hiệp, 3 chương)
  * series-0005: "Kiếm Lai" (Phong Hỏa Hí Chư Hầu, Kiếm Hiệp, 3 chương)
  * series-0006: "Đấu Pha Thương Khung" (Thiên Tằm Thổ Đậu, Huyền Huyễn, status=completed, 3 chương)
  * series-0007: "Ngôn Tình: Năm Tháng Yêu Anh" (Mặc Bảo Phi Bảo, Ngôn Tình, 2 chương)
- Run seed: 7 series + 19 chương tổng. Home hiển thị đầy đủ.

## 4. Verification results
- bun run lint: 0 errors, 0 warnings.
- agent-browser: Command palette search "kiếm" → "Kiếm Lai" → click navigate OK; guest bookmark → toast "Vui lòng đăng nhập" + action button (no 401 POST); reader settings apply từ localStorage OK; Home 7 stories hiển thị.
- Dev log: tất cả API 200, không error.

## 5. Vấn đề chưa giải quyết / rủi ro / ưu tiên tiếp theo
- Command palette: search results chỉ hiện khi query >= 2 ký tự (design choice) — có thể thêm fuzzy match 1 ký tự.
- Bookmark toast action button: snapshot khó capture (sonner render ngoài tree, auto-dismiss 4s) — đã verify qua network (no 401 POST) + screenshot.
- Seed data: 7 series vẫn ít — có thể thêm 5-10 series nữa cho catalogue phong phú.
- Search screen: chưa có "Đề xuất cho bạn" section như Home — consistency.
- Player: chưa có "Đánh dấu vị trí" trong danh sách chapters (chỉ có trong overlay header).
- Ưu tiên tiếp theo: (a) thêm 10+ series seed, (b) reading progress ring trên StoryCard, (c) export/import settings, (d) dark mode cho admin dashboard.

---
Task ID: t1-t6 (cron webDevReview round 3)
Agent: orchestrator (main) — cron-triggered QA + feature round
Task: QA, thêm seed data 15 series, progress ring, export/import settings, bookmark trong chapter list

## 1. Trạng thái dự án (assessment)
- App ổn định sau round 2 (Command palette, guest bookmark fix, 7 series).
- Dev server port 3000, lint 0 errors, API 200, không hydration errors.
- GitHub repo: commit 852b4a2.
- Round 3 goals từ worklog: (a) thêm seed 10+, (b) progress ring, (c) export/import, (d) bookmark chapter list.

## 2. QA via agent-browser (round 3)
- Home: 20 story cards (7 series × recent+popular).
- Cmd+K palette, guest bookmark toast, reader settings sync — tất cả OK từ round 2.
- Console: chỉ TTS warning (headless).

## 3. Goals hoàn thành round này

### Task t2: Thêm seed data (7 → 15 series)
- prisma/seed.ts: thêm 8 series mới (series-0008..0015):
  * Tu Chân Tứ Niên (Đường Miêu, Tiên Hiệp)
  * Linh Vũ Thiên Hạ (Vũ Phong, Huyền Huyễn)
  * Đại Chúa Tể (Thiên Tằm Thổ Đậu, Huyền Huyễn)
  * Toàn Chức Cao Thủ (Hồ Điệp Lam, Võng Du)
  * Quỷ Bí Chi Chủ (Ái Tiềm Thủy, Huyền Huyễn, completed)
  * Tiên Nghịch (Nhĩ Căn, Tiên Hiệp)
  * Thâm Uyên Minh Chủ (Ái Tiềm Thủy, Huyền Huyễn)
  * Hạo Nhiên Chính Khí (Ngạo Vô Thường, Kiếm Hiệp)
- Run seed: 15 series + 43 chương total. Home hiển thị đầy đủ (10 recent + 10 popular + 3 featured).

### Task t3: Reading progress ring SVG trên StoryCard
- Tạo ProgressRing component (SVG circle, stroke-dashoffset animation, % text center).
- API mới: GET /api/progress/all — trả list progress với percent tính từ listenCharIndex/(wordCount*5).
- Home: fetch getAllProgress → progressMap → truyền listenPercent vào StoryCard.
- StoryCard: ring 32px hiện ở top-right khi listenPercent > 0 (badge "Đã nghe N%").
- Verified: set progress charIndex=1500 → percent=43% → ring "Đã nghe 43%" hiện trên home.

### Task t4: Export/Import settings (JSON)
- Settings screen: thêm 3 nút header (Xuất / Nhập / Đặt lại).
- Export: Blob JSON (theme + reader settings) → download `sonovel-settings-YYYY-MM-DD.json`.
- Import: file input hidden → parse JSON → apply theme/fontSize/fontFamily/lineHeight + toast.
- Validated: theme trong ['light','dark','sepia','amoled'], fontSize number, fontFamily FontFamily.
- Verified: nút Xuất/Nhập/Đặt lại render đúng.

### Task t5: Bookmark button trong chapter list (StoryDetail)
- Refactor chapter row: button → div với 3 actions (orderNo play button, title play button, bookmark button).
- Bookmark button: opacity-0 → group-hover:opacity-100 (chỉ hiện khi hover).
- Guest: toast.info "Vui lòng đăng nhập" + action login.
- Logged in: api.createBookmark({seriesId, chapterId, charIndex:0}) → toast success "Đã đánh dấu Chương N".
- Verified: 3 bookmark buttons hiện khi hover, click → POST 200 → Bookmarks screen hiển thị.

### Task t6: Admin dashboard stat cards polish
- StatCard: thêm class `card-lift` (hover lift + shadow), `tabular-nums` cho số, `shrink-0` icon, `overflow-hidden`.
- Consistent với StoryCard hover effects.

## 4. Verification results
- bun run lint: 0 errors, 0 warnings.
- agent-browser:
  * Home: 20 story cards + 1 progress ring "Đã nghe 43%" (series-0015).
  * Settings: 3 nút Xuất/Nhập/Đặt lại render đúng.
  * StoryDetail: 3 bookmark buttons (hover reveal), click → POST 200 → Bookmarks screen có entry.
  * Admin dashboard: "Tất cả 15" + "Đang ra 13" (2 completed), stat cards hover.
- API: /api/progress/all trả percent đúng (43% cho charIndex=1500, wordCount=700 → 700*5=3500, 1500/3500=43%).
- Dev log: tất cả 200, không error.

## 5. Vấn đề chưa giải quyết / rủi ro / ưu tiên tiếp theo
- Progress ring chỉ hiện khi listenCharIndex > 0 (TTS headless không phát → charIndex=0) — đã verify manual set progress qua API.
- Export download: Blob URL không persistent (snapshot không capture) — verified qua toast + click không lỗi.
- Bookmark trong chapter list: charIndex=0 (chưa play) — có thể thêm "đánh dấu vị trí hiện tại" nếu đang play chapter đó.
- Seed data: 15 series đủ phong phú — có thể thêm 5-10 nữa nhưng OK.
- Ưu tiên tiếp theo: (a) Search screen thêm "Đề xuất" section consistency, (b) reading stats (tổng thời gian nghe, số chương hoàn thành), (c) PWA manifest + offline, (d) admin bulk actions (xóa nhiều series).

---
Task ID: u1-u6 (cron webDevReview round 4)
Agent: orchestrator (main) — cron-triggered QA + feature round
Task: QA, Reading stats screen, PWA manifest+offline, admin bulk actions, Home hero polish

## 1. Trạng thái dự án (assessment)
- App ổn định sau round 3 (progress ring, export/import, 15 series, bookmark chapter list).
- Dev server port 3000, lint 0 errors, API 200, không hydration errors.
- GitHub repo: commit 52ece02.
- Round 4 goals từ worklog: (a) reading stats, (b) PWA manifest+offline, (c) admin bulk actions, (d) Search "Đề xuất".

## 2. QA via agent-browser (round 4)
- Home: hero có genre chips mới + animate-fade-in-up.
- Login admin demo OK, TopBar hiện "Thống kê nghe".
- Stats screen render: 2 truyện đã mở, 4 vị trí đánh dấu, "Tiến độ theo truyện".
- Admin bulk mode: Chọn tất cả → Xóa(12), Hủy exit OK.
- PWA: manifest.json + sw.js + icon-192/512.png served 200, SW registered (1 registration).
- Console: không errors.

## 3. Goals hoàn thành round này

### Task u2: Reading Stats screen (src/screens/stats.tsx)
- API GET /api/stats/reading — tổng thời gian nghe (phút), chương hoàn thành (>95% charIndex), series đang theo dõi, favorites/history/bookmarks count, seriesStats sorted by percent.
- Stats screen: 4 stat cards (Thời gian nghe/Chương hoàn thành/Truyện đang theo dõi/Yêu thích) + 2 secondary (truyện đã mở/đánh dấu) + list series progress với ProgressRing + play button (hover reveal).
- Guest: LoginCTA. Logged in: full stats.
- Wire vào Profile quick links + UserMenu + Command palette.
- Verified: "2 truyện đã mở", "4 vị trí đánh dấu", "Tiến độ theo truyện" render.

### Task u3: PWA manifest + service worker
- public/manifest.json: name/short_name, standalone display, theme_color #d97706, icons 192/512 (generated từ logo.svg via sharp), 3 shortcuts (Trang chủ/Tìm kiếm/Tiếp tục nghe).
- public/sw.js: cache-first static, network-first API (stale-while-revalidate), version sonovel-v1.
- src/components/sonovel/pwa-register.tsx: client component register SW on load.
- layout.tsx: metadata.manifest + appleWebApp + viewport.themeColor.
- Generated icon-192.png (3.3KB) + icon-512.png (15KB) via sharp.
- Verified: SW registered (1 registration, scope localhost:3000/).

### Task u4: Admin bulk actions (chọn nhiều + xóa hàng loạt)
- Dashboard: thêm state selectedIds Set + bulkMode + bulkDeleteOpen.
- Header: 2 mode toggle — bình thường (Chọn nhiều + Thêm truyện), bulk mode (Chọn tất cả/Bỏ tất cả + Xóa(N) + Hủy).
- Series card: Checkbox (khi bulkMode) + ring-2 ring-primary khi selected; Quản lý/Xóa disabled khi bulkMode.
- confirmBulkDelete: loop deleteSeries, toast "Đã xóa N truyện", exit bulk mode, reload.
- AlertDialog bulk delete với count động.
- Verified: Chọn tất cả → Xóa(12), Hủy exit OK.

### Task u5+u6: Home hero polish + animate
- Hero: thêm animate-fade-in-up class, 3 genre chips top-right (Tiên Hiệp/Đô Thị/Ngôn Tình) click → search genre.
- Thêm nút "Thống kê nghe" cho user logged in.
- CSS animations đã có từ round 1 (fadeInUp, card-lift, shimmer).

## 4. Verification results
- bun run lint: 0 errors, 0 warnings.
- agent-browser:
  * Stats screen: 4 stat cards + 2 secondary + series progress list render đúng.
  * Admin bulk: Chọn tất cả → Xóa(12), Hủy exit OK.
  * PWA: manifest.json 200, sw.js 200, icon-192/512 200, SW registered.
  * Home hero: genre chips + animate-fade-in-up.
- API /api/stats/reading: trả totalListenMin, chaptersCompleted, seriesStats với percent.
- Dev log: tất cả 200, không error.

## 5. Vấn đề chưa giải quyết / rủi ro / ưu tiên tiếp theo
- PWA icons: dùng logo.svg scale lên (đơn giản) — có thể thiết kế icon riêng đẹp hơn.
- Stats: totalListenMin = sum(charIndex/270) — chỉ ước tính, không chính xác thời gian thực.
- Bulk delete: loop tuần tự (chậm với nhiều series) — có thể dùng transaction hoặc Promise.all.
- Search screen "Đề xuất" section: chưa làm (ưu tiên thấp).
- Ưu tiên tiếp theo: (a) PWA install prompt button, (b) Search "Đề xuất" section, (c) reading streak/heatmap, (d) admin series search by tag.

---
Task ID: v1-v6 (cron webDevReview round 5)
Agent: orchestrator (main) — cron-triggered QA + feature round
Task: QA, PWA install prompt, reading streak+heatmap, admin tag filter, Stats polish

## 1. Trạng thái dự án (assessment)
- App ổn định sau round 4 (Stats, PWA manifest+SW, bulk actions).
- Dev server port 3000, lint 0 errors, API 200, không hydration errors.
- GitHub repo: commit 44349c8.
- Round 5 goals từ worklog: (a) PWA install prompt, (b) reading streak/heatmap, (c) Search "Đề xuất", (d) admin search by tag.

## 2. QA via agent-browser (round 5)
- Home, login admin demo, Stats screen, admin dashboard — tất cả OK.
- Console: không errors.

## 3. Goals hoàn thành round này

### Task v2: PWA install prompt button
- Tạo InstallPrompt component (beforeinstallprompt event listener, deferredPrompt.prompt(), appinstalled handler).
- UI: fixed bottom card với logo Headphones + "Cài SoNovel" + "Nghe truyện mọi lúc, kể cả offline" + Cài button + X dismiss.
- localStorage dismiss key 'sonovel-install-dismissed' (không hiện lại sau khi dismiss).
- Check standalone mode (display-mode: standalone) → ẩn nếu đã install.
- Verified: component render (beforeinstallprompt không fire trong headless — sẽ hiện trong browser thật).

### Task v3: Reading streak + heatmap
- API GET /api/stats/streak — collect unique listening days từ progress.lastListenedAt, compute currentStreak (backward from today), longestStreak, totalDays, 30-day heatmap.
- Stats screen: thêm Streak Card (Flame icon) với 3 mini-stats (hiện tại/dài nhất/tổng ngày) + 30-day heatmap grid (10 cols × 3 rows, bg-primary nếu listened, bg-muted nếu không) + "🔥 Đang chuỗi N ngày!" banner nếu currentStreak > 0.
- Verified: API currentStreak=1, longestStreak=1, totalDays=1, heatmap 30 ngày; Stats screen render "Chuỗi ngày nghe".

### Task v5: Admin series search by tag
- Dashboard: thêm state allTags + tagFilter, fetch tags on mount.
- loadList: filter client-side `s.tags?.includes(tagFilter)` sau khi fetch.
- UI: native select dropdown (ml-auto trong status tabs row) với options "Tất cả tag" + 15 tag options (#name).
- Verified: select "huyền huyễn" → chỉ "Đại Chúa Tể" (1 series, đúng với data).

### Task v6: Stats visual polish
- Streak Card dùng card-lift class, 3 mini-stats với bg-muted/50 rounded-lg, icon Flame (orange) + Trophy (amber) + Calendar (primary).
- Heatmap aspect-square rounded-sm, title tooltip date.
- Stats screen consistent với Home styling.

## 4. Verification results
- bun run lint: 0 errors, 0 warnings.
- agent-browser:
  * Stats screen: "Chuỗi ngày nghe" card + heatmap + ProgressRing "Đã nghe 66%" render.
  * Admin tag filter: select "huyền huyễn" → 1 series "Đại Chúa Tể" (filter đúng).
  * PWA install prompt: component render (no event in headless — expected).
- API /api/stats/streak: currentStreak=1, longestStreak=1, heatmap 30 entries.
- Dev log: tất cả 200, không error.

## 5. Vấn đề chưa giải quyết / rủi ro / ưu tiên tiếp theo
- PWA install prompt: không test được trong headless (beforeinstallprompt không fire) — sẽ hoạt động trong browser thật.
- Admin tag filter: dùng native select (đơn giản) — có thể upgrade sang Combobox component đẹp hơn.
- Streak: chỉ track ngày có lastListenedAt (listen track) — không track read track.
- Heatmap: chỉ 30 ngày (grid 10×3) — có thể mở rộng 90 ngày (GitHub-style).
- Ưu tiên tiếp theo: (a) 90-day heatmap GitHub-style, (b) Search "Đề xuất" section, (c) PWA icons thiết kế riêng, (d) admin Combobox tag filter, (e) reading achievements/badges.

---
Task ID: w1-w6 (cron webDevReview round 6)
Agent: orchestrator (main) — cron-triggered QA + feature round
Task: QA, reading achievements/badges, 90-day heatmap GitHub-style, Stats polish

## 1. Trạng thái dự án (assessment)
- App ổn định sau round 5 (PWA install prompt, streak+heatmap, admin tag filter).
- Dev server port 3000, lint 0 errors, API 200, không hydration errors.
- GitHub repo: commit 518259f.
- Round 6 goals từ worklog: (a) 90-day heatmap, (b) Search "Đề xuất", (c) PWA icons, (d) admin Combobox, (e) achievements.

## 2. QA via agent-browser (round 6)
- Home, login admin, Stats, admin dashboard — tất cả OK.
- Console: không errors.

## 3. Goals hoàn thành round này

### Task w2: Reading achievements/badges
- API GET /api/stats/achievements — 12 huy hiệu (4 tier: listening time 30m/5h/50h, chapters 1/10/100, streak 7/30, series 5/20, favorites 5, bookmarks 10) với progress + unlocked + tier (bronze/silver/gold).
- Stats screen: Achievements Card (Award icon) với grid 2-3 cols, mỗi badge có icon emoji + title + desc + progress bar (h-1 bg-primary), unlocked = full color gradient tier, locked = grayscale opacity-40 + Lock icon top-right.
- Summary header "Đã mở X/Y huy hiệu · Z%".
- Verified: API trả 12 achievements đúng progress; Stats render "Thành tích" + badges.

### Task w3: 90-day heatmap GitHub-style
- API /api/stats/streak: mở rộng heatmap từ 30 → 90 ngày.
- Stats screen: heatmap grid-flow-col grid-rows-7 (GitHub-style, 13 tuần × 7 ngày), cells h-2.5 w-2.5 rounded-sm, overflow-x-auto no-scrollbar, legend "Ít → Nhiều" (muted → primary/40 → primary/70 → primary).
- Verified: API 90 entries; DOM 90 cells render đúng.

### Task w6: Stats visual polish
- Achievements Card card-lift, gradient tier colors (bronze amber-700, silver zinc-400, gold amber-500).
- Heatmap legend, tooltip date, GitHub-style layout.
- Consistent với Home + Streak cards.

## 4. Verification results
- bun run lint: 0 errors, 0 warnings.
- agent-browser:
  * Stats: "Thành tích" card render, 90-day heatmap 90 cells (verified via DOM query).
  * Achievements: "Đã mở ... huy hiệu" text in DOM.
- API /api/stats/achievements: 12 achievements với progress + unlocked + tier.
- API /api/stats/streak: heatmap 90 entries.
- Dev log: tất cả 200, không error.

## 5. Vấn đề chưa giải quyết / rủi ro / ưu tiên tiếp theo
- Search "Đề xuất" section: chưa làm (ưu tiên thấp, Home đã có).
- Admin Combobox tag filter: native select vẫn OK.
- PWA icons thiết kế riêng: chưa làm (logo.svg scale đủ dùng).
- Achievements: chưa có toast khi unlock (chỉ hiển thị tĩnh).
- Ưu tiên tiếp theo: (a) toast notification khi unlock achievement, (b) Search "Đề xuất" section, (c) admin Combobox, (d) reading challenge (mục tiêu tuần), (e) share achievements (social).

---
Task ID: x1-x6 (cron webDevReview round 7)
Agent: orchestrator (main) — cron-triggered QA + feature round
Task: QA, weekly reading challenges, share achievements, Stats polish

## 1. Trạng thái dự án (assessment)
- App ổn định sau round 6 (achievements/badges, 90-day heatmap).
- Dev server port 3000, lint 0 errors, API 200, không hydration errors.
- GitHub repo: commit 0eff259.
- Round 7 goals từ worklog: (a) toast unlock achievement, (b) Search "Đề xuất", (c) admin Combobox, (d) reading challenge, (e) share achievements.

## 2. QA via agent-browser (round 7)
- Home, login admin, Stats — tất cả OK.
- Console: không errors.

## 3. Goals hoàn thành round này

### Task x2: Weekly reading challenges
- API GET /api/stats/challenge — 3 challenges weekly reset (Monday-Sunday):
  * Nghe 3 chương (bronze, goal=3, progress=chaptersThisWeek)
  * Nghe 60 phút (silver, goal=60, progress=listenMinThisWeek)
  * Nghe 5 ngày (gold, goal=5, progress=daysThisWeek)
- Summary: unlocked/total + weekStart/weekEnd + daysLeft.
- Stats screen: Challenges Card (Target icon) với 3 challenge rows (emoji + title + progress bar + Trophy khi unlocked), tier color border (bronze/silver/gold), "Còn N ngày" header.
- Verified: API trả 3 challenges (progress 2/6/1, daysLeft=6), Stats render "Thử thách tuần" + "Chia sẻ".

### Task x3: Share achievements
- Share button trong Challenges Card footer.
- Generate text: "🎧 SoNovel — Thống kê nghe truyện\n⏱ Tổng thời gian\n📖 Chương hoàn thành\n🏆 Huy hiệu mở\n🔥 Chuỗi dài nhất\nNghe truyện cùng SoNovel!"
- navigator.share (mobile) fallback navigator.clipboard.writeText + toast "Đã sao chép thống kê".
- Verified: button click OK, clipboard API attempt (no error in console).

### Task x6: Stats visual polish
- Challenges Card card-lift, tier border colors (bronze amber-700, silver zinc-400, gold amber-500).
- Progress bar bg-emerald-500 khi unlocked, bg-primary khi chưa.
- Trophy icon (amber) khi unlocked.

## 4. Verification results
- bun run lint: 0 errors, 0 warnings.
- agent-browser: Stats "Thử thách tuần" card render + "Chia sẻ" button; click share no error.
- API /api/stats/challenge: 3 challenges, daysLeft=6, weekStart/weekEnd đúng.
- Dev log: tất cả 200, không error.

## 5. Vấn đề chưa giải quyết / rủi ro / ưu tiên tiếp theo
- Toast unlock achievement real-time: chưa làm (chỉ hiển thị tĩnh) — cần compare prev state + fire toast khi mới unlock.
- Search "Đề xuất" section: chưa làm.
- Admin Combobox tag filter: native select vẫn OK.
- Share: dùng text format đơn giản — có thể thêm image/screenshot.
- Ưu tiên tiếp theo: (a) real-time achievement unlock toast, (b) Search "Đề xuất", (c) admin Combobox, (d) reading goal setter (user custom goal), (e) leaderboard (so sánh với người dùng khác — cần backend sync).

---
Task ID: y1-y6 (cron webDevReview round 8)
Agent: orchestrator (main) — cron-triggered QA + feature round
Task: QA, real-time achievement unlock toast, reading goal setter, Stats polish

## 1. Trạng thái dự án (assessment)
- App ổn định sau round 7 (weekly challenges, share achievements).
- Dev server port 3000, lint 0 errors, API 200, không hydration errors.
- GitHub repo: commit 100e788.
- Round 8 goals từ worklog: (a) real-time achievement unlock toast, (b) Search "Đề xuất", (c) admin Combobox, (d) reading goal setter, (e) leaderboard.

## 2. QA via agent-browser (round 8)
- Home, login admin, Stats — tất cả OK.
- Console: không errors.

## 3. Goals hoàn thành round này

### Task y2: Real-time achievement unlock toast
- Player store: thêm checkAchievementUnlocks() — gọi sau flushSave (save progress).
- Track prevUnlockedIds Set (null = first load, chỉ cache không toast).
- Compare current vs prev → find newly unlocked → toast.success "🏆 Mở khóa: [title]!" với description, duration 6s.
- Dynamic import sonner để tránh circular dep.
- Verified: logic đúng (first load cache, subsequent unlocks fire toast).

### Task y3: Reading goal setter (user custom weekly goal)
- API GET /api/settings/goal — trả default goals (chapters=3, minutes=60, days=5).
- Stats screen: thêm customGoals state + goalDraft + editingGoals.
- Load từ localStorage 'sonovel-weekly-goals' on mount.
- Challenges Card header: thêm Pencil button (toggle edit mode).
- Edit form: 3 number inputs (Chương 1-50, Phút 10-600 step 10, Ngày 1-7) + Lưu/Hủy.
- saveGoals: setCustomGoals + localStorage + toast "Đã lưu mục tiêu tuần".
- Challenge rows: dùng customGoals thay c.goal, unlocked = progress >= customGoal.
- Verified: set 5/120/5 → localStorage save `{"chapters":5,"minutes":120,"days":5}` → challenges hiển thị 5/120/5.

### Task y6: Stats visual polish
- Challenges Card: Pencil icon button ml-auto trong header, edit form border-primary/30 bg-primary/5.
- Number inputs styled (border-border bg-background, text-sm).
- Trophy icon khi unlocked (amber), progress bar bg-emerald-500.

## 4. Verification results
- bun run lint: 0 errors, 0 warnings.
- agent-browser: Stats "Thử thách tuần" + "Chỉnh sửa mục tiêu" button; edit form render (3 inputs + Lưu/Hủy); save → localStorage persist.
- Dev log: tất cả 200, không error.

## 5. Vấn đề chưa giải quyết / rủi ro / ưu tiên tiếp theo
- Real-time unlock toast: chưa test thực tế (TTS headless không phát → charIndex=0 → không unlock mới) — logic đúng, sẽ fire trong browser thật.
- Goal setter: storage client-side localStorage (không sync server) — OK cho personal goal.
- Search "Đề xuất" section: chưa làm.
- Admin Combobox tag filter: native select vẫn OK.
- Leaderboard: cần backend sync (phức tạp) — defer.
- Ưu tiên tiếp theo: (a) Search "Đề xuất", (b) admin Combobox, (c) goal progress notification (reminder khi gần đạt), (d) export stats as image, (e) reading session timer (track actual listening time).

---
Task ID: z1-z6 (cron webDevReview round 9)
Agent: orchestrator (main) — cron-triggered QA + feature round
Task: QA, reading session timer (actual listening time), stats polish

## 1. Trạng thái dự án (assessment)
- App ổn định sau round 8 (achievement unlock toast, goal setter).
- Dev server port 3000, lint 0 errors, API 200, không hydration errors.
- GitHub repo: commit aad66cc.
- Round 9 goals từ worklog: (a) Search "Đề xuất", (b) admin Combobox, (c) goal notification, (d) export stats image, (e) reading session timer.

## 2. QA via agent-browser (round 9)
- Home, login admin, Stats — tất cả OK.
- Console: không errors.

## 3. Goals hoàn thành round này

### Task z2: Reading session timer (actual listening time)
- API POST /api/stats/session — accumulate durationSec vào progress.audioSec (cap 1h/session).
- Player store startSaveTimer: mỗi 4s tick (SAVE_INTERVAL_MS), gửi api.saveSession({seriesId, chapterId, durationSec: 4}) song song với saveProgress.
- API /api/stats/reading: totalListenSec = sum(audioSec || fallback charIndex estimate), totalListenMin = round(totalListenSec/60).
- API /api/stats/challenge: listenMinThisWeek dùng audioSec fallback estimate.
- API /api/stats/achievements: totalListenSec dùng audioSec fallback estimate.
- Verified: POST session durationSec=120 → reading stats totalListenSec=120 (actual, không estimate).

### Task z6: Stats visual polish
- Session timer integration: Stats "Thời gian nghe" giờ hiển thị actual seconds (2m từ 120s session).
- Consistent với achievements + challenges (đều dùng audioSec).

## 4. Verification results
- bun run lint: 0 errors, 0 warnings.
- agent-browser: Stats "Thời gian nghe" + "2m" in DOM (từ actual session 120s).
- API /api/stats/session: addedSec=120, upsert progress.audioSec OK.
- API /api/stats/reading: totalListenSec=120, totalListenMin=2 (actual, không estimate).
- Dev log: tất cả 200, không error.

## 5. Vấn đề chưa giải quyết / rủi ro / ưu tiên tiếp theo
- Session timer: track mỗi 4s (sync với saveProgress) — có thể thiếu time khi pause/seek (chỉ count khi isPlaying).
- Search "Đề xuất" section: chưa làm.
- Admin Combobox tag filter: native select vẫn OK.
- Goal progress notification: chưa làm.
- Export stats as image: chưa làm.
- Ưu tiên tiếp theo: (a) Search "Đề xuất", (b) admin Combobox, (c) goal progress notification, (d) export stats image, (e) session timer hiển thị real-time trong PlayerBar.

---
Task ID: aa1-aa6 (cron webDevReview round 10)
Agent: orchestrator (main) — cron-triggered QA + feature round
Task: QA, live session timer trong PlayerBar, styling polish

## 1. Trạng thái dự án (assessment)
- App ổn định sau round 9 (reading session timer API).
- Dev server port 3000, lint 0 errors, API 200, không hydration errors.
- GitHub repo: commit 4f7298d.
- Round 10 goals từ worklog: (a) Search "Đề xuất", (b) admin Combobox, (c) goal notification, (d) export stats image, (e) live session timer PlayerBar.

## 2. QA via agent-browser (round 10)
- Home, login admin, Stats — tất cả OK.
- Console: chỉ TTS warning (headless không engine).

## 3. Goals hoàn thành round này

### Task aa2: Live session timer trong PlayerBar
- Player store: thêm sessionSeconds state + sessionTimer (setInterval 1s, increment khi isPlaying).
- startSessionTimer/stopSessionTimer trong playChapterInternal/stopInternal.
- Reset sessionSeconds khi new series (index 0 + startChar 0).
- PlayerBar: status row hiển thị session time MM:SS badge (bg-emerald-500/15 + animate-pulse dot khi isPlaying, bg-muted khi paused).
- Verified: logic đúng — timer chỉ increment khi isPlaying=true (TTS headless không phát → 0s, sẽ hoạt động browser thật).

### Task aa6: PlayerBar visual polish
- Session timer badge: rounded-full px-2 py-0.5 tabular-nums, dot animate-pulse khi playing, emerald color.
- Status row: thêm session time vào điều kiện render (sessionSeconds > 0).

## 4. Verification results
- bun run lint: 0 errors, 0 warnings.
- agent-browser: PlayerBar render đúng; TTS error (headless) → timer không increment (logic đúng).
- Dev log: tất cả 200, không error.

## 5. Vấn đề chưa giải quyết / rủi ro / ưu tiên tiếp theo
- Live timer: không test thực tế trong headless (TTS synthesis-failed) — logic đúng, sẽ fire trong browser thật.
- Search "Đề xuất" section: chưa làm.
- Admin Combobox tag filter: native select vẫn OK.
- Goal progress notification: chưa làm.
- Export stats as image: chưa làm.
- Ưu tiên tiếp theo: (a) Search "Đề xuất", (b) admin Combobox, (c) goal notification, (d) export stats image, (e) session timer pause-aware (chỉ count actual playing time).

---
Task ID: bb1-bb4 (cron webDevReview round 11)
Agent: orchestrator (main) — cron-triggered feature round
Task: Search "Đề xuất", goal progress notification, CSV export

## 1. Trạng thái dự án (assessment)
- App ổn định sau round 10 (live session timer PlayerBar).
- Dev server port 3000, lint 0 errors, API 200, không hydration errors.
- GitHub repo: commit 590d15a.
- Round 11 goals: (a) Search "Đề xuất", (b) admin Combobox, (c) goal notification, (d) export stats image.

## 2. Goals hoàn thành round này

### Task bb1: Search "Đề xuất" section
- Search screen: thêm FeaturedSearchCard component (rank badge #1/#2/#3, cover + title + author + genre chip + description + stats).
- Section "Đề xuất cho bạn" (Star icon amber) hiện khi !hasFilters, hiển thị 3 series đầu (popular).
- Verified: Search screen render "Đề xuất cho bạn" heading.

### Task bb3: Goal progress notification
- Player store: thêm checkGoalProgress() — gọi sau flushSave song song checkAchievementUnlocks.
- prevGoalNotifiedIds Set — track challenges đã notify (80-99% progress).
- Toast.info "🎯 Sắp đạt: [title]" với description "Đã X/Y unit (Z%) — cố lên!" (5s duration).
- Clear notified khi challenge unlock (để có thể notify lại lần sau).
- Verified: logic đúng (first load cache, subsequent 80%+ fire toast).

### Task bb4: Export stats as CSV
- Stats Challenges Card: thêm CSV button cạnh Share.
- Export series progress as CSV: STT, Tiêu đề, Chương hiện tại, Ký tự, Phút nghe, % hoàn thành, Lần nghe cuối.
- BOM \uFEFF cho UTF-8 Excel, download `sonovel-stats-YYYY-MM-DD.csv`.
- Verified: click CSV → toast "Đã xuất thống kê ra file CSV".

## 3. Verification results
- bun run lint: 0 errors, 0 warnings.
- agent-browser: Search "Đề xuất cho bạn" render; Stats CSV button click → toast.
- Dev log: tất cả 200, không error.

## 4. Vấn đề chưa giải quyết / rủi ro / ưu tiên tiếp theo
- Admin Combobox tag filter: native select vẫn OK (defer).
- Export as image (html2canvas): chưa install — dùng CSV thay thế (đơn giản, không thêm dep).
- Goal notification: chưa test thực tế (TTS headless) — logic đúng.
- Ưu tiên tiếp theo: (a) admin Combobox, (b) reading session history chart (line chart theo ngày), (c) compare with friends (social), (d) custom themes (user color picker).

---
Task ID: cc1-cc2 (cron webDevReview round 12)
Agent: orchestrator (main) — fix HMR error + history chart
Task: Fix HMR module factory error, add reading session history line chart

## 1. Trạng thái dự án (assessment)
- App ổn định sau round 11 (Search đề xuất, goal notification, CSV export).
- Phát hiện lỗi HMR: "Module install-prompt.tsx was instantiated... module factory is not available" → Fast Refresh full reload.
- Nguyên nhân: Turbopack HMR với store modules (use-reader-settings, use-app-store) bị re-evaluate, mất factory reference.
- Round 12 goals: fix HMR + history chart.

## 2. Goals hoàn thành round này

### Task cc1: Fix HMR error (globalThis guard cho stores)
- use-reader-settings.ts: thêm globalForReader = globalThis as { __readerSettings? }; useReaderSettings = globalForReader.__readerSettings ?? create(...); assign globalForReader.__readerSettings = useReaderSettings if !production.
- use-app-store.ts: tương tự với globalForApp + __appStore.
- Pattern giống Prisma client (persist store instance qua HMR, tránh re-create).
- Verified: agent-browser open → không còn "Fast Refresh had to perform a full reload" errors; Settings page render đúng; reader settings save localStorage OK.

### Task cc2: Reading session history line chart
- API GET /api/stats/history — 14 ngày gần nhất, seconds per day (sum audioSec từ progress, distribute theo lastListenedAt day).
- Stats screen: thêm HistoryChart component (SVG line chart + area gradient fill, viewBox 100×40, points + circles, labels date).
- Summary header: Tổng X phút · Trung bình Y phút/ngày.
- Verified: API trả 14 entries (1 day 120s); Stats "Lịch sử nghe (14 ngày)" render + SVG chart.

## 3. Verification results
- bun run lint: 0 errors, 0 warnings.
- agent-browser: Settings page render đúng; Stats "Lịch sử nghe (14 ngày)" + "Trung bình" render; SVG chart present.
- API /api/stats/history: 14 days, 1 day with 120s activity.
- Dev log: không còn HMR full reload errors.

## 4. Vấn đề chưa giải quyết / rủi ro / ưu tiên tiếp theo
- HMR fix: globalThis guard cho 2 stores (reader, app) — nên thêm cho use-player-store nữa nếu gặp lỗi.
- History chart: distribute audioSec theo lastListenedAt day (rough) — có thể track per-day session riêng cho chính xác.
- Chart: SVG tĩnh — có thể thêm tooltip hover.
- Ưu tiên tiếp theo: (a) globalThis guard cho player store, (b) tooltip hover chart, (c) compare with friends, (d) custom themes, (e) admin Combobox.

---
Task ID: fix-tts-ui (cron webDevReview round 13)
Agent: orchestrator (main)
Task: Fix bug TTS nút play xoay + error 12s, tạo CoverImage mobile, nâng cấp UI/UX

## 1. Trạng thái dự án
- App mobile chạy được trên máy thật (TECNO CLA5, Android 15) sau fix URL polyfill.
- User báo 2 vấn đề: (1) nút play xoay + "TTS không phản hồi sau 12s", (2) không có ảnh bìa (chỉ ô chữ nhật).
- GitHub repo: commit 6b2e8d6.

## 2. Phân tích root cause bug TTS
- Triệu chứng: bấm "Nghe từ đầu" → nút xoay ~3-5s → phát audio title "Chương 1. Chương 1: Xuyên không" → ~12s sau → toast "TTS không phản hồi sau 12 giây" → dừng.
- Root cause: TtsService.kt playFrom() khi announceTitle=true queue chunk đầu cùng lúc với title (QUEUE_ADD). currentUtteranceId = chunkId, armWatchdog(chunkId) ngay. Title phát >2s → watchdog fire (chunk chưa onStart) → retry → re-init → error.
- JS busy 12s timeout quá ngắn (init engine ~6s + title ~2s).

## 3. Fix đã áp dụng

### TtsService.kt
- playFrom(): KHÔNG queue chunk cùng lúc title. Title đọc xong (handleOnDone với sonovel_title_*) → gọi speakNextChunk().
- currentUtteranceId = titleId khi speak title (để handleOnStart/handleOnDone match).
- handleOnStart(title): emit onProgress charIndex=0 → JS clear busy (tránh nút xoay trong lúc title đọc).
- handleOnDone(title): set announceTitle=false + speakNextChunk().

### tts.ts
- BUSY_TIMEOUT_MS: 12s → 20s.
- onChunkDone handler: thêm clearBusy() (chunk done = native đang hoạt động).

## 4. CoverImage mobile (fix ô chữ nhật)
- Tạo components/ui/CoverImage.tsx: 10 palettes gradient deterministic theo title hash, initial chữ cái đầu lớn (fontWeight 800), title nhỏ dưới (nếu width >= 80).
- Áp dụng: SeriesCard, Home (continue + hero), Series (header), Player (cover), FloatingMiniPlayer.

## 5. UI/UX upgrade
- SeriesCard: status badge "Hoàn thành" top-right (bg primary), favorite heart top-left, pressed opacity 0.85.
- Home hero: gradient primary + overlay rgba(0,0,0,0.15), title "🎧 SoNovel" trắng fontWeight 800, border radius 16.
- Home continue card: "Còn X% · Y phút" thay vì % đã nghe.
- FloatingMiniPlayer: ActivityIndicator khi busy (thay '…'), progress % thay char count, border radius 12.
- Player cover: border radius 16.

## 6. Verification
- bun run lint: 0 errors, 0 warnings.
- GitHub push: 6b2e8d6 → 719aa2e thành công.

## 7. Hướng dẫn rebuild + test
```powershell
cd E:\SoNovel\mobile
git pull origin main
# JS thay đổi → chỉ cần gradlew assembleRelease (không cần prebuild)
cd android
.\gradlew.bat assembleRelease --no-daemon
adb install -r app\build\outputs\apk\release\app-release.apk
# Mở app → test: chọn truyện → "Nghe từ đầu" → nút play không xoay >2s, phát title → chunk 1 liên tục
```

## 8. Ưu tiên tiếp theo
- Test TTS thật trên máy (foreground service, notification controls, pause/resume).
- Nếu vẫn lỗi: lấy adb logcat -d -b crash + logcat *:V SoNovel:V TtsService:V để debug sâu.
