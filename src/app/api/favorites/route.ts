import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { parseArray } from '@/lib/sonovel'
import { getSessionUser } from '@/lib/session'

// GET /api/favorites — list user favorites
export async function GET() {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ items: [] })
  const favs = await db.favorite.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: 'desc' },
    include: {
      series: {
        select: { id: true, title: true, author: true, coverUrl: true, status: true, genres: true, tags: true, wordCount: true, updatedAt: true, _count: { select: { chapters: { where: { status: 'published' } } } } },
      },
    },
  })
  return NextResponse.json({
    items: favs.map((f) => ({
      id: f.series.id,
      title: f.series.title,
      author: f.series.author,
      coverUrl: f.series.coverUrl,
      status: f.series.status,
      genres: parseArray(f.series.genres),
      tags: parseArray(f.series.tags),
      wordCount: f.series.wordCount,
      chapterCount: f.series._count.chapters,
      updatedAt: f.series.updatedAt,
      favoritedAt: f.createdAt,
    })),
  })
}

// POST /api/favorites — toggle { seriesId }
export async function POST(req: NextRequest) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Vui lòng đăng nhập để dùng tính năng này.' }, { status: 401 })
  const { seriesId } = await req.json()
  if (!seriesId) return NextResponse.json({ error: 'Thiếu seriesId.' }, { status: 400 })
  const existing = await db.favorite.findUnique({ where: { userId_seriesId: { userId: user.id, seriesId } } })
  if (existing) {
    await db.favorite.delete({ where: { userId_seriesId: { userId: user.id, seriesId } } })
    return NextResponse.json({ ok: true, favorited: false })
  }
  await db.favorite.create({ data: { userId: user.id, seriesId } })
  return NextResponse.json({ ok: true, favorited: true })
}

// GET /api/favorites/check?series_id=xxx
export async function CHECK(req: NextRequest) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ favorited: false })
  const { searchParams } = new URL(req.url)
  const seriesId = searchParams.get('series_id')
  if (!seriesId) return NextResponse.json({ favorited: false })
  const f = await db.favorite.findUnique({ where: { userId_seriesId: { userId: user.id, seriesId } } })
  return NextResponse.json({ favorited: !!f })
}
