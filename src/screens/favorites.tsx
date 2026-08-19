'use client'

import { useEffect, useState } from 'react'
import { Heart } from 'lucide-react'
import { useAppStore } from '@/store/use-app-store'
import { api, type SeriesItem } from '@/lib/api-client'
import { StoryCard } from '@/components/sonovel/story-card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'

export function FavoritesScreen() {
  const { user, navigate } = useAppStore()
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
  }, [user])

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
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3">
          {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="aspect-[3/4] w-full rounded-lg" />)}
        </div>
      ) : items.length === 0 ? (
        <div className="py-16 text-center text-muted-foreground">
          <Heart className="mx-auto h-10 w-10 mb-2 opacity-50" />
          Bạn chưa có truyện yêu thích nào.
        </div>
      ) : (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-3">
          {items.map((s) => <StoryCard key={s.id} series={s} />)}
        </div>
      )}
    </div>
  )
}
