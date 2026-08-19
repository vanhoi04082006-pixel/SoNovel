import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSessionUser } from '@/lib/session'

// GET /api/stats/reading — reading stats cho user hiện tại
export async function GET() {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ stats: null })

  const [progress, favorites, history, bookmarks] = await Promise.all([
    db.progress.findMany({
      where: { userId: user.id, listenChapterId: { not: null } },
      include: {
        series: { select: { id: true, title: true, coverUrl: true, wordCount: true, _count: { select: { chapters: { where: { status: 'published' } } } } } },
        listenChapter: { select: { id: true, orderNo: true, title: true, wordCount: true } },
      },
      orderBy: { lastListenedAt: 'desc' },
    }),
    db.favorite.count({ where: { userId: user.id } }),
    db.history.count({ where: { userId: user.id } }),
    db.bookmark.count({ where: { userId: user.id } }),
  ])

  // Tổng thời gian nghe thực tế (phút) = sum(audioSec) / 60
  // Fallback to charIndex estimate if audioSec = 0
  let totalListenSec = 0
  let chaptersCompleted = 0
  const seriesStats = progress.map((p) => {
    const chapterTotalChars = (p.listenChapter?.wordCount || 0) * 5
    const seriesTotalChars = (p.series.wordCount || 0)
    // Use actual audioSec if > 0, else estimate from charIndex
    const sessionSec = p.audioSec || Math.round((p.listenCharIndex || 0) / 270 * 60)
    totalListenSec += sessionSec
    if (chapterTotalChars > 0 && (p.listenCharIndex || 0) >= chapterTotalChars * 0.95) {
      chaptersCompleted++
    }
    const seriesPct = seriesTotalChars > 0
      ? Math.min(100, Math.round(((p.listenCharIndex || 0) / seriesTotalChars) * 100))
      : 0
    return {
      seriesId: p.series.id,
      title: p.series.title,
      coverUrl: p.series.coverUrl,
      totalChapters: p.series._count.chapters,
      listenChapterId: p.listenChapterId,
      listenChapterOrderNo: p.listenChapter?.orderNo,
      listenChapterTitle: p.listenChapter?.title,
      listenCharIndex: p.listenCharIndex,
      audioSec: sessionSec,
      percent: seriesPct,
      lastListenedAt: p.lastListenedAt,
    }
  })

  return NextResponse.json({
    stats: {
      totalListenMin: Math.round(totalListenSec / 60),
      totalListenSec,
      chaptersCompleted,
      seriesFollowing: progress.length,
      favoritesCount: favorites,
      historyCount: history,
      bookmarksCount: bookmarks,
      seriesStats: seriesStats.sort((a, b) => (b.percent) - (a.percent)),
    },
  })
}
