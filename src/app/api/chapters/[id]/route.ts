import { NextRequest, NextResponse } from 'next/server'
import { serverDb, mapChapter } from '@/lib/server-data'
import { chapterWordCount } from '@/lib/sonovel'
import { cachedFetch, invalidateAll } from '@/lib/server-cache'
import { requireAdmin } from '@/lib/session'

// GET /api/chapters/[id]
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
    const result = await cachedFetch(`chapter:${id}`, 60_000, async () => {
      const supabase = serverDb()
      const { data: c, error } = await supabase.from('chapters').select('*, series(*)').eq('id', id).maybeSingle()
      if (error) throw error
      if (!c) return null
      const s = c.series
      const series = s ? { id: s.id, title: s.title, coverUrl: s.cover_url } : null
      return { ...mapChapter(c), series }
    })

    if (result === null) {
      return NextResponse.json({ error: 'Không tìm thấy chương.' }, { status: 404 })
    }
    return NextResponse.json(result)
  } catch (e) {
    return NextResponse.json({ error: 'Tải chương thất bại: ' + (e as Error).message }, { status: 500 })
  }
}

// PATCH /api/chapters/[id] — admin update
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin()
    const { id } = await params
    const body = await req.json()

    const { data: existing } = await serverDb().from('chapters').select('series_id').eq('id', id).maybeSingle()
    if (!existing) return NextResponse.json({ error: 'Không tìm thấy chương.' }, { status: 404 })

    const data: Record<string, any> = {}
    if (body.title !== undefined) data.title = String(body.title).trim()
    if (body.content !== undefined) {
      data.content = String(body.content)
      data.word_count = chapterWordCount(String(body.content))
    }
    if (body.orderNo !== undefined && !isNaN(Number(body.orderNo))) data.order_no = Number(body.orderNo)
    if (body.status !== undefined) {
      // §10.5: ONLY draft | published
      if (body.status === 'draft' || body.status === 'published') {
        data.status = body.status
        data.published_at = body.status === 'published' ? new Date().toISOString() : null
      } else {
        return NextResponse.json({ error: 'Trạng thái chương chỉ được là Nháp hoặc Đã đăng.' }, { status: 400 })
      }
    }

    const { error } = await serverDb().from('chapters').update(data).eq('id', id)
    if (error) {
      if ((error as any).code === '23505') {
        return NextResponse.json({ error: 'Số thứ tự chương đã tồn tại.' }, { status: 400 })
      }
      throw error
    }
    invalidateAll()
    return NextResponse.json({ ok: true })
  } catch (e) {
    const msg = (e as Error).message
    if (msg === 'UNAUTHORIZED' || msg === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Bạn không có quyền quản trị.' }, { status: 403 })
    }
    return NextResponse.json({ error: 'Cập nhật chương thất bại: ' + msg }, { status: 500 })
  }
}

// DELETE /api/chapters/[id]
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin()
    const { id } = await params
    const { data: c } = await serverDb().from('chapters').select('series_id').eq('id', id).maybeSingle()
    if (!c) return NextResponse.json({ error: 'Không tìm thấy chương.' }, { status: 404 })
    const { error } = await serverDb().from('chapters').delete().eq('id', id)
    if (error) throw error
    invalidateAll()
    return NextResponse.json({ ok: true })
  } catch (e) {
    const msg = (e as Error).message
    if (msg === 'UNAUTHORIZED' || msg === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Bạn không có quyền quản trị.' }, { status: 403 })
    }
    return NextResponse.json({ error: 'Xóa chương thất bại: ' + msg }, { status: 500 })
  }
}
