'use client'

import { CoverImage } from './cover-image'
import { Badge } from '@/components/ui/badge'
import { BookOpen, Headphones, Heart } from 'lucide-react'
import { useAppStore } from '@/store/use-app-store'
import type { SeriesItem } from '@/lib/api-client'
import { estMinutes } from '@/lib/format'
import { ProgressRing } from './progress-ring'

export function StoryCard({ series, onClick, favorited, listenPercent }: { series: SeriesItem; onClick?: () => void; favorited?: boolean; listenPercent?: number }) {
  const navigate = useAppStore((s) => s.navigate)
  const go = () => onClick ? onClick() : navigate({ view: 'story', seriesId: series.id })

  const listenMin = Math.max(1, Math.round((series.wordCount || 0) / 270))
  const primaryGenre = series.genres?.[0]
  const hasProgress = typeof listenPercent === 'number' && listenPercent > 0

  return (
    <button
      onClick={go}
      className="group flex flex-col text-left transition-all duration-200 hover:-translate-y-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-lg"
      aria-label={`Mở truyện ${series.title}`}
    >
      <div className="relative aspect-[2/3] w-full overflow-hidden rounded-lg border border-border bg-muted shadow-sm transition-all duration-200 group-hover:shadow-lg group-hover:border-primary/40">
        <CoverImage title={series.title} coverUrl={series.coverUrl} className="h-full w-full transition-transform duration-300 group-hover:scale-105" />
        {/* Top badges */}
        <div className="absolute top-1.5 left-1.5 right-1.5 flex items-start justify-between gap-1">
          <div className="flex flex-col gap-1">
            {series.status === 'completed' && (
              <Badge variant="secondary" className="bg-background/85 backdrop-blur text-[9px] px-1.5 py-0 shadow-sm">Hoàn thành</Badge>
            )}
            {series.status === 'published' && (
              <Badge variant="secondary" className="bg-emerald-500/90 text-white backdrop-blur text-[9px] px-1.5 py-0 shadow-sm">Đang ra</Badge>
            )}
            {series.status === 'draft' && (
              <Badge variant="outline" className="bg-background/85 backdrop-blur text-[9px] px-1.5 py-0">Nháp</Badge>
            )}
          </div>
          <div className="flex flex-col items-end gap-1">
            {favorited && (
              <span className="grid h-5 w-5 place-items-center rounded-full bg-background/85 backdrop-blur shadow-sm">
                <Heart className="h-3 w-3 fill-rose-500 text-rose-500" />
              </span>
            )}
            {hasProgress && (
              <div className="rounded-full bg-background/85 backdrop-blur shadow-sm">
                <ProgressRing percent={listenPercent!} size={32} strokeWidth={3} className="text-primary" />
              </div>
            )}
          </div>
        </div>
        {/* Bottom gradient + stats */}
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent p-2 pt-5">
          <div className="flex items-center gap-2 text-xs text-white/95">
            <span className="flex items-center gap-1"><BookOpen className="h-4 w-4" /> {series.chapterCount ?? 0} ch</span>
            <span className="flex items-center gap-1"><Headphones className="h-4 w-4" /> ~{listenMin} phút</span>
          </div>
        </div>
      </div>
      <div className="mt-1.5 px-0.5">
        <h3 className="line-clamp-2 text-[15px] sm:text-base font-semibold leading-snug group-hover:text-primary transition-colors">
          {series.title}
        </h3>
        {series.author && (
          <p className="mt-0.5 line-clamp-1 text-[13px] text-muted-foreground">{series.author}</p>
        )}
        {primaryGenre && (
          <span className="mt-1 inline-block text-xs text-primary/80 font-medium">{primaryGenre}</span>
        )}
      </div>
    </button>
  )
}

