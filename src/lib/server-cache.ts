// SoNovel — server-side in-memory TTL cache.
// Dùng cho dữ liệu public catalogue (series/chapters/tags) để giảm round-trip tới Supabase.
// Cache per-process: hiệu quả nhất khi chạy local (1 process); trên Vercel vẫn giảm đáng kể.

type Entry = { exp: number; value: unknown }

const store = new Map<string, Entry>()
const DEFAULT_TTL_MS = 30_000

export function cachedFetch<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T> {
  const hit = store.get(key)
  if (hit && hit.exp > Date.now()) {
    return Promise.resolve(hit.value as T)
  }
  return fn().then((value) => {
    store.set(key, { exp: Date.now() + ttlMs, value })
    return value
  })
}

export function cachedFetchWithDefault<T>(key: string, fn: () => Promise<T>): Promise<T> {
  return cachedFetch(key, DEFAULT_TTL_MS, fn)
}

export function invalidateAll() {
  store.clear()
}