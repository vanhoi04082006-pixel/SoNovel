import { NextResponse } from 'next/server'
import { serverDb } from '@/lib/server-data'
import { getSessionUser } from '@/lib/session'

// GET /api/stats/challenge — weekly reading challenge (reset mỗi tuần)
export async function GET() {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ challenge: null })
  try {
    const now = new Date()
    const dayOfWeek = now.getDay()
    const daysFromMonday = (dayOfWeek + 6) % 7
    const weekStart = new Date(now)
    weekStart.setHours(0, 0, 0, 0)
    weekStart.setDate(weekStart.getDate() - daysFromMonday)

    const { data: progress, error } = await serverDb()
      .from('progress')
      .select('listen_char_index, listen_chapter_id, last_listened_at, audio_sec')
      .eq('user_id', user.id)
      .not('listen_chapter_id', 'is', null)
      .gte('last_listened_at', weekStart.toISOString())
    if (error) throw error

    const chaptersThisWeek = new Set((progress ?? []).filter((p: any) => p.listen_chapter_id).map((p: any) => p.listen_chapter_id)).size
    const listenSecThisWeek = (progress ?? []).reduce((sum: number, p: any) => sum + (p.audio_sec || Math.round((p.listen_char_index || 0) / 270 * 60)), 0)
    const listenMinThisWeek = Math.round(listenSecThisWeek / 60)
    const daysThisWeek = new Set(
      (progress ?? []).filter((p: any) => p.last_listened_at).map((p: any) => {
        const d = new Date(p.last_listened_at!)
        return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`
      })
    ).size

    const challenges = [
      { id: 'weekly-chapters', title: 'Nghe 3 chương', desc: 'Hoàn thành 3 chương trong tuần này', icon: '📖', goal: 3, progress: chaptersThisWeek, unit: 'chương', tier: 'bronze' },
      { id: 'weekly-minutes', title: 'Nghe 60 phút', desc: 'Nghe tổng cộng 60 phút trong tuần', icon: '⏰', goal: 60, progress: listenMinThisWeek, unit: 'phút', tier: 'silver' },
      { id: 'weekly-days', title: 'Nghe 5 ngày', desc: 'Nghe truyện 5 ngày trong tuần', icon: '🔥', goal: 5, progress: daysThisWeek, unit: 'ngày', tier: 'gold' },
    ]

    const mapped = challenges.map((c) => ({ ...c, unlocked: c.progress >= c.goal, progress: Math.min(c.progress, c.goal) }))
    const unlockedCount = mapped.filter((c) => c.unlocked).length
    const weekEnd = new Date(weekStart)
    weekEnd.setDate(weekEnd.getDate() + 7)

    return NextResponse.json({
      challenges: mapped,
      summary: {
        unlocked: unlockedCount,
        total: mapped.length,
        weekStart: weekStart.toISOString(),
        weekEnd: weekEnd.toISOString(),
        daysLeft: Math.ceil((weekEnd.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)),
      },
    })
  } catch (e) {
    return NextResponse.json({ error: 'Tải thử thách thất bại: ' + (e as Error).message }, { status: 500 })
  }
}
