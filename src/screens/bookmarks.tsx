'use client'

import { useEffect, useState } from 'react'
import { Bookmark, Trash2, Play, BookmarkX } from 'lucide-react'
import { useAppStore } from '@/store/use-app-store'
import { api } from '@/lib/api-client'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { CoverImage } from '@/components/sonovel/cover-image'
import { EmptyState } from '@/components/sonovel/empty-state'
import { usePlayerStore, type PlayerChapter } from '@/store/use-player-store'
import { toast } from 'sonner'
import { formatTimeAgo, formatCharCount } from '@/lib/format'

export function BookmarksScreen() {
  const { user, navigate, syncVersion } = useAppStore()
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const playChapter = usePlayerStore((s) => s.playChapter)
  const setPlayerActive = useAppStore((s) => s.setPlayerActive)

  const load = async () => {
    if (!user) { setLoading(false); return }
    setLoading(true)
    try {
      const r = await api.listBookmarks()
      setItems(r.items)
    } catch {} finally { setLoading(false) }
  }

  useEffect(() => { load() }, [user, syncVersion])

  const onPlay = async (bm: any) => {
    try {
      const detail = await api.getSeries(bm.seriesId)
      const chapters: PlayerChapter[] = detail.chapters.map((c) => ({
        id: c.id, orderNo: c.orderNo, title: c.title, content: '', wordCount: c.wordCount,
      }))
      const idx = chapters.findIndex((c) => c.id === bm.chapterId)
      if (idx < 0) { toast.error('Chương không còn tồn tại.'); return }
      // load target chapter content so playback starts immediately
      try {
        const full = await api.getChapter(chapters[idx].id)
        chapters[idx] = { ...chapters[idx], content: full.content || '' }
      } catch {}
      playChapter({
        seriesId: bm.seriesId,
        seriesTitle: bm.series.title,
        coverUrl: bm.series.coverUrl,
        chapters,
        index: idx,
        startChar: bm.charIndex || 0,
      })
      setPlayerActive(true)
    } catch {
      toast.error('Không mở được trình nghe.')
    }
  }

  const onDelete = async (id: string) => {
    const prev = items
    setItems((cur) => cur.filter((x) => x.id !== id))
    try {
      await api.deleteBookmark(id)
      toast.success('Đã xóa đánh dấu.')
    } catch {
      setItems(prev)
      toast.error('Xóa thất bại.')
    }
  }

  if (!user) {
    return (
      <div className="mx-auto max-w-md px-4 py-12 text-center">
        <div className="grid h-16 w-16 mx-auto place-items-center rounded-full bg-muted">
          <Bookmark className="h-8 w-8 text-muted-foreground" />
        </div>
        <h1 className="mt-4 text-xl font-semibold">Đánh dấu của bạn</h1>
        <p className="mt-1 text-sm text-muted-foreground">Đăng nhập để lưu và xem lại các vị trí bạn đánh dấu trong truyện.</p>
        <Button className="mt-4" onClick={() => navigate({ view: 'login' })}>Đăng nhập</Button>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl px-3 sm:px-4 py-4 sm:py-6 space-y-4">
      <h1 className="text-2xl font-bold flex items-center gap-2">
        <Bookmark className="h-6 w-6 text-primary" /> Đánh dấu
      </h1>
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 w-full rounded-xl" />)}
        </div>
      ) : items.length === 0 ? (
        <EmptyState icon={BookmarkX} title="Chưa có đánh dấu" description="Đánh dấu vị trí đang nghe để quay lại chính xác đoạn đó." actionLabel="Khám phá truyện" onAction={() => navigate({ view: 'home' })} />
      ) : (
        <div className="space-y-2">
          {items.map((bm) => (
            <Card key={bm.id}>
              <CardContent className="p-3 flex items-center gap-3">
                <button onClick={() => navigate({ view: 'story', seriesId: bm.seriesId })} className="shrink-0">
                  <CoverImage title={bm.series.title} coverUrl={bm.series.coverUrl} className="h-16 w-12" />
                </button>
                <div className="flex-1 min-w-0">
                  <button onClick={() => navigate({ view: 'story', seriesId: bm.seriesId })} className="text-left">
                    <h3 className="font-semibold text-sm line-clamp-1 hover:text-primary">{bm.series.title}</h3>
                  </button>
                  <p className="text-xs text-muted-foreground">{formatCharCount(bm.charIndex)} · {formatTimeAgo(bm.createdAt)}</p>
                  {bm.note && <p className="text-xs italic text-muted-foreground line-clamp-1 mt-0.5">"{bm.note}"</p>}
                </div>
                <Button size="icon" variant="default" className="h-9 w-9 shrink-0 rounded-full" onClick={() => onPlay(bm)} aria-label="Phát từ vị trí đánh dấu">
                  <Play className="h-4 w-4 fill-current" />
                </Button>
                <Button size="icon" variant="ghost" className="h-9 w-9 shrink-0 text-destructive hover:text-destructive" onClick={() => onDelete(bm.id)} aria-label="Xóa đánh dấu">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
