import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSessionUser } from '@/lib/session'

// GET /api/progress?series_id=xxx — get progress for a series (owner only)
export async function GET(req: NextRequest) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ progress: null })
  const { searchParams } = new URL(req.url)
  const seriesId = searchParams.get('series_id')
  if (!seriesId) return NextResponse.json({ error: 'Thiếu series_id.' }, { status: 400 })
  const p = await db.progress.findUnique({
    where: { userId_seriesId: { userId: user.id, seriesId } },
  })
  return NextResponse.json({ progress: p })
}

// PUT /api/progress — upsert listen progress
export async function PUT(req: NextRequest) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ ok: true, skipped: true }) // guest: no-op
  try {
    const body = await req.json()
    const { seriesId, listenChapterId, listenCharIndex, playbackSpeed } = body
    if (!seriesId) return NextResponse.json({ error: 'Thiếu seriesId.' }, { status: 400 })

    // ensure user_settings exists (mirror §5.5 ensure_user_settings trigger)
    await db.userSettings.upsert({
      where: { userId: user.id },
      update: {},
      create: { userId: user.id },
    })

    const data: any = {
      lastListenedAt: new Date(),
    }
    if (listenChapterId !== undefined) data.listenChapterId = listenChapterId || null
    if (listenCharIndex !== undefined) data.listenCharIndex = Number(listenCharIndex) || 0
    if (playbackSpeed !== undefined) data.playbackSpeed = Number(playbackSpeed) || 1.0

    await db.progress.upsert({
      where: { userId_seriesId: { userId: user.id, seriesId } },
      update: data,
      create: {
        userId: user.id,
        seriesId,
        ...data,
      },
    })
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: 'Lưu tiến độ thất bại: ' + (e as Error).message }, { status: 500 })
  }
}
