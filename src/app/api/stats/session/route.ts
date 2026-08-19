import { NextRequest, NextResponse } from 'next/server'
import { serverDb } from '@/lib/server-data'
import { getSessionUser } from '@/lib/session'

// POST /api/stats/session — track listening session (actual seconds)
// Body: { seriesId, chapterId, durationSec } — accumulate into progress.audio_sec
export async function POST(req: NextRequest) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ ok: true, skipped: true })
  try {
    const { seriesId, chapterId, durationSec } = await req.json()
    if (!seriesId || !durationSec) return NextResponse.json({ error: 'Thiếu seriesId/durationSec.' }, { status: 400 })
    const dur = Math.max(1, Math.min(3600, Number(durationSec) || 1))
    const supabase = serverDb()

    const { data: existing } = await supabase
      .from('progress')
      .select('audio_sec')
      .eq('user_id', user.id)
      .eq('series_id', seriesId)
      .maybeSingle()

    const row: Record<string, any> = {
      user_id: user.id,
      series_id: seriesId,
      audio_sec: Number(existing?.audio_sec || 0) + dur,
      last_listened_at: new Date().toISOString(),
    }
    if (chapterId) row.listen_chapter_id = chapterId

    const { error } = await supabase.from('progress').upsert(row, { onConflict: 'user_id,series_id' })
    if (error) throw error
    return NextResponse.json({ ok: true, addedSec: dur })
  } catch (e) {
    return NextResponse.json({ error: 'Lưu session thất bại: ' + (e as Error).message }, { status: 500 })
  }
}
