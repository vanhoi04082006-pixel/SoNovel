import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { parseArray } from '@/lib/sonovel'

// GET /api/series — list with filters (public catalogue)
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const q = (searchParams.get('q') || '').trim()
  const genre = searchParams.get('genre') || ''
  const tag = searchParams.get('tag') || ''
  const status = searchParams.get('status') || 'published,completed'
  const sort = searchParams.get('sort') || 'new'
  const limit = Math.min(48, Math.max(1, Number(searchParams.get('limit') || 24)))
  const offset = Math.max(0, Number(searchParams.get('offset') || 0))

  const statuses = status.split(',').filter(Boolean)
  const where: any = { status: { in: statuses } }

  if (q) {
    where.OR = [
      { title: { contains: q } },
      { author: { contains: q } },
    ]
  }

  // genre/tag filter done in-memory (SQLite can't query JSON array easily)
  const all = await db.series.findMany({
    where,
    orderBy: sort === 'title' ? { title: 'asc' } : sort === 'chapters' ? { wordCount: 'desc' } : { updatedAt: 'desc' },
    include: { _count: { select: { chapters: { where: { status: 'published' } } } } },
  })

  let filtered = all
  if (genre) filtered = filtered.filter((s) => parseArray(s.genres).includes(genre))
  if (tag) filtered = filtered.filter((s) => parseArray(s.tags).includes(tag))

  const total = filtered.length
  const items = filtered.slice(offset, offset + limit).map((s) => ({
    id: s.id,
    title: s.title,
    author: s.author,
    description: s.description,
    coverUrl: s.coverUrl,
    status: s.status,
    genres: parseArray(s.genres),
    tags: parseArray(s.tags),
    wordCount: s.wordCount,
    chapterCount: s._count.chapters,
    createdAt: s.createdAt,
    updatedAt: s.updatedAt,
  }))

  return NextResponse.json({ items, total, offset, limit })
}
