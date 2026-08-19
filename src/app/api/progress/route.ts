import { NextRequest, NextResponse } from 'next/server'
import { serverDb, mapProgress } from '@/lib/server-data'
import { getSessionUser } from '@/lib/session'

// GET /api/progress?series_id=xxx — get progress for a series (owner only)
export async function GET(req: NextRequest) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ progress: null })
  const { searchParams } = new URL(req.url)
  const seriesId = searchParams.get('series_id')
  if (!seriesId) return NextResponse.json({ error: 'Thiếu series_id.' }, { status: 400 })
  try {
    const { data, error } = await serverDb()
      .from('progress')
      .select('*')
      .eq('user_id', user.id)
      .eq('series_id', seriesId)
      .maybeSingle()
    if (error) throw error
    return NextResponse.json({ progress: mapProgress(data) })
  } catch (e) {
    return NextResponse.json({ error: 'Tải tiến độ thất bại: ' + (e as Error).message }, { status: 500 })
  }
}

// PUT /api/progress — upsert listen progress
export async function PUT(req: NextRequest) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ ok: true, skipped: true }) // guest: no-op
  try {
    const body = await req.json()
    const { seriesId, listenChapterId, listenCharIndex, playbackSpeed } = body
    if (!seriesId) return NextResponse.json({ error: 'Thiếu seriesId.' }, { status: 400 })

    const row: Record<string, any> = {
      user_id: user.id,
      series_id: seriesId,
      last_listened_at: new Date().toISOString(),
    }
    if (listenChapterId !== undefined) row.listen_chapter_id = listenChapterId || null
    if (listenCharIndex !== undefined) row.listen_char_index = Number(listenCharIndex) || 0
    if (playbackSpeed !== undefined) row.playback_speed = Number(playbackSpeed) || 1.0

    const { error } = await serverDb().from('progress').upsert(row, { onConflict: 'user_id,series_id' })
    if (error) throw error
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: 'Lưu tiến độ thất bại: ' + (e as Error).message }, { status: 500 })
  }
}
