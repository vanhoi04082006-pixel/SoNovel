import { NextResponse } from 'next/server'
import { serverDb } from '@/lib/server-data'
import { getSessionUser } from '@/lib/session'

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

// GET /api/stats/achievements — reading achievements/badges
export async function GET() {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ achievements: [] })
  try {
    const supabase = serverDb()

    const { data: progress, error } = await supabase
      .from('progress')
      .select('listen_char_index, listen_chapter_id, last_listened_at, audio_sec')
      .eq('user_id', user.id)
      .not('listen_chapter_id', 'is', null)
    if (error) throw error

    const chapterIds = (progress ?? []).map((p: any) => p.listen_chapter_id).filter(Boolean) as string[]
    let wordCounts = new Map<string, number>()
    if (chapterIds.length) {
      const { data: chs } = await supabase.from('chapters').select('id, word_count').in('id', chapterIds)
      wordCounts = new Map((chs ?? []).map((c: any) => [c.id, c.word_count]))
    }

    const countOf = async (table: string) => {
      const { count, error } = await supabase.from(table).select('*', { count: 'exact', head: true }).eq('user_id', user.id)
      if (error) throw error
      return count ?? 0
    }
    const [favorites, history, bookmarks] = await Promise.all([
      countOf('favorites'),
      countOf('history'),
      countOf('bookmarks'),
    ])

    let totalListenSec = 0
    let chaptersCompleted = 0
    const days = new Set<string>()

    ;(progress ?? []).forEach((p: any) => {
      totalListenSec += p.audio_sec || Math.round((p.listen_char_index || 0) / 270 * 60)
      const wc = (wordCounts.get(p.listen_chapter_id) || 0) * 5
      if (wc > 0 && (p.listen_char_index || 0) >= wc * 0.95) chaptersCompleted++
      if (p.last_listened_at) {
        const d = new Date(p.last_listened_at)
        days.add(`${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`)
      }
    })

    const totalListenMin = Math.round(totalListenSec / 60)
    const totalDays = days.size
    const seriesCount = (progress ?? []).length

    const defs: Array<Omit<Achievement, 'unlocked'>> = [
      { id: 'listen-30', title: 'Người nghe kiên nhẫn', desc: 'Nghe 30 phút tổng cộng', icon: '🎧', goal: 30, progress: totalListenMin, tier: 'bronze' },
      { id: 'listen-300', title: 'Người nghe mẫn cán', desc: 'Nghe 5 giờ tổng cộng', icon: '⏰', goal: 300, progress: totalListenMin, tier: 'silver' },
      { id: 'listen-3000', title: 'Bậc thầy nghe truyện', desc: 'Nghe 50 giờ tổng cộng', icon: '🏆', goal: 3000, progress: totalListenMin, tier: 'gold' },
      { id: 'chap-1', title: 'Chương đầu tiên', desc: 'Hoàn thành 1 chương', icon: '📖', goal: 1, progress: chaptersCompleted, tier: 'bronze' },
      { id: 'chap-10', title: 'Đạo hữu', desc: 'Hoàn thành 10 chương', icon: '📚', goal: 10, progress: chaptersCompleted, tier: 'silver' },
      { id: 'chap-100', title: 'Thư linh', desc: 'Hoàn thành 100 chương', icon: '💯', goal: 100, progress: chaptersCompleted, tier: 'gold' },
      { id: 'streak-7', title: 'Tuần liên tục', desc: 'Nghe 7 ngày liên tiếp', icon: '🔥', goal: 7, progress: totalDays >= 7 ? 7 : totalDays, tier: 'bronze' },
      { id: 'streak-30', title: 'Tháng liên tục', desc: 'Nghe 30 ngày liên tiếp', icon: '☄️', goal: 30, progress: totalDays >= 30 ? 30 : totalDays, tier: 'silver' },
      { id: 'series-5', title: 'Đa tượng', desc: 'Theo dõi 5 truyện', icon: '🌟', goal: 5, progress: seriesCount, tier: 'bronze' },
      { id: 'series-20', title: 'Bao quát', desc: 'Theo dõi 20 truyện', icon: '✨', goal: 20, progress: seriesCount, tier: 'silver' },
      { id: 'fav-5', title: 'Sưu tập', desc: 'Yêu thích 5 truyện', icon: '❤️', goal: 5, progress: favorites, tier: 'bronze' },
      { id: 'bm-10', title: 'Người sưu tầm', desc: 'Đánh dấu 10 vị trí', icon: '🔖', goal: 10, progress: bookmarks, tier: 'bronze' },
    ]

    const achievements: Achievement[] = defs.map((a) => ({
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
      summary: { unlocked: unlockedCount, total: achievements.length, progress: totalProgress },
    })
  } catch (e) {
    return NextResponse.json({ error: 'Tải thành tích thất bại: ' + (e as Error).message }, { status: 500 })
  }
}
