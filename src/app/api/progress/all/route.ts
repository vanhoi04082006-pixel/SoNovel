import { NextResponse } from 'next/server'
import { serverDb } from '@/lib/server-data'
import { getSessionUser } from '@/lib/session'

// GET /api/progress/all — trả list progress của user (cho StoryCard hiển thị ring)
export async function GET() {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ items: [] })
  try {
    const supabase = serverDb()
    const { data: progress, error } = await supabase
      .from('progress')
      .select('series_id, listen_chapter_id, listen_char_index, last_listened_at')
      .eq('user_id', user.id)
    if (error) throw error

    const chapterIds = (progress ?? [])
      .map((p: any) => p.listen_chapter_id)
      .filter(Boolean) as string[]

    let wordCounts = new Map<string, number>()
    if (chapterIds.length) {
      const { data: chapters } = await supabase
        .from('chapters')
        .select('id, word_count')
        .in('id', chapterIds)
      wordCounts = new Map((chapters ?? []).map((c: any) => [c.id, c.word_count]))
    }

    const items = (progress ?? []).map((p: any) => {
      const total = (wordCounts.get(p.listen_chapter_id) || 1) * 5
      const percent = Math.min(100, Math.round((p.listen_char_index / total) * 100))
      return {
        seriesId: p.series_id,
        listenChapterId: p.listen_chapter_id,
        listenCharIndex: p.listen_char_index,
        percent,
        lastListenedAt: p.last_listened_at,
      }
    })
    return NextResponse.json({ items })
  } catch (e) {
    return NextResponse.json({ error: 'Tải tiến độ thất bại: ' + (e as Error).message }, { status: 500 })
  }
}
