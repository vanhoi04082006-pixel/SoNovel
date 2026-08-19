import { NextRequest, NextResponse } from 'next/server'
import { serverDb } from '@/lib/server-data'
import { getSessionUser } from '@/lib/session'

// GET /api/favorites — list user favorites
export async function GET() {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ items: [] })
  try {
    const supabase = serverDb()
    const { data, error } = await supabase
      .from('favorites')
      .select('created_at, series(*)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
    if (error) throw error

    return NextResponse.json({
      items: (data ?? []).map((f: any) => {
        const s = f.series
        return {
          id: s.id,
          title: s.title,
          author: s.author,
          coverUrl: s.cover_url,
          status: s.status,
          genres: s.genres ?? [],
          tags: s.tags ?? [],
          wordCount: s.word_count,
          chapterCount: null,
          updatedAt: s.updated_at,
          favoritedAt: f.created_at,
        }
      }),
    })
  } catch (e) {
    return NextResponse.json({ error: 'Tải yêu thích thất bại: ' + (e as Error).message }, { status: 500 })
  }
}

// POST /api/favorites — toggle { seriesId }
export async function POST(req: NextRequest) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Vui lòng đăng nhập để dùng tính năng này.' }, { status: 401 })
  const { seriesId } = await req.json()
  if (!seriesId) return NextResponse.json({ error: 'Thiếu seriesId.' }, { status: 400 })
  try {
    const supabase = serverDb()
    const { data: existing } = await supabase
      .from('favorites')
      .select('series_id')
      .eq('user_id', user.id)
      .eq('series_id', seriesId)
      .maybeSingle()
    if (existing) {
      await supabase.from('favorites').delete().eq('user_id', user.id).eq('series_id', seriesId)
      return NextResponse.json({ ok: true, favorited: false })
    }
    await supabase.from('favorites').insert({ user_id: user.id, series_id: seriesId })
    return NextResponse.json({ ok: true, favorited: true })
  } catch (e) {
    return NextResponse.json({ error: 'Cập nhật yêu thích thất bại: ' + (e as Error).message }, { status: 500 })
  }
}
