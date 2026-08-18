import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSessionUser } from '@/lib/session'

// GET /api/stats/achievements — reading achievements/badges
export async function GET() {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ achievements: [] })

  const [progress, favorites, history, bookmarks] = await Promise.all([
    db.progress.findMany({
      where: { userId: user.id, listenChapterId: { not: null } },
      select: { listenCharIndex: true, lastListenedAt: true, listenChapter: { select: { wordCount: true } } },
    }),
    db.favorite.count({ where: { userId: user.id } }),
    db.history.count({ where: { userId: user.id } }),
    db.bookmark.count({ where: { userId: user.id } }),
  ])

  let totalListenMin = 0
  let chaptersCompleted = 0
  const days = new Set<string>()

  progress.forEach((p) => {
    totalListenMin += Math.round((p.listenCharIndex || 0) / 270)
    const wc = (p.listenChapter?.wordCount || 0) * 5
    if (wc > 0 && (p.listenCharIndex || 0) >= wc * 0.95) chaptersCompleted++
    if (p.lastListenedAt) {
      const d = new Date(p.lastListenedAt)
      const key = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`
      days.add(key)
    }
  })

  const totalDays = days.size
  const seriesCount = progress.length

  // Define all achievements
  type Achievement = {
    id: string
    title: string
    desc: string
    icon: string
    goal: number
    progress: number
    unlocked: boolean
    tier?: string
  }

  const all: Achievement[] = [
    // Listening time
    { id: 'listen-30', title: 'Người nghe kiên nhẫn', desc: 'Nghe 30 phút tổng cộng', icon: '🎧', goal: 30, progress: totalListenMin, tier: 'bronze' },
    { id: 'listen-300', title: 'Người nghe mẫn cán', desc: 'Nghe 5 giờ tổng cộng', icon: '⏰', goal: 300, progress: totalListenMin, tier: 'silver' },
    { id: 'listen-3000', title: 'Bậc thầy nghe truyện', desc: 'Nghe 50 giờ tổng cộng', icon: '🏆', goal: 3000, progress: totalListenMin, tier: 'gold' },
    // Chapters completed
    { id: 'chap-1', title: 'Chương đầu tiên', desc: 'Hoàn thành 1 chương', icon: '📖', goal: 1, progress: chaptersCompleted, tier: 'bronze' },
    { id: 'chap-10', title: 'Đạo hữu', desc: 'Hoàn thành 10 chương', icon: '📚', goal: 10, progress: chaptersCompleted, tier: 'silver' },
    { id: 'chap-100', title: 'Thư linh', desc: 'Hoàn thành 100 chương', icon: '💯', goal: 100, progress: chaptersCompleted, tier: 'gold' },
    // Streak
    { id: 'streak-7', title: 'Tuần liên tục', desc: 'Nghe 7 ngày liên tiếp', icon: '🔥', goal: 7, progress: totalDays >= 7 ? 7 : totalDays, tier: 'bronze' },
    { id: 'streak-30', title: 'Tháng liên tục', desc: 'Nghe 30 ngày liên tiếp', icon: '☄️', goal: 30, progress: totalDays >= 30 ? 30 : totalDays, tier: 'silver' },
    // Series following
    { id: 'series-5', title: 'Đa tượng', desc: 'Theo dõi 5 truyện', icon: '🌟', goal: 5, progress: seriesCount, tier: 'bronze' },
    { id: 'series-20', title: 'Bao quát', desc: 'Theo dõi 20 truyện', icon: '✨', goal: 20, progress: seriesCount, tier: 'silver' },
    // Favorites
    { id: 'fav-5', title: 'Sưu tập', desc: 'Yêu thích 5 truyện', icon: '❤️', goal: 5, progress: favorites, tier: 'bronze' },
    // Bookmarks
    { id: 'bm-10', title: 'Người sưu tầm', desc: 'Đánh dấu 10 vị trí', icon: '🔖', goal: 10, progress: bookmarks, tier: 'bronze' },
  ]

  const achievements = all.map((a) => ({
    ...a,
    unlocked: a.progress >= a.goal,
    progress: Math.min(a.progress, a.goal),
  }))

  const unlockedCount = achievements.filter((a) => a.unlocked).length
  const totalProgress = totalListenMin > 0 || chaptersCompleted > 0
    ? Math.round((unlockedCount / achievements.length) * 100)
    : 0

  return NextResponse.json({
    achievements,
    summary: {
      unlocked: unlockedCount,
      total: achievements.length,
      progress: totalProgress,
    },
  })
}
