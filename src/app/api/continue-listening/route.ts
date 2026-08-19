import { NextResponse } from 'next/server'
import { serverDb } from '@/lib/server-data'
import { getSessionUser } from '@/lib/session'

// GET /api/continue-listening — top 5 listen progress for current user
export async function GET() {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ items: [] })
  try {
    const supabase = serverDb()
    const { data: progress, error } = await supabase
      .from('progress')
      .select('listen_chapter_id, listen_char_index, playback_speed, last_listened_at, series(*)')
      .eq('user_id', user.id)
      .not('listen_chapter_id', 'is', null)
      .order('last_listened_at', { ascending: false })
      .limit(5)
    if (error) throw error

    const chapterIds = (progress ?? []).map((p: any) => p.listen_chapter_id).filter(Boolean) as string[]
    let chapters = new Map<string, any>()
    if (chapterIds.length) {
      const { data: chs } = await supabase
        .from('chapters')
        .select('id, order_no, title, word_count')
        .in('id', chapterIds)
      chapters = new Map((chs ?? []).map((c: any) => [c.id, c]))
    }

    const items = (progress ?? [])
      .filter((p: any) => p.series && chapters.has(p.listen_chapter_id))
      .map((p: any) => {
        const s = p.series
        const ch = chapters.get(p.listen_chapter_id)
        return {
          seriesId: s.id,
          title: s.title,
          coverUrl: s.cover_url,
          chapterId: ch.id,
          chapterOrderNo: ch.order_no,
          chapterTitle: ch.title,
          chapterWordCount: ch.word_count,
          listenCharIndex: p.listen_char_index,
          playbackSpeed: p.playback_speed,
          lastListenedAt: p.last_listened_at,
          totalChapters: null,
        }
      })
    return NextResponse.json({ items })
  } catch (e) {
    return NextResponse.json({ error: 'Tải tiếp tục nghe thất bại: ' + (e as Error).message }, { status: 500 })
  }
}
