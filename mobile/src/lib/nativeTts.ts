import { requireNativeModule } from 'expo-modules-core';
import type { EventSubscription } from 'expo-modules-core';

/**
 * Typed wrapper cho native module `SonovelTts` (xem modules/sonovel-tts/).
 * Runtime entry: modules/sonovel-tts/index.js (requireNativeModule).
 *
 * `requireNativeModule` trả về object có sẵn các method của EventEmitter
 * (addListener, removeListener...) — ta chỉ cần khai báo thêm phần API
 * do Kotlin module expose qua AsyncFunction.
 */

export type TtsState = 'playing' | 'paused' | 'stopped';

export interface TtsProgress {
  chapterIndex: number;
  charIndex: number;
  charLength: number;
  fraction: number;
}

export interface TtsStateSnapshot {
  playing: boolean;
  chapterIndex: number;
  charIndex: number;
  charLength: number;
  chapterTitle: string;
  orderNo: number;
  rate: number;
  chaptersCount: number;
  seriesTitle: string;
  ttsReady: boolean;
  serviceRunning: boolean;
}

export interface SonovelTtsEvents {
  onStateChange: { state: TtsState };
  onProgress: TtsProgress;
  onChunkDone: { chapterIndex: number; chunkIndex: number };
  onChapterEnd: { chapterIndex: number };
  onChapterChange: { chapterIndex: number };
  onChapterSeek: { direction: number };
  onSeriesEnd: Record<string, never>;
  onError: { code: number; message: string };
}

export interface SonovelTtsApi {
  play(
    seriesTitle: string,
    coverUrl: string,
    chapterNumber: number,
    chapterTitle: string,
    chapterContent: string,
    startChar: number,
    rate: number
  ): Promise<string>;
  playChapter(
    chapterNumber: number,
    chapterTitle: string,
    chapterContent: string,
    startChar: number
  ): Promise<string>;
  pause(): Promise<string>;
  resume(): Promise<string>;
  stop(): Promise<string>;
  seekTo(char: number): Promise<string>;
  setRate(rate: number): Promise<string>;
  getState(): Promise<TtsStateSnapshot>;
  requestNotificationPermission(): Promise<boolean>;
}

export type SonovelTtsModule = SonovelTtsApi & {
  addListener<K extends keyof SonovelTtsEvents>(
    eventName: K,
    listener: (event: SonovelTtsEvents[K]) => void
  ): EventSubscription;
  removeListener<K extends keyof SonovelTtsEvents>(
    eventName: K,
    listener: (event: SonovelTtsEvents[K]) => void
  ): void;
  emit<K extends keyof SonovelTtsEvents>(eventName: K, params: SonovelTtsEvents[K]): void;
};

// Safe require — không throw nếu module native chưa được link (tránh crash app khi mở)
function safeRequireNativeModule(): SonovelTtsModule | null {
  try {
    return requireNativeModule<SonovelTtsModule>('SonovelTts');
  } catch (e) {
    console.warn('[SoNovel] Native module SonovelTts không khả dụng:', (e as Error).message);
    return null;
  }
}

const _nativeModule = safeRequireNativeModule();

// Proxy: nếu module không có, gọi method nào cũng reject với error rõ ràng
const noopAsync = () => Promise.reject(new Error('Native module SonovelTts không khả dụng. Cần build dev client (không chạy được trong Expo Go).'));

export const nativeTts: SonovelTtsModule = new Proxy({} as SonovelTtsModule, {
  get(_target, prop) {
    if (_nativeModule) {
      return (prop in _nativeModule) ? (_nativeModule as any)[prop] : undefined;
    }
    // Fallback khi module không có
    if (typeof prop === 'string') {
      return noopAsync;
    }
    return undefined;
  },
});

// Export flag để UI check
export const isNativeTtsAvailable = () => _nativeModule !== null;
