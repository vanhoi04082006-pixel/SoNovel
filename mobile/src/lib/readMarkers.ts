import React from 'react';
import { useSyncExternalStore } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Đánh dấu chương đã nghe/đọc xong — lưu LOCAL per-series.
 * Key: `sonovel.read.<seriesId>` = JSON string[] các chapterId.
 *
 * Lưu ý trade-off: local-only (schema server chưa có bảng lịch sử per-chapter)
 * → chưa đồng bộ chéo thiết bị.
 */

const PREFIX = 'sonovel.read.';

const EMPTY: ReadonlySet<string> = new Set<string>();

// seriesId -> Set(chapterId) — thay bằng instance MỚI khi đổi (immutable)
// để useSyncExternalStore nhận biết thay đổi qua so sánh tham chiếu.
const cache = new Map<string, ReadonlySet<string>>();
const loaded = new Set<string>();
const listeners = new Set<() => void>();

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function notify() {
  listeners.forEach((l) => l());
}

/** Tải danh sách đã đọc của 1 series từ AsyncStorage (idempotent). */
export async function loadReadMarkers(seriesId: string): Promise<void> {
  if (!seriesId || loaded.has(seriesId)) return;
  loaded.add(seriesId);
  let set: ReadonlySet<string> = EMPTY;
  try {
    const raw = await AsyncStorage.getItem(PREFIX + seriesId);
    if (raw) {
      const arr = JSON.parse(raw) as unknown;
      if (Array.isArray(arr)) {
        set = new Set(arr.filter((x): x is string => typeof x === 'string'));
      }
    }
  } catch (_e) {}
  cache.set(seriesId, set);
  notify();
}

/** Đọc snapshot sync cho hook. */
export function getReadSetSync(seriesId: string): ReadonlySet<string> {
  return cache.get(seriesId) ?? EMPTY;
}

/** Đánh dấu 1 chương là đã đọc (fire-and-forget friendly). */
export async function markChapterRead(seriesId: string, chapterId: string): Promise<void> {
  if (!seriesId || !chapterId) return;
  const prev = getReadSetSync(seriesId);
  if (prev.has(chapterId)) return;
  const next = new Set(prev);
  next.add(chapterId);
  cache.set(seriesId, next);
  notify();
  try {
    await AsyncStorage.setItem(PREFIX + seriesId, JSON.stringify(Array.from(next)));
  } catch (_e) {
    // ignore — local save không nghiêm trọng
  }
}

/**
 * Hook reactive: trả về Set(chapterId) đã đọc của series.
 * Tự load lazily khi được dùng lần đầu.
 */
export function useReadMarkers(seriesId: string | null | undefined): ReadonlySet<string> {
  const sid = seriesId ?? '';
  // Trigger lazy-load khi mount / đổi series
  if (sid && !loaded.has(sid)) {
    // gọi ngoài render an toàn vì idempotent + async; notify sẽ re-render
    void loadReadMarkers(sid);
  }
  return useSyncExternalStore(
    subscribe,
    () => (sid ? getReadSetSync(sid) : EMPTY),
    () => EMPTY
  );
}
