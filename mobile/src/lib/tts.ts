import AsyncStorage from '@react-native-async-storage/async-storage';
import { EventSubscription } from 'expo-modules-core';
import { supabase } from './supabase';
import { getUserId } from './session';
import { getChapterContent } from './chapters';
import { nativeTts, TtsState, TtsProgress } from './nativeTts';
import { workerJson } from './worker';
import { saveSession } from './progress';
import { invalidateCache } from './dataCache';
import { markChapterRead } from './readMarkers';

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
  content?: string;
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
  charLength: number;
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
let currentCharLength = 0;
let rate = 1.0;
let isPlaying = false;
// Mốc thời gian đếm giờ nghe thực tế (reset khi pause/stop, set khi phát).
let lastSessionMark = 0;
let busy = false;
let seriesEnded = false;
// True khi NGƯỜI DÙNG chủ động pause — phân biệt với "hết chương tự nhiên"
// trong poll-based chapter-end detection.
let userPaused = false;

// ---------- Cache nội dung chương (lazy load theo yêu cầu) ----------
const contentCache = new Map<string, string>();

/**
 * Đảm bảo nội dung của chương `idx` đã có (tải + cache nếu chưa).
 * Trả về nội dung (string) hoặc null nếu không tải được.
 */
export async function ensureChapterContent(idx: number): Promise<string | null> {
  const ch = chapters[idx];
  if (!ch) return null;
  if (ch.content) {
    currentCharLength = ch.content.length;
    return ch.content;
  }
  const cached = contentCache.get(ch.id);
  if (cached !== undefined) {
    ch.content = cached;
    currentCharLength = cached.length;
    emitLocal('nowPlaying');
    return cached;
  }
  try {
    const row = await getChapterContent(seriesId!, ch.id);
    const content = row?.content ?? '';
    ch.content = content;
    contentCache.set(ch.id, content);
    currentCharLength = content.length;
    emitLocal('nowPlaying');
    return content;
  } catch (_e) {
    return ch.content ?? null;
  }
}

// ---------- Persist now-playing (mini player sống sót qua restart app) ----------
const NP_KEY = 'sonovel.nowPlaying';

type NowPlayingSnapshot = {
  seriesId: string;
  seriesTitle: string;
  coverUrl: string;
  chapters: TtsChapter[];
  currentIndex: number;
  currentChar: number;
  rate: number;
};

/** Lưu snapshot đang phát (chỉ metadata chương, KHÔNG nội dung) vào AsyncStorage. */
export async function persistNowPlaying(): Promise<void> {
  if (!seriesId || chapters.length === 0) return;
  try {
    const snap: NowPlayingSnapshot = {
      seriesId,
      seriesTitle,
      coverUrl,
      chapters: chapters.map((c) => ({ id: c.id, title: c.title, order_no: c.order_no, word_count: c.word_count })),
      currentIndex,
      currentChar,
      rate,
    };
    await AsyncStorage.setItem(NP_KEY, JSON.stringify(snap));
  } catch (_e) {}
}

/**
 * Khôi phục snapshot sau khi mở lại app — mini player hiện ngay ở trạng thái dừng.
 * Bấm phát sẽ đi qua resumePlayback → service đã chết → startTts từ đúng vị trí.
 */
export async function restoreNowPlaying(): Promise<boolean> {
  try {
    const raw = await AsyncStorage.getItem(NP_KEY);
    if (!raw) return false;
    const snap = JSON.parse(raw) as NowPlayingSnapshot;
    if (!snap?.seriesId || !Array.isArray(snap.chapters) || snap.chapters.length === 0) return false;
    wireNative();
    seriesId = snap.seriesId;
    seriesTitle = snap.seriesTitle ?? '';
    coverUrl = snap.coverUrl ?? '';
    chapters = snap.chapters.map((c) => ({ ...c }));
    currentIndex = Math.min(Math.max(0, snap.currentIndex ?? 0), chapters.length - 1);
    currentChar = Math.max(0, snap.currentChar ?? 0);
    rate = snap.rate && snap.rate > 0 ? snap.rate : 1.0;
    isPlaying = false;
    console.log(`[SoNovel][tts] restoreNowPlaying: "${seriesTitle}" ch${currentIndex + 1}@${currentChar}`);
    emitLocal('nowPlaying');
    return true;
  } catch (_e) {
    return false;
  }
}

/** Xóa snapshot khi người dùng dừng hẳn. */
export async function clearNowPlayingPersist(): Promise<void> {
  try { await AsyncStorage.removeItem(NP_KEY); } catch (_e) {}
}

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

// Local progress — lưu AsyncStorage song song với server để khách vẫn resume được.
const LOCAL_PROGRESS_PREFIX = 'sonovel.localProgress.';

export function getLocalProgressKey(seriesId: string): string {
  return `${LOCAL_PROGRESS_PREFIX}${seriesId}`;
}

export type LocalProgress = {
  chapterId: string | null;
  charIndex: number;
  lastListenedAt: string;
};

export async function getLocalProgress(seriesId: string): Promise<LocalProgress | null> {
  try {
    const raw = await AsyncStorage.getItem(getLocalProgressKey(seriesId));
    return raw ? (JSON.parse(raw) as LocalProgress) : null;
  } catch (_e) {
    return null;
  }
}

export type LocalProgressEntry = LocalProgress & { seriesId: string };

/** Liệt kê toàn bộ progress local (theo prefix) — dùng cho "Tiếp tục nghe" khi chưa đăng nhập. */
export async function listLocalProgress(): Promise<LocalProgressEntry[]> {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const list: LocalProgressEntry[] = [];
    for (const key of keys) {
      if (!key.startsWith(LOCAL_PROGRESS_PREFIX)) continue;
      const seriesId = key.slice(LOCAL_PROGRESS_PREFIX.length);
      const raw = await AsyncStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw) as LocalProgress;
      if (!parsed || !parsed.chapterId) continue;
      list.push({ ...parsed, seriesId });
    }
    return list.sort((a, b) => (b.lastListenedAt > a.lastListenedAt ? 1 : -1));
  } catch (_e) {
    return [];
  }
}

async function saveLocalProgress(seriesId: string, chapterId: string | null, charIndex: number) {
  try {
    await AsyncStorage.setItem(
      getLocalProgressKey(seriesId),
      JSON.stringify({ chapterId, charIndex, lastListenedAt: new Date().toISOString() } satisfies LocalProgress)
    );
  } catch (_e) {
    // ignore — local save không nghiêm trọng
  }
}

function scheduleSave() {
  if (saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    flushTtsSave().catch(() => {});
    // Đếm giờ nghe thực tế (nuôi stats/streak/achievements) — chỉ khi đang phát.
    if (isPlaying && seriesId) {
      const now = Date.now();
      if (lastSessionMark > 0) {
        const sec = Math.round((now - lastSessionMark) / 1000);
        if (sec > 0) saveSession({ seriesId, chapterId: chapters[currentIndex]?.id ?? null, durationSec: sec }).catch(() => {});
      }
      lastSessionMark = now;
    }
  }, SAVE_THROTTLE_MS);
}

export async function flushTtsSave(): Promise<void> {
  if (!seriesId) return;
  const chapter = chapters[currentIndex];
  if (!chapter) return;
  await saveLocalProgress(seriesId, chapter.id, currentChar);
  void persistNowPlaying();
  invalidateCache('continue:'); // Home "Tiếp tục nghe" lấy % mới nhất lần tới
  invalidateCache('follow:');   // mục "Có chương mới" tính lại theo vị trí vừa lưu
  const userId = getUserId();
  if (!userId) return;
  try {
    await workerJson('/api/progress', {
      method: 'PUT',
      body: JSON.stringify({
        seriesId,
        listenChapterId: chapter.id,
        listenCharIndex: currentChar,
        playbackSpeed: rate,
      }),
    });
  } catch {}
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
  } catch {}
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

      // Chỉ sync charIndex (progress) — currentIndex do JS điều phối chương
      // (native không còn giữ list chương).
      if (state.charIndex !== currentChar) {
        currentChar = state.charIndex;
        if (state.charLength) currentCharLength = state.charLength;
        const charLength = state.charLength || currentCharLength || 0;
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
      // Native đang phát → advance (nếu có) đã hoàn tất
      if (state.playing) {
        endAdvance();
        markChapterLoadedOk();
      }

      // SAFETY NET auto-next: nhận diện hết chương qua cờ `finished` từ native
      // (bật trong finishChapter, tắt khi ACTION_START/PLAY_CHAPTER xử lý xong).
      // Đường này hoạt động kể cả khi event ON_CHAPTER_END bị drop.
      if ((state as any).finished && !userPaused && !advanceInFlight && seriesId && chapters.length > 0) {
        console.log('[SoNovel][tts] poll: finished=true → advance sang chương kế');
        scheduleSave();
        emitLocal('chapterEnd', { chapterIndex: currentIndex });
        advanceToNextChapter();
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

// ---------- Auto-next hardening ----------
// Guard chống advance kép: onChapterEnd đôi khi bị emit 2 lần liên tiếp
// (native retry/callback race) → nếu không chặn sẽ nhảy cóc 2 chương.
let advanceInFlight = false;
let advanceGuardTimer: ReturnType<typeof setTimeout> | null = null;
// Đếm số chương tải nội dung thất bại liên tiếp — tránh lặp vô hạn khi mất mạng.
let consecutiveLoadFailures = 0;

function beginAdvance() {
  advanceInFlight = true;
  if (advanceGuardTimer) clearTimeout(advanceGuardTimer);
  // Safety: tối đa 15s sau advance phải được giải phóng bởi tín hiệu phát/ lỗi.
  advanceGuardTimer = setTimeout(() => { advanceInFlight = false; }, 15000);
}

function endAdvance() {
  advanceInFlight = false;
  if (advanceGuardTimer) {
    clearTimeout(advanceGuardTimer);
    advanceGuardTimer = null;
  }
}

function markChapterLoadedOk() {
  consecutiveLoadFailures = 0;
}

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
  // KHÔNG stopPolling() ở đây — polling phải chạy liên tục khi đang phát
  // để UI đồng bộ chương + progress (tránh kẹt UI khi audio sang chương sau).
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
      if (event.state === 'playing') {
        endAdvance();
        markChapterLoadedOk();
      }
      clearBusy();
      emitLocal('stateChange', event);
      if (event.state !== 'playing') scheduleSave();
    })
  );

  subs.push(
    nativeTts.addListener('onProgress', (event: TtsProgress) => {
      // Chỉ sync charIndex (progress) — currentIndex do JS điều phối chương.
      currentChar = event.charIndex;
      currentCharLength = event.charLength;
      endAdvance();
      markChapterLoadedOk();
      clearBusy();
      emitLocal('progress', { ...event, chapterIndex: currentIndex });
      scheduleSave();
    })
  );

  subs.push(
    nativeTts.addListener('onChunkDone', (event: { chapterIndex: number; chunkIndex: number }) => {
      // Chunk done = native đang hoạt động → clear busy (tránh nút play xoay)
      endAdvance();
      markChapterLoadedOk();
      clearBusy();
      emitLocal('chunkDone', event);
    })
  );

  subs.push(
    nativeTts.addListener('onChapterEnd', (event: { chapterIndex: number }) => {
      console.log('[SoNovel][tts] event onChapterEnd nhận (chapterIndex=' + (event.chapterIndex + 1) + ')');
      scheduleSave();
      emitLocal('chapterEnd', event);
      advanceToNextChapter();
    })
  );

  subs.push(
    nativeTts.addListener('onChapterSeek', (event: { direction: number }) => {
      seekChapterBy(event.direction);
    })
  );

  subs.push(
    nativeTts.addListener('onSeriesEnd', () => {
      isPlaying = false;
      seriesEnded = true;
      endAdvance();
      clearBusy();
      stopPolling();
      flushTtsSave().catch(() => {});
      emitLocal('seriesEnd');
    })
  );

  subs.push(
    nativeTts.addListener('onError', (event: { code: number; message: string }) => {
      isPlaying = false;
      endAdvance();
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
    charLength: currentCharLength,
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
  // Single-flight: đang khởi động cùng bộ truyện thì bỏ qua lời gọi trùng
  // (người dùng bấm nút nhiều lần liên tiếp).
  if (busy && seriesId === opts.seriesId) return;
  wireNative();
  seriesId = opts.seriesId;
  seriesTitle = opts.seriesTitle;
  coverUrl = opts.coverUrl;
  chapters = opts.chapters;
  currentIndex = opts.startIndex ?? 0;
  currentChar = opts.startChar ?? 0;
  rate = opts.rate ?? rate;
  seriesEnded = false;
  userPaused = false;
  console.log(`[SoNovel][tts] startTts: "${opts.seriesTitle}", startIndex=${currentIndex + 1}/${opts.chapters.length}, startChar=${currentChar}`);

  setBusy(true);
  // Android 13+: yêu cầu quyền notification để hiện media notification của foreground service.
  try { nativeTts.requestNotificationPermission(); } catch (_e) {}
  // Start polling liên tục — sync UI với native state (chapter change, progress)
  startPolling();
  emitLocal('nowPlaying');

  try {
    const start = opts.chapters[currentIndex] ?? opts.chapters[0];
    if (!start) {
      setBusy(false);
      stopPolling();
      emitLocal('error', { code: 500, message: 'Không có chương để phát' });
      return;
    }
    // Lazy-load nội dung chương bắt đầu (metadata đã có, content tải theo yêu cầu).
    const content = await ensureChapterContent(currentIndex);
    if (content == null) {
      setBusy(false);
      stopPolling();
      emitLocal('error', { code: 500, message: 'Không tải được nội dung chương' });
      return;
    }
    // Native chỉ nhận NỘI DUNG 1 chương tại thời điểm phát (tránh Intent quá lớn
    // → TransactionTooLargeException). Việc chuyển chương do JS điều phối ở đây.
    await nativeTts.play(
      opts.seriesTitle,
      opts.coverUrl,
      currentIndex + 1,
      start.title,
      content,
      currentChar,
      rate
    );
    // Đánh dấu mốc đếm giờ nghe
    lastSessionMark = Date.now();
    // Prefetch chương kế tiếp vào cache để chuyển chương không bị lag
    if (currentIndex + 1 < chapters.length) {
      ensureChapterContent(currentIndex + 1).catch(() => {});
    }
    // busy + UI sẽ được sync bởi polling (getState mỗi 1s)
  } catch (e: any) {
    setBusy(false);
    stopPolling();
    const detail = (e as any)?.nativeStackAndroid || (e as any)?.cause?.message || '';
    console.warn('[SoNovel] startTts thất bại:', e?.message ?? e, detail ? ` | ${detail}` : '');
    emitLocal('error', { code: 500, message: `Không thể start TTS: ${e?.message ?? e}` });
  }
}

async function sendPlayChapter(idx: number, startChar: number) {
  const ch = chapters[idx];
  if (!ch) return;
  setBusy(true);
  startPolling(); // đảm bảo polling/watchdog chạy khi chuyển chương
  emitLocal('nowPlaying');

  let content: string | null = null;
  // Retry 2 lần nếu fetch content fail (500ms giữa các lần)
  for (let attempt = 0; attempt < 3; attempt++) {
    content = await ensureChapterContent(idx);
    if (content != null) break;
    if (attempt < 2) await new Promise((r) => setTimeout(r, 500));
  }

  if (content == null) {
    setBusy(false);
    consecutiveLoadFailures++;
    console.warn(`[SoNovel][tts] sendPlayChapter: KHÔNG tải được chương ${idx + 1} (fail liên tiếp=${consecutiveLoadFailures})`);
    emitLocal('error', { code: 500, message: `Không tải được nội dung chương ${idx + 1}` });
    // HARDENING auto-next: KHÔNG dừng im lặng —
    // - Nếu chưa vượt ngưỡng lỗi liên tiếp và còn chương kế → tự bỏ qua chương lỗi, phát tiếp.
    // - Ngược lại → kết thúc phiên một cách rõ ràng.
    const canSkip =
      consecutiveLoadFailures <= 3 &&
      !!seriesId &&
      idx + 1 < chapters.length &&
      advanceInFlight; // chỉ tự skip khi đang trong luồng auto-next, không áp dụng cho bấm tay
    if (canSkip) {
      setTimeout(() => {
        currentIndex = idx + 1;
        currentChar = 0;
        currentCharLength = 0;
        emitLocal('chapterChange', { chapterIndex: currentIndex });
        emitLocal('nowPlaying');
        sendPlayChapter(currentIndex, 0);
      }, 400);
    } else {
      endAdvance();
      stopPolling();
      flushTtsSave().catch(() => {});
    }
    return;
  }

  markChapterLoadedOk();

  try {
    await nativeTts.playChapter(idx + 1, ch.title, content, startChar);
    console.log(`[SoNovel][tts] playChapter(${idx + 1}) đã gửi native (${content.length} ký tự)`);
    // Watchdog chuyển chương: nếu sau 6s vẫn không phát được (im lặng giữa 2 chương
    // quá lâu) → gửi lại playChapter đúng 1 lần để tự phục hồi.
    setTimeout(async () => {
      try {
        const st = await nativeTts.getState();
        if (st?.playing || !busy || isPlaying) return; // đã phát hoặc đã dừng/hủy
        const st2 = await nativeTts.getState();
        if (!st2?.playing && busy && !isPlaying) {
          console.warn('[SoNovel][tts] watchdog 6s: chưa phát → gửi lại playChapter');
          try { await nativeTts.playChapter(idx + 1, ch.title, content!, startChar); } catch (_e2) {}
        }
      } catch (_e) {}
    }, 6000);
  } catch (e: any) {
    setBusy(false);
    endAdvance();
    emitLocal('error', { code: 500, message: `playChapter lỗi: ${e?.message ?? e}` });
  }
}

export async function playChapterTts(idx: number, startChar = 0): Promise<void> {
  if (!seriesId) return;
  if (idx < 0 || idx >= chapters.length) return;
  endAdvance(); // bấm tay chọn chương → hủy mọi guard auto-next đang treo
  userPaused = false;
  currentIndex = idx;
  currentChar = startChar;
  seriesEnded = false;
  console.log(`[SoNovel][tts] playChapterTts: idx=${idx + 1}, startChar=${startChar}`);
  await sendPlayChapter(idx, startChar);
}

export async function pauseTts(): Promise<void> {
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
  await flushTtsSave();
  userPaused = true;
  try { await nativeTts.pause(); } catch (_e) {}
  isPlaying = false;
  lastSessionMark = 0;
  emitLocal('stateChange', { state: 'paused' });
  emitLocal('nowPlaying');
}

/**
 * Resume bug fix §8.5.1 (cải tiến):
 * - Native đang THỰC SỰ playing → chỉ sync UI.
 * - Nếu service còn sống (paused) → dùng nativeTts.resume() để giữ đúng charIndex native.
 *   (Tránh race condition JS currentChar vs native charIndex khi full startTts()).
 * - Service chết / chưa load chương → full startTts() từ currentChar JS.
 */
export async function resumePlayback(): Promise<void> {
  if (isPlaying) {
    emitLocal('stateChange', { state: 'playing' });
    emitLocal('nowPlaying');
    return;
  }
  if (!seriesId || chapters.length === 0) return;
  userPaused = false;

  // Thử dùng native resume (giữ charIndex chính xác từ service)
  try {
    // Timeout 1s để không block nếu service dead
    const statePromise = nativeTts.getState();
    const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), 1000));
    const state = await Promise.race([statePromise, timeoutPromise]);
    if (state && (state as any).serviceRunning && !(state as any).playing) {
      // Service đang alive và paused → resume native trực tiếp
      setBusy(true);
      try {
        await nativeTts.resume();
        return;
      } catch (_e) {
        // Resume lỗi → fallback startTts bên dưới
      }
    }
  } catch (_e) {
    // getState() lỗi → fallback startTts
  }

  // Fallback: service dead / chưa load → full restart từ vị trí JS nhớ
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
  lastSessionMark = 0;
  endAdvance();
  consecutiveLoadFailures = 0;
  await clearNowPlayingPersist(); // dừng hẳn → mini player biến mất cả sau restart
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
  seekChapterBy(1);
}

export async function prevChapterTts(): Promise<void> {
  if (currentIndex <= 0) return;
  seekChapterBy(-1);
}

// ---------- Điều phối chương (JS là nguồn duy nhất của danh sách chương) ----------

/** Native báo hết 1 chương → tiến sang chương kế, hoặc kết thúc series nếu hết. */
function advanceToNextChapter() {
  // Guard: onChapterEnd có thể emit 2 lần liên tiếp — bỏ qua lần trùng.
  if (advanceInFlight) return;
  beginAdvance();
  console.log(`[SoNovel][tts] advanceToNextChapter: từ chương ${currentIndex + 1}`);

  if (currentIndex + 1 >= chapters.length) {
    // Chương cuối vừa phát xong → cũng ghi dấu đã đọc.
    const lastCh = chapters[currentIndex];
    if (lastCh && seriesId) markChapterRead(seriesId, lastCh.id).catch(() => {});
    seriesEnded = true;
    isPlaying = false;
    endAdvance();
    clearBusy();
    stopPolling();
    flushTtsSave().catch(() => {});
    emitLocal('seriesEnd');
    return;
  }
  seekChapterBy(1);
}

/** Đổi chương theo hướng (+1/-1) rồi gửi nội dung chương mới cho native. */
function seekChapterBy(direction: number) {
  const nextIdx = currentIndex + direction;
  if (nextIdx < 0 || nextIdx >= chapters.length) return;
  // Đi tới (+1) = chương hiện tại được coi là đã nghe xong → ghi dấu đã đọc.
  if (direction > 0 && seriesId) {
    const curCh = chapters[currentIndex];
    if (curCh) markChapterRead(seriesId, curCh.id).catch(() => {});
  }
  currentIndex = nextIdx;
  currentChar = 0;
  currentCharLength = 0;
  seriesEnded = false;
  emitLocal('chapterChange', { chapterIndex: nextIdx });
  emitLocal('nowPlaying');
  void persistNowPlaying(); // mini player nhớ đúng chương sau restart
  sendPlayChapter(nextIdx, 0);
}
