'use client'

import { useCallback, useEffect, useState } from 'react'
import { Clock } from 'lucide-react'
import { useAppStore } from '@/store/use-app-store'
import { api, type SeriesItem } from '@/lib/api-client'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { CoverImage } from '@/components/sonovel/cover-image'
import { EmptyState } from '@/components/sonovel/empty-state'
import { formatTimeAgo } from '@/lib/format'

export function HistoryScreen() {
  const { user, navigate, syncVersion } = useAppStore()
  const [items, setItems] = useState<SeriesItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const load = useCallback(async () => {
    if (!user) { setLoading(false); return }
    setLoading(true)
    setError(false)
    try {
      const r = await api.listHistory()
      setItems(r.items)
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    load()
  }, [load, syncVersion])

  if (!user) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <Clock className="mx-auto h-12 w-12 text-muted-foreground" />
        <h1 className="mt-4 text-xl font-semibold">Lịch sử nghe</h1>
        <p className="mt-1 text-muted-foreground">Đăng nhập để xem lịch sử các truyện bạn đã mở.</p>
        <Button className="mt-4" onClick={() => navigate({ view: 'login' })}>Đăng nhập</Button>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-4xl px-3 sm:px-4 py-4 sm:py-6 space-y-4">
      <h1 className="text-2xl font-bold">Lịch sử nghe</h1>
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-20 w-full rounded-xl" />)}
        </div>
      ) : error ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-6 text-center space-y-2">
          <p className="text-sm text-destructive">Không tải được lịch sử.</p>
          <Button variant="outline" size="sm" onClick={load}>Thử lại</Button>
        </div>
      ) : items.length === 0 ? (
        <EmptyState icon={Clock} title="Chưa có lịch sử" description="Mở truyện để lưu lại lịch sử nghe của bạn." actionLabel="Khám phá truyện" onAction={() => navigate({ view: 'search' })} />
      ) : (
        <div className="space-y-2">
          {items.map((s) => (
            <button
              key={s.id}
              onClick={() => navigate({ view: 'story', seriesId: s.id })}
              className="flex w-full items-center gap-3 rounded-xl border border-border bg-card p-3 hover:bg-accent/50 transition-colors text-left"
            >
              <CoverImage title={s.title} coverUrl={s.coverUrl} className="h-16 w-12 shrink-0" />
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-sm line-clamp-1">{s.title}</h3>
                <p className="text-xs text-muted-foreground line-clamp-1">{s.author}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Đã mở {s.openedCount} lần · {formatTimeAgo(s.lastOpenedAt)}
                </p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
