'use client'

import { useEffect, useState } from 'react'
import {
  Headphones, Clock, BookOpen, Heart, Bookmark, TrendingUp,
  BarChart3, ChevronLeft, Play, Calendar,
} from 'lucide-react'
import { useAppStore } from '@/store/use-app-store'
import { api } from '@/lib/api-client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { CoverImage } from '@/components/sonovel/cover-image'
import { ProgressRing } from '@/components/sonovel/progress-ring'
import { usePlayerStore, type PlayerChapter } from '@/store/use-player-store'
import { toast } from 'sonner'
import { formatTimeAgo, formatCharCount } from '@/lib/format'

export function StatsScreen() {
  const { user, navigate } = useAppStore()
  const [stats, setStats] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const playChapter = usePlayerStore((s) => s.playChapter)
  const setPlayerActive = useAppStore((s) => s.setPlayerActive)

  useEffect(() => {
    if (!user) { setLoading(false); return }
    let cancelled = false
    ;(async () => {
      setLoading(true)
      try {
        const r = await api.readingStats()
        if (!cancelled) setStats(r.stats)
      } catch {
        toast.error('Không tải được thống kê.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [user])

  if (!user) {
    return (
      <div className="mx-auto max-w-md px-4 py-12 text-center">
        <div className="grid h-16 w-16 mx-auto place-items-center rounded-full bg-muted">
          <BarChart3 className="h-8 w-8 text-muted-foreground" />
        </div>
        <h1 className="mt-4 text-xl font-semibold">Thống kê nghe truyện</h1>
        <p className="mt-1 text-sm text-muted-foreground">Đăng nhập để xem tổng thời gian nghe, số chương đã hoàn thành và truyện đang theo dõi.</p>
        <Button className="mt-4" onClick={() => navigate({ view: 'login' })}>Đăng nhập</Button>
      </div>
    )
  }

  const listenHours = stats ? Math.floor(stats.totalListenMin / 60) : 0
  const listenMinRem = stats ? stats.totalListenMin % 60 : 0

  const onPlay = async (seriesId: string, chapterId: string, charIndex: number) => {
    try {
      const detail = await api.getSeries(seriesId)
      const chapters: PlayerChapter[] = []
      for (const c of detail.chapters) {
        const full = await api.getChapter(c.id)
        chapters.push({ id: full.id, orderNo: full.orderNo, title: full.title, content: full.content || '', wordCount: full.wordCount })
      }
      const idx = chapters.findIndex((c) => c.id === chapterId)
      if (idx < 0) { toast.error('Chương không tồn tại.'); return }
      playChapter({
        seriesId: detail.id,
        seriesTitle: detail.title,
        coverUrl: detail.coverUrl,
        chapters,
        index: idx,
        startChar: charIndex,
      })
      setPlayerActive(true)
    } catch {
      toast.error('Không mở được trình nghe.')
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-3 sm:px-4 py-4 sm:py-6 space-y-4">
      <Button variant="ghost" size="sm" onClick={() => navigate({ view: 'profile' })} className="-ml-2">
        <ChevronLeft className="h-4 w-4" /> Quay lại
      </Button>
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <BarChart3 className="h-6 w-6 text-primary" /> Thống kê nghe
        </h1>
        <p className="text-sm text-muted-foreground mt-1">Tổng quan hoạt động nghe truyện của bạn</p>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 w-full rounded-lg" />)}
        </div>
      ) : stats ? (
        <>
          {/* Stat cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard
              icon={<Clock className="h-5 w-5" />}
              label="Thời gian nghe"
              value={listenHours > 0 ? `${listenHours}h ${listenMinRem}m` : `${stats.totalListenMin}m`}
              color="text-amber-600"
            />
            <StatCard
              icon={<BookOpen className="h-5 w-5" />}
              label="Chương hoàn thành"
              value={stats.chaptersCompleted}
              color="text-emerald-600"
            />
            <StatCard
              icon={<Headphones className="h-5 w-5" />}
              label="Truyện đang theo dõi"
              value={stats.seriesFollowing}
              color="text-rose-600"
            />
            <StatCard
              icon={<Heart className="h-5 w-5" />}
              label="Yêu thích"
              value={stats.favoritesCount}
              color="text-violet-600"
            />
          </div>

          {/* Secondary stats */}
          <div className="grid grid-cols-2 gap-3">
            <Card>
              <CardContent className="p-3 flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">{stats.historyCount} truyện đã mở</span>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3 flex items-center gap-2">
                <Bookmark className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">{stats.bookmarksCount} vị trí đã đánh dấu</span>
              </CardContent>
            </Card>
          </div>

          {/* Series progress list */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base"><TrendingUp className="h-4 w-4" /> Tiến độ theo truyện</CardTitle>
              <CardDescription>Sắp xếp theo % nghe nhiều nhất</CardDescription>
            </CardHeader>
            <CardContent>
              {stats.seriesStats.length === 0 ? (
                <div className="py-8 text-center text-sm text-muted-foreground">
                  Bạn chưa nghe truyện nào. <button onClick={() => navigate({ view: 'home' })} className="text-primary hover:underline">Bắt đầu nghe</button>
                </div>
              ) : (
                <div className="space-y-2">
                  {stats.seriesStats.map((s: any) => (
                    <div key={s.seriesId} className="flex items-center gap-3 rounded-lg border border-border p-2.5 hover:bg-accent/30 transition-colors group">
                      <button onClick={() => navigate({ view: 'story', seriesId: s.seriesId })} className="shrink-0">
                        <CoverImage title={s.title} coverUrl={s.coverUrl} className="h-16 w-12" />
                      </button>
                      <div className="flex-1 min-w-0">
                        <button onClick={() => navigate({ view: 'story', seriesId: s.seriesId })} className="text-left">
                          <h3 className="font-semibold text-sm line-clamp-1 hover:text-primary">{s.title}</h3>
                        </button>
                        <p className="text-xs text-muted-foreground line-clamp-1">
                          Chương {s.listenChapterOrderNo}. {s.listenChapterTitle}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {formatCharCount(s.listenCharIndex)} · {formatTimeAgo(s.lastListenedAt)}
                        </p>
                      </div>
                      <ProgressRing percent={s.percent} size={40} strokeWidth={3} className="text-primary shrink-0" />
                      <button
                        onClick={() => onPlay(s.seriesId, s.listenChapterId, s.listenCharIndex)}
                        className="shrink-0 grid h-9 w-9 place-items-center rounded-full bg-primary text-primary-foreground opacity-0 group-hover:opacity-100 transition-opacity"
                        aria-label="Tiếp tục nghe"
                      >
                        <Play className="h-4 w-4 fill-current" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      ) : (
        <div className="py-12 text-center text-muted-foreground">Không có dữ liệu.</div>
      )}
    </div>
  )
}

function StatCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string | number; color: string }) {
  return (
    <Card className="card-lift">
      <CardContent className="p-4 flex items-center gap-3">
        <span className={`grid h-10 w-10 place-items-center rounded-lg bg-muted ${color} shrink-0`}>{icon}</span>
        <div className="min-w-0">
          <p className="text-xl font-bold leading-none tabular-nums">{value}</p>
          <p className="text-xs text-muted-foreground mt-1">{label}</p>
        </div>
      </CardContent>
    </Card>
  )
}
