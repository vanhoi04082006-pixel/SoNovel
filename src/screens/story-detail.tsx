'use client'

import { useEffect, useState, useCallback } from 'react'
import { Heart, Share2, Play, Headphones, ChevronLeft, BookOpen, Search as SearchIcon, Volume2, Bookmark } from 'lucide-react'
import { useAppStore } from '@/store/use-app-store'
import { api, type SeriesDetail, type ChapterItem } from '@/lib/api-client'
import { CoverImage } from '@/components/sonovel/cover-image'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Progress } from '@/components/ui/progress'
import { toast } from 'sonner'
import { usePlayerStore, type PlayerChapter } from '@/store/use-player-store'
import { estMinutes, formatCharCount } from '@/lib/format'

export function StoryDetailScreen() {
  const { view, navigate, user, refreshUser, syncVersion } = useAppStore()
  const seriesId = view.view === 'story' ? view.seriesId : ''
  const [detail, setDetail] = useState<SeriesDetail | null>(null)
  const [progress, setProgress] = useState<any>(null)
  const [favorited, setFavorited] = useState(false)
  const [loading, setLoading] = useState(true)
  const [chapterFilter, setChapterFilter] = useState('')
  const playChapter = usePlayerStore((s) => s.playChapter)
  const setPlayerActive = useAppStore((s) => s.setPlayerActive)

  const load = useCallback(async () => {
    if (!seriesId) return
    setLoading(true)
    try {
      const [d, p] = await Promise.all([
        api.getSeries(seriesId),
        user ? api.getProgress(seriesId) : Promise.resolve({ progress: null }),
      ])
      setDetail(d)
      setProgress(p.progress)
      if (user) {
        const favs = await api.listFavorites()
        setFavorited(favs.items.some((s) => s.id === seriesId))
      }
      if (user) {
        api.recordHistory(seriesId).catch(() => {})
      }
      // Prefetch chapter content into the client cache so playback starts instantly:
      // the first few chapters + the chapter right after the current listening position.
      const startIdx = Math.max(0, d.chapters.findIndex((c) => c.id === p.progress?.listenChapterId))
      const ids = new Set<string>()
      for (let i = 0; i < Math.min(5, d.chapters.length); i++) ids.add(d.chapters[i].id)
      if (d.chapters[startIdx + 1]) ids.add(d.chapters[startIdx + 1].id)
      ids.forEach((cid) => api.getChapter(cid).catch(() => {}))
    } catch {
      toast.error('Không tải được truyện.')
    } finally {
      setLoading(false)
    }
  }, [seriesId, user, syncVersion])

  useEffect(() => { load() }, [load])

  const chapters = detail?.chapters || []
  const filteredChapters = chapterFilter
    ? chapters.filter((c) => c.title.toLowerCase().includes(chapterFilter.toLowerCase()) || String(c.orderNo) === chapterFilter)
    : chapters

  const listenChapterId = progress?.listenChapterId
  const listenCharIndex = progress?.listenCharIndex || 0
  const currentPlayingChapterId = usePlayerStore((s) => s.seriesId === seriesId ? s.chapters[s.currentIndex]?.id : null)
  const currentPlayingChar = usePlayerStore((s) => s.seriesId === seriesId ? s.currentChar : 0)

  const startPlay = async (index: number, startChar = 0) => {
    if (!detail) return
    // Fetch only the target chapter's content so playback starts immediately;
    // the rest are lazy-loaded by the player store on demand.
    const target = detail.chapters[index]
    let targetContent = ''
    if (target) {
      try {
        const full = await api.getChapter(target.id)
        targetContent = full.content || ''
      } catch {}
    }
    const chaptersWithContent: PlayerChapter[] = detail.chapters.map((c) => ({
      id: c.id,
      orderNo: c.orderNo,
      title: c.title,
      content: c.id === target?.id ? targetContent : '',
      wordCount: c.wordCount,
    }))
    playChapter({
      seriesId: detail.id,
      seriesTitle: detail.title,
      coverUrl: detail.coverUrl,
      chapters: chaptersWithContent,
      index,
      startChar,
    })
    setPlayerActive(true)
  }

  const onContinueOrStart = async () => {
    if (!detail) return
    if (listenChapterId) {
      const idx = chapters.findIndex((c) => c.id === listenChapterId)
      if (idx >= 0) {
        await startPlay(idx, listenCharIndex)
        return
      }
    }
    await startPlay(0, 0)
  }

  const toggleFav = async () => {
    if (!user) {
      toast.info('Vui lòng đăng nhập để lưu truyện yêu thích.')
      navigate({ view: 'login' })
      return
    }
    try {
      const r = await api.toggleFavorite(seriesId)
      setFavorited(r.favorited)
      toast.success(r.favorited ? 'Đã thêm vào yêu thích' : 'Đã bỏ khỏi yêu thích')
    } catch {
      toast.error('Không cập nhật được yêu thích.')
    }
  }

  const onShare = async () => {
    const url = typeof window !== 'undefined' ? window.location.href : ''
    const text = detail ? `${detail.title} — ${detail.author}` : 'SoNovel'
    try {
      if (navigator.share) {
        await navigator.share({ title: detail?.title, text, url })
      } else {
        await navigator.clipboard.writeText(url)
        toast.success('Đã sao chép đường link.')
      }
    } catch {}
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl px-3 sm:px-4 py-4 space-y-4">
        <Skeleton className="h-6 w-32" />
        <div className="flex gap-4">
          <Skeleton className="h-48 w-32 rounded-lg" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-8 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-20 w-full" />
          </div>
        </div>
      </div>
    )
  }

  if (!detail) {
    return <div className="py-16 text-center text-muted-foreground">Không tìm thấy truyện.</div>
  }

  const totalListenMin = estMinutes(detail.wordCount)

  return (
    <div className="mx-auto max-w-5xl px-3 sm:px-4 py-4 space-y-6">
      <Button variant="ghost" size="sm" onClick={() => navigate({ view: 'home' })} className="-ml-2">
        <ChevronLeft className="h-4 w-4" /> Quay lại
      </Button>

      {/* Header */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="shrink-0 mx-auto sm:mx-0">
          <CoverImage title={detail.title} coverUrl={detail.coverUrl} className="h-52 w-36 sm:h-60 sm:w-40 shadow-md" />
        </div>
        <div className="flex-1 min-w-0 space-y-2">
          <h1 className="text-2xl sm:text-3xl font-bold text-balance">{detail.title}</h1>
          <p className="text-sm text-muted-foreground">Tác giả: {detail.author || 'Không rõ'}</p>
          <div className="flex flex-wrap gap-1.5">
            {detail.status === 'completed' && <Badge>Hoàn thành</Badge>}
            {detail.status === 'published' && <Badge variant="secondary">Đang ra</Badge>}
            {detail.genres?.map((g) => (
              <button key={g} onClick={() => navigate({ view: 'search', genre: g })}>
                <Badge variant="outline" className="cursor-pointer hover:border-primary">{g}</Badge>
              </button>
            ))}
          </div>
          {detail.tags?.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {detail.tags.map((t) => (
                <button key={t} onClick={() => navigate({ view: 'search', tag: t })}>
                  <span className="text-xs text-primary hover:underline">#{t}</span>
                </button>
              ))}
            </div>
          )}
          <p className="text-sm text-muted-foreground flex items-center gap-3 pt-1">
            <span className="flex items-center gap-1"><BookOpen className="h-4 w-4" /> {detail.chapters.length} chương</span>
            <span className="flex items-center gap-1"><Headphones className="h-4 w-4" /> ~{totalListenMin} phút nghe</span>
          </p>
          <p className="text-sm leading-relaxed line-clamp-4 pt-1">{detail.description}</p>
          <div className="flex flex-wrap gap-2 pt-2">
            <Button onClick={onContinueOrStart} size="sm">
              <Play className="h-4 w-4 mr-1 fill-current" />
              {listenChapterId ? 'Tiếp tục nghe' : 'Nghe từ đầu'}
            </Button>
            <Button variant="outline" size="sm" onClick={() => navigate({ view: 'reader', seriesId, chapterId: progress?.readChapterId || '' })}>
              <BookOpen className="h-4 w-4 mr-1" /> Đọc
            </Button>
            <Button variant={favorited ? 'default' : 'outline'} size="sm" onClick={toggleFav}>
              <Heart className={`h-4 w-4 mr-1 ${favorited ? 'fill-current' : ''}`} />
              {favorited ? 'Đã thích' : 'Yêu thích'}
            </Button>
            <Button variant="outline" size="sm" onClick={onShare}>
              <Share2 className="h-4 w-4 mr-1" /> Chia sẻ
            </Button>
          </div>
        </div>
      </div>

      {/* Continue listening CTA */}
      {listenChapterId && (
        <div className="rounded-xl border border-primary/30 bg-primary/5 p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Đang nghe</p>
              <p className="font-semibold truncate">
                Chương {chapters.find((c) => c.id === listenChapterId)?.orderNo}. {chapters.find((c) => c.id === listenChapterId)?.title}
              </p>
              <p className="text-xs text-muted-foreground">{formatCharCount(listenCharIndex)} / {formatCharCount(chapters.find((c) => c.id === listenChapterId)?.wordCount ? chapters.find((c) => c.id === listenChapterId)!.wordCount * 5 : 0)}</p>
            </div>
            <Button size="sm" onClick={onContinueOrStart}>
              <Volume2 className="h-4 w-4 mr-1" /> Tiếp tục
            </Button>
          </div>
          <Progress value={Math.min(100, (listenCharIndex / Math.max(1, (chapters.find((c) => c.id === listenChapterId)?.wordCount || 1) * 5)) * 100)} className="h-1.5 mt-2" />
        </div>
      )}

      {/* Chapters */}
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">Danh sách chương</h2>
          <div className="relative w-48">
            <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={chapterFilter}
              onChange={(e) => setChapterFilter(e.target.value)}
              placeholder="Tìm chương…"
              className="pl-8 h-8 text-sm"
            />
          </div>
        </div>
        <div className="rounded-xl border border-border divide-y divide-border overflow-hidden">
          {filteredChapters.map((c) => {
            const isPlaying = currentPlayingChapterId === c.id
            const isListened = listenChapterId === c.id
            const pct = isPlaying && currentPlayingChar
              ? Math.min(100, (currentPlayingChar / Math.max(1, c.wordCount * 5)) * 100)
              : isListened ? Math.min(100, (listenCharIndex / Math.max(1, c.wordCount * 5)) * 100) : 0
            return (
              <div
                key={c.id}
                className="flex w-full items-center gap-3 px-3 py-2.5 hover:bg-accent/50 transition-colors text-left group"
              >
                <button
                  onClick={() => {
                    const idx = chapters.findIndex((ch) => ch.id === c.id)
                    startPlay(idx, 0)
                  }}
                  className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-muted text-xs font-semibold hover:bg-primary hover:text-primary-foreground transition-colors"
                  aria-label={`Phát ${c.title}`}
                >
                  {c.orderNo}
                </button>
                <button
                  onClick={() => {
                    const idx = chapters.findIndex((ch) => ch.id === c.id)
                    startPlay(idx, 0)
                  }}
                  className="flex-1 min-w-0 text-left"
                >
                  <p className={`text-sm font-medium line-clamp-1 ${isPlaying ? 'text-primary' : 'group-hover:text-primary'}`}>{c.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatCharCount(c.wordCount * 5)} · ~{estMinutes(c.wordCount * 5)} phút
                  </p>
                  {pct > 0 && <Progress value={pct} className="h-1 mt-1" />}
                </button>
                {isPlaying && <Volume2 className="h-4 w-4 text-primary shrink-0 animate-pulse" />}
                {isListened && !isPlaying && <Headphones className="h-4 w-4 text-muted-foreground shrink-0" />}
                <button
                  onClick={() => navigate({ view: 'reader', seriesId, chapterId: c.id })}
                  className="shrink-0 p-1.5 text-muted-foreground hover:text-primary opacity-0 group-hover:opacity-100 transition-opacity"
                  aria-label={`Đọc ${c.title}`}
                  title="Đọc chương này"
                >
                  <BookOpen className="h-4 w-4" />
                </button>
                <button
                  onClick={async () => {
                    if (!user) {
                      toast.info('Vui lòng đăng nhập để đánh dấu.', { action: { label: 'Đăng nhập', onClick: () => navigate({ view: 'login' }) } })
                      return
                    }
                    try {
                      await api.createBookmark({ seriesId, chapterId: c.id, charIndex: 0 })
                      toast.success(`Đã đánh dấu Chương ${c.orderNo}`)
                    } catch (e) {
                      toast.error('Đánh dấu thất bại.')
                    }
                  }}
                  className="shrink-0 p-1.5 text-muted-foreground hover:text-primary opacity-0 group-hover:opacity-100 transition-opacity"
                  aria-label={`Đánh dấu ${c.title}`}
                  title="Đánh dấu chương này"
                >
                  <Bookmark className="h-4 w-4" />
                </button>
              </div>
            )
          })}
          {filteredChapters.length === 0 && (
            <div className="py-8 text-center text-sm text-muted-foreground">Không có chương phù hợp.</div>
          )}
        </div>
      </div>
    </div>
  )
}
