import { Hono } from 'hono'
import { cors } from 'hono/cors'
import {
  type Env,
  ApiError,
  getAuth,
  requireUser,
  requireAdmin,
  mapSeries,
  mapChapter,
  mapProgress,
  chapterWordCount,
  uuid,
  nowIso,
  estListenSec,
  dayKey,
  dayKeyShort,
  cachedFetch,
  invalidateAll,
  type SeriesRow,
  type ChapterRow,
} from './helpers'
import { checkRateLimit } from './rate-limit'

const ALLOWED_ORIGINS = [
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:8787',
  'http://127.0.0.1:8787',
]

function isAllowedOrigin(origin: string | undefined): boolean {
  if (!origin) return true
  if (ALLOWED_ORIGINS.includes(origin)) return true
  try {
    const u = new URL(origin)
    if (u.hostname === 'localhost' || u.hostname === '127.0.0.1') return true
    if (u.hostname.endsWith('.vercel.app')) return true
    if (u.hostname.endsWith('.workers.dev')) return true
    if (u.hostname === 'sonovel.app' || u.hostname.endsWith('.sonovel.app')) return true
  } catch {}
  return false
}

const app = new Hono<{ Bindings: Env }>()

app.use('*', cors({
  origin: (origin) => isAllowedOrigin(origin) ? origin : undefined,
  allowMethods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS'],
  allowHeaders: ['Content-Type','Authorization','x-service-token'],
  credentials: true,
}))

app.use('*', async (c, next) => {
  const rid = c.req.header('x-request-id') || crypto.randomUUID()
  c.set('requestId' as any, rid)
  c.header('x-request-id', rid)
  await next()
})

app.onError((err, c) => {
  const rid = (c as any).get?.('requestId') || '-'
  console.error(JSON.stringify({ rid, path: c.req.path, error: (err as Error).message, stack: (err as Error).stack?.slice(0, 500) }))
  if (err instanceof ApiError) return c.json({ error: err.message }, err.status as any)
  return c.json({ error: (err as Error).message || 'Lỗi server' }, 500)
})

app.get('/health', (c) => c.json({ ok: true, rid: (c as any).get?.('requestId') }))
app.get('/api/settings/goal', async (c) => {
  const u = await getAuth(c)
  if (!u) return c.json({ goal: null })
  return c.json({ goal: { weeklyChapters: 3, weeklyMinutes: 60, weeklyDays: 5 } })
})

// ---------- helpers for D1 ----------

function jsonArr(text: unknown): string[] {
  if (Array.isArray(text)) return text as string[]
  if (typeof text !== 'string' || !text) return []
  try {
    const v = JSON.parse(text)
    return Array.isArray(v) ? v : []
  } catch { return [] }
}

function pageParams(url: URL, defLimit = 100, max = 200): { limit: number; offset: number } {
  const l = Number(url.searchParams.get('limit') ?? defLimit)
  const o = Number(url.searchParams.get('offset') ?? 0)
  return {
    limit: Number.isFinite(l) ? Math.min(max, Math.max(1, Math.trunc(l))) : defLimit,
    offset: Number.isFinite(o) && o > 0 ? Math.trunc(o) : 0,
  }
}

async function recalcSeriesWordCount(db: D1Database, seriesId: string) {
  try {
    const r = await db.prepare("SELECT COALESCE(SUM(word_count),0) as s FROM chapters WHERE series_id=? AND status='published'").bind(seriesId).first<any>()
    await db.prepare('UPDATE series SET word_count=?, updated_at=? WHERE id=?').bind(r?.s ?? 0, nowIso(), seriesId).run()
  } catch {}
}

// ---------- PUBLIC CATALOG ----------

app.get('/api/series', async (c) => {
  const url = new URL(c.req.url)
  const q = (url.searchParams.get('q') || '').trim()
  const genre = url.searchParams.get('genre') || ''
  const tag = url.searchParams.get('tag') || ''
  const status = url.searchParams.get('status') || 'published,completed'
  const sort = url.searchParams.get('sort') || 'new'
  if (!['new','title','chapters','views'].includes(sort)) return c.json({ error: 'sort không hợp lệ (new|title|chapters|views).' }, 400)
  const rawLimit = Number(url.searchParams.get('limit') || 24)
  const rawOffset = Number(url.searchParams.get('offset') || 0)
  const limit = Number.isFinite(rawLimit) ? Math.min(48, Math.max(1, Math.trunc(rawLimit))) : 24
  const offset = Number.isFinite(rawOffset) && rawOffset > 0 ? Math.trunc(rawOffset) : 0
  const statuses = status.split(',').filter(Boolean)
  const cacheKey = `series:${q}:${genre}:${tag}:${status}:${sort}:${limit}:${offset}`
  const result = await cachedFetch(cacheKey, 30_000, async () => {
    const db = c.env.DB
    // sanitize FTS5 query — escape quotes, add prefix wildcard
    const ftsQuery = q ? q.replace(/"/g, '""').trim().split(/\s+/).map(t => `"${t}"*`).join(' ') : ''
    const useFts = !!ftsQuery
    const where: string[] = []
    const params: any[] = []
    if (statuses.length) { where.push(`status IN (${statuses.map(()=>'?').join(',')})`); params.push(...statuses) }
    if (q && !useFts) { where.push(`(LOWER(title) LIKE ? OR LOWER(author) LIKE ?)`); const pat=`%${q.toLowerCase()}%`; params.push(pat, pat) }
    if (q && useFts) { where.push(`rowid IN (SELECT rowid FROM series_fts WHERE series_fts MATCH ?)`); params.push(ftsQuery) }
    if (genre) { where.push(`genres LIKE ?`); params.push(`%"${genre}"%`) }
    if (tag) { where.push(`tags LIKE ?`); params.push(`%"${tag}"%`) }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : ''
    let order = 'updated_at DESC'
    if (sort === 'title') order = 'title ASC'
    else if (sort === 'chapters') order = 'chapter_count DESC'
    else if (sort === 'views') order = 'view_count DESC'
    let total = 0
    let rows: any
    try {
      const countRow = await db.prepare(`SELECT COUNT(*) as n FROM series ${whereSql}`).bind(...params).first<any>()
      total = countRow?.n ?? 0
      rows = await db.prepare(`SELECT *, (SELECT COUNT(*) FROM chapters WHERE chapters.series_id=series.id AND chapters.status='published') as chapter_count FROM series ${whereSql} ORDER BY ${order} LIMIT ? OFFSET ?`).bind(...params, limit, offset).all<SeriesRow & {chapter_count:number}>()
    } catch (e:any) {
      // FTS5 failed (e.g. syntax) → fallback LIKE
      if (useFts && String(e.message||'').includes('fts5')) {
        const fbWhere: string[] = []
        const fbParams: any[] = []
        if (statuses.length) { fbWhere.push(`status IN (${statuses.map(()=>'?').join(',')})`); fbParams.push(...statuses) }
        fbWhere.push(`(LOWER(title) LIKE ? OR LOWER(author) LIKE ?)`); const pat=`%${q.toLowerCase()}%`; fbParams.push(pat, pat)
        if (genre) { fbWhere.push(`genres LIKE ?`); fbParams.push(`%"${genre}"%`) }
        if (tag) { fbWhere.push(`tags LIKE ?`); fbParams.push(`%"${tag}"%`) }
        const fbSql = fbWhere.length ? `WHERE ${fbWhere.join(' AND ')}` : ''
        const cRow = await db.prepare(`SELECT COUNT(*) as n FROM series ${fbSql}`).bind(...fbParams).first<any>()
        total = cRow?.n ?? 0
        rows = await db.prepare(`SELECT *, (SELECT COUNT(*) FROM chapters WHERE chapters.series_id=series.id AND chapters.status='published') as chapter_count FROM series ${fbSql} ORDER BY ${order} LIMIT ? OFFSET ?`).bind(...fbParams, limit, offset).all<SeriesRow & {chapter_count:number}>()
      } else throw e
    }
    const items = (rows.results ?? []).map(s => mapSeries(s as SeriesRow, (s as any).chapter_count ?? 0))
    return { items, total, offset, limit }
  })
  return c.json(result)
})

app.get('/api/series/:id', async (c) => {
  const id = c.req.param('id')
  const result = await cachedFetch(`series-detail:${id}`, 30_000, async () => {
    const db = c.env.DB
    const s = await db.prepare('SELECT * FROM series WHERE id=?').bind(id).first<SeriesRow>()
    if (!s) return null
    const chs = await db.prepare("SELECT id, series_id, order_no, title, status, word_count, published_at, created_at FROM chapters WHERE series_id=? AND status='published' ORDER BY order_no ASC").bind(id).all<ChapterRow>()
    return { ...mapSeries(s, (chs.results ?? []).length), chapters: (chs.results ?? []).map(mapChapter) }
  })
  if (result === null) return c.json({ error: 'Không tìm thấy truyện.' }, 404)
  return c.json(result)
})

app.get('/api/series/:id/related', async (c) => {
  const id = c.req.param('id')
  const rawLimit = Number(new URL(c.req.url).searchParams.get('limit') || 6)
  const limit = Number.isFinite(rawLimit) ? Math.min(12, Math.max(1, Math.trunc(rawLimit))) : 6
  const s = await c.env.DB.prepare('SELECT genres, tags FROM series WHERE id=?').bind(id).first<any>()
  if (!s) return c.json({ items: [] })
  const genres: string[] = jsonArr(s.genres)
  const tags: string[] = jsonArr(s.tags)
  if (!genres.length && !tags.length) return c.json({ items: [] })
  const rows = await c.env.DB.prepare("SELECT id, title, author, description, cover_url, status, genres, tags, word_count, created_at, updated_at FROM series WHERE id != ? AND status IN ('published','completed')").bind(id).all<any>()
  const scored = (rows.results ?? []).map((r: any) => {
    const rg = jsonArr(r.genres)
    const rt = jsonArr(r.tags)
    let score = 0
    for (const g of genres) if (rg.includes(g)) score += 2
    for (const t of tags) if (rt.includes(t)) score += 1
    return { row: r, score }
  }).filter((x) => x.score > 0).sort((a, b) => b.score - a.score).slice(0, limit)
  const items = scored.map(({ row }) => mapSeries(row as SeriesRow))
  return c.json({ items })
})

// ---------- ILLUSTRATIONS (ảnh minh họa theo bộ truyện) ----------

// Public — danh sách ảnh minh họa của 1 bộ truyện
app.get('/api/series/:id/illustrations', async (c) => {
  const id = c.req.param('id')
  const result = await cachedFetch(`illust:${id}`, 60_000, async () => {
    const rows = await c.env.DB.prepare('SELECT id, order_no, image_url, caption FROM series_illustrations WHERE series_id=? ORDER BY order_no ASC').bind(id).all<any>()
    return { items: (rows.results ?? []).map((r) => ({ id: r.id, imageUrl: r.image_url, caption: r.caption || '', orderNo: r.order_no })) }
  })
  return c.json(result)
})

// Admin — lưu lại TOÀN BỘ danh sách (bulk replace theo thứ tự mảng)
app.put('/api/series/:id/illustrations', async (c) => {
  await requireAdmin(c)
  const id = c.req.param('id')
  const body: any = await c.req.json()
  const items: any[] = Array.isArray(body.items) ? body.items : []
  if (items.length > 100) return c.json({ error: 'Tối đa 100 ảnh minh họa mỗi bộ truyện.' }, 400)
  const db = c.env.DB
  const s = await db.prepare('SELECT id FROM series WHERE id=?').bind(id).first<any>()
  if (!s) return c.json({ error: 'Không tìm thấy truyện.' }, 404)
  const now = nowIso()
  const stmts: any[] = [db.prepare('DELETE FROM series_illustrations WHERE series_id=?').bind(id)]
  let count = 0
  for (const it of items) {
    const url = String(it?.imageUrl || '').trim()
    if (!url) continue
    stmts.push(
      db.prepare('INSERT INTO series_illustrations (id, series_id, order_no, image_url, caption, created_at) VALUES (?,?,?,?,?,?)')
        .bind(uuid(), id, count, url.slice(0, 2000), String(it?.caption || '').slice(0, 500), now)
    )
    count++
  }
  await db.batch(stmts)
  invalidateAll()
  return c.json({ ok: true, count })
})

app.get('/api/series/:id/chapters', async (c) => {
  const id = c.req.param('id')
  const url = new URL(c.req.url)
  const includeDraft = url.searchParams.get('all') === '1'
  // fields=meta → chỉ trả metadata (không nội dung) — mobile dùng để list nhanh,
  // nội dung từng chương được tải lười qua /api/chapters/:id.
  const metaOnly = url.searchParams.get('fields') === 'meta'
  const q = (url.searchParams.get('q') || '').trim().toLowerCase()
  if (includeDraft) {
    const u = await getAuth(c)
    if (!u || (!u.service && u.role !== 'admin')) throw new ApiError(403, 'Bạn không có quyền quản trị.')
    const select = metaOnly
      ? 'SELECT id, series_id, order_no, title, status, word_count, published_at FROM chapters WHERE series_id=? ORDER BY order_no ASC'
      : 'SELECT * FROM chapters WHERE series_id=? ORDER BY order_no ASC'
    const rows = await c.env.DB.prepare(select).bind(id).all<ChapterRow>()
    let chapters = (rows.results ?? []).map(mapChapter)
    if (q) chapters = chapters.filter(ch => ch.title.toLowerCase().includes(q) || String(ch.orderNo) === q)
    return c.json({ items: chapters })
  }
  const cacheKey = `chapters:${id}:${q}:${metaOnly ? 'meta' : 'full'}`
  const result = await cachedFetch(cacheKey, 20_000, async () => {
    const select = metaOnly
      ? "SELECT id, series_id, order_no, title, status, word_count, published_at FROM chapters WHERE series_id=? AND status='published' ORDER BY order_no ASC"
      : "SELECT * FROM chapters WHERE series_id=? AND status='published' ORDER BY order_no ASC"
    const rows = await c.env.DB.prepare(select).bind(id).all<ChapterRow>()
    let chapters = (rows.results ?? []).map(mapChapter)
    if (q) chapters = chapters.filter(ch => ch.title.toLowerCase().includes(q) || String(ch.orderNo) === q)
    return { items: chapters }
  })
  return c.json(result)
})

app.post('/api/series/:id/chapters', async (c) => {
  await requireAdmin(c)
  const id = c.req.param('id')
  const body: any = await c.req.json()
  if (!body.title || !String(body.title).trim()) return c.json({ error: 'Tiêu đề chương là bắt buộc.' }, 400)
  if (body.orderNo === undefined || body.orderNo === null || isNaN(Number(body.orderNo))) return c.json({ error: 'Số thứ tự chương không hợp lệ.' }, 400)
  const chapStatus = body.status === 'draft' ? 'draft' : 'published'
  const nid = uuid()
  const now = nowIso()
  try {
    await c.env.DB.prepare('INSERT INTO chapters (id, series_id, order_no, title, content, status, word_count, published_at, created_at) VALUES (?,?,?,?,?,?,?,?,?)')
      .bind(nid, id, Number(body.orderNo), String(body.title).trim(), String(body.content || ''), chapStatus, chapterWordCount(String(body.content || '')), chapStatus==='published'?now:null, now).run()
  } catch (e:any) {
    if (String(e.message||'').includes('UNIQUE')) return c.json({ error: 'Số thứ tự chương đã tồn tại.' }, 400)
    throw e
  }
  await recalcSeriesWordCount(c.env.DB, id)
  invalidateAll()
  return c.json({ ok: true, id: nid })
})

app.post('/api/series/:id/chapters/bulk', async (c) => {
  await requireAdmin(c)
  const id = c.req.param('id')
  const body: any = await c.req.json()
  const chapters: any[] = Array.isArray(body.chapters) ? body.chapters : []
  if (chapters.length === 0) return c.json({ error: 'Không có chương nào để nhập.' }, 400)
  if (chapters.length > 500) return c.json({ error: 'Tối đa 500 chương mỗi lần nhập.' }, 400)
  const rows = chapters.map(ch => ({
    id: uuid(), series_id: id, order_no: Number(ch.orderNo), title: String(ch.title||'').trim(),
    content: String(ch.content||''), status: ch.status==='draft'?'draft':'published',
    word_count: chapterWordCount(String(ch.content||'')), published_at: ch.status==='draft'?null:nowIso()
  })).filter(r => r.title && !isNaN(r.order_no) && r.order_no>=0)
  if (rows.length===0) return c.json({ error: 'Không có chương hợp lệ (thiếu tiêu đề hoặc số thứ tự).' }, 400)
  const existing = await c.env.DB.prepare('SELECT order_no FROM chapters WHERE series_id=?').bind(id).all<any>()
  const existingOrders = new Set((existing.results??[]).map(r=>r.order_no))
  const skipped = rows.filter(r=>existingOrders.has(r.order_no)).length
  const toInsert = rows.filter(r=>!existingOrders.has(r.order_no))
  const now = nowIso()
  for (let i=0;i<toInsert.length;i+=10) {
    const chunk = toInsert.slice(i,i+10)
    const placeholders = chunk.map(()=>'(?,?,?,?,?,?,?,?,?)').join(',')
    const vals:any[]=[]; for(const r of chunk) vals.push(r.id,r.series_id,r.order_no,r.title,r.content,r.status,r.word_count,r.published_at,now)
    if(vals.length) await c.env.DB.prepare(`INSERT OR IGNORE INTO chapters (id,series_id,order_no,title,content,status,word_count,published_at,created_at) VALUES ${placeholders}`).bind(...vals).run()
  }
  await recalcSeriesWordCount(c.env.DB, id)
  invalidateAll()
  return c.json({ ok: true, count: toInsert.length, skipped })
})

app.get('/api/chapters/:id', async (c) => {
  const id = c.req.param('id')
  const result = await cachedFetch(`chapter:${id}`, 60_000, async () => {
    const ch = await c.env.DB.prepare('SELECT * FROM chapters WHERE id=?').bind(id).first<ChapterRow>()
    if (!ch) return null
    const s = await c.env.DB.prepare('SELECT id, title, cover_url FROM series WHERE id=?').bind((ch as any).series_id).first<any>()
    const series = s ? { id: s.id, title: s.title, coverUrl: s.cover_url } : null
    return { ...mapChapter(ch as ChapterRow), series }
  })
  if (result===null) return c.json({ error: 'Không tìm thấy chương.' }, 404)
  return c.json(result)
})

app.patch('/api/chapters/:id', async (c) => {
  await requireAdmin(c)
  const id = c.req.param('id')
  const body:any = await c.req.json()
  const existing = await c.env.DB.prepare('SELECT series_id FROM chapters WHERE id=?').bind(id).first<any>()
  if (!existing) return c.json({ error: 'Không tìm thấy chương.' }, 404)
  const data: Record<string,any> = {}
  if (body.title!==undefined) data.title=String(body.title).trim()
  if (body.content!==undefined) { data.content=String(body.content); data.word_count=chapterWordCount(String(body.content)) }
  if (body.orderNo!==undefined && !isNaN(Number(body.orderNo))) data.order_no=Number(body.orderNo)
  if (body.status!==undefined) {
    if (body.status==='draft'||body.status==='published') { data.status=body.status; data.published_at=body.status==='published'?nowIso():null }
    else return c.json({ error: 'Trạng thái chương chỉ được là Nháp hoặc Đã đăng.' }, 400)
  }
  if (!Object.keys(data).length) return c.json({ ok: true })
  const sets = Object.keys(data).map(k=>`${k}=?`).join(',')
  const vals = Object.values(data)
  try {
    await c.env.DB.prepare(`UPDATE chapters SET ${sets} WHERE id=?`).bind(...vals, id).run()
  } catch(e:any){ if(String(e.message||'').includes('UNIQUE')) return c.json({ error: 'Số thứ tự chương đã tồn tại.' }, 400); throw e }
  if (data.word_count!==undefined) await recalcSeriesWordCount(c.env.DB, existing.series_id)
  invalidateAll()
  return c.json({ ok: true })
})

app.delete('/api/chapters/:id', async (c) => {
  await requireAdmin(c)
  const id = c.req.param('id')
  const ch = await c.env.DB.prepare('SELECT series_id FROM chapters WHERE id=?').bind(id).first<any>()
  if (!ch) return c.json({ error: 'Không tìm thấy chương.' }, 404)
  await c.env.DB.prepare('DELETE FROM chapters WHERE id=?').bind(id).run()
  await recalcSeriesWordCount(c.env.DB, ch.series_id)
  invalidateAll()
  return c.json({ ok: true })
})

app.post('/api/series/create', async (c) => {
  const ip = c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for') || 'anon'
  const rl = checkRateLimit(`series-create:${ip}`, 30, 60_000)
  if (!rl.ok) return c.json({ error: 'Tạo truyện quá nhanh, thử lại sau.' }, 429)
  await requireAdmin(c)
  const body:any = await c.req.json()
  if (!body.title || !String(body.title).trim()) return c.json({ error: 'Tên truyện là bắt buộc.' }, 400)
  const valid=['draft','published','completed','hidden']
  const st = valid.includes(body.status)?body.status:'published'
  const genres = Array.isArray(body.genres)?body.genres:String(body.genres||'').split(',').map((x:string)=>x.trim()).filter(Boolean)
  const tags = Array.isArray(body.tags)?body.tags:String(body.tags||'').split(',').map((x:string)=>x.trim()).filter(Boolean)
  const nid = (body.id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(body.id))) ? String(body.id) : uuid()
  const now=nowIso()
  // Upsert theo id — retry/fallback an toàn, không tạo trùng lặp
  await c.env.DB.prepare('INSERT INTO series (id,title,author,description,cover_url,status,genres,tags,word_count,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET title=excluded.title, author=excluded.author, description=excluded.description, cover_url=excluded.cover_url, status=excluded.status, genres=excluded.genres, tags=excluded.tags, updated_at=excluded.updated_at')
    .bind(nid, String(body.title).trim(), String(body.author||'').trim(), String(body.description||'').trim(), String(body.coverUrl||'').trim(), st, JSON.stringify(genres), JSON.stringify(tags), 0, now, now).run()
  invalidateAll()
  return c.json({ ok: true, series: { id: nid } })
})

app.patch('/api/series/:id', async (c) => {
  await requireAdmin(c)
  const id=c.req.param('id')
  const body:any=await c.req.json()
  const data:Record<string,any>={}
  if(body.title!==undefined) data.title=String(body.title).trim()
  if(body.author!==undefined) data.author=String(body.author).trim()
  if(body.description!==undefined) data.description=String(body.description).trim()
  if(body.coverUrl!==undefined) data.cover_url=String(body.coverUrl).trim()
  if(body.status!==undefined){ const valid=['draft','published','completed','hidden']; if(valid.includes(body.status)) data.status=body.status }
  if(body.genres!==undefined) data.genres=JSON.stringify(Array.isArray(body.genres)?body.genres:String(body.genres||'').split(',').map((x:string)=>x.trim()).filter(Boolean))
  if(body.tags!==undefined) data.tags=JSON.stringify(Array.isArray(body.tags)?body.tags:String(body.tags||'').split(',').map((x:string)=>x.trim()).filter(Boolean))
  if(!Object.keys(data).length) return c.json({ ok:true, id })
  data.updated_at=nowIso()
  const sets=Object.keys(data).map(k=>`${k}=?`).join(',')
  await c.env.DB.prepare(`UPDATE series SET ${sets} WHERE id=?`).bind(...Object.values(data), id).run()
  invalidateAll()
  return c.json({ ok:true, id })
})

app.delete('/api/series/:id', async (c) => {
  await requireAdmin(c)
  const id=c.req.param('id')
  const db=c.env.DB
  await db.batch([
    db.prepare('DELETE FROM chapters WHERE series_id=?').bind(id),
    db.prepare('DELETE FROM favorites WHERE series_id=?').bind(id),
    db.prepare('DELETE FROM history WHERE series_id=?').bind(id),
    db.prepare('DELETE FROM progress WHERE series_id=?').bind(id),
    db.prepare('DELETE FROM bookmarks WHERE series_id=?').bind(id),
    db.prepare('DELETE FROM series WHERE id=?').bind(id),
  ])
  invalidateAll()
  return c.json({ ok:true })
})

app.get('/api/tags', async (c) => {
  const result = await cachedFetch('tags', 60_000, async () => {
    const rows = await c.env.DB.prepare('SELECT id, name FROM tags ORDER BY name ASC').all<any>()
    return { items: rows.results ?? [] }
  })
  return c.json(result)
})
app.post('/api/tags', async (c) => {
  await requireAdmin(c)
  const { name } = await c.req.json() as any
  if (!name || !String(name).trim()) return c.json({ error: 'Tên tag là bắt buộc.' }, 400)
  const nid=uuid()
  try { await c.env.DB.prepare('INSERT INTO tags (id,name) VALUES (?,?)').bind(nid, String(name).trim()).run() }
  catch(e:any){ if(String(e.message||'').includes('UNIQUE')) return c.json({ error: 'Tag đã tồn tại.' }, 400); throw e }
  invalidateAll()
  return c.json({ ok:true, id: nid })
})
app.patch('/api/tags/:id', async (c) => {
  await requireAdmin(c)
  const id=c.req.param('id')
  const { name } = await c.req.json() as any
  if (!name || !String(name).trim()) return c.json({ error: 'Tên tag là bắt buộc.' }, 400)
  try { await c.env.DB.prepare('UPDATE tags SET name=? WHERE id=?').bind(String(name).trim(), id).run() }
  catch(e:any){ if(String(e.message||'').includes('UNIQUE')) return c.json({ error: 'Tag đã tồn tại.' }, 400); throw e }
  invalidateAll()
  return c.json({ ok:true })
})
app.delete('/api/tags/:id', async (c) => {
  await requireAdmin(c)
  await c.env.DB.prepare('DELETE FROM tags WHERE id=?').bind(c.req.param('id')).run()
  invalidateAll()
  return c.json({ ok:true })
})

// ---------- USER ----------

app.get('/api/progress', async (c) => {
  const u = await getAuth(c)
  if (!u) return c.json({ progress: null })
  const seriesId = new URL(c.req.url).searchParams.get('series_id')
  if (!seriesId) return c.json({ error: 'Thiếu series_id.' }, 400)
  const row = await c.env.DB.prepare('SELECT * FROM progress WHERE user_id=? AND series_id=?').bind(u.id, seriesId).first<any>()
  return c.json({ progress: mapProgress(row as any) })
})

app.put('/api/progress', async (c) => {
  const u = await getAuth(c)
  if (!u) return c.json({ ok:true, skipped:true })
  const body:any = await c.req.json()
  if (!body.seriesId) return c.json({ error: 'Thiếu seriesId.' }, 400)
  const db=c.env.DB
  const existing = await db.prepare('SELECT * FROM progress WHERE user_id=? AND series_id=?').bind(u.id, body.seriesId).first<any>()
  const now=nowIso()
  const row:any = {
    user_id: u.id, series_id: body.seriesId,
    read_chapter_id: existing?.read_chapter_id ?? null,
    read_char_index: existing?.read_char_index ?? 0,
    read_percent: existing?.read_percent ?? 0,
    last_read_at: existing?.last_read_at ?? null,
    listen_chapter_id: existing?.listen_chapter_id ?? null,
    listen_char_index: existing?.listen_char_index ?? 0,
    audio_sec: existing?.audio_sec ?? 0,
    playback_speed: existing?.playback_speed ?? 1.0,
    last_listened_at: existing?.last_listened_at ?? null,
    updated_at: now,
  }
  if (body.listenChapterId!==undefined || body.listenCharIndex!==undefined || body.playbackSpeed!==undefined) {
    row.last_listened_at = now
    if (body.listenChapterId!==undefined) row.listen_chapter_id = body.listenChapterId || null
    if (body.listenCharIndex!==undefined) {
      const ci = Number(body.listenCharIndex)
      row.listen_char_index = Number.isFinite(ci) && ci >= 0 ? Math.trunc(ci) : 0
    }
    if (body.playbackSpeed!==undefined) {
      const ps = Number(body.playbackSpeed)
      row.playback_speed = Number.isFinite(ps) && ps >= 0.5 && ps <= 3 ? ps : 1.0
    }
  }
  if (body.readChapterId!==undefined || body.readCharIndex!==undefined) {
    row.last_read_at = now
    if (body.readChapterId!==undefined) row.read_chapter_id = body.readChapterId || null
    if (body.readCharIndex!==undefined) {
      const ci = Number(body.readCharIndex)
      row.read_char_index = Number.isFinite(ci) && ci >= 0 ? Math.trunc(ci) : 0
      if (body.readPercent!==undefined) {
        const rp = Number(body.readPercent)
        row.read_percent = Number.isFinite(rp) && rp >= 0 && rp <= 100 ? rp : 0
      }
    }
  }
  const pid = existing?.id ?? uuid()
  await db.prepare('INSERT OR REPLACE INTO progress (id,user_id,series_id,read_chapter_id,read_char_index,read_percent,last_read_at,listen_chapter_id,listen_char_index,audio_sec,playback_speed,last_listened_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)')
    .bind(pid,row.user_id,row.series_id,row.read_chapter_id,row.read_char_index,row.read_percent,row.last_read_at,row.listen_chapter_id,row.listen_char_index,row.audio_sec,row.playback_speed,row.last_listened_at,row.updated_at).run()
  return c.json({ ok:true })
})

app.get('/api/progress/all', async (c) => {
  const u = await getAuth(c)
  if (!u) return c.json({ items: [] })
  const rows = await c.env.DB.prepare('SELECT series_id, listen_chapter_id, listen_char_index, last_listened_at FROM progress WHERE user_id=?').bind(u.id).all<any>()
  const chapterIds=(rows.results??[]).map((p:any)=>p.listen_chapter_id).filter(Boolean) as string[]
  let wcMap=new Map<string,number>()
  if(chapterIds.length){
    for(let i=0;i<chapterIds.length;i+=90){
      const chunk=chapterIds.slice(i,i+90)
      const ph=chunk.map(()=>'?').join(',')
      const chs=await c.env.DB.prepare(`SELECT id, word_count FROM chapters WHERE id IN (${ph})`).bind(...chunk).all<any>()
      for(const ch of (chs.results??[])) wcMap.set(ch.id, ch.word_count)
    }
  }
  const items=(rows.results??[]).map((p:any)=>{
    const total=(wcMap.get(p.listen_chapter_id)||1)*5
    const percent=Math.min(100, Math.round((p.listen_char_index/total)*100))
    return { seriesId:p.series_id, listenChapterId:p.listen_chapter_id, listenCharIndex:p.listen_char_index, percent, lastListenedAt:p.last_listened_at }
  })
  return c.json({ items })
})

// Truyện người dùng đang nghe mà có chương mới hơn lần nghe cuối (cho mục "Có chương mới" ở Trang chủ).
app.get('/api/following-updates', async (c) => {
  const u = await getAuth(c)
  if (!u) return c.json({ items: [] })
  const rows = await c.env.DB.prepare(`
    SELECT p.series_id, p.last_listened_at, s.title, s.cover_url,
      (SELECT MAX(order_no) FROM chapters ch WHERE ch.series_id=p.series_id AND ch.status='published') AS max_order,
      (SELECT order_no FROM chapters ch WHERE ch.id = p.listen_chapter_id) AS listened_order
    FROM progress p JOIN series s ON s.id = p.series_id
    WHERE p.user_id=? AND p.listen_chapter_id IS NOT NULL
    ORDER BY p.last_listened_at DESC LIMIT 20
  `).bind(u.id).all<any>()
  const items = (rows.results ?? [])
    .map((r: any) => {
      const maxOrder = Number(r.max_order) || 0
      const listenedOrder = Number(r.listened_order) || 0
      const newChapters = Math.max(0, maxOrder - listenedOrder)
      return {
        seriesId: r.series_id,
        title: r.title,
        coverUrl: r.cover_url,
        newChapters,
        lastOrderNo: maxOrder,
        listenedOrderNo: listenedOrder,
        lastListenedAt: r.last_listened_at,
      }
    })
    .filter((it: any) => it.newChapters > 0)
    .slice(0, 10)
  return c.json({ items })
})

app.get('/api/favorites', async (c) => {
  const u=await getAuth(c)
  if(!u) return c.json({ items: [], total: 0 })
  const { limit, offset } = pageParams(new URL(c.req.url))
  const countRow=await c.env.DB.prepare('SELECT COUNT(*) as n FROM favorites WHERE user_id=?').bind(u.id).first<any>()
  const rows=await c.env.DB.prepare('SELECT f.created_at as favorited_at, s.* FROM favorites f JOIN series s ON s.id=f.series_id WHERE f.user_id=? ORDER BY f.created_at DESC LIMIT ? OFFSET ?').bind(u.id, limit, offset).all<any>()
  const items=(rows.results??[]).map((r:any)=>({ id:r.id, title:r.title, author:r.author, coverUrl:r.cover_url, status:r.status, genres:(()=>{try{return JSON.parse(r.genres)}catch{return []}})(), tags:(()=>{try{return JSON.parse(r.tags)}catch{return []}})(), wordCount:r.word_count, chapterCount:null, updatedAt:r.updated_at, favoritedAt:r.favorited_at }))
  return c.json({ items, total: countRow?.n ?? 0 })
})
app.post('/api/favorites', async (c) => {
  const u=await requireUser(c)
  const { seriesId } = await c.req.json() as any
  if(!seriesId) return c.json({ error:'Thiếu seriesId.' },400)
  const existing=await c.env.DB.prepare('SELECT series_id FROM favorites WHERE user_id=? AND series_id=?').bind(u.id, seriesId).first<any>()
  if(existing){ await c.env.DB.prepare('DELETE FROM favorites WHERE user_id=? AND series_id=?').bind(u.id, seriesId).run(); return c.json({ ok:true, favorited:false }) }
  await c.env.DB.prepare('INSERT INTO favorites (user_id,series_id,created_at) VALUES (?,?,?)').bind(u.id, seriesId, nowIso()).run()
  return c.json({ ok:true, favorited:true })
})

app.get('/api/history', async (c) => {
  const u=await getAuth(c)
  if(!u) return c.json({ items:[], total:0 })
  const { limit, offset } = pageParams(new URL(c.req.url), 50)
  const countRow=await c.env.DB.prepare('SELECT COUNT(*) as n FROM history WHERE user_id=?').bind(u.id).first<any>()
  const rows=await c.env.DB.prepare('SELECT h.opened_count, h.last_opened_at, s.* FROM history h JOIN series s ON s.id=h.series_id WHERE h.user_id=? ORDER BY h.last_opened_at DESC LIMIT ? OFFSET ?').bind(u.id, limit, offset).all<any>()
  const items=(rows.results??[]).map((r:any)=>({ id:r.id, title:r.title, author:r.author, coverUrl:r.cover_url, status:r.status, genres:(()=>{try{return JSON.parse(r.genres)}catch{return []}})(), wordCount:r.word_count, chapterCount:null, updatedAt:r.updated_at, openedCount:r.opened_count, lastOpenedAt:r.last_opened_at }))
  return c.json({ items, total: countRow?.n ?? 0 })
})
app.post('/api/history', async (c) => {
  const u=await getAuth(c)
  if(!u) return c.json({ ok:true, skipped:true })
  const { seriesId } = await c.req.json() as any
  if(!seriesId) return c.json({ error:'Thiếu seriesId.' },400)
  const now=nowIso()
  const existing=await c.env.DB.prepare('SELECT opened_count FROM history WHERE user_id=? AND series_id=?').bind(u.id, seriesId).first<any>()
  if(existing) await c.env.DB.prepare('UPDATE history SET opened_count=?, last_opened_at=? WHERE user_id=? AND series_id=?').bind((existing.opened_count??1)+1, now, u.id, seriesId).run()
  else await c.env.DB.prepare('INSERT INTO history (user_id,series_id,opened_count,last_opened_at) VALUES (?,?,?,?)').bind(u.id, seriesId, 1, now).run()
  return c.json({ ok:true })
})

app.get('/api/settings', async (c) => {
  const u=await getAuth(c)
  if(!u) return c.json({ settings:null })
  await c.env.DB.prepare('INSERT OR IGNORE INTO user_settings (user_id) VALUES (?)').bind(u.id).run()
  const s=await c.env.DB.prepare('SELECT * FROM user_settings WHERE user_id=?').bind(u.id).first<any>()
  return c.json({ settings: { theme:s.theme, playbackSpeed:Number(s.playback_speed), fontSize:s.font_size, fontFamily:s.font_family, lineHeight:Number(s.line_height), autoplayNext:!!s.autoplay_next } })
})
app.put('/api/settings', async (c) => {
  const u=await getAuth(c)
  if(!u) return c.json({ ok:true, skipped:true })
  const body:any=await c.req.json()
  const existing=await c.env.DB.prepare('SELECT * FROM user_settings WHERE user_id=?').bind(u.id).first<any>()
  if(!existing) await c.env.DB.prepare('INSERT OR IGNORE INTO user_settings (user_id) VALUES (?)').bind(u.id).run()
  const cur=await c.env.DB.prepare('SELECT * FROM user_settings WHERE user_id=?').bind(u.id).first<any>()
  const data:Record<string,any>={}
  if(body.theme!==undefined){ const valid=['light','dark','sepia','amoled']; if(valid.includes(body.theme)) data.theme=body.theme }
  if(body.playbackSpeed!==undefined) data.playback_speed=Number(body.playbackSpeed)||1.0
  if(body.fontSize!==undefined) data.font_size=Math.min(32,Math.max(12,Number(body.fontSize)||18))
  if(body.fontFamily!==undefined) data.font_family=String(body.fontFamily)
  if(body.lineHeight!==undefined) data.line_height=Number(body.lineHeight)||1.7
  if(body.autoplayNext!==undefined) data.autoplay_next=body.autoplayNext?1:0
  if(Object.keys(data).length){ const sets=Object.keys(data).map(k=>`${k}=?`).join(','); await c.env.DB.prepare(`UPDATE user_settings SET ${sets} WHERE user_id=?`).bind(...Object.values(data), u.id).run() }
  else if(!cur) {}
  return c.json({ ok:true })
})

app.get('/api/continue-listening', async (c) => {
  const u=await getAuth(c)
  if(!u) return c.json({ items:[] })
  const rows=await c.env.DB.prepare('SELECT p.listen_chapter_id, p.listen_char_index, p.playback_speed, p.last_listened_at, p.series_id, s.title, s.cover_url FROM progress p JOIN series s ON s.id=p.series_id WHERE p.user_id=? AND p.listen_chapter_id IS NOT NULL ORDER BY p.last_listened_at DESC LIMIT 5').bind(u.id).all<any>()
  const chapterIds=(rows.results??[]).map((r:any)=>r.listen_chapter_id).filter(Boolean) as string[]
  let chMap=new Map<string,any>()
  if(chapterIds.length){
    const ph=chapterIds.map(()=>'?').join(',')
    const chs=await c.env.DB.prepare(`SELECT id, order_no, title, word_count FROM chapters WHERE id IN (${ph})`).bind(...chapterIds).all<any>()
    chMap=new Map((chs.results??[]).map((ch:any)=>[ch.id,ch]))
  }
  const items=(rows.results??[]).filter((r:any)=>chMap.has(r.listen_chapter_id)).map((r:any)=>{
    const ch=chMap.get(r.listen_chapter_id)
    return { seriesId:r.series_id, title:r.title, coverUrl:r.cover_url, chapterId:ch.id, chapterOrderNo:ch.order_no, chapterTitle:ch.title, chapterWordCount:ch.word_count, listenCharIndex:r.listen_char_index, playbackSpeed:r.playback_speed, lastListenedAt:r.last_listened_at, totalChapters:null }
  })
  return c.json({ items })
})

app.get('/api/bookmarks', async (c) => {
  const u=await getAuth(c)
  if(!u) return c.json({ items:[], total:0 })
  const { limit, offset } = pageParams(new URL(c.req.url))
  const countRow=await c.env.DB.prepare('SELECT COUNT(*) as n FROM bookmarks WHERE user_id=?').bind(u.id).first<any>()
  const rows=await c.env.DB.prepare('SELECT b.id, b.series_id, b.chapter_id, b.char_index, b.note, b.created_at, s.id as s_id, s.title as s_title, s.cover_url as s_cover_url FROM bookmarks b LEFT JOIN series s ON s.id=b.series_id WHERE b.user_id=? ORDER BY b.created_at DESC LIMIT ? OFFSET ?').bind(u.id, limit, offset).all<any>()
  const items=(rows.results??[]).map((r:any)=>({ id:r.id, seriesId:r.series_id, chapterId:r.chapter_id, charIndex:r.char_index, note:r.note, createdAt:r.created_at, series: r.s_id?{ id:r.s_id, title:r.s_title, coverUrl:r.s_cover_url }:null }))
  return c.json({ items, total: countRow?.n ?? 0 })
})
app.post('/api/bookmarks', async (c) => {
  const u=await requireUser(c)
  const { seriesId, chapterId, charIndex, note }=await c.req.json() as any
  if(!seriesId||!chapterId) return c.json({ error:'Thiếu seriesId/chapterId.' },400)
  const nid=uuid()
  await c.env.DB.prepare('INSERT INTO bookmarks (id,user_id,series_id,chapter_id,char_index,note,created_at) VALUES (?,?,?,?,?,?,?)').bind(nid,u.id,seriesId,chapterId,Number(charIndex)||0,String(note||''),nowIso()).run()
  return c.json({ ok:true, id:nid })
})
app.delete('/api/bookmarks/:id', async (c) => {
  const u=await requireUser(c)
  const id=c.req.param('id')
  await c.env.DB.prepare('DELETE FROM bookmarks WHERE id=? AND user_id=?').bind(id, u.id).run()
  return c.json({ ok:true })
})

// ---------- STATS ----------

app.post('/api/stats/session', async (c) => {
  const u=await getAuth(c)
  if(!u) return c.json({ ok:true, skipped:true })
  const { seriesId, chapterId, durationSec }=await c.req.json() as any
  if(!seriesId||!durationSec) return c.json({ error:'Thiếu seriesId/durationSec.' },400)
  const rawDur=Number(durationSec)
  if(!Number.isFinite(rawDur)||rawDur<=0) return c.json({ error:'durationSec không hợp lệ.' },400)
  const dur=Math.min(600,Math.trunc(rawDur))
  const existing=await c.env.DB.prepare('SELECT * FROM progress WHERE user_id=? AND series_id=?').bind(u.id, seriesId).first<any>()
  const now=nowIso()
  if(existing){
    await c.env.DB.prepare('UPDATE progress SET audio_sec=?, last_listened_at=?, listen_chapter_id=COALESCE(?,listen_chapter_id), updated_at=? WHERE user_id=? AND series_id=?')
      .bind(Number(existing.audio_sec||0)+dur, now, chapterId||null, now, u.id, seriesId).run()
  } else {
    await c.env.DB.prepare('INSERT INTO progress (id,user_id,series_id,listen_chapter_id,audio_sec,last_listened_at,updated_at) VALUES (?,?,?,?,?,?,?)').bind(uuid(),u.id, seriesId, chapterId||null, dur, now, now).run()
  }
  return c.json({ ok:true, addedSec: dur })
})

app.get('/api/stats/reading', async (c) => {
  const u=await getAuth(c)
  if(!u) return c.json({ stats:null })
  const db=c.env.DB
  const prog=await db.prepare('SELECT p.listen_chapter_id, p.listen_char_index, p.audio_sec, p.last_listened_at, s.id as s_id, s.title as s_title, s.cover_url as s_cover_url, s.word_count as s_wc FROM progress p LEFT JOIN series s ON s.id=p.series_id WHERE p.user_id=? AND p.listen_chapter_id IS NOT NULL ORDER BY p.last_listened_at DESC').bind(u.id).all<any>()
  const rows=prog.results??[]
  const chapterIds=rows.map((r:any)=>r.listen_chapter_id).filter(Boolean) as string[]
  let chMap=new Map<string,any>()
  if(chapterIds.length){
    const ph=chapterIds.map(()=>'?').join(',')
    const chs=await db.prepare(`SELECT id, order_no, title, word_count FROM chapters WHERE id IN (${ph})`).bind(...chapterIds).all<any>()
    chMap=new Map((chs.results??[]).map((ch:any)=>[ch.id,ch]))
  }
  const fav=await db.prepare('SELECT COUNT(*) as n FROM favorites WHERE user_id=?').bind(u.id).first<any>()
  const his=await db.prepare('SELECT COUNT(*) as n FROM history WHERE user_id=?').bind(u.id).first<any>()
  const bms=await db.prepare('SELECT COUNT(*) as n FROM bookmarks WHERE user_id=?').bind(u.id).first<any>()
  let totalListenSec=0, chaptersCompleted=0
  const seriesStats=rows.map((r:any)=>{
    const ch=chMap.get(r.listen_chapter_id)
    const chapterTotalChars=(ch?.word_count||0)*5
    const sessionSec=estListenSec(r.listen_char_index, r.audio_sec)
    totalListenSec+=sessionSec
    if(chapterTotalChars>0 && (r.listen_char_index||0) >= chapterTotalChars*0.95) chaptersCompleted++
    const seriesPct=r.s_wc>0?Math.min(100,Math.round(((r.listen_char_index||0)/r.s_wc)*100)):0
    return { seriesId:r.s_id, title:r.s_title, coverUrl:r.s_cover_url, totalChapters:null, listenChapterId:r.listen_chapter_id, listenChapterOrderNo:ch?.order_no, listenChapterTitle:ch?.title, listenCharIndex:r.listen_char_index, audioSec:sessionSec, percent:seriesPct, lastListenedAt:r.last_listened_at }
  })
  return c.json({ stats: { totalListenMin: Math.round(totalListenSec/60), totalListenSec, chaptersCompleted, seriesFollowing: rows.length, favoritesCount: fav?.n??0, historyCount: his?.n??0, bookmarksCount: bms?.n??0, seriesStats: seriesStats.sort((a,b)=>b.percent-a.percent) } })
})

app.get('/api/stats/history', async (c) => {
  const u=await getAuth(c)
  if(!u) return c.json({ items:[] })
  const rows=await c.env.DB.prepare('SELECT last_listened_at, audio_sec, listen_char_index FROM progress WHERE user_id=? AND last_listened_at IS NOT NULL').bind(u.id).all<any>()
  const today=new Date(); today.setUTCHours(0,0,0,0)
  const dayMap=new Map<string,number>()
  for(const p of (rows.results??[])){
    const d=new Date(p.last_listened_at); d.setUTCHours(0,0,0,0)
    const key=dayKey(d)
    const sec=estListenSec(p.listen_char_index, p.audio_sec)
    dayMap.set(key,(dayMap.get(key)||0)+sec)
  }
  const days=[]
  for(let i=13;i>=0;i--){ const d=new Date(today); d.setUTCDate(d.getUTCDate()-i); const key=dayKey(d); days.push({ date:key, seconds:dayMap.get(key)||0, label:`${d.getUTCDate()}/${d.getUTCMonth()+1}` }) }
  return c.json({ items: days })
})

app.get('/api/stats/streak', async (c) => {
  const u=await getAuth(c)
  if(!u) return c.json({ stats:null })
  const rows=await c.env.DB.prepare('SELECT last_listened_at FROM progress WHERE user_id=? AND last_listened_at IS NOT NULL').bind(u.id).all<any>()
  const days=new Set<string>()
  for(const p of (rows.results??[])){ const d=new Date(p.last_listened_at); days.add(dayKey(d)) }
  const today=new Date(); today.setUTCHours(0,0,0,0)
  const heatmap=[]
  for(let i=89;i>=0;i--){ const d=new Date(today); d.setUTCDate(d.getUTCDate()-i); const key=dayKey(d); heatmap.push({ date:key, listened:days.has(key) }) }
  const sortedDays=Array.from(days).sort()
  let longestStreak=0, tempStreak=0; let prevDay:Date|null=null
  for(const day of sortedDays){ const d=new Date(day); d.setUTCHours(0,0,0,0); if(prevDay){ const diff=Math.round((d.getTime()-prevDay.getTime())/86400000); if(diff===1) tempStreak++; else tempStreak=1 } else tempStreak=1; if(tempStreak>longestStreak) longestStreak=tempStreak; prevDay=d }
  const todayKey=dayKey(today)
  let currentStreak=0
  if(days.has(todayKey)){ const cursor=new Date(today); currentStreak=1; while(true){ cursor.setUTCDate(cursor.getUTCDate()-1); const key=dayKey(cursor); if(days.has(key)) currentStreak++; else break } }
  return c.json({ stats: { currentStreak, longestStreak, totalDays: days.size, heatmap } })
})

app.get('/api/stats/challenge', async (c) => {
  const u=await getAuth(c)
  if(!u) return c.json({ challenge:null })
  const now=new Date()
  const dayOfWeek=now.getUTCDay()
  const daysFromMonday=(dayOfWeek+6)%7
  const weekStart=new Date(now); weekStart.setUTCHours(0,0,0,0); weekStart.setUTCDate(weekStart.getUTCDate()-daysFromMonday)
  const rows=await c.env.DB.prepare('SELECT listen_char_index, listen_chapter_id, last_listened_at, audio_sec FROM progress WHERE user_id=? AND listen_chapter_id IS NOT NULL AND last_listened_at >= ?').bind(u.id, weekStart.toISOString()).all<any>()
  const rs=rows.results??[]
  const chaptersThisWeek=new Set(rs.filter((p:any)=>p.listen_chapter_id).map((p:any)=>p.listen_chapter_id)).size
  const listenSecThisWeek=rs.reduce((s:number,p:any)=>s+estListenSec(p.listen_char_index,p.audio_sec),0)
  const listenMinThisWeek=Math.round(listenSecThisWeek/60)
  const daysThisWeek=new Set(rs.filter((p:any)=>p.last_listened_at).map((p:any)=>{ const d=new Date(p.last_listened_at!); return dayKeyShort(d) })).size
  const challenges=[
    { id:'weekly-chapters', title:'Nghe 3 chương', desc:'Hoàn thành 3 chương trong tuần này', icon:'📖', goal:3, progress:chaptersThisWeek, unit:'chương', tier:'bronze' },
    { id:'weekly-minutes', title:'Nghe 60 phút', desc:'Nghe tổng cộng 60 phút trong tuần', icon:'⏰', goal:60, progress:listenMinThisWeek, unit:'phút', tier:'silver' },
    { id:'weekly-days', title:'Nghe 5 ngày', desc:'Nghe truyện 5 ngày trong tuần', icon:'🔥', goal:5, progress:daysThisWeek, unit:'ngày', tier:'gold' },
  ]
  const mapped=challenges.map(ch=>({ ...ch, unlocked:ch.progress>=ch.goal, progress:Math.min(ch.progress,ch.goal) }))
  const weekEnd=new Date(weekStart); weekEnd.setUTCDate(weekEnd.getUTCDate()+7)
  return c.json({ challenges: mapped, summary:{ unlocked:mapped.filter(ch=>ch.unlocked).length, total:mapped.length, weekStart:weekStart.toISOString(), weekEnd:weekEnd.toISOString(), daysLeft:Math.ceil((weekEnd.getTime()-now.getTime())/86400000) } })
})

app.get('/api/stats/achievements', async (c) => {
  const u=await getAuth(c)
  if(!u) return c.json({ achievements:[] })
  const db=c.env.DB
  const prog=await db.prepare('SELECT listen_char_index, listen_chapter_id, last_listened_at, audio_sec FROM progress WHERE user_id=? AND listen_chapter_id IS NOT NULL').bind(u.id).all<any>()
  const rs=prog.results??[]
  const chapterIds=rs.map((p:any)=>p.listen_chapter_id).filter(Boolean) as string[]
  let wcMap=new Map<string,number>()
  if(chapterIds.length){ const ph=chapterIds.map(()=>'?').join(','); const chs=await db.prepare(`SELECT id, word_count FROM chapters WHERE id IN (${ph})`).bind(...chapterIds).all<any>(); wcMap=new Map((chs.results??[]).map((ch:any)=>[ch.id,ch.word_count])) }
  const fav=await db.prepare('SELECT COUNT(*) as n FROM favorites WHERE user_id=?').bind(u.id).first<any>()
  const his=await db.prepare('SELECT COUNT(*) as n FROM history WHERE user_id=?').bind(u.id).first<any>()
  const bms=await db.prepare('SELECT COUNT(*) as n FROM bookmarks WHERE user_id=?').bind(u.id).first<any>()
  let totalListenSec=0, chaptersCompleted=0
  const days=new Set<string>()
  for(const p of rs){ totalListenSec+=estListenSec(p.listen_char_index,p.audio_sec); const wc=(wcMap.get(p.listen_chapter_id)||0)*5; if(wc>0 && (p.listen_char_index||0)>=wc*0.95) chaptersCompleted++; if(p.last_listened_at){ const d=new Date(p.last_listened_at); days.add(dayKeyShort(d)) } }
  const totalListenMin=Math.round(totalListenSec/60)
  const totalDays=days.size
  const seriesCount=rs.length
  const defs=[
    { id:'listen-30', title:'Người nghe kiên nhẫn', desc:'Nghe 30 phút tổng cộng', icon:'🎧', goal:30, progress:totalListenMin, tier:'bronze' },
    { id:'listen-300', title:'Người nghe mẫn cán', desc:'Nghe 5 giờ tổng cộng', icon:'⏰', goal:300, progress:totalListenMin, tier:'silver' },
    { id:'listen-3000', title:'Bậc thầy nghe truyện', desc:'Nghe 50 giờ tổng cộng', icon:'🏆', goal:3000, progress:totalListenMin, tier:'gold' },
    { id:'chap-1', title:'Chương đầu tiên', desc:'Hoàn thành 1 chương', icon:'📖', goal:1, progress:chaptersCompleted, tier:'bronze' },
    { id:'chap-10', title:'Đạo hữu', desc:'Hoàn thành 10 chương', icon:'📚', goal:10, progress:chaptersCompleted, tier:'silver' },
    { id:'chap-100', title:'Thư linh', desc:'Hoàn thành 100 chương', icon:'💯', goal:100, progress:chaptersCompleted, tier:'gold' },
    { id:'streak-7', title:'Tuần liên tục', desc:'Nghe 7 ngày liên tiếp', icon:'🔥', goal:7, progress:totalDays>=7?7:totalDays, tier:'bronze' },
    { id:'streak-30', title:'Tháng liên tục', desc:'Nghe 30 ngày liên tiếp', icon:'☄️', goal:30, progress:totalDays>=30?30:totalDays, tier:'silver' },
    { id:'series-5', title:'Đa tượng', desc:'Theo dõi 5 truyện', icon:'🌟', goal:5, progress:seriesCount, tier:'bronze' },
    { id:'series-20', title:'Bao quát', desc:'Theo dõi 20 truyện', icon:'✨', goal:20, progress:seriesCount, tier:'silver' },
    { id:'fav-5', title:'Sưu tập', desc:'Yêu thích 5 truyện', icon:'❤️', goal:5, progress:fav?.n??0, tier:'bronze' },
    { id:'bm-10', title:'Người sưu tầm', desc:'Đánh dấu 10 vị trí', icon:'🔖', goal:10, progress:bms?.n??0, tier:'bronze' },
  ]
  const achievements=defs.map(a=>({ ...a, unlocked:a.progress>=a.goal, progress:Math.min(a.progress,a.goal) }))
  const unlockedCount=achievements.filter(a=>a.unlocked).length
  const totalProgress=totalListenMin>0||chaptersCompleted>0?Math.round((unlockedCount/achievements.length)*100):0
  return c.json({ achievements, summary:{ unlocked:unlockedCount, total:achievements.length, progress:totalProgress } })
})

app.get('/api/stats', async (c) => {
  await requireAdmin(c)
  const db=c.env.DB
  const [seriesCount, chapterCount, userCount, progressCount]=await Promise.all([
    db.prepare('SELECT COUNT(*) as n FROM series').first<any>(),
    db.prepare('SELECT COUNT(*) as n FROM chapters').first<any>(),
    db.prepare('SELECT COUNT(*) as n FROM profiles').first<any>(),
    db.prepare('SELECT COUNT(*) as n FROM progress').first<any>(),
  ])
  const statuses=await db.prepare('SELECT status FROM series').all<any>()
  const byStatus:Record<string,number>={ draft:0, published:0, completed:0, hidden:0 }
  for(const s of (statuses.results??[])){ if(s.status in byStatus) byStatus[s.status]++ }
  return c.json({ series:seriesCount?.n??0, chapters:chapterCount?.n??0, users:userCount?.n??0, listeners:progressCount?.n??0, byStatus })
})

// ---------- R2 covers ----------

// Sniff magic bytes để xác thực ảnh thật (không tin MIME client khai báo).
function sniffImage(buf: Uint8Array): { mime: string; ext: string } | null {
  const b = buf
  if (b.length < 12) return null
  // PNG
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 && b[4] === 0x0d && b[5] === 0x0a) return { mime: 'image/png', ext: 'png' }
  // JPEG
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return { mime: 'image/jpeg', ext: 'jpg' }
  // GIF
  if (b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x38) return { mime: 'image/gif', ext: 'gif' }
  // WEBP
  if (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return { mime: 'image/webp', ext: 'webp' }
  // BMP
  if (b[0] === 0x42 && b[1] === 0x4d) return { mime: 'image/bmp', ext: 'bmp' }
  return null
}

app.post('/api/upload', async (c) => {
  const ip = c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for') || 'anon'
  const rl = checkRateLimit(`upload:${ip}`, 20, 60_000)
  if (!rl.ok) return c.json({ error: 'Quá nhiều yêu cầu upload, thử lại sau.' }, 429)
  await requireAdmin(c)
  if (!c.env.COVERS) return c.json({ error: 'R2 chưa cấu hình. Vui lòng bật R2 tại https://dash.cloudflare.com/3bc7982e8a2f3c210b766b046fd3557c/r2/overview rồi tạo bucket sonovel-covers.' }, 503)
  const lenHeader = c.req.header('content-length')
  if (lenHeader) {
    const len = Number(lenHeader)
    if (Number.isFinite(len) && len > 6 * 1024 * 1024) return c.json({ error: 'Payload vượt quá 6MB (giới hạn 5MB cho ảnh).' }, 413)
  }
  const contentType = c.req.header('content-type') || ''
  let file: File | null = null
  if (contentType.includes('multipart/form-data')) {
    const form = await c.req.formData()
    const f = form.get('file') || form.get('cover') || form.get('image')
    if (f && typeof (f as any).arrayBuffer === 'function') { file = f as unknown as File }
  } else {
    const body: any = await c.req.json().catch(() => null)
    if (body?.image && typeof body.image === 'string') {
      const b64 = body.image.replace(/^data:image\/\w+;base64,/, '')
      const buf = Uint8Array.from(atob(b64), ch => ch.charCodeAt(0))
      if (buf.length > 5 * 1024 * 1024) return c.json({ error: 'Ảnh vượt quá 5MB.' }, 400)
      const sniffed = sniffImage(buf)
      if (!sniffed) return c.json({ error: 'File không phải ảnh hợp lệ (PNG/JPEG/GIF/WEBP/BMP).' }, 400)
      const key = `covers/${uuid()}.${sniffed.ext}`
      await c.env.COVERS!.put(key, buf, { httpMetadata: { contentType: sniffed.mime } })
      return c.json({ url: `/covers/${key.replace('covers/','')}`, key })
    }
  }
  if (!file) return c.json({ error: 'Thiếu file ảnh.' }, 400)
  if (file.size > 5 * 1024 * 1024) return c.json({ error: 'Ảnh vượt quá 5MB.' }, 400)
  const buf = new Uint8Array(await file.arrayBuffer())
  // Xác thực bằng magic bytes — không tin file.type client khai báo
  const sniffed = sniffImage(buf)
  if (!sniffed) return c.json({ error: 'File không phải ảnh hợp lệ (PNG/JPEG/GIF/WEBP/BMP).' }, 400)
  const key = `covers/${uuid()}.${sniffed.ext}`
  await c.env.COVERS!.put(key, buf, { httpMetadata: { contentType: sniffed.mime } })
  return c.json({ url: `/covers/${key.replace('covers/','')}`, key })
})

app.get('/covers/:key', async (c) => {
  if (!c.env.COVERS) return c.json({ error: 'R2 chưa cấu hình' }, 503)
  const key = c.req.param('key')
  if (!key || key.includes('..') || key.includes('/')) return c.json({ error: 'Key không hợp lệ' }, 400)
  const obj = await c.env.COVERS!.get(`covers/${key}`)
  if (!obj) return c.json({ error: 'Không tìm thấy ảnh' }, 404)
  const headers = new Headers()
  headers.set('Content-Type', obj.httpMetadata?.contentType || 'image/jpeg')
  headers.set('Cache-Control', 'public, max-age=31536000, immutable')
  return new Response(obj.body, { headers })
})

// ---------- ADMIN helpers ----------

app.get('/api/profiles/roles', async (c) => {
  const u=await getAuth(c)
  if(!u || (!u.service && u.role!=='admin')) throw new ApiError(403,'Bạn không có quyền quản trị.')
  const idsStr=new URL(c.req.url).searchParams.get('ids')||''
  const ids=idsStr.split(',').filter(Boolean)
  if(!ids.length) return c.json({ roles:{} })
  const ph=ids.map(()=>'?').join(',')
  const rows=await c.env.DB.prepare(`SELECT id, role FROM profiles WHERE id IN (${ph})`).bind(...ids).all<any>()
  const roles:Record<string,string>={}
  for(const r of (rows.results??[])) roles[r.id]=r.role
  return c.json({ roles })
})

app.patch('/api/admin/users/:id', async (c) => {
  await requireAdmin(c)
  const id=c.req.param('id')
  const body:any=await c.req.json()
  if(body.role!==undefined){
    if(body.role!=='user' && body.role!=='admin') return c.json({ error:'Role không hợp lệ.' },400)
    await c.env.DB.prepare('INSERT INTO profiles (id,role) VALUES (?,?) ON CONFLICT(id) DO UPDATE SET role=excluded.role').bind(id, body.role).run()
    return c.json({ ok:true })
  }
  return c.json({ error:'Thiếu hành động (role).' },400)
})

export default app
