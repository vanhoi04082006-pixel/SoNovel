'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { Heart, Share2, Play, Headphones, ChevronLeft, BookOpen, Search as SearchIcon, Volume2, Bookmark } from 'lucide-react'
import { useAppStore } from '@/store/use-app-store'
import { api, type SeriesDetail, type ChapterItem, type SeriesItem } from '@/lib/api-client'
import { CoverImage } from '@/components/sonovel/cover-image'
import { StoryCard } from '@/components/sonovel/story-card'
import { EmptyState } from '@/components/sonovel/empty-state'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toast } from 'sonner'
import { usePlayerStore, type PlayerChapter } from '@/store/use-player-store'
import { estMinutes, formatCharCount } from '@/lib/format'

type IllustrationItem = { id: string; imageUrl: string; thumbUrl?: string; caption: string; orderNo: number }

function IllustImage({ it, index, onOpen }: { it: IllustrationItem; index: number; onOpen: () => void }) {
  const [failed, setFailed] = useState(false)
  const [retryKey, setRetryKey] = useState(0)
  const src = it.thumbUrl || it.imageUrl
  if (failed) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-xl border border-border bg-muted py-10 text-center">
        <p className="text-xs text-muted-foreground">Không tải được ảnh (mạng yếu?).</p>
        <Button size="sm" variant="outline" onClick={() => { setFailed(false); setRetryKey((k) => k + 1) }}>Thử lại</Button>
      </div>
    )
  }
  return (
    <button type="button" onClick={onOpen} className="block w-full cursor-zoom-in" aria-label={`Phóng to ${it.caption || `ảnh ${index + 1}`}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img key={retryKey} src={src} alt={it.caption || `Ảnh ${index + 1}`} loading="lazy" onError={() => setFailed(true)} className="h-auto w-full rounded-xl border border-border bg-muted" />
    </button>
  )
}

/** Tab Minh họa: mục lục sticky cột trái (desktop) + danh sách chữ trên / ảnh dưới giữ tỉ lệ gốc. */
function IllustrationsTab({ seriesId }: { seriesId: string }) {
  const [items, setItems] = useState<IllustrationItem[] | null>(null)
  const [lightbox, setLightbox] = useState<string | null>(null)
  const [activeIdx, setActiveIdx] = useState(0)
  const rowRefs = useRef<(HTMLDivElement | null)[]>([])

  useEffect(() => {
    let cancelled = false
    setItems(null)
    setActiveIdx(0)
    rowRefs.current = []
    api.getIllustrations(seriesId)
      .then((r) => { if (!cancelled) setItems(r.items) })
      .catch(() => { if (!cancelled) setItems([]) })
    return () => { cancelled = true }
  }, [seriesId])

  useEffect(() => {
    if (!lightbox) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setLightbox(null) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [lightbox])

  if (items === null) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="min-h-64 w-full rounded-xl" />)}
      </div>
    )
  }
  if (items.length === 0) {
    return <EmptyState icon={BookOpen} title="Chưa có ảnh minh họa" description="Bộ truyện này chưa có ảnh minh họa." />
  }

  const scrollTo = (i: number) => {
    setActiveIdx(i)
    rowRefs.current[i]?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const indexList = (vertical: boolean) => (
    <>
      {items.map((it, i) => (
        <button
          key={it.id || i}
          onClick={() => scrollTo(i)}
          className={
            vertical
              ? `block w-full truncate rounded-lg border px-3 py-2 text-left text-xs transition-colors ${i === activeIdx ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:border-primary hover:text-primary'}`
              : `shrink-0 rounded-full border border-border px-3 py-1 text-xs hover:border-primary hover:text-primary transition-colors ${i === activeIdx ? 'border-primary text-primary' : ''}`
          }
        >
          {i + 1}. {it.caption || `Ảnh ${i + 1}`}
        </button>
      ))}
    </>
  )

  return (
    <div className="md:grid md:grid-cols-[220px_1fr] md:gap-5">
      {/* Mục lục: mobile chips ngang phía trên, desktop sticky cột trái */}
      <div className="mb-3 md:mb-0">
        <div className="flex gap-2 overflow-x-auto pb-1 md:hidden">{indexList(false)}</div>
        <div className="hidden md:block md:sticky md:top-20 max-h-[70vh] overflow-y-auto rounded-xl border border-border p-2">
          <p className="px-2 pb-2 pt-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Mục lục ({items.length})</p>
          <div className="space-y-1">{indexList(true)}</div>
        </div>
      </div>
      {/* Cột ảnh: giữ nguyên tỉ lệ gốc, không crop */}
      <div className="space-y-5 min-w-0">
        {items.map((it, i) => (
          <div key={it.id || i} ref={(el) => { rowRefs.current[i] = el }} className="space-y-2 scroll-mt-24">
            <p className="text-sm font-medium">
              <span className="text-primary mr-1.5">{i + 1}.</span>
              {it.caption || `Ảnh ${i + 1}`}
            </p>
            <IllustImage it={it} index={i} onOpen={() => setLightbox(it.imageUrl)} />
          </div>
        ))}
      </div>
      {lightbox && (
        <button type="button" onClick={() => setLightbox(null)} className="fixed inset-0 z-50 grid place-items-center bg-black/80 p-4 cursor-zoom-out" aria-label="Đóng ảnh phóng to">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={lightbox} alt="Ảnh minh họa phóng to" className="max-h-full max-w-full rounded-lg object-contain" />
        </button>
      )}
    </div>
  )
}

export function StoryDetailScreen() {
  const { view, navigate, user, refreshUser, syncVersion } = useAppStore()
  const seriesId = view.view === 'story' ? view.seriesId : ''
  const [detail, setDetail] = useState<SeriesDetail | null>(null)
  const [progress, setProgress] = useState<any>(null)
  const [favorited, setFavorited] = useState(false)
  const [loading, setLoading] = useState(true)
  const [chapterFilter, setChapterFilter] = useState('')
  const [visibleChapters, setVisibleChapters] = useState(200)
  const [related, setRelated] = useState<SeriesItem[]>([])
  const playChapter = usePlayerStore((s) => s.playChapter)
  const setPlayerActive = useAppStore((s) => s.setPlayerActive)

  useEffect(() => {
    let cancelled = false
    if (!seriesId) return
    api.getRelated(seriesId, 6).then((r) => { if (!cancelled) setRelated(r.items) }).catch(() => {})
    return () => { cancelled = true }
  }, [seriesId])

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
  const shownChapters = filteredChapters.slice(0, visibleChapters)
  const remainingChapters = filteredChapters.length - visibleChapters

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
    const prev = favorited
    setFavorited(!prev)
    try {
      const r = await api.toggleFavorite(seriesId)
      setFavorited(r.favorited)
      toast.success(r.favorited ? 'Đã thêm vào yêu thích' : 'Đã bỏ khỏi yêu thích')
    } catch {
      setFavorited(prev)
      toast.error('Không cập nhật được yêu thích.')
    }
  }

  const onShare = async () => {
    const url = typeof window !== 'undefined' ? `${window.location.origin}${window.location.pathname}#/story/${seriesId}` : ''
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
    return (
      <div className="mx-auto max-w-2xl px-4 py-16">
        <EmptyState
          icon={BookOpen}
          title="Không tìm thấy truyện"
          description="Truyện có thể đã bị xóa hoặc đường dẫn không đúng."
          actionLabel="Về trang chủ"
          onAction={() => navigate({ view: 'home' })}
        />
      </div>
    )
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

      {/* Tabs: Chương | Minh Họa (thông tin đã có ở header phía trên) */}
      <Tabs defaultValue="chapters" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="chapters">Chương</TabsTrigger>
          <TabsTrigger value="illustrations">Minh Họa</TabsTrigger>
        </TabsList>
        <TabsContent value="chapters" className="space-y-3 pt-2">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold">Danh sách chương</h3>
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
            {shownChapters.map((c) => {
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
          {remainingChapters > 0 && (
            <button
              onClick={() => setVisibleChapters((v) => v + 200)}
              className="w-full rounded-lg border border-border py-2.5 text-sm text-primary hover:bg-accent/50 transition-colors"
            >
              Tải thêm chương ({remainingChapters} còn lại)
            </button>
          )}
        </TabsContent>
        <TabsContent value="illustrations" className="pt-2">
          <IllustrationsTab seriesId={seriesId} />
        </TabsContent>
      </Tabs>

      {/* Related stories */}
      {related.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold">Có thể bạn sẽ thích</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6 sm:gap-4">
            {related.map((s) => (
              <StoryCard key={s.id} series={s} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
