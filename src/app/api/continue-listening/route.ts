import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { parseArray } from '@/lib/sonovel'
import { getSessionUser } from '@/lib/session'

// GET /api/continue-listening — top 5 listen progress for current user
export async function GET() {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ items: [] })
  const progress = await db.progress.findMany({
    where: { userId: user.id, listenChapterId: { not: null } },
    orderBy: { lastListenedAt: 'desc' },
    take: 5,
    include: {
      series: {
        select: { id: true, title: true, author: true, coverUrl: true, updatedAt: true, _count: { select: { chapters: { where: { status: 'published' } } } } },
      },
      listenChapter: { select: { id: true, orderNo: true, title: true, wordCount: true } },
    },
  })
  const items = progress
    .filter((p) => p.listenChapter && p.series)
    .map((p) => ({
      seriesId: p.series.id,
      title: p.series.title,
      coverUrl: p.series.coverUrl,
      chapterId: p.listenChapter!.id,
      chapterOrderNo: p.listenChapter!.orderNo,
      chapterTitle: p.listenChapter!.title,
      chapterWordCount: p.listenChapter!.wordCount,
      listenCharIndex: p.listenCharIndex,
      playbackSpeed: p.playbackSpeed,
      lastListenedAt: p.lastListenedAt,
      totalChapters: p.series._count.chapters,
    }))
  return NextResponse.json({ items })
}
