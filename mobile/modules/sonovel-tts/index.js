// @ts-nocheck
// JS entry point for native module sonovel-tts.
// Re-exports the typed wrapper defined in src/lib/tts.ts that uses NativeModule.

import { NativeModule, requireNativeModule } from 'expo-modules-core';

/**
 * @typedef {Object} SonovelTtsEvents
 * @property {(payload: { state: string }) => void} onStateChange
 * @property {(payload: { chapterIndex: number, charIndex: number, charLength: number, fraction: number }) => void} onProgress
 * @property {(payload: { chapterIndex: number, chunkIndex: number }) => void} onChunkDone
 * @property {(payload: { chapterIndex: number }) => void} onChapterEnd
 * @property {(payload: { chapterIndex: number }) => void} onChapterChange
 * @property {() => void} onSeriesEnd
 * @property {(payload: { code: number, message: string }) => void} onError
 */

const SonovelTts = requireNativeModule('SonovelTts');

export default SonovelTts;
