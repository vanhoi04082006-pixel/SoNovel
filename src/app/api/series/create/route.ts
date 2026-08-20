import { NextRequest, NextResponse } from 'next/server'
import { serverDb } from '@/lib/server-data'
import { requireAdmin } from '@/lib/session'

// POST /api/series/create — admin create new series
export async function POST(req: NextRequest) {
  try {
    await requireAdmin()
    const body = await req.json()
    const { title, author, description, coverUrl, status, genres, tags } = body

    if (!title || !String(title).trim()) {
      return NextResponse.json({ error: 'Tên truyện là bắt buộc.' }, { status: 400 })
    }

    const valid = ['draft', 'published', 'completed', 'hidden']
    const seriesStatus = valid.includes(status) ? status : 'published'

    const seriesGenres = Array.isArray(genres)
      ? genres
      : String(genres || '').split(',').map((x: string) => x.trim()).filter(Boolean)

    const seriesTags = Array.isArray(tags)
      ? tags
      : String(tags || '').split(',').map((x: string) => x.trim()).filter(Boolean)

    const { data, error } = await serverDb()
      .from('series')
      .insert({
        title: String(title).trim(),
        author: String(author || '').trim(),
        description: String(description || '').trim(),
        cover_url: String(coverUrl || '').trim(),
        status: seriesStatus,
        genres: seriesGenres,
        tags: seriesTags,
      })
      .select('id')
      .single()

    if (error) throw error

    return NextResponse.json({ ok: true, series: { id: data.id } })
  } catch (e) {
    const msg = (e as Error).message
    if (msg === 'UNAUTHORIZED' || msg === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Bạn không có quyền quản trị.' }, { status: 403 })
    }
    return NextResponse.json({ error: 'Tạo truyện thất bại: ' + msg }, { status: 500 })
  }
}
