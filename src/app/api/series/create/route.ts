import { NextRequest, NextResponse } from 'next/server'
import { proxyToWorker } from '@/lib/worker'
import { serverDb } from '@/lib/server-data'
import { invalidateAll } from '@/lib/server-cache'
import { requireAdmin } from '@/lib/session'

export async function POST(req: NextRequest) {
  let bodyText = ''
  try { bodyText = await req.text() } catch {}
  // Sinh id MỘT lần → mọi retry/fallback dùng chung id (worker upsert + Supabase),
  // tránh tạo series trùng lặp khác id giữa 2 DB.
  let body: any = {}
  try { body = JSON.parse(bodyText || '{}') } catch {}
  if (!body.id) {
    body.id = crypto.randomUUID()
    bodyText = JSON.stringify(body)
  }
  try {
    const { res, json } = await proxyToWorker('/api/series/create', { method: 'POST', body: bodyText, admin: true })
    if (res.ok) return NextResponse.json(json, { status: res.status })
    if (res.status >= 500 || json?.error?.includes('Worker fetch failed')) throw new Error(json?.error || `Worker ${res.status}`)
    return NextResponse.json(json, { status: res.status })
  } catch (e) {
    const msg = (e as Error).message
    if (msg.includes('Worker fetch failed') || msg.includes('Failed to fetch')) {
      try {
        await requireAdmin()
        if (!body.title || !String(body.title).trim()) return NextResponse.json({ error: 'Tên truyện là bắt buộc.' }, { status: 400 })
        const valid = ['draft', 'published', 'completed', 'hidden']
        const seriesStatus = valid.includes(body.status) ? body.status : 'published'
        const seriesGenres = Array.isArray(body.genres) ? body.genres : String(body.genres || '').split(',').map((x: string) => x.trim()).filter(Boolean)
        const seriesTags = Array.isArray(body.tags) ? body.tags : String(body.tags || '').split(',').map((x: string) => x.trim()).filter(Boolean)
        const { data, error } = await serverDb().from('series').upsert({
          id: body.id,
          title: String(body.title).trim(),
          author: String(body.author || '').trim(),
          description: String(body.description || '').trim(),
          cover_url: String(body.coverUrl || '').trim(),
          status: seriesStatus,
          genres: seriesGenres,
          tags: seriesTags,
        }, { onConflict: 'id' }).select('id').single()
        if (error) throw error
        invalidateAll()
        return NextResponse.json({ ok: true, series: { id: data.id } })
      } catch (fallbackErr) {
        return NextResponse.json({ error: 'Tạo truyện thất bại: ' + (fallbackErr as Error).message + ' (Worker: ' + msg + ')' }, { status: 500 })
      }
    }
    return NextResponse.json({ error: 'Tạo truyện thất bại: ' + msg }, { status: 500 })
  }
}
