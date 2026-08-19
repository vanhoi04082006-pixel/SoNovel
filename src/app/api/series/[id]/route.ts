import { NextRequest, NextResponse } from 'next/server'
import { serverDb, mapSeries, mapChapter } from '@/lib/server-data'
import { requireAdmin } from '@/lib/session'

// GET /api/series/[id] — public detail with published chapters
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
    const supabase = serverDb()
    const { data: s, error } = await supabase.from('series').select('*').eq('id', id).maybeSingle()
    if (error) throw error
    if (!s) return NextResponse.json({ error: 'Không tìm thấy truyện.' }, { status: 404 })

    const { data: chapters, error: cErr } = await supabase
      .from('chapters')
      .select('id, order_no, title, word_count, status, published_at')
      .eq('series_id', id)
      .eq('status', 'published')
      .order('order_no', { ascending: true })
    if (cErr) throw cErr

    return NextResponse.json({
      ...mapSeries(s, (chapters ?? []).length),
      chapters: (chapters ?? []).map(mapChapter),
    })
  } catch (e) {
    return NextResponse.json({ error: 'Tải truyện thất bại: ' + (e as Error).message }, { status: 500 })
  }
}

// PATCH /api/series/[id] — admin update
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin()
    const { id } = await params
    const body = await req.json()
    const data: Record<string, any> = {}
    if (body.title !== undefined) data.title = String(body.title).trim()
    if (body.author !== undefined) data.author = String(body.author).trim()
    if (body.description !== undefined) data.description = String(body.description).trim()
    if (body.coverUrl !== undefined) data.cover_url = String(body.coverUrl).trim()
    if (body.status !== undefined) {
      const valid = ['draft', 'published', 'completed', 'hidden']
      if (valid.includes(body.status)) data.status = body.status
    }
    if (body.genres !== undefined) {
      data.genres = Array.isArray(body.genres) ? body.genres : String(body.genres || '').split(',').map((x: string) => x.trim()).filter(Boolean)
    }
    if (body.tags !== undefined) {
      data.tags = Array.isArray(body.tags) ? body.tags : String(body.tags || '').split(',').map((x: string) => x.trim()).filter(Boolean)
    }
    const { error } = await serverDb().from('series').update(data).eq('id', id)
    if (error) throw error
    return NextResponse.json({ ok: true, id })
  } catch (e) {
    const msg = (e as Error).message
    if (msg === 'UNAUTHORIZED' || msg === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Bạn không có quyền quản trị.' }, { status: 403 })
    }
    return NextResponse.json({ error: 'Cập nhật thất bại: ' + msg }, { status: 500 })
  }
}

// DELETE /api/series/[id] — admin delete (cascade)
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin()
    const { id } = await params
    const { error } = await serverDb().from('series').delete().eq('id', id)
    if (error) throw error
    return NextResponse.json({ ok: true })
  } catch (e) {
    const msg = (e as Error).message
    if (msg === 'UNAUTHORIZED' || msg === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Bạn không có quyền quản trị.' }, { status: 403 })
    }
    return NextResponse.json({ error: 'Xóa thất bại: ' + msg }, { status: 500 })
  }
}
