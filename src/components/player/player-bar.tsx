'use client'

import { useEffect, useState, useRef, useMemo, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Play, Pause, SkipBack, SkipForward, Square, ChevronUp, ChevronDown,
  List, FileText, Settings, X, Repeat, Moon, Gauge, BookOpen, Bookmark, Keyboard,
  Rewind, FastForward, AudioLines,
} from 'lucide-react'
import { useAppStore } from '@/store/use-app-store'
import { usePlayerStore, RATE_PRESETS, type SleepMode } from '@/store/use-player-store'
import { useReaderSettings, FONT_FAMILY_CSS } from '@/store/use-reader-settings'
import { useShallow } from 'zustand/react/shallow'
import { CoverImage } from '@/components/sonovel/cover-image'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Slider } from '@/components/ui/slider'
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

// Slider có hover preview — hiện % / thời điểm khi di chuột.
function SeekSlider({ value, onCommit, formatLabel }: { value: number; onCommit: (frac: number) => void; formatLabel?: (frac: number) => string }) {
  const ref = useRef<HTMLDivElement>(null)
  const [hover, setHover] = useState<number | null>(null)
  const onMove = useCallback((e: React.PointerEvent) => {
    const el = ref.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const f = rect.width > 0 ? Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width)) : 0
    setHover(f)
  }, [])
  return (
    <div ref={ref} className="relative group py-2 -my-2" onPointerMove={onMove} onPointerLeave={() => setHover(null)}>
      {hover !== null && (
        <div
          className="pointer-events-none absolute -top-1 z-10 -translate-x-1/2 rounded-md bg-foreground px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-background shadow"
          style={{ left: `${Math.min(96, Math.max(4, hover * 100))}%` }}
        >
          {formatLabel ? formatLabel(hover) : `${Math.round(hover * 100)}%`}
        </div>
      )}
      <Slider value={[value * 100]} max={100} step={0.1} onValueCommit={(v) => onCommit(v[0] / 100)} className="flex-1" aria-label="Thanh tiến trình" />
    </div>
  )
}

export function PlayerBar() {
  const playerActive = useAppStore((s) => s.playerActive)
  const overlayOpen = useAppStore((s) => s.playerOverlayOpen)
  const setOverlayOpen = useAppStore((s) => s.setPlayerOverlayOpen)
  const setPlayerActive = useAppStore((s) => s.setPlayerActive)

  const player = usePlayerStore(useShallow((s) => ({
    seriesTitle: s.seriesTitle, coverUrl: s.coverUrl, chapters: s.chapters, currentIndex: s.currentIndex,
    currentChar: s.currentChar, isPlaying: s.isPlaying, isPaused: s.isPaused, busy: s.busy,
    seriesEnded: s.seriesEnded, rate: s.rate, error: s.error, sleepMode: s.sleepMode,
    sleepEndTime: s.sleepEndTime, sessionSeconds: s.sessionSeconds,
    togglePlayPause: s.togglePlayPause, seekBy: s.seekBy, seekTo: s.seekTo, prev: s.prev, next: s.next,
    setRate: s.setRate, stop: s.stop, setSleep: s.setSleep, replay: s.replay, playChapter: s.playChapter,
  })))

  const ch = player.chapters[player.currentIndex]
  const contentLen = ch?.content?.length || 1
  const progressFrac = Math.min(1, player.currentChar / contentLen)

  const sessionMin = Math.floor(player.sessionSeconds / 60)
  const sessionSec = player.sessionSeconds % 60
  const sessionTime = `${String(sessionMin).padStart(2, '0')}:${String(sessionSec).padStart(2, '0')}`

  // hotkeys
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!useAppStore.getState().playerActive) return
      const target = e.target as HTMLElement
      const tag = target?.tagName?.toLowerCase()
      // bỏ qua khi focus đang ở input/button (tránh Space double-trigger)
      if (tag === 'input' || tag === 'textarea' || tag === 'button' || target?.isContentEditable) return
      const st = usePlayerStore.getState()
      if (e.code === 'Space') { e.preventDefault(); st.togglePlayPause() }
      else if (e.code === 'ArrowLeft') { e.preventDefault(); st.seekBy(-0.05) }
      else if (e.code === 'ArrowRight') { e.preventDefault(); st.seekBy(0.05) }
      else if (e.code === 'ArrowUp') { e.preventDefault(); st.prev() }
      else if (e.code === 'ArrowDown') { e.preventDefault(); st.next() }
      else if (e.key === '?' || e.key === '/') { e.preventDefault(); useAppStore.getState().setPlayerOverlayOpen(true) }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  if (!playerActive || !ch) return null

  const rateIdx = RATE_PRESETS.indexOf(player.rate as any)
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
            <SeekSlider value={progressFrac} onCommit={(f) => player.seekTo(f)} formatLabel={(f) => `${Math.floor(f * 100)}%`} />
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
              <CoverImage title={player.seriesTitle} coverUrl={player.coverUrl} className="h-10 w-10" rounded="rounded-md" />
            </button>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium line-clamp-1">Chương {ch.orderNo}. {ch.title}</p>
              <p className="text-[10px] text-muted-foreground">{formatCharCount(player.currentChar)} / {formatCharCount(contentLen)}</p>
            </div>
            <div className="flex items-center gap-0.5 shrink-0">
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => player.prev()} aria-label="Chương trước">
                <SkipBack className="h-4 w-4" />
              </Button>
              <Button variant="default" size="icon" className="h-9 w-9" onClick={() => player.togglePlayPause()} disabled={player.busy} aria-label={player.isPlaying ? 'Tạm dừng' : 'Phát'}>
                {player.busy ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" /> :
                 player.seriesEnded ? <Repeat className="h-4 w-4" /> :
                 player.isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5 fill-current" />}
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => player.next()} aria-label="Chương sau">
                <SkipForward className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="sm" className="h-8 px-2 hidden sm:flex" onClick={() => player.setRate(nextRate)} title="Tốc độ đọc">
                <Gauge className="h-4 w-4 mr-1" /> {player.rate}x
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
          {(player.sessionSeconds > 0 || player.sleepMode !== 'off' || player.error || player.seriesEnded) && (
            <div className="flex items-center gap-2 pb-1.5 text-[10px]">
              {player.sessionSeconds > 0 && (
                <span className={`flex items-center gap-1 rounded-full px-2 py-0.5 tabular-nums ${player.isPlaying ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' : 'bg-muted text-muted-foreground'}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${player.isPlaying ? 'bg-emerald-500 animate-pulse' : 'bg-muted-foreground'}`} />
                  {sessionTime}
                </span>
              )}
              {player.sleepMode !== 'off' && (
                <span className="flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-primary">
                  <Moon className="h-3 w-3" />
                  Hẹn giờ: {SLEEP_OPTIONS.find((s) => s.key === player.sleepMode)?.label}
                  {player.sleepEndTime && ` · ${formatRemainingMs(player.sleepEndTime - Date.now())}`}
                </span>
              )}
              {player.seriesEnded && (
                <span className="rounded-full bg-muted px-2 py-0.5 text-muted-foreground">Đã nghe hết bộ truyện!</span>
              )}
              {player.error && (
                <span className="rounded-full bg-destructive/15 px-2 py-0.5 text-destructive">{player.error}</span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Full overlay */}
      <AnimatePresence>
        {overlayOpen && <PlayerOverlay />}
      </AnimatePresence>
    </>
  )
}

function PlayerOverlay() {
  const setOverlayOpen = useAppStore((s) => s.setPlayerOverlayOpen)
  const player = usePlayerStore(useShallow((s) => ({
    seriesId: s.seriesId, seriesTitle: s.seriesTitle, chapters: s.chapters, currentIndex: s.currentIndex,
    currentChar: s.currentChar, isPlaying: s.isPlaying, busy: s.busy,
    togglePlayPause: s.togglePlayPause,
  })))
  const [tab, setTab] = useState<'now' | 'chapters' | 'text' | 'settings'>('now')
  const [noteOpen, setNoteOpen] = useState(false)
  const [note, setNote] = useState('')
  const [noteSaving, setNoteSaving] = useState(false)

  const onBookmark = async (e?: React.FormEvent) => {
    e?.preventDefault()
    if (!player.seriesId) return
    const ch = player.chapters[player.currentIndex]
    if (!ch) return
    const user = useAppStore.getState().user
    if (!user) {
      toast.error('Vui lòng đăng nhập để đánh dấu vị trí.', {
        action: { label: 'Đăng nhập', onClick: () => useAppStore.getState().navigate({ view: 'login' }) },
      })
      return
    }
    setNoteSaving(true)
    try {
      await api.createBookmark({
        seriesId: player.seriesId,
        chapterId: ch.id,
        charIndex: player.currentChar,
        note: note.trim() || undefined,
      })
      toast.success(`Đã đánh dấu tại ${formatCharCount(player.currentChar)} — Chương ${ch.orderNo}`)
      setNote('')
      setNoteOpen(false)
    } catch (err) {
      const e2 = err as Error & { status?: number }
      if (e2.status === 401) {
        toast.error('Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại.', {
          action: { label: 'Đăng nhập', onClick: () => useAppStore.getState().navigate({ view: 'login' }) },
        })
      } else {
        toast.error('Đánh dấu thất bại: ' + (e2 as Error).message)
      }
    } finally {
      setNoteSaving(false)
    }
  }

  return (
    <motion.div
      initial={{ y: '100%' }}
      animate={{ y: 0 }}
      exit={{ y: '100%' }}
      transition={{ type: 'spring', damping: 30, stiffness: 300 }}
      className="fixed inset-0 z-50 flex flex-col bg-background pb-[env(safe-area-inset-bottom)]"
    >
      {/* header */}
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <div className="min-w-0 flex-1">
          <p className="text-xs text-muted-foreground">Đang phát</p>
          <p className="text-sm font-semibold line-clamp-1">{player.seriesTitle}</p>
        </div>
        <Button variant="ghost" size="icon" onClick={() => player.togglePlayPause()} disabled={player.busy} aria-label={player.isPlaying ? 'Tạm dừng' : 'Phát'}>
          {player.busy ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" /> :
           player.isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5 fill-current" />}
        </Button>
        <Button variant="ghost" size="icon" onClick={() => setNoteOpen((v) => !v)} aria-label="Đánh dấu vị trí hiện tại" title="Đánh dấu vị trí hiện tại">
          <Bookmark className="h-5 w-5" />
        </Button>
        <Button variant="ghost" size="icon" onClick={() => setOverlayOpen(false)} aria-label="Thu gọn">
          <ChevronDown className="h-5 w-5" />
        </Button>
      </div>

      {/* bookmark note inline */}
      <AnimatePresence>
        {noteOpen && (
          <motion.form
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            onSubmit={onBookmark}
            className="overflow-hidden border-b border-border bg-muted/40"
          >
            <div className="p-3 space-y-2">
              <label htmlFor="bookmark-note" className="text-xs font-medium text-muted-foreground">Ghi chú đánh dấu (không bắt buộc)</label>
              <Input
                id="bookmark-note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="VD: đoạn này hay, nghe lại…"
                className="h-9 text-sm"
                autoFocus
              />
              <div className="flex justify-end gap-2">
                <Button type="button" variant="ghost" size="sm" className="h-8" onClick={() => setNoteOpen(false)}>Hủy</Button>
                <Button type="submit" size="sm" className="h-8" disabled={noteSaving}>
                  {noteSaving ? 'Đang lưu…' : 'Lưu đánh dấu'}
                </Button>
              </div>
            </div>
          </motion.form>
        )}
      </AnimatePresence>

      {/* tabs */}
      <div className="flex border-b border-border">
        {[
          { key: 'now' as const, label: 'Đang phát', icon: AudioLines },
          { key: 'chapters' as const, label: 'Chương', icon: List },
          { key: 'text' as const, label: 'Xem chữ', icon: FileText },
          { key: 'settings' as const, label: 'Cài đặt', icon: Settings },
        ].map((t) => {
          const Icon = t.icon
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={cn(
                'relative flex flex-1 flex-col items-center gap-0.5 py-2 text-xs font-medium transition-colors',
                tab === t.key ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <Icon className="h-4 w-4" />
              <span>{t.label}</span>
              {tab === t.key && <span className="absolute bottom-0 left-1/2 h-0.5 w-8 -translate-x-1/2 rounded-full bg-primary" />}
            </button>
          )
        })}
      </div>

      {/* content */}
      <div className="flex-1 overflow-hidden">
        {tab === 'now' && <NowPlayingTab />}
        {tab === 'chapters' && <ChaptersTab key={player.seriesId || 'chapters'} />}
        {tab === 'text' && <TextTab />}
        {tab === 'settings' && <SettingsTab />}
      </div>
    </motion.div>
  )
}

function NowPlayingTab() {
  const player = usePlayerStore(useShallow((s) => ({
    seriesTitle: s.seriesTitle, coverUrl: s.coverUrl, chapters: s.chapters, currentIndex: s.currentIndex,
    currentChar: s.currentChar, sessionSeconds: s.sessionSeconds, rate: s.rate, isPlaying: s.isPlaying,
    busy: s.busy, seriesEnded: s.seriesEnded, error: s.error, sleepMode: s.sleepMode,
    togglePlayPause: s.togglePlayPause, seekTo: s.seekTo, seekBy: s.seekBy, prev: s.prev, next: s.next,
    setRate: s.setRate, setSleep: s.setSleep,
  })))
  const ch = player.chapters[player.currentIndex]
  const contentLen = ch?.content?.length || 1
  const frac = Math.min(1, player.currentChar / contentLen)
  const sessionMin = Math.floor(player.sessionSeconds / 60)
  const sessionSec = player.sessionSeconds % 60
  const sessionTime = `${String(sessionMin).padStart(2, '0')}:${String(sessionSec).padStart(2, '0')}`
  const totalMin = Math.max(1, Math.round(contentLen / 270))

  return (
    <div className="h-full overflow-y-auto bg-ambient">
      <div className="mx-auto flex max-w-3xl flex-col items-center px-4 py-6 sm:py-8">
        {/* cover */}
        <div className="aspect-[3/4] w-44 sm:w-56 overflow-hidden rounded-2xl border border-border/40 shadow-glow">
          <CoverImage title={player.seriesTitle} coverUrl={player.coverUrl} className="h-full w-full" rounded="" />
        </div>

        {/* title */}
        <div className="mt-5 px-2 text-center">
          <p className="line-clamp-1 text-xs text-muted-foreground">{player.seriesTitle}</p>
          <h2 className="mt-1 line-clamp-2 text-lg font-bold">Chương {ch?.orderNo}. {ch?.title}</h2>
        </div>

        {/* progress */}
        <div className="mt-5 w-full max-w-md">
          <SeekSlider value={frac} onCommit={(f) => player.seekTo(f)} formatLabel={(f) => `${Math.floor(f * 100)}%`} />
          <div className="mt-1.5 flex items-center justify-between text-xs text-muted-foreground tabular-nums">
            <span>{sessionTime}</span>
            <span className="font-medium text-primary">{Math.floor(frac * 100)}%</span>
            <span>~{totalMin} phút</span>
          </div>
        </div>

        {/* controls */}
        <div className="mt-6 flex items-center justify-center gap-2 sm:gap-3">
          <Button variant="ghost" size="icon" className="h-10 w-10" onClick={() => player.prev()} aria-label="Chương trước">
            <SkipBack className="h-5 w-5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-10 w-10" onClick={() => player.seekBy(-0.05)} aria-label="Lùi 5%">
            <Rewind className="h-5 w-5" />
          </Button>
          <Button variant="default" className="h-16 w-16 rounded-full p-0 shadow-glow" onClick={() => player.togglePlayPause()} disabled={player.busy} aria-label={player.isPlaying ? 'Tạm dừng' : 'Phát'}>
            {player.busy ? <span className="h-6 w-6 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" /> :
             player.seriesEnded ? <Repeat className="h-7 w-7" /> :
             player.isPlaying ? <Pause className="h-7 w-7" /> : <Play className="h-7 w-7 fill-current" />}
          </Button>
          <Button variant="ghost" size="icon" className="h-10 w-10" onClick={() => player.seekBy(0.05)} aria-label="Tiến 5%">
            <FastForward className="h-5 w-5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-10 w-10" onClick={() => player.next()} aria-label="Chương sau">
            <SkipForward className="h-5 w-5" />
          </Button>
        </div>

        {/* rate */}
        <div className="mt-6 flex items-center gap-1.5">
          <Gauge className="h-4 w-4 text-muted-foreground" />
          {RATE_PRESETS.map((r) => (
            <button
              key={r}
              onClick={() => player.setRate(r)}
              className={cn(
                'rounded-full border px-3 py-1 text-xs transition-colors',
                player.rate === r ? 'border-primary bg-primary text-primary-foreground' : 'border-border hover:border-primary'
              )}
            >
              {r}x
            </button>
          ))}
        </div>

        {/* sleep */}
        <div className="mt-3 flex flex-wrap items-center justify-center gap-1.5">
          <Moon className="h-4 w-4 text-muted-foreground" />
          {SLEEP_OPTIONS.map((s) => (
            <button
              key={String(s.key)}
              onClick={() => player.setSleep(s.key)}
              className={cn(
                'rounded-full border px-3 py-1 text-xs transition-colors',
                player.sleepMode === s.key ? 'border-primary bg-primary text-primary-foreground' : 'border-border hover:border-primary'
              )}
            >
              {s.label}
            </button>
          ))}
        </div>

        {(player.seriesEnded || player.error) && (
          <div className="mt-4 flex flex-wrap justify-center gap-2 text-xs">
            {player.seriesEnded && <span className="rounded-full bg-muted px-3 py-1 text-muted-foreground">Đã nghe hết bộ truyện!</span>}
            {player.error && <span className="rounded-full bg-destructive/15 px-3 py-1 text-destructive">{player.error}</span>}
          </div>
        )}
      </div>
    </div>
  )
}

const CHAPTER_BATCH = 200

function ChaptersTab() {
  const player = usePlayerStore(useShallow((s) => ({
    seriesId: s.seriesId, seriesTitle: s.seriesTitle, coverUrl: s.coverUrl, chapters: s.chapters,
    currentIndex: s.currentIndex, isPlaying: s.isPlaying, rate: s.rate, autoplayNext: s.autoplayNext,
    playChapter: s.playChapter,
  })))
  const [q, setQ] = useState('')
  const [visible, setVisible] = useState(CHAPTER_BATCH)

  const indexById = useMemo(() => {
    const m = new Map<string, number>()
    player.chapters.forEach((c, i) => m.set(c.id, i))
    return m
  }, [player.chapters])

  const chapters = player.chapters || []
  const filtered = q ? chapters.filter((c) => c.title.toLowerCase().includes(q.toLowerCase()) || String(c.orderNo) === q) : chapters
  const shown = filtered.slice(0, visible)
  const remaining = filtered.length - visible

  return (
    <div className="h-full flex flex-col">
      <div className="p-3 border-b border-border">
        <div className="relative">
          <Input value={q} onChange={(e) => { setQ(e.target.value); setVisible(CHAPTER_BATCH) }} placeholder="Tìm chương…" className="h-9" aria-label="Tìm chương" />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        {shown.map((c) => {
          const idx = indexById.get(c.id)
          const isCurrent = idx === player.currentIndex
          return (
            <button
              key={c.id}
              onClick={() => {
                if (idx === undefined) return
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
        {remaining > 0 && (
          <button
            onClick={() => setVisible((v) => v + CHAPTER_BATCH)}
            className="w-full py-3 text-center text-sm text-primary hover:bg-accent/50 transition-colors"
          >
            Tải thêm ({remaining} chương còn lại)
          </button>
        )}
      </div>
    </div>
  )
}

function HighlightedParagraph({ text, activeWordChar }: { text: string; activeWordChar: number }) {
  const words = useMemo(() => {
    const parts: { t: string; start: number }[] = []
    const re = /\S+/g
    let m: RegExpExecArray | null
    while ((m = re.exec(text)) !== null) parts.push({ t: m[0], start: m.index })
    return parts
  }, [text])
  return (
    <>
      {words.map((w, i) => {
        const isActive = activeWordChar >= w.start && activeWordChar < w.start + w.t.length
        return (
          <span key={i} className={cn(isActive ? 'word-highlight rounded-sm px-0.5 -mx-0.5' : '')}>
            {w.t}
            {i < words.length - 1 ? ' ' : ''}
          </span>
        )
      })}
    </>
  )
}

function TextTab() {
  const player = usePlayerStore(useShallow((s) => ({
    chapters: s.chapters, currentIndex: s.currentIndex, currentChar: s.currentChar,
  })))
  const { fontSize, fontFamily, lineHeight, hydrate } = useReaderSettings()
  useEffect(() => { hydrate() }, [hydrate])
  const ch = player.chapters[player.currentIndex]
  const containerRef = useRef<HTMLDivElement>(null)
  const [follow, setFollow] = useState(true)
  const [userScrolled, setUserScrolled] = useState(false)

  const paragraphs = useMemo(() => (ch?.content || '').split('\n').filter((p) => p.trim()), [ch?.content])

  // compute current paragraph + char offset based on char index
  const { currentParaIdx, paraStart } = useMemo(() => {
    let acc = 0
    let idx = 0
    let start = 0
    for (let i = 0; i < paragraphs.length; i++) {
      const plen = paragraphs[i].length + 1
      if (acc + plen > player.currentChar) { idx = i; start = acc; break }
      acc += plen
      idx = i
      start = acc
    }
    return { currentParaIdx: idx, paraStart: start }
  }, [paragraphs, player.currentChar])

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
        {paragraphs.map((p, i) => {
          const isActive = i === currentParaIdx
          const activeWordChar = isActive ? Math.max(0, player.currentChar - paraStart) : -1
          return (
            <p
              key={i}
              data-para-idx={i}
              className={cn('mb-3 transition-colors', isActive && 'player-highlight')}
            >
              {isActive ? (
                <HighlightedParagraph text={p} activeWordChar={activeWordChar} />
              ) : p}
            </p>
          )
        })}
        {paragraphs.length === 0 && <p className="text-muted-foreground">Không có nội dung.</p>}
      </div>
    </div>
  )
}

function SettingsTab() {
  const player = usePlayerStore(useShallow((s) => ({
    rate: s.rate, sleepMode: s.sleepMode, sleepEndTime: s.sleepEndTime, autoplayNext: s.autoplayNext,
    seriesEnded: s.seriesEnded, setRate: s.setRate, setSleep: s.setSleep, setAutoplayNext: s.setAutoplayNext,
    stop: s.stop, replay: s.replay,
  })))

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
          <Button variant={player.autoplayNext ? 'default' : 'outline'} size="sm" onClick={() => player.setAutoplayNext(true)}>Bật</Button>
          <Button variant={!player.autoplayNext ? 'default' : 'outline'} size="sm" onClick={() => player.setAutoplayNext(false)}>Tắt</Button>
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
          <ShortcutRow keys="?" desc="Mở trình nghe đầy đủ" />
        </div>
        <p className="text-xs text-muted-foreground mt-1.5">Chỉ hoạt động khi overlay đóng và focus không nằm trong ô nhập / nút bấm.</p>
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
