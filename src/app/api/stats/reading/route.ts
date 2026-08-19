import { NextResponse } from 'next/server'
import { serverDb } from '@/lib/server-data'
import { getSessionUser } from '@/lib/session'

// GET /api/stats/reading — reading stats cho user hiện tại
export async function GET() {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ stats: null })
  try {
    const supabase = serverDb()

    const { data: progress, error } = await supabase
      .from('progress')
      .select('listen_chapter_id, listen_char_index, audio_sec, last_listened_at, series(*)')
      .eq('user_id', user.id)
      .not('listen_chapter_id', 'is', null)
      .order('last_listened_at', { ascending: false })
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

    const countOf = async (table: string, column: string) => {
      const { count, error } = await supabase.from(table).select('*', { count: 'exact', head: true }).eq(column, user.id)
      if (error) throw error
      return count ?? 0
    }
    const [favorites, history, bookmarks] = await Promise.all([
      countOf('favorites', 'user_id'),
      countOf('history', 'user_id'),
      countOf('bookmarks', 'user_id'),
    ])

    let totalListenSec = 0
    let chaptersCompleted = 0
    const seriesStats = (progress ?? []).map((p: any) => {
      const ch = chapters.get(p.listen_chapter_id)
      const chapterTotalChars = (ch?.word_count || 0) * 5
      const seriesTotalChars = (p.series?.word_count || 0)
      const sessionSec = p.audio_sec || Math.round((p.listen_char_index || 0) / 270 * 60)
      totalListenSec += sessionSec
      if (chapterTotalChars > 0 && (p.listen_char_index || 0) >= chapterTotalChars * 0.95) chaptersCompleted++
      const seriesPct = seriesTotalChars > 0
        ? Math.min(100, Math.round(((p.listen_char_index || 0) / seriesTotalChars) * 100))
        : 0
      return {
        seriesId: p.series.id,
        title: p.series.title,
        coverUrl: p.series.cover_url,
        totalChapters: null,
        listenChapterId: p.listen_chapter_id,
        listenChapterOrderNo: ch?.order_no,
        listenChapterTitle: ch?.title,
        listenCharIndex: p.listen_char_index,
        audioSec: sessionSec,
        percent: seriesPct,
        lastListenedAt: p.last_listened_at,
      }
    })

    return NextResponse.json({
      stats: {
        totalListenMin: Math.round(totalListenSec / 60),
        totalListenSec,
        chaptersCompleted,
        seriesFollowing: (progress ?? []).length,
        favoritesCount: favorites,
        historyCount: history,
        bookmarksCount: bookmarks,
        seriesStats: seriesStats.sort((a, b) => b.percent - a.percent),
      },
    })
  } catch (e) {
    return NextResponse.json({ error: 'Tải thống kê thất bại: ' + (e as Error).message }, { status: 500 })
  }
}
