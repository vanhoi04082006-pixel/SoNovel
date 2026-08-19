import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { chapterWordCount, recalcSeriesWordCount } from '@/lib/sonovel'
import { requireAdmin } from '@/lib/session'

// GET /api/series/[id]/chapters — all chapters (admin: includes draft)
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { searchParams } = new URL(req.url)
  const includeDraft = searchParams.get('all') === '1'
  const q = (searchParams.get('q') || '').trim().toLowerCase()

  const where: any = { seriesId: id }
  if (!includeDraft) where.status = 'published'

  let chapters = await db.chapter.findMany({
    where,
    orderBy: { orderNo: 'asc' },
    select: { id: true, orderNo: true, title: true, content: true, status: true, wordCount: true, publishedAt: true, createdAt: true },
  })

  if (q) {
    chapters = chapters.filter((c) => c.title.toLowerCase().includes(q) || String(c.orderNo) === q)
  }

  return NextResponse.json({
    items: chapters.map((c) => ({
      id: c.id,
      orderNo: c.orderNo,
      title: c.title,
      content: c.content,
      status: c.status,
      wordCount: c.wordCount,
      publishedAt: c.publishedAt,
      createdAt: c.createdAt,
    })),
  })
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
    const c = await db.chapter.create({
      data: {
        seriesId: id,
        orderNo: Number(orderNo),
        title: String(title).trim(),
        content: String(content || ''),
        status: chapStatus,
        wordCount: chapterWordCount(String(content || '')),
        publishedAt: chapStatus === 'published' ? new Date() : null,
      },
    })
    await recalcSeriesWordCount(id)
    return NextResponse.json({ ok: true, id: c.id })
  } catch (e) {
    const msg = (e as Error).message
    if (msg === 'UNAUTHORIZED' || msg === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Bạn không có quyền quản trị.' }, { status: 403 })
    }
    if (msg.includes('Unique constraint')) {
      return NextResponse.json({ error: 'Số thứ tự chương đã tồn tại.' }, { status: 400 })
    }
    return NextResponse.json({ error: 'Tạo chương thất bại: ' + msg }, { status: 500 })
  }
}
