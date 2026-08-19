import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
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
    await db.userSettings.upsert({
      where: { userId: user.id },
      update: {},
      create: { userId: user.id },
    })
    await db.progress.upsert({
      where: { userId_seriesId: { userId: user.id, seriesId } },
      update: {
        audioSec: { increment: dur },
        listenChapterId: chapterId || undefined,
        lastListenedAt: new Date(),
      },
      create: {
        userId: user.id,
        seriesId,
        listenChapterId: chapterId || null,
        audioSec: dur,
        lastListenedAt: new Date(),
      },
    })
    return NextResponse.json({ ok: true, addedSec: dur })
  } catch (e) {
    return NextResponse.json({ error: 'Lưu session thất bại: ' + (e as Error).message }, { status: 500 })
  }
}
