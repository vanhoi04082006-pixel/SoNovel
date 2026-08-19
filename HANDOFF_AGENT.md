# SoNovel — Handoff cho AI Agent kế tiếp

> Tài liệu này mô tả toàn bộ công việc đã làm cho **mobile APK** của SoNovel
> (`E:\SoNovel\mobile`): từ build APK thành công → debug "app mở là thoát" →
> đã fix và verify chạy được trên máy thật (TECNO CLA5, Android 15).
> Đọc xong file này, agent mới phải hiểu được trạng thái hiện tại, nguyên nhân
> lỗi cũ, và cách tiếp tục phát triển mà **không phá vỡ build**.

---

## 1. Bối cảnh

- Dự án SoNovel có 4 phần: `admin-web`, `web`, `mobile` (Expo + Kotlin native TTS), `supabase`.
- `mobile/` là app **Expo SDK 57 + React Native 0.86.2**, dùng **custom native module** `sonovel-tts`
  (Kotlin, `mobile/modules/sonovel-tts`) → **KHÔNG chạy được trên Expo Go**, chỉ chạy trên
  dev client / release APK tự build.
- Package: `com.sonovel.app`. New Architecture BẬT.
- Repo: https://github.com/vanhoi04082006-pixel/SoNovel (branch `main`).

---

## 2. Kết quả hiện tại

| Hạng mục | Trạng thái |
|---|---|
| Build APK release | ✅ `BUILD SUCCESSFUL` (gradle 614 tasks, ~2–25 phút tùy cache) |
| App chạy trên máy thật | ✅ Đã verify: app mở, không crash, không FATAL trong logcat |
| Tsc typecheck | ✅ PASS |
| Lỗi crash lúc mở | ✅ Đã fix (xem §4) |

APK output:
`E:\SoNovel\mobile\android\app\build\outputs\apk\release\app-release.apk` (~85 MB, ký debug `CN=Android Debug`).
Thư mục `mobile/android/` là **prebuild sinh ra** (gitignored) — không sửa tay khi cần làm lại.

---

## 3. Môi trường build (máy Windows của chủ dự án)

- OS: Windows, shell PowerShell.
- JDK 17 Temurin: `C:\Program Files\Eclipse Adoptium\jdk-17.0.20.8-hotspot`
- `ANDROID_HOME = C:\Users\buiva\AppData\Local\Android\Sdk`
  - platform-36, build-tools 35/36, NDK 27.1.12297006, CMake 3.22.1
- adb: `C:\Users\buiva\AppData\Local\Android\Sdk\platform-tools\adb.exe`
- Gradle dùng wrapper trong `mobile/android/gradlew.bat` (Gradle 9.3.1)

---

## 4. Các thay đổi & fix đã làm (theo thứ tự)

### 4.1. Commit `b9cce97` — căn chỉnh deps với Expo SDK 57 + fix TTS module
- `react`: `19.0.0` → `19.2.3` (RN 0.86.2 yêu cầu peer `react@^19.2.3` — thiếu là npm/gradle lỗi).
- `@types/react`: `~19.1.1` (đã có).
- **Xóa** dependency sai `expo-modules-core: ~2.0.0` khỏi `package.json`.
  - Lý do: bản hoisted `2.0.6` (nested trong expo) thiếu `expo-module-gradle-plugin`
    → lỗi build project `:expo` (kotlin plugin không thấy expo-modules-core).
  - Hệ quả: hiện `expo-modules-core` **chỉ tồn tại nested** tại
    `node_modules/expo/node_modules/expo-modules-core` (57.0.11), KHÔNG có bản top-level.
    Metro/autolinking vẫn resolve được → build OK. Đừng cài thêm bản top-level sai version.
- `npx expo install --fix` (via `expo install`): reanimated 4.5.1, screens ~4.26.2,
  safe-area ~5.7.0, gesture-handler ~2.32.0, expo-status-bar ~57.0.1; codegen top-level 0.86.2.
- `app.json`: bỏ `./modules/sonovel-tts` khỏi `plugins`; thêm plugin `expo-asset`, `expo-font`,
  `expo-localization`, `expo-status-bar`.
  - **QUAN TRỌNG**: Đừng thêm lại `./modules/sonovel-tts` vào `plugins` — nó gây crash prebuild.
    Module vẫn được autolink qua `expo.autolinking.nativeModulesDir: "./modules"` trong package.json.
- `SonovelTtsModule.kt`: bỏ `onCreate`/`onDestroy` override; dùng `OnCreate {}`/`OnDestroy {}`
  bên trong `definition()`.
- `TtsService.kt`: sửa import thành `android.support.v4.media.*` (MediaSessionCompat,
  PlaybackStateCompat, MediaMetadataCompat).
- Copy assets từ ổ E: (`icon.png`, `splash.png`, `adaptive-icon.png`) vào `mobile/assets/`.

### 4.2. Commit `3f73aa9` — gitignore
- Thêm ignore: `mobile/.expo/`, `mobile/android/`, `modules/sonovel-tts/android/build/`.

### 4.3. Commit `6f9d5c8` — fix crash on launch (đợt 1, chưa đủ)
- `nativeTts.ts`: dùng safe requireNativeModule (wrap try/catch) trước khi gọi module.
- `babel.config.js`: thêm `react-native-reanimated/plugin` (cuối mảng) — bản này re-export
  `react-native-worklets/plugin`, là shim hợp lệ. App không import reanimated trong src.

### 4.4. **Fix CHÍNH (commit `62a1e1f`)** — crash `Cannot assign to property 'protocol'`

**a) Triệu chứng (báo cáo từ user)**
- Cài APK lần đầu lên máy TECNO CLA5 (Android 15) → mở app → **flash trắng rồi thoát ngay**,
  không có dialog lỗi nào hiện ra.

**b) Quá trình khắc phục — từng bước đã làm**

1. **Thiết lập adb** — lúc đầu `adb devices` rỗng dù đã cắm USB. Xử lý:
   `adb kill-server && adb start-server`, đồng thời hướng dẫn user bật
   Developer options → USB debugging, đổi chế độ USB sang **File transfer/MTP**,
   chấp nhận popup RSA "Allow USB debugging". Sau đó máy hiện:
   `127763749D104047 device TECNO-CLA5` (Android 15).

2. **Đọc crash buffer (bằng chứng quyết định)**:
   ```
   adb logcat -d -b crash -t 200
   ```
   Kết quả:
   ```
   F libc: Fatal signal 6 (SIGABRT), code -1 (SI_QUEUE) in tid ... (mqt_v_js), pid ... (com.sonovel.app)
   Abort message: 'terminating due to uncaught exception ... JavascriptException:
   [runtime not ready]: TypeError: Cannot assign to property 'protocol' which has only a getter
   stack: SupabaseClient → createClient → anonymous → loadModuleImplementation → metroRequire ...'
   ```
   → **Nguyên nhân trực tiếp**: JS exception **tại thời điểm load module** (bundle init),
   phát sinh trong `createClient()` của `@supabase/supabase-js`.

3. **Phân tích code để xác định gốc rễ**:
   - `src/lib/supabase.ts` gọi `createClient(SUPABASE_URL, SUPABASE_ANON_KEY)` ở **module scope**
     (dòng export const) → module này được kéo vào bundle ngay từ lúc app khởi động
     (navigation → session/tts → supabase), nên lỗi xảy ra ngay khi app mở.
   - Xem source supabase-js: `createClient` → `normalizeUrl()` chạy `url_.protocol = ...`
     (gán property `protocol`).
   - Trong Hermes (RN 0.86, release bundle), global `URL` chỉ có **getter** cho `protocol`
     (URL này là của Hermes/RN, không settable) → gán vào property read-only ném
     `TypeError: Cannot assign to property 'protocol' which has only a getter`.

4. **Loại trừ các giả thuyết khác** (để chắc chắn không phải native module TTS):
   - Kiểm tra `adb shell pm list packages` → app đã cài đúng `com.sonovel.app`.
   - Rà toàn bộ code startup (App.tsx, index.js, navigation, session/tts/supabase/Home,
     SonovelTtsModule.kt, TtsService.kt, Events.kt, TtsChunker.kt, MainApplication.kt):
     mọi chỗ đều defensive, không thấy lỗi JS.
   - Grep toàn src: không có import `react-native-reanimated` → loại reanimated.
   - Kiểm tra bundle trong APK: `assets/index.android.bundle` (~2.9 MB) tồn tại, đủ lib native
     (`libreanimated.so`, `libworklets.so`, `libreactnative.so`, `libexpo-modules-core.so`...).
   - Giả thuyết "expo-modules-core chỉ có nested (57.0.11), require.resolve thất bại" — loại:
     Metro vẫn bundle được, không liên quan crash runtime.
   → **Kết luận**: crash là JS thuần từ URL của Hermes, không phải native.

5. **Fix + rebuild + verify** (chi tiết lệnh ở §5):
   - `npm install react-native-url-polyfill` (v4.0.0).
   - `index.js`: thêm **dòng đầu tiên** `import 'react-native-url-polyfill/auto';`
     (bắt buộc trước mọi import dùng supabase vì supabase chạy ở module scope).
   - `gradlew assembleRelease` → BUILD SUCCESSFUL (Metro rebundle 1260 modules, 21s).
   - `adb install -r` → `adb logcat -c` → `am start` → sau 15s:
     - `adb shell pidof com.sonovel.app` → trả PID (app còn sống).
     - `adb logcat -d -b crash` → rỗng (không crash).
     - `dumpsys activity` → `mFocusedApp=com.sonovel.app/.MainActivity` (đang foreground).
   → **Đã hết crash, app chạy ổn định.**

**c) Root cause (tóm tắt)**
- `@supabase/supabase-js` (2.45.4 → đang cài 2.112.3) gán `url.protocol` trên global `URL`
  của Hermes — property này **read-only** → `TypeError` → JS exception không bắt → app thoát.
- Entry `index.js` custom không kích hoạt URL polyfill của Expo → không có WHATWG URL settable.

**d) Fix đã áp dụng**
1. `react-native-url-polyfill` v4.0.0 vào `dependencies`.
2. `index.js` line 1: `import 'react-native-url-polyfill/auto';`
3. Rebuild + verify trên máy thật.

- Phương án B (dự phòng nếu polyfill lỗi): thêm `import 'expo'` đầu `index.js` để bật winter URL
  của Expo SDK 57 — polyfill v4 đã hoạt động tốt nên không cần.

---

## 5. Build & verify (lệnh chuẩn)

```powershell
# 1) Cài deps (sau khi clone/pull)
cd E:\SoNovel\mobile
npm install

# 2) Chỉ cần khi sinh lại thư mục android (thay đổi native module/config):
npx expo prebuild --platform android --clean --no-install

# 3) Build APK release (JS thay đổi thì KHÔNG cần prebuild lại, chạy thẳng)
cd E:\SoNovel\mobile\android
.\gradlew.bat assembleRelease --no-daemon
# Output: android\app\build\outputs\apk\release\app-release.apk

# 4) Verify trên máy (bật Developer options → USB debugging, cắm USB, nhận RSA)
$adb = "C:\Users\buiva\AppData\Local\Android\Sdk\platform-tools\adb.exe"
& $adb install -r "E:\SoNovel\mobile\android\app\build\outputs\apk\release\app-release.apk"
& $adb logcat -c
& $adb shell am start -n com.sonovel.app/.MainActivity
# chờ ~15s rồi:
& $adb shell pidof com.sonovel.app          # có PID = app còn sống
& $adb logcat -d -b crash                    # rỗng = không crash
```

---

## 6. Cấu trúc mobile đáng chú ý

- `index.js` — entry custom, import URL polyfill đầu tiên.
- `src/lib/supabase.ts` — `createClient` với URL + anon key thật (đã commit).
- `src/lib/nativeTts.ts` — typed wrapper + safe requireNativeModule.
- `src/lib/tts.ts` (427 dòng) — state manager, 16 functions, event bus, watchdog/safety net.
- `modules/sonovel-tts/android/.../SonovelTtsModule.kt`, `TtsService.kt`, `Events.kt`, `TtsChunker.kt`.
- `App.tsx`: GestureHandlerRootView + SafeAreaProvider + RootNavigator (sạch).

---

## 7. Lưu ý / cạm bẫy cho agent kế tiếp

1. **KHÔNG thêm** `./modules/sonovel-tts` vào `plugins` trong `app.json`.
2. **KHÔNG cài** `expo-modules-core` bản top-level ≠ 57.x — giữ cấu trúc nested hiện tại.
3. React phải là `19.2.3` (peer của RN 0.86.2). Đừng downgrade.
4. `mobile/android/` được sinh bởi prebuild, gitignored — đừng sửa tay trực tiếp (sửa qua
   `app.json`/`module.gradle`/config rồi `prebuild --clean`).
5. APK hiện ký **debug** — muốn phát hành phải cấu hình keystore + signing config trong gradle.
6. App là dev client, **không chạy được trên Expo Go**.
7. Khi thay JS thuần: chỉ cần `gradlew assembleRelease` (Metro rebundle), không cần prebuild.
8. Debug crash: luôn dùng `adb logcat -d -b crash` + `adb shell pidof` — không đoán mò.
9. `react-native-url-polyfill/auto` bắt buộc ở đầu entry — bất kỳ thay đổi entry nào cũng phải giữ.

---

## 8. Việc chưa làm (nếu muốn tiếp tục)

- Cấu hình signing release (keystore) để lên store.
- Build dev client / EAS build cho luồng phát triển nhanh hơn.
- Test luồng TTS thật trên máy (nhận quyền notification, foreground service).
- Cập nhật phần mobile của `worklog.md` cho thống nhất (file này là nguồn tham chiếu mới).