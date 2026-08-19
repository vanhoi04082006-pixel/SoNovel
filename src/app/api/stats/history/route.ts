import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSessionUser } from '@/lib/session'

// GET /api/stats/history — listening time per day (last N days)
export async function GET() {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ items: [] })

  const progress = await db.progress.findMany({
    where: { userId: user.id, lastListenedAt: { not: null } },
    select: { lastListenedAt: true, audioSec: true, listenCharIndex: true },
  })

  // Group by day (last 14 days)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const days: { date: string; seconds: number; label: string }[] = []
  const dayMap = new Map<string, number>()

  // Sum seconds per day from all progress entries (use audioSec if > 0, else estimate)
  // Note: progress.audioSec is cumulative, not per-day. We approximate by distributing
  // audioSec across lastListenedAt day (rough but OK for visualization).
  progress.forEach((p) => {
    if (!p.lastListenedAt) return
    const d = new Date(p.lastListenedAt)
    d.setHours(0, 0, 0, 0)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    const sec = p.audioSec || Math.round((p.listenCharIndex || 0) / 270 * 60)
    // Distribute: assume all audioSec happened on lastListenedAt day (rough)
    dayMap.set(key, (dayMap.get(key) || 0) + sec)
  })

  // Build last 14 days array
  for (let i = 13; i >= 0; i--) {
    const d = new Date(today)
    d.setDate(d.getDate() - i)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    const dayLabel = `${d.getDate()}/${d.getMonth() + 1}`
    days.push({
      date: key,
      seconds: dayMap.get(key) || 0,
      label: dayLabel,
    })
  }

  return NextResponse.json({ items: days })
}
