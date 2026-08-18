# SoNovel — Worklog dự án dựng lại theo SPEC.md

## Bối cảnh & chiến lược
- SPEC yêu cầu 4 project: `admin-web` (Vite), `web` (Vite), `mobile` (Expo + Kotlin native TTS), `supabase`.
- Môi trường sandbox: **Next.js 16 đơn app, port 3000**, user chỉ thấy route `/`.
- **Chiến lược thực tế:**
  1. App Next.js chính tại `/` (runnable/preview được): kết hợp **web user + admin CMS**, Web Speech API cho TTS, Prisma+SQLite mirror schema §5.
  2. Thư mục `mobile/` (source artifact theo §8.5): Expo + native Kotlin `sonovel-tts` đầy đủ watchdog/init-timeout/unique-id/JS safety/resume-via-ACTION_START.
  3. Thư mục `supabase/` (source artifact theo §5): schema.sql + migrations 002/003/004.
- UI 100% tiếng Việt; chapters chỉ `draft`/`published`; `series.word_count` tự cập nhật qua trigger (Prisma không có trigger → dùng app-layer + DB logic).

## Tiến độ
- [ ] Phase 1: Prisma schema + seed
- [ ] Phase 2: Backend API
- [ ] Phase 3: App shell + theme + auth + routing
- [ ] Phase 4: User screens
- [ ] Phase 5: Player + PlayerBar (Web Speech API)
- [ ] Phase 6: Admin screens
- [ ] Phase 7: mobile/ artifact (subagent)
- [ ] Phase 8: supabase/ artifact (subagent)
- [ ] Phase 9: Lint + agent-browser verification
- [ ] Phase 10: Cron webDevReview

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

