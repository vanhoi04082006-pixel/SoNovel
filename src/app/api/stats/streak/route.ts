import { NextResponse } from 'next/server'
import { serverDb } from '@/lib/server-data'
import { getSessionUser } from '@/lib/session'

// GET /api/stats/streak — reading streak + 90-day heatmap
export async function GET() {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ stats: null })
  try {
    const { data: progress, error } = await serverDb()
      .from('progress')
      .select('last_listened_at')
      .eq('user_id', user.id)
      .not('last_listened_at', 'is', null)
    if (error) throw error

    const days = new Set<string>()
    ;(progress ?? []).forEach((p: any) => {
      if (p.last_listened_at) {
        const d = new Date(p.last_listened_at)
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
        days.add(key)
      }
    })

    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const heatmap: { date: string; listened: boolean }[] = []
    for (let i = 89; i >= 0; i--) {
      const d = new Date(today)
      d.setDate(d.getDate() - i)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      heatmap.push({ date: key, listened: days.has(key) })
    }

    const sortedDays = Array.from(days).sort()
    let longestStreak = 0
    let tempStreak = 0
    let prevDay: Date | null = null
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

    const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
    let currentStreak = 0
    if (days.has(todayKey)) {
      const cursor = new Date(today)
      currentStreak = 1
      while (true) {
        cursor.setDate(cursor.getDate() - 1)
        const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}-${String(cursor.getDate()).padStart(2, '0')}`
        if (days.has(key)) currentStreak++
        else break
      }
    }

    return NextResponse.json({
      stats: { currentStreak, longestStreak, totalDays: days.size, heatmap },
    })
  } catch (e) {
    return NextResponse.json({ error: 'Tải streak thất bại: ' + (e as Error).message }, { status: 500 })
  }
}
