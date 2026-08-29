type CacheEntry = { exp: number; value: unknown }
const store = new Map<string, CacheEntry>()

export async function cachedFetch<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T> {
  const hit = store.get(key)
  if (hit && hit.exp > Date.now()) return hit.value as T
  const value = await fn()
  store.set(key, { exp: Date.now() + ttlMs, value })
  return value
}

export function invalidateAll() {
  store.clear()
}
