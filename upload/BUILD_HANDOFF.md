# Bàn giao: Build APK Android SoNovel Mobile

Tài liệu này mô tả toàn bộ những gì đã làm và thay đổi để build thành công APK Android
cho app mobile SoNovel. Dùng làm bàn giao cho một Agent khác tiếp tục công việc.

---

## 1. Kết quả cuối cùng

- **APK:** `E:\SoNovel\mobile\android\app\build\outputs\apk\release\app-release.apk`
- **Kích thước:** ~85.8 MB
- **Chữ ký:** Debug keystore (`CN=Android Debug`) → cài thẳng vào máy Android được.
- **Package:** `com.sonovel.app`
- **Trạng thái build:** `BUILD SUCCESSFUL` (Gradle 9.3.1, 614 actionable tasks).
- App hiện dùng credentials Supabase **thật** trong `mobile/src/lib/supabase.ts`
  (URL `https://ysehlghdwodsovaxxwpx.supabase.co` + anon key thật).

---

## 2. Môi trường build

- Windows (PowerShell), JDK 17 Temurin: `C:\Program Files\Eclipse Adoptium\jdk-17.0.20.8-hotspot`
- `JAVA_HOME` đã trỏ tới JDK 17.
- `ANDROID_HOME` = `C:\Users\buiva\AppData\Local\Android\Sdk`
  - platform-36, build-tools 35.0.0 / 36.0.0
  - NDK 27.1.12297006, CMake 3.22.1
- Gradle dùng wrapper (`gradlew.bat`), không cần cài gradle global.
- Stack: Expo SDK 57 (expo 57.0.14), RN 0.86.2, React 19.2.x, `newArchEnabled: true`.

Lệnh build:

```powershell
cd E:\SoNovel\mobile
npm install
npx expo prebuild --platform android --clean --no-install
cd android
.\gradlew.bat assembleRelease --no-daemon
```

---

## 3. THAY ĐỔI CODE

> Trạng thái: **đã commit + push** lên GitHub (`origin main`, repo
> `vanhoi04082006-pixel/SoNovel`). Các commit liên quan:
> - `b9cce97` — fix deps + module TTS + assets
> - `3f73aa9` — chore gitignore (thư mục sinh tự động)
> Các thư mục sinh tự động `mobile/android/`, `mobile/.expo/`,
> `modules/sonovel-tts/android/build/` **không nằm trong repo** (đã ignore).

### 3.1 `mobile/package.json`

1. `"react": "19.0.0"` → `"react": "^19.2.3"`
   - Lý do: `react-native@0.86.2` khai báo `peer react@^19.2.3`; bản 19.0.0 gây lỗi
     `npm ERESOLVE` (không cài được node_modules).
2. `"@types/react": "~19.0.0"` → `"@types/react": "^19.1.1"`
   - Lý do: RN 0.86.2 yêu cầu `peerOptional @types/react@^19.1.1`.
3. **XÓA** dependency `"expo-modules-core": "~2.0.0"`
   - Đây là dependency SAI do chính tay ai đó thêm vào package.json trước đó.
   - Hậu quả: npm hoisted `expo-modules-core@2.0.6` (bản cũ) lên top-level trong khi
     `expo@57.0.14` cần `~57.0.11` (bị đẩy xuống nested). Bản 2.0.6 không có
     `expo-module-gradle-plugin` → lỗi build `Plugin with id 'expo-module-gradle-plugin' not found`
     khi evaluate project `:expo`.
   - Sau khi xóa, npm giữ `expo-modules-core@57.0.11` (nested dưới `node_modules/expo/node_modules`),
     plugin gradle nằm ở root package: `expo-module-gradle-plugin/` (KHÔNG phải `android/`).
4. `npx expo install --fix` đồng bộ toàn bộ dependency về đúng version của SDK 57
   (theo `node_modules/expo/bundledNativeModules.json`):
   | Package | Trước | Sau (SDK 57) |
   |---|---|---|
   | react-native-reanimated | ~3.16.0 | **4.5.1** |
   | react-native-screens | ~4.4.0 | **~4.26.0** (cài 4.26.2) |
   | react-native-safe-area-context | 4.12.0 | **~5.7.0** (cài 5.7.0) |
   | react-native-gesture-handler | ~2.20.2 | **~2.32.0** (cài 2.32.0) |
   | expo-status-bar | ~2.0.0 | **~57.0.1** (cài 57.0.1) |
   - Lý do: bản cũ không tương thích RN 0.86 / New Architecture. Reanimated 3.16.7
     lỗi biên dịch CMake (`target was not found`), codegen sai bản gây lỗi bundle.
   - Reanimated 4.5.1 kéo theo dependency `react-native-worklets`.
   - Sau đó `@react-native/codegen` top-level đúng = 0.86.2 (khớp react-native).

### 3.2 `mobile/app.json`

1. **XÓA** `"./modules/sonovel-tts"` khỏi mảng `plugins`.
   - Lý do: `expo prebuild` load config plugin này → resolve vào `modules/sonovel-tts/index.js`
     → file này import `expo-modules-core` → Node crash
     `Stripping types is currently unsupported for files under node_modules`
     (vì import qua đường dẫn `.ts` trong node_modules).
   - Module TTS **vẫn hoạt động bình thường** vì được autolink qua
     `"autolinking": { "nativeModulesDir": "./modules" }` trong package.json
     (không cần khai trong `plugins`).
   - ⚠️ **KHÔNG thêm lại** `./modules/sonovel-tts` vào `plugins` trừ khi tạo một
     config plugin thực sự (index.js hiện là JS API của native module, không phải config plugin).
2. `expo install --fix` thêm vào `plugins`:
   `expo-asset`, `expo-font`, `expo-localization`, `expo-status-bar`.
3. Còn cảnh báo không chặn build:
   - `edgeToEdgeEnabled` bị deprecated (Android 16 ép edge-to-edge) — nên gỡ key này khỏi app.json khi rảnh.
   - `userInterfaceStyle` cần cài `expo-system-ui` nếu muốn bật — không bắt buộc.

### 3.3 `mobile/modules/sonovel-tts/android/src/main/java/expo/modules/sonoveltts/SonovelTtsModule.kt`

Module này viết cho SDK cũ, fix để chạy trên expo-modules-core 57:

1. **BỎ** 2 override không còn tồn tại trong `Module` base class của expo-modules-core 57:
   - `override fun onCreate()` và `override fun onDestroy()` (compile lỗi "overrides nothing").
2. **THÊM** lifecycle mới bên trong `ModuleDefinition { ... }`:
   ```kotlin
   Name("SonovelTts")

   OnCreate {
       instance = this@SonovelTtsModule
   }

   OnDestroy {
       instance = null
   }
   ```
   - API mới: `OnCreate { }` / `OnDestroy { }` là function của `ModuleDefinitionBuilder`
     (xem `ModuleDefinitionBuilder.kt` trong expo-modules-core). Chạy khi module được tạo/hủy.
   - `instance` là companion var dùng để `TtsService` gửi event về JS.

### 3.4 `mobile/modules/sonovel-tts/android/src/main/java/expo/modules/sonoveltts/TtsService.kt`

1. **Sửa import** (3 dòng đầu sau `NotificationCompat.MediaStyle`):
   - Trước (SAI): `androidx.media.session.MediaSessionCompat`,
     `androidx.media.session.PlaybackStateCompat`,
     `androidx.media.session.MediaMetadataCompat`
   - Sau (ĐÚNG):
     ```kotlin
     import android.support.v4.media.MediaMetadataCompat
     import android.support.v4.media.session.MediaSessionCompat
     import android.support.v4.media.session.PlaybackStateCompat
     ```
   - Lý do: artifact `androidx.media:media:1.7.0` (đã khai trong
     `modules/sonovel-tts/android/build.gradle`) giữ `MediaSessionCompat`,
     `PlaybackStateCompat`, `MediaMetadataCompat` ở **package legacy**
     `android.support.v4.media.*` — KHÔNG nằm ở `androidx.media.app` / `androidx.media.session`.
     (Riêng `androidx.media.app.NotificationCompat.MediaStyle` là có thật trong artifact này.)
2. **Đổi API:** `module.emit(eventName, params)` → `module.sendEvent(eventName, params)`
   - Lý do: `emit()` không còn trong `Module` class expo-modules-core 57; thay bằng `sendEvent`.

### 3.5 Assets

- Copy 3 file icon người dùng chuẩn bị ở `E:\` root (đều 1254×1254) vào `mobile/assets/`:
  - `E:\icon.png` → `mobile/assets/icon.png`
  - `E:\splash.png` → `mobile/assets/splash.png`
  - `E:\adaptive-icon.png` → `mobile/assets/adaptive-icon.png`
- app.json đã tham chiếu các file này (đã commit trong `b9cce97`).

### 3.6 `.gitignore` (root)

- Thêm ignore cho 3 thư mục sinh tự động để `git status` sạch:
  - `mobile/.expo/` (cache Expo)
  - `mobile/android/` (project native do `expo prebuild` sinh)
  - `mobile/modules/sonovel-tts/android/build/` (output build gradle)
- Commit `3f73aa9`.

---

## 4. Những lỗi gặp phải trong quá trình build và cách xử lý

| STT | Lỗi | Nguyên nhân | Cách xử lý |
|---|---|---|---|
| 1 | `npm ERESOLVE` (react-native cần react ^19.2.3, @types/react ^19.1.1) | Version peer sai | Sửa package.json (mục 3.1) |
| 2 | `expo prebuild` crash `Stripping types ... under node_modules` | Plugin `./modules/sonovel-tts` trong app.json | Gỡ khỏi plugins (mục 3.2) |
| 3 | Gradle: `Plugin with id 'expo-module-gradle-plugin' not found` (project `:expo`) | `expo-modules-core@2.0.6` (cũ) hoisted top-level, thiếu plugin | Xóa dep sai `expo-modules-core@~2.0.0` trong package.json (mục 3.1) |
| 4 | `createBundleReleaseJsAndAssets`: `Unable to determine event arguments for "onModeChange"` | `@react-native/codegen@0.76.9` top-level không khớp RN 0.86.2 | `expo install --fix` → codegen hoisted đúng 0.86.2 |
| 5 | `react-native-reanimated:configureCMake...` fail (`target was not found`) | Reanimated 3.16.7 không tương thích RN 0.86 | Nâng reanimated lên 4.5.1 (mục 3.1) |
| 6 | `:sonovel-tts:compileReleaseKotlin`: `Unresolved reference 'MediaSessionCompat'...` | Import package SAI (nghĩ là `androidx.media.app`, thực ra là `android.support.v4.media.*`) | Sửa import (mục 3.4) |
| 7 | `:sonovel-tts:compileReleaseKotlin`: `onCreate/onDestroy overrides nothing`, `module.emit` unresolved | API expo-modules-core 57 đổi | `OnCreate/OnDestroy` trong definition + `sendEvent` (mục 3.3, 3.4) |

Ghi chú phụ: có thử xóa cache gradle `androidx.media/media/1.7.0` vì tưởng artifact hỏng,
nhưng artifact là đúng — vấn đề thực sự là package import sai (lỗi #6).

---

## 5. Lưu ý cho Agent/người tiếp tục

1. Thay đổi mục 3 **đã commit** (`b9cce97`, `3f73aa9`) và **đã push** lên `origin/main`.
2. APK đã sẵn sàng để test. Người dùng sẽ cài `app-release.apk` lên máy và test
   (đọc truyện + tính năng TTS qua module `sonovel-tts`).
3. Nếu cần chạy lại build: chạy đúng lệnh mục 2. Không cần `expo prebuild` lại trừ khi
   sửa `app.json` hoặc cấu hình native.
4. **Đừng thêm** `./modules/sonovel-tts` vào `plugins` của app.json (lỗi #2).
5. `mobile/android/` là thư mục sinh tự động bởi prebuild (có thể xóa và prebuild lại an toàn,
   không cần commit).
6. Nếu gặp lỗi liên quan TTS khi test: nhìn `TtsService.kt` (service foreground +
   MediaSession) và `SonovelTtsModule.kt` (cầu nối JS↔native).
7. Module `sonovel-tts` dùng các API của `expo-modules-core` — khi nâng Expo SDK lần sau,
   kiểm tra lại: lifecycle (`OnCreate/OnDestroy`), `sendEvent`, package của media classes.