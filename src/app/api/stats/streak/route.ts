import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSessionUser } from '@/lib/session'

// GET /api/stats/streak — reading streak + 30-day heatmap
export async function GET() {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ stats: null })

  const progress = await db.progress.findMany({
    where: { userId: user.id, lastListenedAt: { not: null } },
    select: { lastListenedAt: true },
  })

  // Collect all unique listening days (ISO date strings)
  const days = new Set<string>()
  progress.forEach((p) => {
    if (p.lastListenedAt) {
      const d = new Date(p.lastListenedAt)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      days.add(key)
    }
  })

  // Build last 90 days heatmap (GitHub-style: 13 weeks × 7 days)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const heatmap: { date: string; listened: boolean }[] = []
  for (let i = 89; i >= 0; i--) {
    const d = new Date(today)
    d.setDate(d.getDate() - i)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    heatmap.push({ date: key, listened: days.has(key) })
  }

  // Compute current streak + longest streak
  const sortedDays = Array.from(days).sort()
  let currentStreak = 0
  let longestStreak = 0
  let tempStreak = 0
  let prevDay: Date | null = null

  // longest streak
  for (const day of sortedDays) {
    const d = new Date(day)
    d.setHours(0, 0, 0, 0)
    if (prevDay) {
      const diff = Math.round((d.getTime() - prevDay.getTime()) / (24 * 60 * 60 * 1000))
      if (diff === 1) tempStreak++
      else tempStreak = 1
    } else {
      tempStreak = 1
    }
    if (tempStreak > longestStreak) longestStreak = tempStreak
    prevDay = d
  }

  // current streak — count backward from today
  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
  if (days.has(todayKey)) {
    let cursor = new Date(today)
    currentStreak = 1
    while (true) {
      cursor.setDate(cursor.getDate() - 1)
      const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}-${String(cursor.getDate()).padStart(2, '0')}`
      if (days.has(key)) currentStreak++
      else break
    }
  }

  const totalDays = days.size

  return NextResponse.json({
    stats: {
      currentStreak,
      longestStreak,
      totalDays,
      heatmap,
    },
  })
}
