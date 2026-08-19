import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { serverDb } from '@/lib/server-data'
import { chapterWordCount, recalcSeriesWordCount } from '@/lib/sonovel'
import { requireAdmin } from '@/lib/session'

type BulkChapterInput = {
  orderNo: number
  title: string
  content: string
  status?: 'draft' | 'published'
}

// POST /api/series/[id]/chapters/bulk — nhập hàng loạt chương (admin)
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin()
    const { id } = await params
    const body = await req.json()
    const chapters: BulkChapterInput[] = Array.isArray(body.chapters) ? body.chapters : []

    if (chapters.length === 0) {
      return NextResponse.json({ error: 'Không có chương nào để nhập.' }, { status: 400 })
    }
    if (chapters.length > 500) {
      return NextResponse.json({ error: 'Tối đa 500 chương mỗi lần nhập.' }, { status: 400 })
    }

    const rows = chapters
      .map((c) => ({
        id: randomUUID(),
        series_id: id,
        order_no: Number(c.orderNo),
        title: String(c.title || '').trim(),
        content: String(c.content || ''),
        status: c.status === 'draft' ? 'draft' : 'published',
        word_count: chapterWordCount(String(c.content || '')),
        published_at: c.status === 'draft' ? null : new Date().toISOString(),
      }))
      .filter((c) => c.title && !isNaN(c.order_no) && c.order_no > 0)

    if (rows.length === 0) {
      return NextResponse.json({ error: 'Không có chương hợp lệ (thiếu tiêu đề hoặc số thứ tự).' }, { status: 400 })
    }

    const supabase = serverDb()

    // Xác định số chương bị trùng order_no (để báo skipped)
    const { data: existing } = await supabase.from('chapters').select('order_no').eq('series_id', id)
    const existingOrders = new Set((existing ?? []).map((c: any) => c.order_no))
    const skipped = rows.filter((r) => existingOrders.has(r.order_no)).length

    const { error } = await supabase
      .from('chapters')
      .upsert(rows, { onConflict: 'series_id,order_no', ignoreDuplicates: true })
    if (error) throw error

    await recalcSeriesWordCount(id)

    return NextResponse.json({ ok: true, count: rows.length - skipped, skipped })
  } catch (e) {
    const msg = (e as Error).message
    if (msg === 'UNAUTHORIZED' || msg === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Bạn không có quyền quản trị.' }, { status: 403 })
    }
    return NextResponse.json({ error: 'Nhập hàng loạt thất bại: ' + msg }, { status: 500 })
  }
}
