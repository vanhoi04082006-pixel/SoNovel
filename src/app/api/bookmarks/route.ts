import { NextRequest, NextResponse } from 'next/server'
import { serverDb } from '@/lib/server-data'
import { getSessionUser } from '@/lib/session'

// GET /api/bookmarks — list user bookmarks (join series)
export async function GET() {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ items: [] })
  try {
    const { data, error } = await serverDb()
      .from('bookmarks')
      .select('id, series_id, chapter_id, char_index, note, created_at, series(id, title, cover_url)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
    if (error) throw error

    return NextResponse.json({
      items: (data ?? []).map((b: any) => ({
        id: b.id,
        seriesId: b.series_id,
        chapterId: b.chapter_id,
        charIndex: b.char_index,
        note: b.note,
        createdAt: b.created_at,
        series: b.series
          ? { id: b.series.id, title: b.series.title, coverUrl: b.series.cover_url }
          : null,
      })),
    })
  } catch (e) {
    return NextResponse.json({ error: 'Tải đánh dấu thất bại: ' + (e as Error).message }, { status: 500 })
  }
}

// POST /api/bookmarks — create { seriesId, chapterId, charIndex, note? }
export async function POST(req: NextRequest) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Vui lòng đăng nhập.' }, { status: 401 })
  try {
    const { seriesId, chapterId, charIndex, note } = await req.json()
    if (!seriesId || !chapterId) return NextResponse.json({ error: 'Thiếu seriesId/chapterId.' }, { status: 400 })
    const { data, error } = await serverDb()
      .from('bookmarks')
      .insert({
        user_id: user.id,
        series_id: seriesId,
        chapter_id: chapterId,
        char_index: Number(charIndex) || 0,
        note: String(note || ''),
      })
      .select('id')
      .single()
    if (error) throw error
    return NextResponse.json({ ok: true, id: data.id })
  } catch (e) {
    return NextResponse.json({ error: 'Tạo đánh dấu thất bại: ' + (e as Error).message }, { status: 500 })
  }
}
