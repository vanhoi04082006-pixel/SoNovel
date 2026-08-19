import { NextResponse } from 'next/server'
import { serverDb } from '@/lib/server-data'
import { getSessionUser } from '@/lib/session'

// GET /api/stats/history — listening time per day (last 14 days)
export async function GET() {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ items: [] })
  try {
    const { data: progress, error } = await serverDb()
      .from('progress')
      .select('last_listened_at, audio_sec, listen_char_index')
      .eq('user_id', user.id)
      .not('last_listened_at', 'is', null)
    if (error) throw error

    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const dayMap = new Map<string, number>()

    ;(progress ?? []).forEach((p: any) => {
      if (!p.last_listened_at) return
      const d = new Date(p.last_listened_at)
      d.setHours(0, 0, 0, 0)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      const sec = p.audio_sec || Math.round((p.listen_char_index || 0) / 270 * 60)
      dayMap.set(key, (dayMap.get(key) || 0) + sec)
    })

    const days: { date: string; seconds: number; label: string }[] = []
    for (let i = 13; i >= 0; i--) {
      const d = new Date(today)
      d.setDate(d.getDate() - i)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      days.push({ date: key, seconds: dayMap.get(key) || 0, label: `${d.getDate()}/${d.getMonth() + 1}` })
    }
    return NextResponse.json({ items: days })
  } catch (e) {
    return NextResponse.json({ error: 'Tải lịch sử thất bại: ' + (e as Error).message }, { status: 500 })
  }
}
