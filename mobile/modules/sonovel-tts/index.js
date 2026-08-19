// @ts-nocheck
// JS entry point for native module sonovel-tts.
// Re-exports the typed wrapper defined in src/lib/tts.ts that uses NativeModule.

// Safe require — không throw nếu module native chưa được link
let SonovelTts = null;
try {
  const { requireNativeModule } = require('expo-modules-core');
  SonovelTts = requireNativeModule('SonovelTts');
} catch (e) {
  console.warn('[SoNovel] Native module SonovelTts không khả dụng:', e?.message || e);
}

export default SonovelTts;
