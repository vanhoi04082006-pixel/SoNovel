'use client'

import { CoverImage } from './cover-image'
import { Badge } from '@/components/ui/badge'
import { BookOpen, Headphones } from 'lucide-react'
import { useAppStore } from '@/store/use-app-store'
import type { SeriesItem } from '@/lib/api-client'
import { estMinutes } from '@/lib/format'

export function StoryCard({ series, onClick }: { series: SeriesItem; onClick?: () => void }) {
  const navigate = useAppStore((s) => s.navigate)
  const go = () => onClick ? onClick() : navigate({ view: 'story', seriesId: series.id })

  const listenMin = Math.max(1, Math.round((series.wordCount || 0) / 270))

  return (
    <button
      onClick={go}
      className="group flex flex-col text-left transition-transform hover:-translate-y-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-lg"
      aria-label={`Mở truyện ${series.title}`}
    >
      <div className="relative aspect-[3/4] w-full overflow-hidden rounded-lg border border-border bg-muted shadow-sm transition-shadow group-hover:shadow-md">
        <CoverImage title={series.title} coverUrl={series.coverUrl} className="h-full w-full" />
        <div className="absolute top-1.5 right-1.5">
          {series.status === 'completed' && (
            <Badge variant="secondary" className="bg-background/85 backdrop-blur text-[10px] px-1.5 py-0">Hoàn thành</Badge>
          )}
          {series.status === 'draft' && (
            <Badge variant="outline" className="bg-background/85 backdrop-blur text-[10px] px-1.5 py-0">Nháp</Badge>
          )}
        </div>
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-1.5">
          <div className="flex items-center gap-2 text-[10px] text-white/90">
            <span className="flex items-center gap-0.5"><BookOpen className="h-3 w-3" /> {series.chapterCount ?? 0} chương</span>
            <span className="flex items-center gap-0.5"><Headphones className="h-3 w-3" /> ~{listenMin} phút</span>
          </div>
        </div>
      </div>
      <div className="mt-1.5 px-0.5">
        <h3 className="line-clamp-2 text-sm font-semibold leading-snug group-hover:text-primary transition-colors">
          {series.title}
        </h3>
        {series.author && (
          <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{series.author}</p>
        )}
      </div>
    </button>
  )
}
