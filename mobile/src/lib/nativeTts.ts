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
  onSeriesEnd: Record<string, never>;
  onError: { code: number; message: string };
}

/**
 * API methods (AsyncFunction trong Kotlin module). EventEmitter methods
 * (addListener/removeListener/emit) được expo-modules-core thêm sẵn vào
 * object trả về từ `requireNativeModule` nên ta không cần khai báo lại.
 */
export interface SonovelTtsApi {
  play(
    seriesTitle: string,
    coverUrl: string,
    chaptersJson: string,
    startChapter: number,
    startChar: number,
    rate: number
  ): Promise<string>;
  playChapter(idx: number, startChar: number): Promise<string>;
  pause(): Promise<string>;
  resume(): Promise<string>;
  stop(): Promise<string>;
  seekTo(char: number): Promise<string>;
  setRate(rate: number): Promise<string>;
  nextChapter(): Promise<string>;
  prevChapter(): Promise<string>;
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

export const nativeTts: SonovelTtsModule = requireNativeModule<SonovelTtsModule>('SonovelTts');
