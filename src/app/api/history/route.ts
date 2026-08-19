import { NextRequest, NextResponse } from 'next/server'
import { serverDb } from '@/lib/server-data'
import { getSessionUser } from '@/lib/session'

// GET /api/history — list user history (top 20)
export async function GET() {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ items: [] })
  try {
    const { data, error } = await serverDb()
      .from('history')
      .select('opened_count, last_opened_at, series(*)')
      .eq('user_id', user.id)
      .order('last_opened_at', { ascending: false })
      .limit(20)
    if (error) throw error

    return NextResponse.json({
      items: (data ?? []).map((h: any) => {
        const s = h.series
        return {
          id: s.id,
          title: s.title,
          author: s.author,
          coverUrl: s.cover_url,
          status: s.status,
          genres: s.genres ?? [],
          wordCount: s.word_count,
          chapterCount: null,
          updatedAt: s.updated_at,
          openedCount: h.opened_count,
          lastOpenedAt: h.last_opened_at,
        }
      }),
    })
  } catch (e) {
    return NextResponse.json({ error: 'Tải lịch sử thất bại: ' + (e as Error).message }, { status: 500 })
  }
}

// POST /api/history — record open { seriesId }
export async function POST(req: NextRequest) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ ok: true, skipped: true }) // guest: no-op
  const { seriesId } = await req.json()
  if (!seriesId) return NextResponse.json({ error: 'Thiếu seriesId.' }, { status: 400 })
  try {
    const supabase = serverDb()
    const now = new Date().toISOString()
    const { data: existing } = await supabase
      .from('history')
      .select('opened_count')
      .eq('user_id', user.id)
      .eq('series_id', seriesId)
      .maybeSingle()
    if (existing) {
      await supabase
        .from('history')
        .update({ opened_count: (existing.opened_count ?? 1) + 1, last_opened_at: now })
        .eq('user_id', user.id)
        .eq('series_id', seriesId)
    } else {
      await supabase.from('history').insert({ user_id: user.id, series_id: seriesId, opened_count: 1, last_opened_at: now })
    }
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: 'Ghi lịch sử thất bại: ' + (e as Error).message }, { status: 500 })
  }
}
