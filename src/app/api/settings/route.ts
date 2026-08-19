import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSessionUser } from '@/lib/session'

// GET /api/settings
export async function GET() {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ settings: null })
  const s = await db.userSettings.upsert({
    where: { userId: user.id },
    update: {},
    create: { userId: user.id },
  })
  return NextResponse.json({
    settings: {
      theme: s.theme,
      playbackSpeed: s.playbackSpeed,
      fontSize: s.fontSize,
      fontFamily: s.fontFamily,
      lineHeight: s.lineHeight,
      autoplayNext: s.autoplayNext,
    },
  })
}

// PUT /api/settings
export async function PUT(req: NextRequest) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ ok: true, skipped: true })
  const body = await req.json()
  const data: any = {}
  if (body.theme !== undefined) {
    const valid = ['light', 'dark', 'sepia', 'amoled']
    if (valid.includes(body.theme)) data.theme = body.theme
  }
  if (body.playbackSpeed !== undefined) data.playbackSpeed = Number(body.playbackSpeed) || 1.0
  if (body.fontSize !== undefined) data.fontSize = Math.min(32, Math.max(12, Number(body.fontSize) || 18))
  if (body.fontFamily !== undefined) data.fontFamily = String(body.fontFamily)
  if (body.lineHeight !== undefined) data.lineHeight = Number(body.lineHeight) || 1.7
  if (body.autoplayNext !== undefined) data.autoplayNext = !!body.autoplayNext
  await db.userSettings.upsert({
    where: { userId: user.id },
    update: data,
    create: { userId: user.id, ...data },
  })
  return NextResponse.json({ ok: true })
}
