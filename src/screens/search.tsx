'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { Search as SearchIcon, X, ChevronRight, Clock, Star, SearchX } from 'lucide-react'
import { useAppStore } from '@/store/use-app-store'
import { api, type SeriesItem } from '@/lib/api-client'
import { StoryCard } from '@/components/sonovel/story-card'
import { EmptyState } from '@/components/sonovel/empty-state'
import { CoverImage } from '@/components/sonovel/cover-image'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'

const SORTS = [
  { key: 'new', label: 'Mới cập nhật' },
  { key: 'title', label: 'Tiêu đề' },
  { key: 'chapters', label: 'Nhiều chương' },
] as const

const RECENT_KEY = 'sonovel-recent-searches'

export function SearchScreen() {
  const { view, navigate } = useAppStore()
  const initialQ = view.view === 'search' ? view.q || '' : ''
  const initialGenre = view.view === 'search' ? view.genre || '' : ''
  const initialTag = view.view === 'search' ? view.tag || '' : ''
  const initialSort = view.view === 'search' ? view.sort || 'new' : 'new'

  const [q, setQ] = useState(initialQ)
  const [genre, setGenre] = useState(initialGenre)
  const [tag, setTag] = useState(initialTag)
  const [sort, setSort] = useState<string>(initialSort)
  const [items, setItems] = useState<SeriesItem[]>([])
  const [total, setTotal] = useState(0)
  const [offset, setOffset] = useState(0)
  const [loading, setLoading] = useState(false)
  const [facets, setFacets] = useState<{ genres: string[]; tags: string[] }>({ genres: [], tags: [] })
  const [recent, setRecent] = useState<string[]>([])

  const limit = 24
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // load recent searches
  useEffect(() => {
    try {
      const r = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]')
      setRecent(Array.isArray(r) ? r.slice(0, 8) : [])
    } catch {}
  }, [])

  // load facets (genres + tags from up to 500 series)
  useEffect(() => {
    ;(async () => {
      try {
        const res = await api.listSeries({ status: 'published,completed', limit: 500 })
        const gset = new Set<string>()
        const tset = new Set<string>()
        res.items.forEach((s) => {
          s.genres?.forEach((g) => g && gset.add(g))
          s.tags?.forEach((t) => t && tset.add(t))
        })
        setFacets({ genres: Array.from(gset).sort(), tags: Array.from(tset).sort() })
      } catch {}
    })()
  }, [])

  const saveRecent = useCallback((term: string) => {
    const t = term.trim()
    if (!t) return
    setRecent((prev) => {
      const next = [t, ...prev.filter((x) => x !== t)].slice(0, 8)
      try { localStorage.setItem(RECENT_KEY, JSON.stringify(next)) } catch {}
      return next
    })
  }, [])

  const doSearch = useCallback(async (resetOffset = true) => {
    setLoading(true)
    if (resetOffset) setOffset(0)
    try {
      const res = await api.listSeries({
        q,
        genre,
        tag,
        sort,
        status: 'published,completed',
        limit,
        offset: resetOffset ? 0 : offset,
      })
      setItems(resetOffset ? res.items : [...items, ...res.items])
      setTotal(res.total)
    } catch {
      toast.error('Tìm kiếm thất bại.')
    } finally {
      setLoading(false)
    }
  }, [q, genre, tag, sort, offset, items])

  // debounced search on q/genre/tag/sort change
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      doSearch(true)
      if (q.trim()) saveRecent(q)
    }, 350)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [q, genre, tag, sort])

  const removeRecent = (term: string) => {
    setRecent((prev) => {
      const next = prev.filter((x) => x !== term)
      try { localStorage.setItem(RECENT_KEY, JSON.stringify(next)) } catch {}
      return next
    })
  }

  const hasFilters = q || genre || tag

  return (
    <div className="mx-auto max-w-6xl px-3 sm:px-4 py-4 sm:py-6 space-y-4">
      <div>
        <h1 className="text-2xl font-bold mb-3">Tìm kiếm truyện</h1>
        <div className="relative">
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Tên truyện, tác giả…"
            className="pl-9 pr-9 h-11"
            autoFocus
          />
          {q && (
            <button
              onClick={() => setQ('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground"
              aria-label="Xóa tìm kiếm"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Recent searches */}
      {!hasFilters && recent.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-semibold flex items-center gap-1.5 text-muted-foreground">
              <Clock className="h-4 w-4" /> Tìm kiếm gần đây
            </h2>
          </div>
          <div className="flex flex-wrap gap-2">
            {recent.map((r) => (
              <div key={r} className="group flex items-center gap-1 rounded-full border border-border bg-card pl-3 pr-1 py-1 text-sm">
                <button onClick={() => setQ(r)} className="hover:text-primary">{r}</button>
                <button onClick={() => removeRecent(r)} className="p-0.5 text-muted-foreground hover:text-destructive" aria-label={`Xóa ${r}`}>
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Đề xuất — chỉ hiện khi không có filter */}
      {!hasFilters && (
        <div>
          <h2 className="flex items-center gap-1.5 text-sm font-semibold text-muted-foreground mb-2">
            <Star className="h-4 w-4 text-amber-500" /> Đề xuất cho bạn
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {items.slice(0, 3).map((s, i) => (
              <FeaturedSearchCard key={s.id} series={s} rank={i + 1} />
            ))}
          </div>
        </div>
      )}

      {/* Sort */}
      <div className="flex flex-wrap items-center gap-2">
        {SORTS.map((s) => (
          <Button
            key={s.key}
            variant={sort === s.key ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSort(s.key)}
          >
            {s.label}
          </Button>
        ))}
        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={() => { setQ(''); setGenre(''); setTag('') }}>
            <X className="h-4 w-4 mr-1" /> Xóa lọc
          </Button>
        )}
      </div>

      {/* Genre facets */}
      {facets.genres.length > 0 && (
        <div>
          <h2 className="text-xs font-semibold uppercase text-muted-foreground mb-1.5">Thể loại</h2>
          <div className="flex flex-wrap gap-1.5">
            {facets.genres.slice(0, 16).map((g) => (
              <button
                key={g}
                onClick={() => setGenre(genre === g ? '' : g)}
                className={`rounded-full border px-2.5 py-1 text-xs transition-colors ${
                  genre === g ? 'border-primary bg-primary text-primary-foreground' : 'border-border hover:border-primary'
                }`}
              >
                {g}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Tag facets */}
      {facets.tags.length > 0 && (
        <div>
          <h2 className="text-xs font-semibold uppercase text-muted-foreground mb-1.5">Tag</h2>
          <div className="flex flex-wrap gap-1.5">
            {facets.tags.slice(0, 16).map((t) => (
              <button
                key={t}
                onClick={() => setTag(tag === t ? '' : t)}
                className={`rounded-full border px-2.5 py-1 text-xs transition-colors ${
                  tag === t ? 'border-primary bg-primary text-primary-foreground' : 'border-border hover:border-primary'
                }`}
              >
                #{t}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Results */}
      <div>
        <p className="text-sm text-muted-foreground mb-3">{total} kết quả</p>
        {loading && items.length === 0 ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-[repeat(auto-fit,minmax(170px,1fr))] sm:gap-4">
            {Array.from({ length: 12 }).map((_, i) => <div key={i} className="aspect-[2/3] w-full rounded-lg skeleton-shimmer" />)}
          </div>
        ) : items.length === 0 ? (
          <EmptyState icon={SearchX} title="Không tìm thấy truyện" description="Thử thay đổi từ khóa hoặc bộ lọc." />
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-[repeat(auto-fit,minmax(170px,1fr))] sm:gap-4">
              {items.map((s) => <StoryCard key={s.id} series={s} />)}
            </div>
            {offset + limit < total && (
              <div className="mt-6 text-center">
                <Button variant="outline" onClick={() => doSearch(false)} disabled={loading}>
                  Tải thêm ({total - offset - limit} còn lại)
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function FeaturedSearchCard({ series, rank }: { series: SeriesItem; rank: number }) {
  const navigate = useAppStore((s) => s.navigate)
  const listenMin = Math.max(1, Math.round(((series.wordCount || 0) * 5) / 270))
  const rankColors = ['text-amber-500', 'text-zinc-400', 'text-orange-700']

  return (
    <button
      type="button"
      onClick={() => navigate({ view: 'story', seriesId: series.id })}
      className="group relative flex gap-3 rounded-xl border border-border bg-card p-3 text-left cursor-pointer card-lift overflow-hidden focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
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
          <span>{series.chapterCount ?? 0} chương</span>
          <span>· ~{listenMin} phút</span>
        </div>
      </div>
    </button>
  )
}
