/**
 * Cache in-memory TTL ngắn cho dữ liệu catalogue (series/chapters/progress).
 * Mục đích: chuyển tab/quay lại màn không phải refetch từ đầu → app cảm giác nhanh.
 * - Pull-to-refresh hoặc sau khi ghi dữ liệu → gọi invalidateCache() để lấy mới.
 * - Chỉ giữ trong RAM (không AsyncStorage): chết app là hết, luôn an toàn.
 */

type Entry = { exp: number; value: unknown };

const store = new Map<string, Entry>();

export const DEFAULT_TTL_MS = 60_000;
export const SHORT_TTL_MS = 15_000;

export function cacheGet<T>(key: string): T | null {
  const hit = store.get(key);
  if (!hit) return null;
  if (hit.exp <= Date.now()) {
    store.delete(key);
    return null;
  }
  return hit.value as T;
}

export function cacheSet(key: string, value: unknown, ttlMs: number = DEFAULT_TTL_MS) {
  store.set(key, { exp: Date.now() + ttlMs, value });
}

/** Đọc cache nếu còn hạn, không thì chạy fn() rồi lưu kết quả. */
export async function withCache<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T> {
  const hit = cacheGet<T>(key);
  if (hit !== null) return hit;
  const value = await fn();
  try {
    cacheSet(key, value, ttlMs);
  } catch (_e) {}
  return value;
}

/** Xóa toàn bộ cache, hoặc chỉ các key có prefix (VD 'series:', 'continue:'). */
export function invalidateCache(prefix?: string) {
  if (!prefix) {
    store.clear();
    return;
  }
  for (const k of Array.from(store.keys())) {
    if (k.startsWith(prefix)) store.delete(k);
  }
}
