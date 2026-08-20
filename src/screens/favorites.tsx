'use client'

import { useEffect, useState } from 'react'
import { Heart } from 'lucide-react'
import { useAppStore } from '@/store/use-app-store'
import { api, type SeriesItem } from '@/lib/api-client'
import { StoryCard } from '@/components/sonovel/story-card'
import { EmptyState } from '@/components/sonovel/empty-state'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'

export function FavoritesScreen() {
  const { user, navigate, syncVersion } = useAppStore()
  const [items, setItems] = useState<SeriesItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) { setLoading(false); return }
    let cancelled = false
    ;(async () => {
      setLoading(true)
      try {
        const r = await api.listFavorites()
        if (!cancelled) setItems(r.items)
      } catch {} finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [user, syncVersion])

  if (!user) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <Heart className="mx-auto h-12 w-12 text-muted-foreground" />
        <h1 className="mt-4 text-xl font-semibold">Yêu thích của bạn</h1>
        <p className="mt-1 text-muted-foreground">Đăng nhập để lưu và xem lại các truyện bạn yêu thích.</p>
        <Button className="mt-4" onClick={() => navigate({ view: 'login' })}>Đăng nhập</Button>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-6xl px-3 sm:px-4 py-4 sm:py-6 space-y-4">
      <h1 className="text-2xl font-bold">Truyện yêu thích</h1>
      {loading ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-[repeat(auto-fit,minmax(170px,1fr))] sm:gap-4">
          {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="aspect-[2/3] w-full rounded-lg" />)}
        </div>
      ) : items.length === 0 ? (
        <EmptyState icon={Heart} title="Chưa có truyện yêu thích" description="Lưu truyện bạn thích để dễ dàng tìm lại sau này." actionLabel="Khám phá truyện" onAction={() => navigate({ view: 'search' })} />
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-[repeat(auto-fit,minmax(170px,1fr))] sm:gap-4">
          {items.map((s) => <StoryCard key={s.id} series={s} />)}
        </div>
      )}
    </div>
  )
}
