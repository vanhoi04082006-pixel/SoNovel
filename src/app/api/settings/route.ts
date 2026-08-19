import { NextRequest, NextResponse } from 'next/server'
import { serverDb } from '@/lib/server-data'
import { getSessionUser } from '@/lib/session'

// GET /api/settings
export async function GET() {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ settings: null })
  try {
    const { data: s, error } = await serverDb()
      .from('user_settings')
      .upsert({ user_id: user.id }, { onConflict: 'user_id' })
      .select('*')
      .single()
    if (error) throw error
    return NextResponse.json({
      settings: {
        theme: s.theme,
        playbackSpeed: Number(s.playback_speed),
        fontSize: s.font_size,
        fontFamily: s.font_family,
        lineHeight: Number(s.line_height),
        autoplayNext: s.autoplay_next,
      },
    })
  } catch (e) {
    return NextResponse.json({ error: 'Tải cài đặt thất bại: ' + (e as Error).message }, { status: 500 })
  }
}

// PUT /api/settings
export async function PUT(req: NextRequest) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ ok: true, skipped: true })
  const body = await req.json()
  const data: Record<string, any> = {}
  if (body.theme !== undefined) {
    const valid = ['light', 'dark', 'sepia', 'amoled']
    if (valid.includes(body.theme)) data.theme = body.theme
  }
  if (body.playbackSpeed !== undefined) data.playback_speed = Number(body.playbackSpeed) || 1.0
  if (body.fontSize !== undefined) data.font_size = Math.min(32, Math.max(12, Number(body.fontSize) || 18))
  if (body.fontFamily !== undefined) data.font_family = String(body.fontFamily)
  if (body.lineHeight !== undefined) data.line_height = Number(body.lineHeight) || 1.7
  if (body.autoplayNext !== undefined) data.autoplay_next = !!body.autoplayNext
  try {
    await serverDb().from('user_settings').upsert({ user_id: user.id, ...data }, { onConflict: 'user_id' })
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: 'Lưu cài đặt thất bại: ' + (e as Error).message }, { status: 500 })
  }
}
