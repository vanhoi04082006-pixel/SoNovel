// SoNovel — client-side API helpers

export type SeriesItem = {
  id: string
  title: string
  author: string
  description: string
  coverUrl: string
  status: string
  genres: string[]
  tags: string[]
  wordCount: number
  chapterCount?: number
  createdAt?: string
  updatedAt?: string
  favoritedAt?: string
  openedCount?: number
  lastOpenedAt?: string
}

export type ChapterItem = {
  id: string
  orderNo: number
  title: string
  content?: string
  status: string
  wordCount: number
  publishedAt?: string | null
  createdAt?: string
}

export type SeriesDetail = SeriesItem & {
  chapters: ChapterItem[]
}

export type SessionUser = { id: string; email: string; role: 'user' | 'admin' }

// ---- client cache cho dữ liệu public catalogue ----
// Giảm round-trip khi chuyển tab back/forth. Chỉ cache GET của series/chapters/tags.
type CacheEntry = { exp: number; value: unknown }
const clientCache = new Map<string, CacheEntry>()

// ---- typed error + timeout + retry ----
export class ApiError extends Error {
  status: number
  body: any
  constructor(message: string, status: number, body?: any) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.body = body
  }
}

const TIMEOUT_MS = 20_000

function fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  return fetch(url, { ...init, signal: controller.signal }).finally(() => clearTimeout(timer))
}

function isNetworkError(e: any): boolean {
  return e instanceof TypeError || e?.name === 'AbortError' || (e as any)?.cause instanceof TypeError
}

function isCatalogUrl(url: string): boolean {
  return url.startsWith('/api/series') || url.startsWith('/api/chapters') || url.startsWith('/api/tags')
}

function catalogTtlMs(url: string): number {
  if (url.includes('/chapters')) return 15_000
  if (url.includes('/chapters/')) return 30_000
  if (url.startsWith('/api/tags')) return 30_000
  return 15_000
}

export function clearCatalogCache() {
  clientCache.clear()
}

async function json<T = any>(url: string, init?: RequestInit): Promise<T> {
  const method = (init?.method || 'GET').toUpperCase()

  // Write → xóa cache catalog để lần đọc sau lấy dữ liệu mới
  if (method !== 'GET' && isCatalogUrl(url)) {
    clearCatalogCache()
  }

  // GET catalog → đọc cache nếu còn TTL
  if (method === 'GET' && isCatalogUrl(url)) {
    const hit = clientCache.get(url)
    if (hit && hit.exp > Date.now()) {
      return hit.value as T
    }
  }

  // Retry 1 lần cho GET khi lỗi mạng/timeout (các mutation không retry — tránh trùng lặp)
  const attempts = method === 'GET' ? 2 : 1
  let lastErr: any
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      const res = await fetchWithTimeout(url, {
        ...init,
        headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) },
        credentials: 'include',
      })
      let data: any = null
      try { data = await res.json() } catch {}
      if (!res.ok) {
        const msg = (data && data.error) || `Lỗi ${res.status}`
        throw new ApiError(msg, res.status, data)
      }

      // GET catalog thành công → lưu cache
      if (method === 'GET' && isCatalogUrl(url)) {
        clientCache.set(url, { exp: Date.now() + catalogTtlMs(url), value: data })
      }
      return data as T
    } catch (e) {
      lastErr = e
      if (!(attempt === attempts - 1) && isNetworkError(e)) continue
      throw lastErr
    }
  }
  throw lastErr
}

export const api = {
  // ---- auth ----
  signup: (email: string, password: string) => json<{ ok: boolean; user: SessionUser }>('/api/auth/signup', { method: 'POST', body: JSON.stringify({ email, password }) }),
  login: (email: string, password: string) => json<{ ok: boolean; user: SessionUser }>('/api/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  logout: () => json('/api/auth/logout', { method: 'POST' }),
  me: () => json<{ user: SessionUser | null }>('/api/auth/me'),

  // ---- series ----
  listSeries: (params: Record<string, string | number> = {}) => {
    const q = new URLSearchParams(params as any).toString()
    return json<{ items: SeriesItem[]; total: number; offset: number; limit: number }>(`/api/series?${q}`)
  },
  getSeries: (id: string) => json<SeriesDetail>(`/api/series/${id}`),
  getRelated: (id: string, limit = 6) => json<{ items: SeriesItem[] }>(`/api/series/${id}/related?limit=${limit}`),
  getIllustrations: (seriesId: string) => json<{ items: Array<{ id: string; imageUrl: string; caption: string; orderNo: number }> }>(`/api/series/${seriesId}/illustrations`),
  saveIllustrations: (seriesId: string, items: Array<{ imageUrl: string; caption: string }>) =>
    json<{ ok: boolean; count: number }>(`/api/series/${seriesId}/illustrations`, { method: 'PUT', body: JSON.stringify({ items }) }),
  createSeries: (data: any) => json('/api/series/create', { method: 'POST', body: JSON.stringify(data) }),
  updateSeries: (id: string, data: any) => json(`/api/series/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteSeries: (id: string) => json(`/api/series/${id}`, { method: 'DELETE' }),

  // ---- chapters ----
  listChapters: (seriesId: string, all = false, q = '') => json<{ items: ChapterItem[] }>(`/api/series/${seriesId}/chapters?${all ? 'all=1&' : ''}q=${encodeURIComponent(q)}`),
  getChapter: (id: string) => json<ChapterItem & { seriesId: string; series: any }>(`/api/chapters/${id}`),
  createChapter: (seriesId: string, data: any) => json(`/api/series/${seriesId}/chapters`, { method: 'POST', body: JSON.stringify(data) }),
  bulkCreateChapters: (seriesId: string, chapters: { orderNo: number; title: string; content: string; status: string }[]) =>
    json<{ ok: boolean; count: number; skipped: number }>(`/api/series/${seriesId}/chapters/bulk`, { method: 'POST', body: JSON.stringify({ chapters }) }),
  importChaptersFromFolder: (seriesId: string, folderPath: string) =>
    json<{ ok: boolean; count: number; skipped: number }>(`/api/series/${seriesId}/chapters/import-folder`, { method: 'POST', body: JSON.stringify({ folderPath }) }),
  previewImportFromFolder: (seriesId: string, folderPath: string) =>
    json<{ ok: boolean; total: number; preview: Array<{ fileName: string; orderNo: number; title: string; exists: boolean }> }>(`/api/series/${seriesId}/chapters/import-folder`, { method: 'POST', body: JSON.stringify({ folderPath, preview: true }) }),
  updateChapter: (id: string, data: any) => json(`/api/chapters/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteChapter: (id: string) => json(`/api/chapters/${id}`, { method: 'DELETE' }),

  // ---- tags ----
  listTags: () => json<{ items: { id: string; name: string }[] }>('/api/tags'),
  createTag: (name: string) => json('/api/tags', { method: 'POST', body: JSON.stringify({ name }) }),
  updateTag: (id: string, name: string) => json(`/api/tags/${id}`, { method: 'PATCH', body: JSON.stringify({ name }) }),
  deleteTag: (id: string) => json(`/api/tags/${id}`, { method: 'DELETE' }),

  // ---- progress ----
  getProgress: (seriesId: string) => json<{ progress: any }>(`/api/progress?series_id=${seriesId}`),
  getAllProgress: () => json<{ items: Array<{ seriesId: string; percent: number; listenCharIndex: number; listenChapterId: string | null; lastListenedAt: string | null }> }>('/api/progress/all'),
  saveProgress: (data: { seriesId: string; listenChapterId?: string; listenCharIndex?: number; playbackSpeed?: number }) =>
    json('/api/progress', { method: 'PUT', body: JSON.stringify(data) }),
  saveReadProgress: (data: { seriesId: string; readChapterId?: string; readCharIndex?: number; readPercent?: number }) =>
    json('/api/progress', { method: 'PUT', body: JSON.stringify(data) }),

  // ---- favorites ----
  listFavorites: () => json<{ items: SeriesItem[] }>('/api/favorites'),
  toggleFavorite: (seriesId: string) => json<{ ok: boolean; favorited: boolean }>('/api/favorites', { method: 'POST', body: JSON.stringify({ seriesId }) }),

  // ---- history ----
  listHistory: () => json<{ items: SeriesItem[] }>('/api/history'),
  recordHistory: (seriesId: string) => json('/api/history', { method: 'POST', body: JSON.stringify({ seriesId }) }),

  // ---- settings ----
  getSettings: () => json<{ settings: any }>('/api/settings'),
  saveSettings: (data: any) => json('/api/settings', { method: 'PUT', body: JSON.stringify(data) }),

  // ---- continue listening ----
  continueListening: () => json<{ items: any[] }>('/api/continue-listening'),

  // ---- bookmarks ----
  listBookmarks: () => json<{ items: any[] }>('/api/bookmarks'),
  createBookmark: (data: { seriesId: string; chapterId: string; charIndex: number; note?: string }) =>
    json('/api/bookmarks', { method: 'POST', body: JSON.stringify(data) }),
  deleteBookmark: (id: string) => json(`/api/bookmarks/${id}`, { method: 'DELETE' }),

  // ---- admin ----
  stats: () => json('/api/stats'),
  listUsers: (q = '') => json<{ items: Array<{ id: string; email: string; role: string; createdAt: string; lastSignInAt: string | null; banned: boolean; emailConfirmed: boolean }> }>(`/api/admin/users?q=${encodeURIComponent(q)}`),
  updateUser: (id: string, data: { role?: string; action?: 'ban' | 'unban' }) =>
    json(`/api/admin/users/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  readingStats: () => json<{ stats: any }>('/api/stats/reading'),
  streakStats: () => json<{ stats: any }>('/api/stats/streak'),
  achievementsStats: () => json<{ achievements: any[]; summary: any }>('/api/stats/achievements'),
  challengeStats: () => json<{ challenges: any[]; summary: any }>('/api/stats/challenge'),
  historyStats: () => json<{ items: Array<{ date: string; seconds: number; label: string }> }>('/api/stats/history'),
  saveSession: (data: { seriesId: string; chapterId?: string; durationSec: number }) =>
    json('/api/stats/session', { method: 'POST', body: JSON.stringify(data) }),
  upload: (file: File) => {
    const fd = new FormData()
    fd.append('file', file)
    return fetchWithTimeout('/api/upload', { method: 'POST', body: fd, credentials: 'include' }).then(async (r) => {
      const j = await r.json().catch(() => null)
      if (!r.ok) throw new ApiError((j && j.error) || `Lỗi ${r.status}`, r.status, j)
      return j
    })
  },
  uploadIllustration: (file: File) => {
    const fd = new FormData()
    fd.append('file', file)
    return fetchWithTimeout('/api/illustrations/upload', { method: 'POST', body: fd, credentials: 'include' }).then(async (r) => {
      const j = await r.json().catch(() => null)
      if (!r.ok) throw new ApiError((j && j.error) || `Lỗi ${r.status}`, r.status, j)
      return j
    })
  },
}
