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

### 4.4. **Fix CHÍNH (chưa commit)** — crash `Cannot assign to property 'protocol'`
- **Triệu chứng**: cài APK lên máy → mở app → flash trắng → thoát ngay, không dialog.
- **Cách tìm**: `adb logcat -d -b crash` → `FATAL signal 6 (SIGABRT)` với
  `JavascriptException: TypeError: Cannot assign to property 'protocol' which has only a getter`
  stack từ `SupabaseClient → createClient` (module `src/lib/supabase.ts` load lúc bundle init).
- **Root cause**: `@supabase/supabase-js` gọi `normalizeUrl()` → gán `url_.protocol = ...`
  trên global `URL` của Hermes — nhưng URL này **read-only** (chỉ getter) → throw.
  `index.js` là custom entry (`AppRegistry.registerComponent('main', ...)`) nên không có
  URL polyfill của Expo, dẫn đến crash lúc module supabase load.
- **Fix**:
  1. `npm install react-native-url-polyfill` (v4.0.0) → thêm vào dependencies.
  2. `index.js`: thêm dòng ĐẦU TIÊN `import 'react-native-url-polyfill/auto';`
     (phải trước mọi import dùng supabase vì supabase chạy ở module scope).
  3. Rebuild + cài lại + verify (xem §5).
- Phương án B (nếu polyfill lỗi): thêm `import 'expo'` đầu `index.js` để bật winter URL của
  Expo SDK 57 — nhưng polyfill v4 đã hoạt động tốt.

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