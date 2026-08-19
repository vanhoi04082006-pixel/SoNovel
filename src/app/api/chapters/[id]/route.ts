import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { chapterWordCount, recalcSeriesWordCount } from '@/lib/sonovel'
import { requireAdmin } from '@/lib/session'

// GET /api/chapters/[id]
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const c = await db.chapter.findUnique({
    where: { id },
    include: { series: { select: { id: true, title: true, coverUrl: true } } },
  })
  if (!c) return NextResponse.json({ error: 'Không tìm thấy chương.' }, { status: 404 })
  return NextResponse.json({
    id: c.id,
    seriesId: c.seriesId,
    series: c.series,
    orderNo: c.orderNo,
    title: c.title,
    content: c.content,
    status: c.status,
    wordCount: c.wordCount,
    publishedAt: c.publishedAt,
    createdAt: c.createdAt,
  })
}

// PATCH /api/chapters/[id] — admin update
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin()
    const { id } = await params
    const body = await req.json()
    const existing = await db.chapter.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: 'Không tìm thấy chương.' }, { status: 404 })

    const data: any = {}
    if (body.title !== undefined) data.title = String(body.title).trim()
    if (body.content !== undefined) {
      data.content = String(body.content)
      data.wordCount = chapterWordCount(String(body.content))
    }
    if (body.orderNo !== undefined && !isNaN(Number(body.orderNo))) data.orderNo = Number(body.orderNo)
    if (body.status !== undefined) {
      // §10.5: ONLY draft | published
      if (body.status === 'draft' || body.status === 'published') {
        data.status = body.status
        data.publishedAt = body.status === 'published' ? (existing.publishedAt ?? new Date()) : null
      } else {
        return NextResponse.json({ error: 'Trạng thái chương chỉ được là Nháp hoặc Đã đăng.' }, { status: 400 })
      }
    }

    await db.chapter.update({ where: { id }, data })
    await recalcSeriesWordCount(existing.seriesId)
    return NextResponse.json({ ok: true })
  } catch (e) {
    const msg = (e as Error).message
    if (msg === 'UNAUTHORIZED' || msg === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Bạn không có quyền quản trị.' }, { status: 403 })
    }
    if (msg.includes('Unique constraint')) {
      return NextResponse.json({ error: 'Số thứ tự chương đã tồn tại.' }, { status: 400 })
    }
    return NextResponse.json({ error: 'Cập nhật chương thất bại: ' + msg }, { status: 500 })
  }
}

// DELETE /api/chapters/[id]
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin()
    const { id } = await params
    const c = await db.chapter.findUnique({ where: { id }, select: { seriesId: true } })
    if (!c) return NextResponse.json({ error: 'Không tìm thấy chương.' }, { status: 404 })
    await db.chapter.delete({ where: { id } })
    await recalcSeriesWordCount(c.seriesId)
    return NextResponse.json({ ok: true })
  } catch (e) {
    const msg = (e as Error).message
    if (msg === 'UNAUTHORIZED' || msg === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Bạn không có quyền quản trị.' }, { status: 403 })
    }
    return NextResponse.json({ error: 'Xóa chương thất bại: ' + msg }, { status: 500 })
  }
}
