'use client'

import { useEffect, useState } from 'react'
import {
  Headphones, Clock, BookOpen, Heart, Bookmark, TrendingUp,
  BarChart3, ChevronLeft, Play, Calendar, Flame, Trophy, Award, Lock, Target, Share2, Pencil, Check,
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
  const [streak, setStreak] = useState<any>(null)
  const [achievements, setAchievements] = useState<any>(null)
  const [challenge, setChallenge] = useState<any>(null)
  const [customGoals, setCustomGoals] = useState<{ chapters: number; minutes: number; days: number }>({ chapters: 3, minutes: 60, days: 5 })
  const [editingGoals, setEditingGoals] = useState(false)
  const [goalDraft, setGoalDraft] = useState({ chapters: 3, minutes: 60, days: 5 })
  const playChapter = usePlayerStore((s) => s.playChapter)
  const setPlayerActive = useAppStore((s) => s.setPlayerActive)

  // Load custom goals from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem('sonovel-weekly-goals')
      if (stored) {
        const parsed = JSON.parse(stored)
        setCustomGoals(parsed)
        setGoalDraft(parsed)
      }
    } catch {}
  }, [])

  const saveGoals = () => {
    setCustomGoals(goalDraft)
    try { localStorage.setItem('sonovel-weekly-goals', JSON.stringify(goalDraft)) } catch {}
    setEditingGoals(false)
    toast.success('Đã lưu mục tiêu tuần.')
  }

  useEffect(() => {
    if (!user) { setLoading(false); return }
    let cancelled = false
    ;(async () => {
      setLoading(true)
      try {
        const [r, s, a, c] = await Promise.all([
          api.readingStats(),
          api.streakStats(),
          api.achievementsStats(),
          api.challengeStats(),
        ])
        if (!cancelled) {
          setStats(r.stats)
          setStreak(s.stats)
          setAchievements(a)
          setChallenge(c)
        }
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

          {/* Streak + heatmap */}
          {streak && (
            <Card className="card-lift">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Flame className="h-4 w-4 text-orange-500" /> Chuỗi ngày nghe
                </CardTitle>
                <CardDescription>Duy trì thói quen nghe truyện mỗi ngày</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-3 gap-2">
                  <div className="rounded-lg bg-muted/50 p-3 text-center">
                    <Flame className="mx-auto h-5 w-5 text-orange-500" />
                    <p className="mt-1 text-2xl font-bold tabular-nums">{streak.currentStreak}</p>
                    <p className="text-xs text-muted-foreground">hiện tại</p>
                  </div>
                  <div className="rounded-lg bg-muted/50 p-3 text-center">
                    <Trophy className="mx-auto h-5 w-5 text-amber-500" />
                    <p className="mt-1 text-2xl font-bold tabular-nums">{streak.longestStreak}</p>
                    <p className="text-xs text-muted-foreground">dài nhất</p>
                  </div>
                  <div className="rounded-lg bg-muted/50 p-3 text-center">
                    <Calendar className="mx-auto h-5 w-5 text-primary" />
                    <p className="mt-1 text-2xl font-bold tabular-nums">{streak.totalDays}</p>
                    <p className="text-xs text-muted-foreground">tổng ngày</p>
                  </div>
                </div>
                {/* 30-day heatmap */}
                <div>
                  <p className="text-xs text-muted-foreground mb-2">90 ngày gần nhất (GitHub-style)</p>
                  <div className="overflow-x-auto no-scrollbar">
                    <div className="grid grid-flow-col grid-rows-7 gap-0.5 min-w-max">
                      {streak.heatmap?.map((day: any, i: number) => (
                        <div
                          key={i}
                          title={`${day.date}${day.listened ? ' — đã nghe' : ''}`}
                          className={`h-2.5 w-2.5 rounded-sm ${day.listened ? 'bg-primary' : 'bg-muted'}`}
                        />
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mt-2 text-[10px] text-muted-foreground">
                    <span>Ít</span>
                    <div className="flex gap-0.5">
                      <div className="h-2 w-2 rounded-sm bg-muted" />
                      <div className="h-2 w-2 rounded-sm bg-primary/40" />
                      <div className="h-2 w-2 rounded-sm bg-primary/70" />
                      <div className="h-2 w-2 rounded-sm bg-primary" />
                    </div>
                    <span>Nhiều</span>
                  </div>
                </div>
                {streak.currentStreak > 0 && (
                  <div className="rounded-lg bg-orange-500/10 border border-orange-500/30 p-2 text-center text-sm text-orange-600 dark:text-orange-400">
                    🔥 Đang chuỗi {streak.currentStreak} ngày! Nghe tiếp để duy trì.
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Achievements */}
          {achievements && (
            <Card className="card-lift">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Award className="h-4 w-4 text-amber-500" /> Thành tích
                </CardTitle>
                <CardDescription>
                  Đã mở {achievements.summary.unlocked}/{achievements.summary.total} huy hiệu · {achievements.summary.progress}%
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {achievements.achievements.map((a: any) => {
                    const tierColors: Record<string, string> = {
                      bronze: 'from-amber-700/20 to-amber-600/10 border-amber-700/30',
                      silver: 'from-zinc-400/20 to-zinc-300/10 border-zinc-400/30',
                      gold: 'from-amber-500/30 to-yellow-400/10 border-amber-500/40',
                    }
                    return (
                      <div
                        key={a.id}
                        title={`${a.title} — ${a.desc}`}
                        className={`relative rounded-lg border bg-gradient-to-br p-3 text-center transition-all ${
                          a.unlocked
                            ? `${tierColors[a.tier] || tierColors.bronze} opacity-100`
                            : 'opacity-40 grayscale'
                        }`}
                      >
                        <div className="text-2xl mb-1">{a.icon}</div>
                        <p className="text-xs font-semibold line-clamp-1">{a.title}</p>
                        <p className="text-[10px] text-muted-foreground line-clamp-1 mt-0.5">{a.desc}</p>
                        {!a.unlocked && (
                          <div className="absolute top-1 right-1">
                            <Lock className="h-3 w-3 text-muted-foreground" />
                          </div>
                        )}
                        <div className="mt-1.5">
                          <div className="h-1 rounded-full bg-muted overflow-hidden">
                            <div
                              className="h-full bg-primary transition-all"
                              style={{ width: `${Math.min(100, (a.progress / a.goal) * 100)}%` }}
                            />
                          </div>
                          <p className="text-[10px] text-muted-foreground mt-0.5 tabular-nums">
                            {a.progress}/{a.goal}
                          </p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Weekly challenges */}
          {challenge && (
            <Card className="card-lift">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Target className="h-4 w-4 text-primary" /> Thử thách tuần
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 ml-auto"
                    onClick={() => { setGoalDraft(customGoals); setEditingGoals(!editingGoals) }}
                    aria-label="Chỉnh sửa mục tiêu"
                    title="Chỉnh sửa mục tiêu"
                  >
                    {editingGoals ? <Check className="h-4 w-4" /> : <Pencil className="h-4 w-4" />}
                  </Button>
                </CardTitle>
                <CardDescription>
                  Còn {challenge.summary.daysLeft} ngày · Đã hoàn thành {challenge.summary.unlocked}/{challenge.summary.total}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {editingGoals && (
                  <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-2">
                    <p className="text-xs font-medium text-primary">Tùy chỉnh mục tiêu tuần</p>
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="text-xs text-muted-foreground">Chương</label>
                        <input
                          type="number"
                          min={1}
                          max={50}
                          value={goalDraft.chapters}
                          onChange={(e) => setGoalDraft({ ...goalDraft, chapters: Math.max(1, Number(e.target.value) || 1) })}
                          className="w-full rounded border border-border bg-background px-2 py-1 text-sm"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground">Phút</label>
                        <input
                          type="number"
                          min={10}
                          max={600}
                          step={10}
                          value={goalDraft.minutes}
                          onChange={(e) => setGoalDraft({ ...goalDraft, minutes: Math.max(10, Number(e.target.value) || 10) })}
                          className="w-full rounded border border-border bg-background px-2 py-1 text-sm"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground">Ngày</label>
                        <input
                          type="number"
                          min={1}
                          max={7}
                          value={goalDraft.days}
                          onChange={(e) => setGoalDraft({ ...goalDraft, days: Math.max(1, Math.min(7, Number(e.target.value) || 1)) })}
                          className="w-full rounded border border-border bg-background px-2 py-1 text-sm"
                        />
                      </div>
                    </div>
                    <div className="flex gap-2 justify-end">
                      <Button size="sm" variant="ghost" onClick={() => setEditingGoals(false)}>Hủy</Button>
                      <Button size="sm" onClick={saveGoals}>Lưu</Button>
                    </div>
                  </div>
                )}
                {challenge.challenges.map((c: any) => {
                  // Use custom goal if matches id
                  let goal = c.goal
                  if (c.id === 'weekly-chapters') goal = customGoals.chapters
                  if (c.id === 'weekly-minutes') goal = customGoals.minutes
                  if (c.id === 'weekly-days') goal = customGoals.days
                  const pct = Math.min(100, (c.progress / goal) * 100)
                  const unlocked = c.progress >= goal
                  const tierColors: Record<string, string> = {
                    bronze: 'border-amber-700/40 bg-amber-700/5',
                    silver: 'border-zinc-400/40 bg-zinc-400/5',
                    gold: 'border-amber-500/40 bg-amber-500/5',
                  }
                  return (
                    <div
                      key={c.id}
                      className={`rounded-lg border p-3 ${unlocked ? tierColors[c.tier] : 'border-border bg-muted/30'}`}
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">{c.icon}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-sm font-semibold truncate">{c.title}</p>
                            <span className="text-xs tabular-nums text-muted-foreground shrink-0">
                              {c.progress}/{goal} {c.unit}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground truncate">{c.desc}</p>
                          <div className="mt-1.5 h-1.5 rounded-full bg-muted overflow-hidden">
                            <div
                              className={`h-full transition-all ${unlocked ? 'bg-emerald-500' : 'bg-primary'}`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                        {unlocked && <Trophy className="h-4 w-4 text-amber-500 shrink-0" />}
                      </div>
                    </div>
                  )
                })}
                {/* Share achievements */}
                <div className="flex justify-end pt-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      const a = achievements?.achievements || []
                      const unlocked = a.filter((x: any) => x.unlocked)
                      const text = `🎧 SoNovel — Thống kê nghe truyện\n\n` +
                        `⏱ Tổng thời gian: ${listenHours > 0 ? `${listenHours}h ${listenMinRem}m` : `${stats?.totalListenMin ?? 0}m`}\n` +
                        `📖 Chương hoàn thành: ${stats?.chaptersCompleted ?? 0}\n` +
                        `🏆 Huy hiệu mở: ${unlocked.length}/${a.length}\n` +
                        `🔥 Chuỗi dài nhất: ${streak?.longestStreak ?? 0} ngày\n\n` +
                        `Nghe truyện cùng SoNovel!`
                      try {
                        if (navigator.share) {
                          await navigator.share({ title: 'SoNovel — Thống kê nghe', text })
                        } else {
                          await navigator.clipboard.writeText(text)
                          toast.success('Đã sao chép thống kê.')
                        }
                      } catch {
                        toast.info('Đã hủy chia sẻ.')
                      }
                    }}
                  >
                    <Share2 className="h-4 w-4 mr-1" /> Chia sẻ
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

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
