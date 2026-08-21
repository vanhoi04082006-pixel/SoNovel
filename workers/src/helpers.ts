import { Context } from 'hono'

export type Env = {
  DB: D1Database
  SUPABASE_URL: string
  SUPABASE_ANON_KEY: string
  SERVICE_TOKEN: string
}

export type AuthUser = {
  id: string
  email: string
  role: 'user' | 'admin'
  service: boolean
}

export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

type CachedUser = { exp: number; user: { id: string; email: string } | null }
const userCache = new Map<string, CachedUser>()
const USER_CACHE_TTL_MS = 5 * 60 * 1000

async function hashToken(token: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token))
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('')
}

async function fetchSupabaseUser(env: Env, token: string): Promise<{ id: string; email: string } | null> {
  try {
    const res = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
      headers: { Authorization: `Bearer ${token}`, apikey: env.SUPABASE_ANON_KEY },
    })
    if (!res.ok) return null
    const u: any = await res.json()
    if (!u?.id) return null
    return { id: u.id, email: u.email ?? '' }
  } catch {
    return null
  }
}

export async function getAuth(c: Context<{ Bindings: Env }>): Promise<AuthUser | null> {
  const svc = c.req.header('x-service-token')
  if (svc && c.env.SERVICE_TOKEN && svc === c.env.SERVICE_TOKEN) {
    return { id: '', email: '', role: 'admin', service: true }
  }

  const authz = c.req.header('Authorization') || ''
  const token = authz.startsWith('Bearer ') ? authz.slice(7).trim() : ''
  if (!token) return null

  const key = await hashToken(token)
  const hit = userCache.get(key)
  let su: { id: string; email: string } | null
  if (hit && hit.exp > Date.now()) {
    su = hit.user
  } else {
    su = await fetchSupabaseUser(c.env, token)
    userCache.set(key, { exp: Date.now() + USER_CACHE_TTL_MS, user: su })
    if (userCache.size > 5000) {
      for (const [k, v] of userCache) if (v.exp < Date.now()) userCache.delete(k)
    }
  }
  if (!su) return null

  let role: string = 'user'
  try {
    const row = await c.env.DB.prepare('SELECT role FROM profiles WHERE id = ?').bind(su.id).first<any>()
    if (row?.role) role = row.role
  } catch {}
  return { id: su.id, email: su.email, role: role === 'admin' ? 'admin' : 'user', service: false }
}

export async function requireUser(c: Context<{ Bindings: Env }>): Promise<AuthUser> {
  const u = await getAuth(c)
  if (!u) throw new ApiError(401, 'Vui lòng đăng nhập.')
  return u
}

export async function requireAdmin(c: Context<{ Bindings: Env }>): Promise<AuthUser> {
  const u = await getAuth(c)
  if (!u || (!u.service && u.role !== 'admin')) throw new ApiError(403, 'Bạn không có quyền quản trị.')
  return u
}

// ---- mappers (camelCase contract khớp web) ----

function parseJsonArray(text: unknown): string[] {
  if (Array.isArray(text)) return text as string[]
  if (typeof text !== 'string' || !text) return []
  try {
    const v = JSON.parse(text)
    return Array.isArray(v) ? v : []
  } catch {
    return []
  }
}

export type SeriesRow = {
  id: string
  title: string
  author: string
  description: string
  cover_url: string
  status: string
  genres: unknown
  tags: unknown
  word_count: number
  created_at: string
  updated_at: string
}

export function mapSeries(s: SeriesRow, chapterCount?: number) {
  return {
    id: s.id,
    title: s.title,
    author: s.author,
    description: s.description,
    coverUrl: s.cover_url,
    status: s.status,
    genres: parseJsonArray(s.genres),
    tags: parseJsonArray(s.tags),
    wordCount: s.word_count,
    chapterCount,
    createdAt: s.created_at,
    updatedAt: s.updated_at,
  }
}

export type ChapterRow = {
  id: string
  series_id: string
  order_no: number
  title: string
  content?: string
  status: string
  word_count: number
  published_at: string | null
  created_at: string
}

export function mapChapter(ch: ChapterRow) {
  return {
    id: ch.id,
    seriesId: ch.series_id,
    orderNo: ch.order_no,
    title: ch.title,
    ...(ch.content !== undefined ? { content: ch.content } : {}),
    status: ch.status,
    wordCount: ch.word_count,
    publishedAt: ch.published_at,
    createdAt: ch.created_at,
  }
}

export type ProgressRow = {
  id?: string
  user_id: string
  series_id: string
  read_chapter_id: string | null
  read_char_index: number
  read_percent: number
  last_read_at: string | null
  listen_chapter_id: string | null
  listen_char_index: number
  audio_sec: number
  playback_speed: number
  last_listened_at: string | null
  updated_at: string
}

export function mapProgress(p: ProgressRow | null) {
  if (!p) return null
  return {
    id: p.id,
    userId: p.user_id,
    seriesId: p.series_id,
    readChapterId: p.read_chapter_id,
    readCharIndex: p.read_char_index,
    readPercent: p.read_percent,
    lastReadAt: p.last_read_at,
    listenChapterId: p.listen_chapter_id,
    listenCharIndex: p.listen_char_index,
    audioSec: p.audio_sec,
    playbackSpeed: p.playback_speed,
    lastListenedAt: p.last_listened_at,
    updatedAt: p.updated_at,
  }
}

// ---- utils ----

export function chapterWordCount(content: string): number {
  return Math.floor((content?.length ?? 0) / 5)
}

export function uuid(): string {
  return crypto.randomUUID()
}

export function nowIso(): string {
  return new Date().toISOString()
}

export function estListenSec(listenCharIndex: number | null | undefined, audioSec: number | null | undefined): number {
  return audioSec && audioSec > 0 ? audioSec : Math.round(((listenCharIndex as number) || 0) / 270 * 60)
}

export function dayKey(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`
}

export function dayKeyShort(d: Date): string {
  return `${d.getUTCFullYear()}-${d.getUTCMonth() + 1}-${d.getUTCDate()}`
}

// ---- TTL cache cho catalogue public ----

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
