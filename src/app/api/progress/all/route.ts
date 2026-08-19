import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSessionUser } from '@/lib/session'

// GET /api/progress/all — trả list progress của user (cho StoryCard hiển thị ring)
export async function GET() {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ items: [] })
  const progress = await db.progress.findMany({
    where: { userId: user.id },
    select: {
      seriesId: true,
      listenChapterId: true,
      listenCharIndex: true,
      lastListenedAt: true,
      listenChapter: { select: { wordCount: true } },
    },
  })
  const items = progress.map((p) => {
    const total = (p.listenChapter?.wordCount || 1) * 5
    const percent = Math.min(100, Math.round((p.listenCharIndex / total) * 100))
    return {
      seriesId: p.seriesId,
      listenChapterId: p.listenChapterId,
      listenCharIndex: p.listenCharIndex,
      percent,
      lastListenedAt: p.lastListenedAt,
    }
  })
  return NextResponse.json({ items })
}
