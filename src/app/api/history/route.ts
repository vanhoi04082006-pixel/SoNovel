import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { parseArray } from '@/lib/sonovel'
import { getSessionUser } from '@/lib/session'

// GET /api/history — list user history (top 20)
export async function GET() {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ items: [] })
  const hist = await db.history.findMany({
    where: { userId: user.id },
    orderBy: { lastOpenedAt: 'desc' },
    take: 20,
    include: {
      series: {
        select: { id: true, title: true, author: true, coverUrl: true, status: true, genres: true, wordCount: true, updatedAt: true, _count: { select: { chapters: { where: { status: 'published' } } } } },
      },
    },
  })
  return NextResponse.json({
    items: hist.map((h) => ({
      id: h.series.id,
      title: h.series.title,
      author: h.series.author,
      coverUrl: h.series.coverUrl,
      status: h.series.status,
      genres: parseArray(h.series.genres),
      wordCount: h.series.wordCount,
      chapterCount: h.series._count.chapters,
      updatedAt: h.series.updatedAt,
      openedCount: h.openedCount,
      lastOpenedAt: h.lastOpenedAt,
    })),
  })
}

// POST /api/history — record open { seriesId }
export async function POST(req: NextRequest) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ ok: true, skipped: true }) // guest: no-op
  const { seriesId } = await req.json()
  if (!seriesId) return NextResponse.json({ error: 'Thiếu seriesId.' }, { status: 400 })
  const existing = await db.history.findUnique({ where: { userId_seriesId: { userId: user.id, seriesId } } })
  if (existing) {
    await db.history.update({
      where: { userId_seriesId: { userId: user.id, seriesId } },
      data: { openedCount: { increment: 1 }, lastOpenedAt: new Date() },
    })
  } else {
    await db.history.create({ data: { userId: user.id, seriesId } })
  }
  return NextResponse.json({ ok: true })
}
