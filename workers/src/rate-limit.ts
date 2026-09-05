type Entry = { count: number; resetAt: number }
const map = new Map<string, Entry>()
// Workers cấm setInterval ở global scope → cleanup lười ngay trong hàm gọi.
let lastCleanup = 0
const CLEANUP_MS = 5 * 60 * 1000
const MAX_ENTRIES = 5000

export function checkRateLimit(key: string, limit: number, windowMs: number): { ok: boolean; remaining: number; resetAt: number } {
  const now = Date.now()
  if (now - lastCleanup > CLEANUP_MS) {
    lastCleanup = now
    for (const [k, v] of map) if (v.resetAt <= now) map.delete(k)
    if (map.size > MAX_ENTRIES) {
      const keys = Array.from(map.keys()).slice(0, map.size - MAX_ENTRIES)
      for (const k of keys) map.delete(k)
    }
  }
  let e = map.get(key)
  if (!e || e.resetAt <= now) {
    e = { count: 1, resetAt: now + windowMs }
    map.set(key, e)
    return { ok: true, remaining: limit - 1, resetAt: e.resetAt }
  }
  if (e.count >= limit) return { ok: false, remaining: 0, resetAt: e.resetAt }
  e.count++
  return { ok: true, remaining: limit - e.count, resetAt: e.resetAt }
}
