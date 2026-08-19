import AsyncStorage from '@react-native-async-storage/async-storage';
import { EventSubscription } from 'expo-modules-core';
import { supabase } from './supabase';
import { getUserId } from './session';
import { nativeTts, TtsState, TtsProgress } from './nativeTts';

/**
 * JS state manager cho native TTS module (theo §8.5).
 *
 * Giữ global module state (chapters, currentIndex, currentChar, rate, isPlaying,
 * busy, seriesEnded), listen native events, emit local events cho UI, và save
 * listen progress throttled 4s.
 */

// ---------- Types ----------
export type TtsChapter = {
  id: string;
  title: string;
  content: string;
  order_no: number;
  word_count?: number;
};

export type NowPlaying = {
  seriesId: string | null;
  seriesTitle: string;
  coverUrl: string;
  chapters: TtsChapter[];
  currentIndex: number;
  currentChar: number;
  rate: number;
  isPlaying: boolean;
  busy: boolean;
  seriesEnded: boolean;
};

export type TtsLocalEvent =
  | { type: 'stateChange'; state: TtsState }
  | { type: 'progress'; payload: TtsProgress }
  | { type: 'chunkDone'; payload: { chapterIndex: number; chunkIndex: number } }
  | { type: 'chapterEnd'; payload: { chapterIndex: number } }
  | { type: 'chapterChange'; payload: { chapterIndex: number } }
  | { type: 'seriesEnd' }
  | { type: 'error'; payload: { code: number; message: string } }
  | { type: 'nowPlaying'; payload: NowPlaying };

// ---------- Global state ----------
const RATE_KEY = 'sonovel.playbackRate';

let seriesId: string | null = null;
let seriesTitle = '';
let coverUrl = '';
let chapters: TtsChapter[] = [];
let currentIndex = 0;
let currentChar = 0;
let rate = 1.0;
let isPlaying = false;
let busy = false;
let seriesEnded = false;

// ---------- Local event bus ----------
const listeners = new Map<string, Set<(payload?: any) => void>>();

function emitLocal(type: string, payload?: any) {
  const set = listeners.get(type);
  if (set) set.forEach((cb) => cb(payload));
  // Always emit `nowPlaying` after any state change
  if (type !== 'nowPlaying') {
    const np = listeners.get('nowPlaying');
    if (np) np.forEach((cb) => cb(getNowPlaying()));
  }
}

export function onTtsEvent(type: string, cb: (payload?: any) => void): () => void {
  let set = listeners.get(type);
  if (!set) {
    set = new Set();
    listeners.set(type, set);
  }
  set.add(cb);
  return () => set!.delete(cb);
}

// ---------- Save progress (throttle 4s) ----------
let saveTimer: ReturnType<typeof setTimeout> | null = null;
const SAVE_THROTTLE_MS = 4000;

function scheduleSave() {
  if (saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    flushTtsSave().catch(() => {});
  }, SAVE_THROTTLE_MS);
}

export async function flushTtsSave(): Promise<void> {
  if (!seriesId) return;
  const userId = getUserId();
  if (!userId) return;
  const chapter = chapters[currentIndex];
  if (!chapter) return;
  try {
    await supabase.from('progress').upsert({
      user_id: userId,
      series_id: seriesId,
      listen_chapter_id: chapter.id,
      listen_char_index: currentChar,
      audio_sec: 0,
      playback_speed: rate,
      last_listened_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,series_id' });
  } catch (_e) {
    // Bỏ qua lỗi mạng — chạy cả khi app ở nền
  }
}

// ---------- State polling (sync UI với native) ----------
// Poll native state mỗi 1s KHI đang playing — sync chapterIndex/charIndex/isPlaying.
// Safety net cho sendEvent bị drop (expo-modules-core yêu cầu listener active trước).
let pollTimer: ReturnType<typeof setInterval> | null = null;
const POLL_INTERVAL_MS = 1000;

function startPolling() {
  stopPolling();
  pollTimer = setInterval(async () => {
    try {
      const state = await nativeTts.getState();
      if (!state) return;

      // Sync playing state
      const wasPlaying = isPlaying;
      isPlaying = state.playing;

      // Detect chapter change
      if (state.chapterIndex !== currentIndex) {
        currentIndex = state.chapterIndex;
        currentChar = state.charIndex;
        emitLocal('chapterChange', { chapterIndex: currentIndex });
        emitLocal('nowPlaying');
        scheduleSave();
      } else if (state.charIndex !== currentChar) {
        // Update charIndex (progress)
        currentChar = state.charIndex;
        const charLength = state.charLength || 0;
        const fraction = charLength > 0 ? currentChar / charLength : 0;
        emitLocal('progress', {
          chapterIndex: currentIndex,
          charIndex: currentChar,
          charLength,
          fraction,
        });
        emitLocal('nowPlaying');
      }

      // Clear busy nếu native đã playing
      if (state.playing && busy) {
        clearBusy();
      }

      // Emit stateChange nếu trạng thái playing thay đổi
      if (isPlaying !== wasPlaying) {
        emitLocal('stateChange', { state: isPlaying ? 'playing' as TtsState : 'paused' as TtsState });
        emitLocal('nowPlaying');
      }
    } catch (_e) {
      // ignore poll error
    }
  }, POLL_INTERVAL_MS);
}

function stopPolling() {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}

// ---------- Busy safety net (20s timeout) ----------
const BUSY_TIMEOUT_MS = 20000;
let busyTimer: ReturnType<typeof setTimeout> | null = null;

function setBusy(value: boolean) {
  if (busy === value) return;
  busy = value;
  emitLocal('nowPlaying');
  if (busyTimer) {
    clearTimeout(busyTimer);
    busyTimer = null;
  }
  if (value) {
    // Polling sẽ clear busy khi native báo playing
    startPolling();
    busyTimer = setTimeout(() => {
      if (busy) {
        setBusy(false);
        try { nativeTts.stop(); } catch (_e) {}
        emitLocal('error', {
          code: 504,
          message: 'TTS không phản hồi sau 20 giây — đã dừng.',
        });
      }
    }, BUSY_TIMEOUT_MS);
  }
}

function clearBusy() {
  if (busyTimer) {
    clearTimeout(busyTimer);
    busyTimer = null;
  }
  stopPolling();
  if (busy) {
    busy = false;
    emitLocal('nowPlaying');
  }
}

// ---------- Native event subscriptions ----------
let wired = false;
const subs: EventSubscription[] = [];

function wireNative() {
  if (wired) return;
  wired = true;

  subs.push(
    nativeTts.addListener('onStateChange', (event: { state: TtsState }) => {
      isPlaying = event.state === 'playing';
      if (event.state === 'stopped') {
        seriesEnded = false;
      }
      clearBusy();
      emitLocal('stateChange', event);
      if (event.state !== 'playing') scheduleSave();
    })
  );

  subs.push(
    nativeTts.addListener('onProgress', (event: TtsProgress) => {
      currentIndex = event.chapterIndex;
      currentChar = event.charIndex;
      clearBusy();
      emitLocal('progress', event);
      scheduleSave();
    })
  );

  subs.push(
    nativeTts.addListener('onChunkDone', (event: { chapterIndex: number; chunkIndex: number }) => {
      // Chunk done = native đang hoạt động → clear busy (tránh nút play xoay)
      clearBusy();
      emitLocal('chunkDone', event);
    })
  );

  subs.push(
    nativeTts.addListener('onChapterEnd', (event: { chapterIndex: number }) => {
      scheduleSave();
      emitLocal('chapterEnd', event);
    })
  );

  subs.push(
    nativeTts.addListener('onChapterChange', (event: { chapterIndex: number }) => {
      currentIndex = event.chapterIndex;
      currentChar = 0;
      emitLocal('chapterChange', event);
      emitLocal('nowPlaying');
      scheduleSave();
    })
  );

  subs.push(
    nativeTts.addListener('onSeriesEnd', () => {
      isPlaying = false;
      seriesEnded = true;
      clearBusy();
      flushTtsSave().catch(() => {});
      emitLocal('seriesEnd');
    })
  );

  subs.push(
    nativeTts.addListener('onError', (event: { code: number; message: string }) => {
      isPlaying = false;
      clearBusy();
      emitLocal('error', event);
    })
  );
}

// ---------- Public API ----------
export function getNowPlaying(): NowPlaying {
  return {
    seriesId,
    seriesTitle,
    coverUrl,
    chapters,
    currentIndex,
    currentChar,
    rate,
    isPlaying,
    busy,
    seriesEnded,
  };
}

export function getTtsState() {
  return { isPlaying, busy, seriesEnded, currentIndex, currentChar, rate };
}

export async function loadSavedRate(): Promise<number> {
  try {
    const r = await AsyncStorage.getItem(RATE_KEY);
    if (r) {
      rate = Number(r) || 1.0;
    }
  } catch (_e) {}
  return rate;
}

async function persistRate(v: number) {
  try { await AsyncStorage.setItem(RATE_KEY, String(v)); } catch (_e) {}
}

export async function startTts(opts: {
  seriesId: string;
  seriesTitle: string;
  coverUrl: string;
  chapters: TtsChapter[];
  startIndex?: number;
  startChar?: number;
  rate?: number;
}): Promise<void> {
  wireNative();
  seriesId = opts.seriesId;
  seriesTitle = opts.seriesTitle;
  coverUrl = opts.coverUrl;
  chapters = opts.chapters;
  currentIndex = opts.startIndex ?? 0;
  currentChar = opts.startChar ?? 0;
  rate = opts.rate ?? rate;
  seriesEnded = false;

  setBusy(true);
  // Start polling liên tục — sync UI với native state (chapter change, progress)
  startPolling();
  emitLocal('nowPlaying');

  try {
    const chaptersJson = JSON.stringify(
      opts.chapters.map((c) => ({ title: c.title, content: c.content }))
    );
    await nativeTts.play(
      opts.seriesTitle,
      opts.coverUrl,
      chaptersJson,
      currentIndex,
      currentChar,
      rate
    );
    // busy + UI sẽ được sync bởi polling (getState mỗi 1s)
  } catch (e: any) {
    setBusy(false);
    stopPolling();
    emitLocal('error', { code: 500, message: `Không thể start TTS: ${e?.message ?? e}` });
  }
}

export async function playChapterTts(idx: number, startChar = 0): Promise<void> {
  if (!seriesId) return;
  currentIndex = idx;
  currentChar = startChar;
  seriesEnded = false;
  setBusy(true);
  emitLocal('nowPlaying');
  try {
    await nativeTts.playChapter(idx, startChar);
  } catch (e: any) {
    setBusy(false);
    emitLocal('error', { code: 500, message: `playChapter lỗi: ${e?.message ?? e}` });
  }
}

export async function pauseTts(): Promise<void> {
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
  await flushTtsSave();
  try { await nativeTts.pause(); } catch (_e) {}
  isPlaying = false;
  emitLocal('stateChange', { state: 'paused' });
  emitLocal('nowPlaying');
}

/**
 * Resume bug fix §8.5.1:
 * - Native đang THỰC SỰ playing → chỉ sync UI.
 * - Mọi trường hợp khác (paused/stopped/service chết/series khác) →
 *   luôn `startTts()` khởi động lại hoàn toàn từ vị trí đang nhớ.
 */
export async function resumePlayback(): Promise<void> {
  if (isPlaying) {
    // Đang phát thật — chỉ sync UI
    emitLocal('stateChange', { state: 'playing' });
    emitLocal('nowPlaying');
    return;
  }
  if (!seriesId || chapters.length === 0) return;
  // Luôn khởi động lại hoàn toàn qua ACTION_START (path tin cậy nhất)
  await startTts({
    seriesId: seriesId!,
    seriesTitle,
    coverUrl,
    chapters,
    startIndex: currentIndex,
    startChar: currentChar,
    rate,
  });
}

export async function togglePlayPause(): Promise<void> {
  if (isPlaying) {
    await pauseTts();
  } else if (busy) {
    await stopTts();
  } else {
    await resumePlayback();
  }
}

export async function stopTts(): Promise<void> {
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
  await flushTtsSave();
  try { await nativeTts.stop(); } catch (_e) {}
  isPlaying = false;
  busy = false;
  seriesEnded = false;
  if (busyTimer) {
    clearTimeout(busyTimer);
    busyTimer = null;
  }
  stopPolling();
  emitLocal('stateChange', { state: 'stopped' });
  emitLocal('nowPlaying');
}

export async function seekToTts(char: number): Promise<void> {
  currentChar = char;
  setBusy(true);
  emitLocal('nowPlaying');
  try { await nativeTts.seekTo(char); } catch (_e) {}
}

export async function setRateTts(r: number): Promise<void> {
  rate = r;
  await persistRate(r);
  emitLocal('nowPlaying');
  try { await nativeTts.setRate(r); } catch (_e) {}
  // Đổi rate cần restart phát để áp dụng
  if (isPlaying || busy) {
    await startTts({
      seriesId: seriesId!,
      seriesTitle,
      coverUrl,
      chapters,
      startIndex: currentIndex,
      startChar: currentChar,
      rate,
    });
  }
}

export async function nextChapterTts(): Promise<void> {
  if (currentIndex + 1 >= chapters.length) {
    seriesEnded = true;
    isPlaying = false;
    emitLocal('seriesEnd');
    emitLocal('nowPlaying');
    return;
  }
  setBusy(true);
  try { await nativeTts.nextChapter(); } catch (_e) {}
}

export async function prevChapterTts(): Promise<void> {
  if (currentIndex <= 0) return;
  setBusy(true);
  try { await nativeTts.prevChapter(); } catch (_e) {}
}
