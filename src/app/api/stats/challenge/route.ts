import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSessionUser } from '@/lib/session'

// GET /api/stats/challenge — weekly reading challenge (reset mỗi tuần)
export async function GET() {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ challenge: null })

  // Week starts Monday, ends Sunday
  const now = new Date()
  const dayOfWeek = now.getDay() // 0=Sun, 1=Mon...
  const daysFromMonday = (dayOfWeek + 6) % 7 // Mon=0, Sun=6
  const weekStart = new Date(now)
  weekStart.setHours(0, 0, 0, 0)
  weekStart.setDate(weekStart.getDate() - daysFromMonday)

  const progress = await db.progress.findMany({
    where: {
      userId: user.id,
      listenChapterId: { not: null },
      lastListenedAt: { gte: weekStart },
    },
    select: { listenCharIndex: true, listenChapterId: true, lastListenedAt: true },
  })

  // Chapters listened this week (distinct)
  const chaptersThisWeek = new Set(progress.filter(p => p.listenChapterId).map(p => p.listenChapterId)).size
  // Total listen minutes this week (sum of charIndex/270)
  const listenMinThisWeek = progress.reduce((sum, p) => sum + Math.round((p.listenCharIndex || 0) / 270), 0)
  // Days listened this week
  const daysThisWeek = new Set(
    progress
      .filter(p => p.lastListenedAt)
      .map(p => {
        const d = new Date(p.lastListenedAt!)
        return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`
      })
  ).size

  // Define weekly challenges (3 tiers)
  const challenges = [
    {
      id: 'weekly-chapters',
      title: 'Nghe 3 chương',
      desc: 'Hoàn thành 3 chương trong tuần này',
      icon: '📖',
      goal: 3,
      progress: chaptersThisWeek,
      unit: 'chương',
      tier: 'bronze',
    },
    {
      id: 'weekly-minutes',
      title: 'Nghe 60 phút',
      desc: 'Nghe tổng cộng 60 phút trong tuần',
      icon: '⏰',
      goal: 60,
      progress: listenMinThisWeek,
      unit: 'phút',
      tier: 'silver',
    },
    {
      id: 'weekly-days',
      title: 'Nghe 5 ngày',
      desc: 'Nghe truyện 5 ngày trong tuần',
      icon: '🔥',
      goal: 5,
      progress: daysThisWeek,
      unit: 'ngày',
      tier: 'gold',
    },
  ]

  const mapped = challenges.map(c => ({
    ...c,
    unlocked: c.progress >= c.goal,
    progress: Math.min(c.progress, c.goal),
  }))

  const unlockedCount = mapped.filter(c => c.unlocked).length
  // Week end (Sunday 23:59)
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
}
