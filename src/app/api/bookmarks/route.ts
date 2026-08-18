import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSessionUser } from '@/lib/session'

// GET /api/bookmarks — list user bookmarks (join series + chapter)
export async function GET() {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ items: [] })
  const bms = await db.bookmark.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: 'desc' },
    include: {
      series: { select: { id: true, title: true, coverUrl: true } },
    },
  })
  return NextResponse.json({
    items: bms.map((b) => ({
      id: b.id,
      seriesId: b.seriesId,
      chapterId: b.chapterId,
      charIndex: b.charIndex,
      note: b.note,
      createdAt: b.createdAt,
      series: b.series,
    })),
  })
}

// POST /api/bookmarks — create { seriesId, chapterId, charIndex, note? }
export async function POST(req: NextRequest) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Vui lòng đăng nhập.' }, { status: 401 })
  try {
    const { seriesId, chapterId, charIndex, note } = await req.json()
    if (!seriesId || !chapterId) return NextResponse.json({ error: 'Thiếu seriesId/chapterId.' }, { status: 400 })
    const bm = await db.bookmark.create({
      data: {
        userId: user.id,
        seriesId,
        chapterId,
        charIndex: Number(charIndex) || 0,
        note: String(note || ''),
      },
    })
    return NextResponse.json({ ok: true, id: bm.id })
  } catch (e) {
    return NextResponse.json({ error: 'Tạo đánh dấu thất bại: ' + (e as Error).message }, { status: 500 })
  }
}
