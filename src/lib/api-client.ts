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

async function json<T = any>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) },
    credentials: 'include',
  })
  let data: any = null
  try { data = await res.json() } catch {}
  if (!res.ok) {
    const msg = (data && data.error) || `Lỗi ${res.status}`
    const err = new Error(msg) as any
    err.status = res.status
    err.body = data
    throw err
  }
  return data as T
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
  createSeries: (data: any) => json('/api/series/create', { method: 'POST', body: JSON.stringify(data) }),
  updateSeries: (id: string, data: any) => json(`/api/series/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteSeries: (id: string) => json(`/api/series/${id}`, { method: 'DELETE' }),

  // ---- chapters ----
  listChapters: (seriesId: string, all = false, q = '') => json<{ items: ChapterItem[] }>(`/api/series/${seriesId}/chapters?${all ? 'all=1&' : ''}q=${encodeURIComponent(q)}`),
  getChapter: (id: string) => json<ChapterItem & { seriesId: string; series: any }>(`/api/chapters/${id}`),
  createChapter: (seriesId: string, data: any) => json(`/api/series/${seriesId}/chapters`, { method: 'POST', body: JSON.stringify(data) }),
  updateChapter: (id: string, data: any) => json(`/api/chapters/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteChapter: (id: string) => json(`/api/chapters/${id}`, { method: 'DELETE' }),

  // ---- tags ----
  listTags: () => json<{ items: { id: string; name: string }[] }>('/api/tags'),
  createTag: (name: string) => json('/api/tags', { method: 'POST', body: JSON.stringify({ name }) }),
  updateTag: (id: string, name: string) => json(`/api/tags/${id}`, { method: 'PATCH', body: JSON.stringify({ name }) }),
  deleteTag: (id: string) => json(`/api/tags/${id}`, { method: 'DELETE' }),

  // ---- progress ----
  getProgress: (seriesId: string) => json<{ progress: any }>(`/api/progress?series_id=${seriesId}`),
  saveProgress: (data: { seriesId: string; listenChapterId?: string; listenCharIndex?: number; playbackSpeed?: number }) =>
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

  // ---- admin ----
  stats: () => json('/api/stats'),
  upload: (file: File) => {
    const fd = new FormData()
    fd.append('file', file)
    return fetch('/api/upload', { method: 'POST', body: fd, credentials: 'include' }).then((r) => r.json())
  },
}
