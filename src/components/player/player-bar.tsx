'use client'

import { useEffect, useState, useRef } from 'react'
import {
  Play, Pause, SkipBack, SkipForward, Square, ChevronUp, ChevronDown,
  List, FileText, Settings, X, Repeat, Moon, Gauge, BookOpen, Bookmark, Keyboard,
} from 'lucide-react'
import { useAppStore } from '@/store/use-app-store'
import { usePlayerStore, RATE_PRESETS, type SleepMode } from '@/store/use-player-store'
import { useReaderSettings, FONT_FAMILY_CSS } from '@/store/use-reader-settings'
import { CoverImage } from '@/components/sonovel/cover-image'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Slider } from '@/components/ui/slider'
import { Progress } from '@/components/ui/progress'
import { toast } from 'sonner'
import { api } from '@/lib/api-client'
import { formatCharCount, formatRemainingMs } from '@/lib/format'
import { cn } from '@/lib/utils'

const SLEEP_OPTIONS: { key: SleepMode; label: string }[] = [
  { key: 'off', label: 'Tắt' },
  { key: 10, label: '10 phút' },
  { key: 15, label: '15 phút' },
  { key: 30, label: '30 phút' },
  { key: 60, label: '60 phút' },
  { key: 'end-of-chapter', label: 'Hết chương' },
]

export function PlayerBar() {
  const playerActive = useAppStore((s) => s.playerActive)
  const overlayOpen = useAppStore((s) => s.playerOverlayOpen)
  const setOverlayOpen = useAppStore((s) => s.setPlayerOverlayOpen)
  const setPlayerActive = useAppStore((s) => s.setPlayerActive)

  const player = usePlayerStore()
  const {
    seriesTitle, coverUrl, chapters, currentIndex, currentChar,
    isPlaying, isPaused, busy, seriesEnded, rate, error, sleepMode, sleepEndTime, sessionSeconds,
  } = player

  const ch = chapters[currentIndex]
  const contentLen = ch?.content?.length || 1
  const progressFrac = Math.min(1, currentChar / contentLen)

  // Format session time MM:SS
  const sessionMin = Math.floor(sessionSeconds / 60)
  const sessionSec = sessionSeconds % 60
  const sessionTime = `${String(sessionMin).padStart(2, '0')}:${String(sessionSec).padStart(2, '0')}`

  // hotkeys
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!playerActive) return
      const target = e.target as HTMLElement
      const tag = target?.tagName?.toLowerCase()
      if (tag === 'input' || tag === 'textarea' || target?.isContentEditable) return
      if (overlayOpen) return // overlay has its own handling
      if (e.code === 'Space') { e.preventDefault(); player.togglePlayPause() }
      else if (e.code === 'ArrowLeft') { e.preventDefault(); player.seekBy(-0.05) }
      else if (e.code === 'ArrowRight') { e.preventDefault(); player.seekBy(0.05) }
      else if (e.code === 'ArrowUp') { e.preventDefault(); player.prev() }
      else if (e.code === 'ArrowDown') { e.preventDefault(); player.next() }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [playerActive, overlayOpen, player])

  if (!playerActive || !ch) return null

  const rateIdx = RATE_PRESETS.indexOf(rate as any)
  const nextRate = RATE_PRESETS[(rateIdx + 1) % RATE_PRESETS.length]

  const onStop = () => {
    player.stop()
    setPlayerActive(false)
    setOverlayOpen(false)
  }

  return (
    <>
      {/* Mini bar */}
      <div className="fixed bottom-14 md:bottom-0 left-0 right-0 z-30 border-t border-border bg-background/97 backdrop-blur supports-[backdrop-filter]:bg-background/85">
        <div className="mx-auto max-w-6xl px-2 sm:px-4">
          {/* seek bar */}
          <div className="flex items-center gap-2 py-1">
            <span className="text-[10px] tabular-nums text-muted-foreground w-10 text-right">{Math.floor(progressFrac * 100)}%</span>
            <Slider
              value={[progressFrac * 100]}
              max={100}
              step={0.1}
              onValueChange={(v) => player.seekTo(v[0] / 100)}
              className="flex-1"
              aria-label="Thanh tiến trình"
            />
            <button
              onClick={() => setOverlayOpen(true)}
              className="text-[10px] text-muted-foreground hover:text-primary px-1"
              aria-label="Mở trình nghe đầy đủ"
            >
              <ChevronUp className="h-4 w-4" />
            </button>
          </div>
          <div className="flex items-center gap-2 py-1.5">
            <button onClick={() => setOverlayOpen(true)} className="shrink-0">
              <CoverImage title={seriesTitle} coverUrl={coverUrl} className="h-10 w-10" rounded="rounded-md" />
            </button>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium line-clamp-1">Chương {ch.orderNo}. {ch.title}</p>
              <p className="text-[10px] text-muted-foreground">{formatCharCount(currentChar)} / {formatCharCount(contentLen)}</p>
            </div>
            <div className="flex items-center gap-0.5 shrink-0">
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => player.prev()} aria-label="Chương trước">
                <SkipBack className="h-4 w-4" />
              </Button>
              <Button variant="default" size="icon" className="h-9 w-9" onClick={() => player.togglePlayPause()} disabled={busy} aria-label={isPlaying ? 'Tạm dừng' : 'Phát'}>
                {busy ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" /> :
                 seriesEnded ? <Repeat className="h-4 w-4" /> :
                 isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5 fill-current" />}
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => player.next()} aria-label="Chương sau">
                <SkipForward className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="sm" className="h-8 px-2 hidden sm:flex" onClick={() => player.setRate(nextRate)} title="Tốc độ đọc">
                <Gauge className="h-4 w-4 mr-1" /> {rate}x
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8 hidden sm:flex" onClick={() => setOverlayOpen(true)} aria-label="Mở rộng">
                <ChevronUp className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onStop} aria-label="Dừng hẳn">
                <Square className="h-4 w-4" />
              </Button>
            </div>
          </div>
          {/* status row */}
          {(sessionSeconds > 0 || sleepMode !== 'off' || error || seriesEnded) && (
            <div className="flex items-center gap-2 pb-1.5 text-[10px]">
              {sessionSeconds > 0 && (
                <span className={`flex items-center gap-1 rounded-full px-2 py-0.5 tabular-nums ${isPlaying ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' : 'bg-muted text-muted-foreground'}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${isPlaying ? 'bg-emerald-500 animate-pulse' : 'bg-muted-foreground'}`} />
                  {sessionTime}
                </span>
              )}
              {sleepMode !== 'off' && (
                <span className="flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-primary">
                  <Moon className="h-3 w-3" />
                  Hẹn giờ: {SLEEP_OPTIONS.find((s) => s.key === sleepMode)?.label}
                  {sleepEndTime && ` · ${formatRemainingMs(sleepEndTime - Date.now())}`}
                </span>
              )}
              {seriesEnded && (
                <span className="rounded-full bg-muted px-2 py-0.5 text-muted-foreground">Đã nghe hết bộ truyện!</span>
              )}
              {error && (
                <span className="rounded-full bg-destructive/15 px-2 py-0.5 text-destructive">{error}</span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Full overlay */}
      {overlayOpen && <PlayerOverlay />}
    </>
  )
}

function PlayerOverlay() {
  const setOverlayOpen = useAppStore((s) => s.setPlayerOverlayOpen)
  const player = usePlayerStore()
  const [tab, setTab] = useState<'chapters' | 'text' | 'settings'>('text')

  const onBookmark = async () => {
    if (!player.seriesId) return
    const ch = player.chapters[player.currentIndex]
    if (!ch) return
    // Guest check — bookmark requires login
    const user = useAppStore.getState().user
    if (!user) {
      toast.error('Vui lòng đăng nhập để đánh dấu vị trí.', {
        action: { label: 'Đăng nhập', onClick: () => useAppStore.getState().navigate({ view: 'login' }) },
      })
      return
    }
    try {
      await api.createBookmark({
        seriesId: player.seriesId,
        chapterId: ch.id,
        charIndex: player.currentChar,
      })
      toast.success(`Đã đánh dấu tại ${formatCharCount(player.currentChar)} — Chương ${ch.orderNo}`)
    } catch (e) {
      const err = e as Error & { status?: number }
      if (err.status === 401) {
        toast.error('Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại.', {
          action: { label: 'Đăng nhập', onClick: () => useAppStore.getState().navigate({ view: 'login' }) },
        })
      } else {
        toast.error('Đánh dấu thất bại: ' + (e as Error).message)
      }
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      {/* header */}
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <div className="min-w-0 flex-1">
          <p className="text-xs text-muted-foreground">Đang phát</p>
          <p className="text-sm font-semibold line-clamp-1">{player.seriesTitle}</p>
        </div>
        <Button variant="ghost" size="icon" onClick={onBookmark} aria-label="Đánh dấu vị trí hiện tại" title="Đánh dấu vị trí hiện tại">
          <Bookmark className="h-5 w-5" />
        </Button>
        <Button variant="ghost" size="icon" onClick={() => setOverlayOpen(false)} aria-label="Thu gọn">
          <ChevronDown className="h-5 w-5" />
        </Button>
      </div>

      {/* tabs */}
      <div className="flex border-b border-border">
        {[
          { key: 'chapters' as const, label: 'Danh sách chương', icon: List },
          { key: 'text' as const, label: 'Xem chữ', icon: FileText },
          { key: 'settings' as const, label: 'Cài đặt', icon: Settings },
        ].map((t) => {
          const Icon = t.icon
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={cn(
                'flex flex-1 flex-col items-center gap-0.5 py-2 text-xs font-medium transition-colors',
                tab === t.key ? 'text-primary border-b-2 border-primary' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <Icon className="h-4 w-4" />
              <span className="hidden sm:inline">{t.label}</span>
              <span className="sm:hidden">{t.label.split(' ')[0]}</span>
            </button>
          )
        })}
      </div>

      {/* content */}
      <div className="flex-1 overflow-hidden">
        {tab === 'chapters' && <ChaptersTab />}
        {tab === 'text' && <TextTab />}
        {tab === 'settings' && <SettingsTab />}
      </div>

      {/* footer controls */}
      <div className="border-t border-border bg-background">
        <div className="mx-auto max-w-3xl px-3 py-2">
          <div className="flex items-center gap-2">
            <span className="text-[10px] tabular-nums text-muted-foreground w-10">{Math.floor((player.currentChar / Math.max(1, (player.chapters[player.currentIndex]?.content?.length || 1))) * 100)}%</span>
            <Slider
              value={[Math.min(100, (player.currentChar / Math.max(1, (player.chapters[player.currentIndex]?.content?.length || 1))) * 100)]}
              max={100}
              step={0.1}
              onValueChange={(v) => player.seekTo(v[0] / 100)}
              className="flex-1"
            />
            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => {
              const idx = RATE_PRESETS.indexOf(player.rate as any)
              player.setRate(RATE_PRESETS[(idx + 1) % RATE_PRESETS.length])
            }}>
              {player.rate}x
            </Button>
          </div>
          <div className="flex items-center justify-center gap-2 py-1.5">
            <Button variant="ghost" size="icon" onClick={() => player.prev()} aria-label="Chương trước">
              <SkipBack className="h-5 w-5" />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => player.seekBy(-0.05)} aria-label="Lùi 5%">
              <SkipBack className="h-4 w-4" />
            </Button>
            <Button variant="default" size="lg" className="rounded-full h-12 w-12 p-0" onClick={() => player.togglePlayPause()} disabled={player.busy}>
              {player.busy ? <span className="h-5 w-5 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" /> :
               player.seriesEnded ? <Repeat className="h-6 w-6" /> :
               player.isPlaying ? <Pause className="h-6 w-6" /> : <Play className="h-6 w-6 fill-current" />}
            </Button>
            <Button variant="ghost" size="icon" onClick={() => player.seekBy(0.05)} aria-label="Tiến 5%">
              <SkipForward className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => player.next()} aria-label="Chương sau">
              <SkipForward className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

function ChaptersTab() {
  const player = usePlayerStore()
  const [q, setQ] = useState('')
  const chapters = player.chapters || []
  const filtered = q ? chapters.filter((c) => c.title.toLowerCase().includes(q.toLowerCase()) || String(c.orderNo) === q) : chapters

  return (
    <div className="h-full flex flex-col">
      <div className="p-3 border-b border-border">
        <div className="relative">
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tìm chương…" className="h-9" />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        {filtered.map((c) => {
          const isCurrent = player.currentIndex === chapters.findIndex((x) => x.id === c.id)
          return (
            <button
              key={c.id}
              onClick={() => {
                const idx = chapters.findIndex((x) => x.id === c.id)
                player.playChapter({
                  seriesId: player.seriesId || '',
                  seriesTitle: player.seriesTitle,
                  coverUrl: player.coverUrl,
                  chapters: player.chapters,
                  index: idx,
                  startChar: 0,
                  rate: player.rate,
                  autoplayNext: player.autoplayNext,
                })
              }}
              className={cn(
                'flex w-full items-center gap-3 px-4 py-3 border-b border-border text-left transition-colors',
                isCurrent ? 'bg-primary/10' : 'hover:bg-accent/50'
              )}
            >
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-muted text-xs font-semibold">{c.orderNo}</span>
              <div className="flex-1 min-w-0">
                <p className={cn('text-sm font-medium line-clamp-1', isCurrent && 'text-primary')}>{c.title}</p>
                <p className="text-xs text-muted-foreground">{formatCharCount(c.wordCount * 5)} · ~{Math.max(1, Math.round(c.wordCount * 5 / 270))} phút</p>
              </div>
              {isCurrent && player.isPlaying && <span className="h-2 w-2 rounded-full bg-primary animate-pulse" />}
            </button>
          )
        })}
        {filtered.length === 0 && <div className="py-8 text-center text-sm text-muted-foreground">Không có chương.</div>}
      </div>
    </div>
  )
}

function TextTab() {
  const player = usePlayerStore()
  const { fontSize, fontFamily, lineHeight, hydrate } = useReaderSettings()
  useEffect(() => { hydrate() }, [hydrate])
  const ch = player.chapters[player.currentIndex]
  const containerRef = useRef<HTMLDivElement>(null)
  const [follow, setFollow] = useState(true)
  const [userScrolled, setUserScrolled] = useState(false)

  const paragraphs = (ch?.content || '').split('\n').filter((p) => p.trim())

  // compute current paragraph based on char index
  let acc = 0
  let currentParaIdx = 0
  for (let i = 0; i < paragraphs.length; i++) {
    const plen = paragraphs[i].length + 1
    if (acc + plen > player.currentChar) { currentParaIdx = i; break }
    acc += plen
    currentParaIdx = i
  }

  useEffect(() => {
    if (!follow || userScrolled) return
    const el = containerRef.current?.querySelector(`[data-para-idx="${currentParaIdx}"]`) as HTMLElement | null
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [currentParaIdx, follow, userScrolled])

  const onScroll = () => {
    if (!follow) return
    const el = containerRef.current
    if (!el) return
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 60
    if (!atBottom) setUserScrolled(true)
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between p-2 border-b border-border">
        <p className="text-xs text-muted-foreground px-1">Chương {ch?.orderNo}. {ch?.title}</p>
        <Button
          variant={follow ? 'default' : 'outline'}
          size="sm"
          className="h-7 text-xs"
          onClick={() => { setFollow(!follow); setUserScrolled(false) }}
        >
          <BookOpen className="h-3 w-3 mr-1" /> Theo dõi
        </Button>
      </div>
      <div
        ref={containerRef}
        onScroll={onScroll}
        className="flex-1 overflow-y-auto px-4 py-3"
        style={{ lineHeight, fontSize: `${fontSize}px`, fontFamily: FONT_FAMILY_CSS[fontFamily] }}
      >
        {paragraphs.map((p, i) => (
          <p
            key={i}
            data-para-idx={i}
            className={cn(
              'mb-3 transition-colors',
              i === currentParaIdx && 'player-highlight'
            )}
          >
            {p}
          </p>
        ))}
        {paragraphs.length === 0 && <p className="text-muted-foreground">Không có nội dung.</p>}
      </div>
    </div>
  )
}

function SettingsTab() {
  const player = usePlayerStore()
  const [autoplay, setAutoplay] = useState(player.autoplayNext)

  return (
    <div className="h-full overflow-y-auto p-4 space-y-6">
      {/* Rate */}
      <section>
        <h3 className="text-sm font-semibold mb-2 flex items-center gap-1.5"><Gauge className="h-4 w-4" /> Tốc độ đọc</h3>
        <div className="flex flex-wrap gap-2">
          {RATE_PRESETS.map((r) => (
            <button
              key={r}
              onClick={() => player.setRate(r)}
              className={cn(
                'rounded-lg border px-3 py-1.5 text-sm transition-colors',
                player.rate === r ? 'border-primary bg-primary text-primary-foreground' : 'border-border hover:border-primary'
              )}
            >
              {r}x
            </button>
          ))}
        </div>
      </section>

      {/* Sleep */}
      <section>
        <h3 className="text-sm font-semibold mb-2 flex items-center gap-1.5"><Moon className="h-4 w-4" /> Hẹn giờ tắt</h3>
        <div className="flex flex-wrap gap-2">
          {SLEEP_OPTIONS.map((s) => (
            <button
              key={String(s.key)}
              onClick={() => player.setSleep(s.key)}
              className={cn(
                'rounded-lg border px-3 py-1.5 text-sm transition-colors',
                player.sleepMode === s.key ? 'border-primary bg-primary text-primary-foreground' : 'border-border hover:border-primary'
              )}
            >
              {s.label}
            </button>
          ))}
        </div>
        {player.sleepEndTime && (
          <p className="text-xs text-muted-foreground mt-2">Còn lại {formatRemainingMs(player.sleepEndTime - Date.now())}</p>
        )}
      </section>

      {/* Autoplay */}
      <section>
        <h3 className="text-sm font-semibold mb-2">Tự động chuyển chương</h3>
        <div className="flex gap-2">
          <Button variant={autoplay ? 'default' : 'outline'} size="sm" onClick={() => { setAutoplay(true); }}>Bật</Button>
          <Button variant={!autoplay ? 'default' : 'outline'} size="sm" onClick={() => { setAutoplay(false); }}>Tắt</Button>
        </div>
      </section>

      {/* Stop */}
      <section>
        <Button
          variant="destructive"
          className="w-full"
          onClick={() => {
            player.stop()
            useAppStore.getState().setPlayerActive(false)
            useAppStore.getState().setPlayerOverlayOpen(false)
          }}
        >
          <Square className="h-4 w-4 mr-1" /> Dừng phát
        </Button>
      </section>

      {/* Keyboard shortcuts */}
      <section>
        <h3 className="text-sm font-semibold mb-2 flex items-center gap-1.5"><Keyboard className="h-4 w-4" /> Phím tắt</h3>
        <div className="rounded-lg border border-border divide-y divide-border text-sm">
          <ShortcutRow keys="Space" desc="Phát / Tạm dừng" />
          <ShortcutRow keys="← / →" desc="Lùi / Tiến 5%" />
          <ShortcutRow keys="↑ / ↓" desc="Chương trước / sau" />
        </div>
        <p className="text-xs text-muted-foreground mt-1.5">Chỉ hoạt động khi overlay đóng và focus không nằm trong ô nhập.</p>
      </section>

      {player.seriesEnded && (
        <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 text-center">
          <p className="font-medium">Đã nghe hết bộ truyện!</p>
          <Button className="mt-2" size="sm" onClick={() => player.replay()}>
            <Repeat className="h-4 w-4 mr-1" /> Nghe lại từ đầu
          </Button>
        </div>
      )}
    </div>
  )
}

function ShortcutRow({ keys, desc }: { keys: string; desc: string }) {
  return (
    <div className="flex items-center justify-between px-3 py-2">
      <span className="text-muted-foreground">{desc}</span>
      <kbd className="rounded border border-border bg-muted px-2 py-0.5 text-xs font-mono">{keys}</kbd>
    </div>
  )
}
