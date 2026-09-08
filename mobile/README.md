# SoNovel Mobile — app Android (Expo + Kotlin TTS)

App nghe truyện: system TTS qua native module `sonovel-tts` (foreground service
`mediaPlayback`, notification/lock-screen controls), đồng bộ tiến độ qua Worker.

- **Version:** `1.1.0` (`app.json`), `versionCode: 2`, package `com.sonovel.app`
- **Stack:** Expo SDK 57 · React Native 0.86.2 New Architecture · expo-image (disk cache) · Zustand-ish module state
- Xem dòng version trong app tại màn **Tài khoản** (dưới nút Đăng xuất).

> ⚠️ Dùng native module riêng — **không chạy được trên Expo Go**, chỉ dev client / APK tự build.

## Build APK release (local)

Yêu cầu: **JDK 17 Temurin** (`C:\Program Files\Eclipse Adoptium\jdk-17.0.20.101-hotspot`),
Android SDK (`platform-36`, build-tools 35/36, NDK 27, CMake 3.22), Gradle wrapper 9.3.1.

```powershell
cd mobile
npm install
npx expo prebuild --platform android --no-install   # BẮT BUỘC khi đổi native module / assets / deps native / app.json
cd android
$env:JAVA_HOME = "C:\Program Files\Eclipse Adoptium\jdk-17.0.20.101-hotspot"
.\gradlew.bat assembleRelease --no-daemon           # ~2–30 phút tùy cache
# Output: android/app/build/outputs/apk/release/app-release.apk
```

- Chỉ đổi JS thuần → bỏ qua prebuild, chạy thẳng gradlew (Metro rebundle).
- Tăng `versionCode` trong `app.json` mỗi bản release để máy nhận update + launcher refresh icon.
- APK ký debug — cài đè bản cũ nên **gỡ bản cũ trước** nếu icon không đổi.

## Build cloud (EAS)

`eas.json` có sẵn 3 profile (`development` / `preview` APK / `production` AAB).
Lưu ý: free plan hết quota nhanh (`This account has used its Android builds...`) — local build là đường chính.

## Cấu trúc

```
mobile/
├── App.tsx / index.js          # entry (index.js import URL polyfill ĐẦU TIÊN)
├── app.json                    # package, permissions, adaptive icon
├── src/
│   ├── screens/                # Player, Series (+tab Minh họa), Reader, Search...
│   ├── components/series/      # IllustrationsTab (drawer mục lục, expo-image)
│   ├── lib/tts.ts              # JS state manager TTS (913+ dòng)
│   ├── lib/nativeTts.ts        # typed bridge (kèm hasNativeFn check version)
│   └── lib/{worker,progress,chapters,illustrations}.ts  # gọi Worker API
└── modules/sonovel-tts/        # native module Kotlin
    └── android/.../sonoveltts/
        ├── TtsService.kt       # foreground service + TTS engine + watchdogs
        ├── SonovelTtsModule.kt # bridge AsyncFunction + Events
        ├── TtsChunker.kt       # chia chunk ~900 ký tự
        └── Events.kt           # tên events
```

## Luồng TTS (tóm tắt — chi tiết xem HANDOFF_AGENT.md)

JS (`tts.ts`) điều phối chương, native phát từng chương. Tự chuyển chương đa lớp:
event `ON_CHAPTER_END` → preload chương kế (tự phát sau 400ms) → tự fetch qua Worker khi thiếu preload → poll `finished` 1s → JS reconcile theo native → watchdog 2s/re-init + busy-timeout 12s. **Ý định bấm tay luôn thắng** (`playChapterTts`, single-flight theo series).

## Cạm bẫy (đã trả giá)

1. **Hermes `URL.protocol` read-only** → crash lúc mở app — fix bằng `react-native-url-polyfill/auto` dòng đầu `index.js`. Không được xóa.
2. **`expo-modules-core` chỉ tồn tại nested** — đừng cài bản top-level sai version.
3. **Thêm native module/asset/config** → phải `expo prebuild` lại, nếu không APK vẫn đồ cũ (đã từng ship nhầm icon cũ).
4. **Worklets/CMake build fail lạ** → xóa `.cxx`/transforms cache, restart daemon, build lại (flaky env, không phải code).
5. **APK cũ thiếu hàm native mới** → dùng `hasNativeFn()` guard + báo "cần APK mới", không crash.

## Debug trên máy thật

```powershell
$adb = "$env:ANDROID_HOME\platform-tools\adb.exe"
& $adb devices
& $adb install -r app-release.apk
& $adb logcat -c
& $adb shell am start -n com.sonovel.app/.MainActivity
& $adb shell pidof com.sonovel.app        # có PID = còn sống
& $adb logcat -d -b crash                 # rỗng = không crash
& $adb logcat -s SoNovelTTS               # log TTS (auto-next, watchdog, fetch)
```

Bật Developer options → USB debugging, chế độ USB File transfer/MTP, chấp nhận RSA trên máy.
