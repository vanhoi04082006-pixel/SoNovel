import { NextRequest, NextResponse } from 'next/server'
import { serverDb, mapChapter } from '@/lib/server-data'
import { chapterWordCount } from '@/lib/sonovel'
import { requireAdmin } from '@/lib/session'

// GET /api/series/[id]/chapters — all chapters (admin: includes draft)
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { searchParams } = new URL(req.url)
  const includeDraft = searchParams.get('all') === '1'
  const q = (searchParams.get('q') || '').trim().toLowerCase()

  try {
    const supabase = serverDb()
    let query = supabase
      .from('chapters')
      .select('*')
      .eq('series_id', id)
      .order('order_no', { ascending: true })

    if (!includeDraft) query = query.eq('status', 'published')

    const { data, error } = await query
    if (error) throw error

    let chapters = (data ?? []).map(mapChapter)
    if (q) {
      chapters = chapters.filter((c) => c.title.toLowerCase().includes(q) || String(c.orderNo) === q)
    }

    return NextResponse.json({ items: chapters })
  } catch (e) {
    return NextResponse.json({ error: 'Tải danh sách chương thất bại: ' + (e as Error).message }, { status: 500 })
  }
}

// POST /api/series/[id]/chapters — admin create chapter
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin()
    const { id } = await params
    const body = await req.json()
    const { orderNo, title, content, status } = body
    if (!title || !String(title).trim()) {
      return NextResponse.json({ error: 'Tiêu đề chương là bắt buộc.' }, { status: 400 })
    }
    if (orderNo === undefined || orderNo === null || isNaN(Number(orderNo))) {
      return NextResponse.json({ error: 'Số thứ tự chương không hợp lệ.' }, { status: 400 })
    }
    const chapStatus = status === 'draft' ? 'draft' : 'published'
    const { data, error } = await serverDb()
      .from('chapters')
      .insert({
        series_id: id,
        order_no: Number(orderNo),
        title: String(title).trim(),
        content: String(content || ''),
        status: chapStatus,
        word_count: chapterWordCount(String(content || '')),
        published_at: chapStatus === 'published' ? new Date().toISOString() : null,
      })
      .select('id')
      .single()
    if (error) {
      if ((error as any).code === '23505') {
        return NextResponse.json({ error: 'Số thứ tự chương đã tồn tại.' }, { status: 400 })
      }
      throw error
    }
    return NextResponse.json({ ok: true, id: data.id })
  } catch (e) {
    const msg = (e as Error).message
    if (msg === 'UNAUTHORIZED' || msg === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Bạn không có quyền quản trị.' }, { status: 403 })
    }
    return NextResponse.json({ error: 'Tạo chương thất bại: ' + msg }, { status: 500 })
  }
}
