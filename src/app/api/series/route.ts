import { NextRequest, NextResponse } from 'next/server'
import { serverDb, mapSeries } from '@/lib/server-data'

// GET /api/series — list with filters (public catalogue)
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const q = (searchParams.get('q') || '').trim()
  const genre = searchParams.get('genre') || ''
  const tag = searchParams.get('tag') || ''
  const status = searchParams.get('status') || 'published,completed'
  const sort = searchParams.get('sort') || 'new'
  const limit = Math.min(48, Math.max(1, Number(searchParams.get('limit') || 24)))
  const offset = Math.max(0, Number(searchParams.get('offset') || 0))

  const statuses = status.split(',').filter(Boolean)

  try {
    const supabase = serverDb()
    let query = supabase
      .from('series')
      .select('*, chapters(count)', { count: 'exact' })
      .in('status', statuses)

    if (q) {
      query = query.or(`title.ilike.%${q}%,author.ilike.%${q}%`)
    }
    if (genre) {
      query = query.contains('genres', [genre])
    }
    if (tag) {
      query = query.contains('tags', [tag])
    }

    if (sort === 'title') query = query.order('title', { ascending: true })
    else if (sort === 'chapters') query = query.order('word_count', { ascending: false })
    else query = query.order('updated_at', { ascending: false })

    query = query.range(offset, offset + limit - 1)

    const { data, count, error } = await query
    if (error) throw error

    const items = (data ?? []).map((s: any) => mapSeries(s, s.chapters?.[0]?.count ?? 0))
    return NextResponse.json({ items, total: count ?? items.length, offset, limit })
  } catch (e) {
    return NextResponse.json({ error: 'Tải danh sách truyện thất bại: ' + (e as Error).message }, { status: 500 })
  }
}
