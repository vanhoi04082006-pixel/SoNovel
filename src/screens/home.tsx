'use client'

import { useEffect, useState } from 'react'
import { Headphones, ChevronRight, ChevronLeft, Sparkles, TrendingUp, Play, Star, BookOpen, BarChart3 } from 'lucide-react'
import { useAppStore } from '@/store/use-app-store'
import { api, type SeriesItem } from '@/lib/api-client'
import { StoryCard } from '@/components/sonovel/story-card'
import { CoverImage } from '@/components/sonovel/cover-image'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Progress } from '@/components/ui/progress'
import { Carousel, CarouselContent, CarouselItem } from '@/components/ui/carousel'
import { toast } from 'sonner'
import { usePlayerStore, type PlayerChapter } from '@/store/use-player-store'

const GENRE_CHIPS = [
  'Tiên Hiệp', 'Kiếm Hiệp', 'Ngôn Tình', 'Đô Thị', 'Huyền Huyễn',
  'Dị Giới', 'Sảng Văn', 'Trọng Sinh', 'Tiểu Thuyết', 'Cổ Đại',
  'Đoản Văn', 'Quan Trường',
]

export function HomeScreen() {
  const { user, navigate, syncVersion } = useAppStore()
  const [recent, setRecent] = useState<SeriesItem[]>([])
  const [popular, setPopular] = useState<SeriesItem[]>([])
  const [continueItems, setContinueItems] = useState<any[]>([])
  const [progressMap, setProgressMap] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [carouselApi, setCarouselApi] = useState<any>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      try {
        const [r, p] = await Promise.all([
          api.listSeries({ status: 'published,completed', sort: 'new', limit: 10 }),
          api.listSeries({ status: 'published,completed', sort: 'chapters', limit: 10 }),
        ])
        if (cancelled) return
        setRecent(r.items)
        setPopular(p.items)
        if (user) {
          try {
            const [c, all] = await Promise.all([
              api.continueListening(),
              api.getAllProgress(),
            ])
            if (!cancelled) {
              setContinueItems(c.items)
              const map: Record<string, number> = {}
              all.items.forEach((p) => { if (p.percent > 0) map[p.seriesId] = p.percent })
              setProgressMap(map)
            }
          } catch {}
        }
      } catch {
        toast.error('Không tải được danh sách truyện.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [user, syncVersion])

  return (
    <div className="mx-auto max-w-6xl px-3 sm:px-4 py-4 sm:py-6 space-y-8">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-primary/15 via-primary/5 to-transparent p-6 sm:p-8 animate-fade-in-up">
        <div className="absolute inset-0 opacity-30 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle at 20% 20%, var(--primary) 0%, transparent 40%)' }} />
        <div className="absolute top-4 right-4 hidden sm:flex gap-1.5 opacity-60">
          {['Tiên Hiệp', 'Đô Thị', 'Ngôn Tình'].map((g) => (
            <button key={g} onClick={() => navigate({ view: 'search', genre: g })} className="rounded-full border border-primary/30 bg-background/50 backdrop-blur px-2.5 py-1 text-xs hover:bg-primary hover:text-primary-foreground transition-colors">
              {g}
            </button>
          ))}
        </div>
        <div className="relative flex flex-col lg:flex-row lg:items-center gap-6">
          <div className="flex-1">
            <h1 className="text-2xl sm:text-4xl font-bold tracking-tight text-balance">
              Nghe truyện chữ bằng <span className="text-primary">giọng đọc tổng hợp</span>
            </h1>
            <p className="mt-2 max-w-2xl text-sm sm:text-base text-muted-foreground text-balance">
              Khám phá hàng ngàn truyện chữ, bật lên và nghe bằng giọng đọc tiếng Việt. Tiếp tục từ đúng vị trí bạn dừng — ngay cả khi vừa khóa màn hình.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button onClick={() => navigate({ view: 'search' })} size="sm">
                <Sparkles className="h-4 w-4 mr-1" /> Khám phá truyện
              </Button>
              {user && (
                <Button variant="outline" size="sm" onClick={() => navigate({ view: 'stats' })}>
                  <BarChart3 className="h-4 w-4 mr-1" /> Thống kê nghe
                </Button>
              )}
              {!user && (
                <Button variant="outline" size="sm" onClick={() => navigate({ view: 'login' })}>
                  Đăng nhập để lưu tiến độ
                </Button>
              )}
            </div>
          </div>

          {popular[0] && (
            <div className="lg:w-72 shrink-0">
              <FeaturedHero series={popular[0]} />
            </div>
          )}
        </div>
      </section>

      {/* Continue listening */}
      {user && continueItems.length > 0 && (
        <section>
          <SectionHeader icon={<Headphones className="h-5 w-5" />} title="Tiếp tục nghe" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {continueItems.map((c) => (
              <ContinueCard key={c.seriesId} item={c} />
            ))}
          </div>
        </section>
      )}

      {/* Recent updates */}
      <section>
        <SectionHeader
          icon={<TrendingUp className="h-5 w-5" />}
          title="Truyện mới cập nhật"
          onMore={() => navigate({ view: 'search', sort: 'new' })}
        />
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-10 gap-3">
          {loading
            ? Array.from({ length: 10 }).map((_, i) => <div key={i} className="aspect-[3/4] w-full rounded-lg skeleton-shimmer" />)
            : recent.map((s) => <StoryCard key={s.id} series={s} listenPercent={progressMap[s.id]} />)}
        </div>
      </section>

      {/* Popular */}
      <section>
        <SectionHeader
          icon={<Sparkles className="h-5 w-5" />}
          title="Phổ biến"
          onMore={() => navigate({ view: 'search', sort: 'chapters' })}
        />
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-10 gap-3">
          {loading
            ? Array.from({ length: 10 }).map((_, i) => <div key={i} className="aspect-[3/4] w-full rounded-lg skeleton-shimmer" />)
            : popular.map((s) => <StoryCard key={s.id} series={s} listenPercent={progressMap[s.id]} />)}
        </div>
      </section>

      {/* Đề xuất (carousel) */}
      {!loading && popular.length > 0 && (
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <span className="text-primary"><Star className="h-5 w-5" /></span>
              Đề xuất cho bạn
            </h2>
            <div className="flex items-center gap-1">
              <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => carouselApi?.scrollPrev()} aria-label="Trước">
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => carouselApi?.scrollNext()} aria-label="Sau">
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <Carousel setApi={setCarouselApi} className="w-full">
            <CarouselContent className="-ml-3">
              {popular.slice(0, 6).map((s, i) => (
                <CarouselItem key={s.id} className="pl-3 basis-full sm:basis-1/2 lg:basis-1/3">
                  <FeaturedCard series={s} rank={i + 1} />
                </CarouselItem>
              ))}
            </CarouselContent>
          </Carousel>
        </section>
      )}

      {/* Genres */}
      <section>
        <SectionHeader title="Thể loại" />
        <div className="flex flex-wrap gap-2">
          {GENRE_CHIPS.map((g) => (
            <button
              key={g}
              onClick={() => navigate({ view: 'search', genre: g })}
              className="rounded-full border border-border bg-card px-3 py-1.5 text-sm hover:border-primary hover:text-primary transition-colors"
            >
              {g}
            </button>
          ))}
        </div>
      </section>
    </div>
  )
}

function SectionHeader({ icon, title, onMore }: { icon?: React.ReactNode; title: string; onMore?: () => void }) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <h2 className="flex items-center gap-2 text-lg font-semibold">
        {icon && <span className="text-primary">{icon}</span>}
        {title}
      </h2>
      {onMore && (
        <Button variant="ghost" size="sm" onClick={onMore} className="text-muted-foreground">
          Xem thêm <ChevronRight className="h-4 w-4" />
        </Button>
      )}
    </div>
  )
}

function ContinueCard({ item }: { item: any }) {
  const navigate = useAppStore((s) => s.navigate)
  const playChapter = usePlayerStore((s) => s.playChapter)
  const setPlayerActive = useAppStore((s) => s.setPlayerActive)

  const onPlay = async () => {
    try {
      const detail = await api.getSeries(item.seriesId)
      // fetch full chapter content
      const chapters: PlayerChapter[] = []
      for (const c of detail.chapters) {
        const full = await api.getChapter(c.id)
        chapters.push({ id: full.id, orderNo: full.orderNo, title: full.title, content: full.content || '', wordCount: full.wordCount })
      }
      let idx = chapters.findIndex((c) => c.id === item.chapterId)
      if (idx < 0) idx = 0
      playChapter({
        seriesId: item.seriesId,
        seriesTitle: item.title,
        coverUrl: item.coverUrl,
        chapters,
        index: idx,
        startChar: item.listenCharIndex || 0,
      })
      setPlayerActive(true)
    } catch {
      toast.error('Không mở được trình nghe.')
    }
  }

  const progress = Math.min(100, Math.max(0, (item.listenCharIndex / Math.max(1, item.chapterWordCount * 5)) * 100))
  const remainingMin = Math.max(1, Math.round((item.chapterWordCount * 5 - item.listenCharIndex) / 270))

  return (
    <div className="flex gap-3 rounded-xl border border-border bg-card p-3">
      <button onClick={() => navigate({ view: 'story', seriesId: item.seriesId })} className="shrink-0">
        <CoverImage title={item.title} coverUrl={item.coverUrl} className="h-20 w-14" />
      </button>
      <div className="flex-1 min-w-0 flex flex-col">
        <button onClick={() => navigate({ view: 'story', seriesId: item.seriesId })} className="text-left">
          <h3 className="font-semibold text-sm line-clamp-1 hover:text-primary">{item.title}</h3>
        </button>
        <p className="text-xs text-muted-foreground line-clamp-1">Chương {item.chapterOrderNo}. {item.chapterTitle}</p>
        <p className="text-xs text-muted-foreground mt-0.5">Còn ~{remainingMin} phút</p>
        <div className="mt-auto pt-1.5">
          <Progress value={progress} className="h-1.5" />
        </div>
      </div>
      <button
        onClick={onPlay}
        className="self-center grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground hover:scale-105 transition-transform"
        aria-label="Tiếp tục nghe"
      >
        <Play className="h-5 w-5 fill-current" />
      </button>
    </div>
  )
}

function FeaturedHero({ series }: { series: SeriesItem }) {
  const navigate = useAppStore((s) => s.navigate)
  return (
    <div className="flex gap-3 rounded-xl border border-border bg-background/80 p-3 shadow-card backdrop-blur">
      <CoverImage title={series.title} coverUrl={series.coverUrl} className="h-28 w-20 shrink-0" rounded="rounded-lg" />
      <div className="flex min-w-0 flex-col">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-primary">Nổi bật</p>
        <h3 className="mt-0.5 line-clamp-1 text-sm font-semibold">{series.title}</h3>
        <p className="mt-0.5 line-clamp-2 flex-1 text-xs text-muted-foreground">{series.description}</p>
        <Button size="sm" className="mt-2 w-fit" onClick={() => navigate({ view: 'story', seriesId: series.id })}>
          <Play className="h-3.5 w-3.5 mr-1 fill-current" /> Nghe ngay
        </Button>
      </div>
    </div>
  )
}

function FeaturedCard({ series, rank }: { series: SeriesItem; rank: number }) {
  const navigate = useAppStore((s) => s.navigate)
  const listenMin = Math.max(1, Math.round((series.wordCount || 0) / 270))
  const rankColors = ['text-amber-500', 'text-zinc-400', 'text-orange-700']

  return (
    <div
      onClick={() => navigate({ view: 'story', seriesId: series.id })}
      className="group relative flex gap-3 rounded-xl border border-border bg-card p-3 cursor-pointer card-lift overflow-hidden"
    >
      {/* Rank badge */}
      <div className={`absolute -top-1 -left-1 grid h-8 w-8 place-items-center rounded-full bg-background border-2 border-border font-bold text-lg ${rankColors[rank - 1] || 'text-muted-foreground'}`}>
        {rank}
      </div>
      <CoverImage title={series.title} coverUrl={series.coverUrl} className="h-24 w-16 shrink-0 ml-2" />
      <div className="flex-1 min-w-0 flex flex-col">
        <h3 className="font-semibold text-sm line-clamp-2 group-hover:text-primary transition-colors">{series.title}</h3>
        <p className="text-xs text-muted-foreground line-clamp-1">{series.author || 'Không rõ'}</p>
        {series.genres?.[0] && (
          <span className="mt-1 inline-block text-[10px] text-primary font-medium w-fit">{series.genres[0]}</span>
        )}
        <p className="text-xs text-muted-foreground line-clamp-2 mt-1 flex-1">{series.description}</p>
        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
          <span className="flex items-center gap-0.5"><BookOpen className="h-3 w-3" /> {series.chapterCount ?? 0} chương</span>
          <span className="flex items-center gap-0.5"><Headphones className="h-3 w-3" /> ~{listenMin} phút</span>
        </div>
      </div>
    </div>
  )
}
