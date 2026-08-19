import { NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/session'

// GET /api/settings/goal — get default weekly goal (actual storage client-side localStorage)
export async function GET() {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ goal: null })
  return NextResponse.json({
    goal: {
      weeklyChapters: 3,
      weeklyMinutes: 60,
      weeklyDays: 5,
    },
  })
}
