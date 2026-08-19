'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { ChevronLeft, ChevronRight, List, Minus, Plus, BookOpen } from 'lucide-react'
import { useAppStore } from '@/store/use-app-store'
import { api, type ChapterItem } from '@/lib/api-client'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'
import { useReaderSettings, FONT_FAMILY_CSS } from '@/store/use-reader-settings'

type ChapterInfo = { id: string; orderNo: number; title: string; wordCount: number }

export function ReaderScreen() {
  const { view, navigate, user } = useAppStore()
  const seriesId = view.view === 'reader' ? view.seriesId : ''
  const initialChapterId = view.view === 'reader' ? view.chapterId : ''
  const { fontSize, fontFamily, lineHeight, setFontSize, hydrate } = useReaderSettings()

  const [seriesTitle, setSeriesTitle] = useState('')
  const [chapters, setChapters] = useState<ChapterInfo[]>([])
  const [chapter, setChapter] = useState<ChapterItem | null>(null)
  const [loading, setLoading] = useState(true)
  const [listOpen, setListOpen] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const currentCharRef = useRef(0)

  const content = chapter?.content || ''
  const currentIndex = chapters.findIndex((c) => c.id === chapter?.id)

  const saveRead = useCallback((charIndex: number) => {
    if (!user || !chapter) return
    currentCharRef.current = charIndex
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      const total = Math.max(1, chapter.content?.length ?? 0)
      api.saveReadProgress({
        seriesId,
        readChapterId: chapter.id,
        readCharIndex: currentCharRef.current,
        readPercent: Math.round((currentCharRef.current / total) * 100),
      }).catch(() => {})
    }, 1500)
  }, [user, chapter, seriesId])

  const loadChapter = useCallback(async (id: string) => {
    setLoading(true)
    try {
      const c = await api.getChapter(id)
      setChapter(c)
      currentCharRef.current = 0
    } catch {
      toast.error('Không tải được chương.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    hydrate()
  }, [hydrate])

  useEffect(() => {
    if (!seriesId) return
    let cancelled = false
    ;(async () => {
      try {
        const [d, p] = await Promise.all([
          api.getSeries(seriesId),
          user ? api.getProgress(seriesId) : Promise.resolve({ progress: null }),
        ])
        if (cancelled) return
        setSeriesTitle(d.title)
        setChapters(d.chapters.map((c) => ({ id: c.id, orderNo: c.orderNo, title: c.title, wordCount: c.wordCount })))
        // chọn chương: theo initialChapterId, else read progress, else chương đầu
        let target = initialChapterId
        if (!target && p.progress?.readChapterId && d.chapters.some((c) => c.id === p.progress.readChapterId)) {
          target = p.progress.readChapterId
        }
        const chapterId = target || d.chapters[0]?.id
        if (chapterId) await loadChapter(chapterId)
      } catch {
        if (!cancelled) toast.error('Không tải được truyện.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [seriesId, initialChapterId, user, loadChapter])

  // scroll tracking
  const onScroll = useCallback(() => {
    const el = scrollRef.current
    if (!el || !content) return
    const max = el.scrollHeight - el.clientHeight
    if (max <= 0) return
    const frac = Math.min(1, Math.max(0, el.scrollTop / max))
    const charIndex = Math.round(frac * content.length)
    saveRead(charIndex)
  }, [content, saveRead])

  const gotoChapter = (id: string) => {
    saveRead(currentCharRef.current)
    setListOpen(false)
    loadChapter(id)
  }
  const goPrev = () => { if (currentIndex > 0) gotoChapter(chapters[currentIndex - 1].id) }
  const goNext = () => { if (currentIndex >= 0 && currentIndex < chapters.length - 1) gotoChapter(chapters[currentIndex + 1].id) }

  // save on unmount
  useEffect(() => () => {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    if (user && chapter) {
      api.saveReadProgress({
        seriesId,
        readChapterId: chapter.id,
        readCharIndex: currentCharRef.current,
        readPercent: Math.round((currentCharRef.current / Math.max(1, chapter.content?.length ?? 0)) * 100),
      }).catch(() => {})
    }
  }, [user, chapter, seriesId])

  const fontCss = FONT_FAMILY_CSS[fontFamily]

  if (!seriesId) return null

  return (
    <div className="mx-auto max-w-3xl px-3 sm:px-4 py-4 flex flex-col min-h-[calc(100vh-8rem)]">
      {/* Top bar */}
      <div className="flex items-center gap-2 mb-3">
        <Button variant="ghost" size="sm" onClick={() => navigate({ view: 'story', seriesId })} className="-ml-2">
          <ChevronLeft className="h-4 w-4" /> Quay lại
        </Button>
        <div className="flex-1 min-w-0 text-center">
          <p className="text-sm font-semibold truncate">{seriesTitle}</p>
          {chapter && <p className="text-xs text-muted-foreground">Chương {chapter.orderNo}. {chapter.title}</p>}
        </div>
        <div className="flex items-center gap-1">
          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setFontSize(fontSize - 1)} aria-label="Giảm cỡ chữ">
            <Minus className="h-4 w-4" />
          </Button>
          <span className="text-xs tabular-nums w-6 text-center">{fontSize}</span>
          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setFontSize(fontSize + 1)} aria-label="Tăng cỡ chữ">
            <Plus className="h-4 w-4" />
          </Button>
          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setListOpen(!listOpen)} aria-label="Danh sách chương">
            <List className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {listOpen && (
        <div className="mb-3 rounded-xl border border-border max-h-72 overflow-y-auto">
          {chapters.map((c) => (
            <button
              key={c.id}
              onClick={() => gotoChapter(c.id)}
              className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-accent ${c.id === chapter?.id ? 'bg-primary/10 text-primary' : ''}`}
            >
              <span className="text-xs text-muted-foreground w-8">{c.orderNo}</span>
              <span className="flex-1 line-clamp-1">{c.title}</span>
            </button>
          ))}
        </div>
      )}

      {/* Content */}
      <div
        ref={scrollRef}
        onScroll={onScroll}
        className="flex-1 overflow-y-auto rounded-xl border border-border bg-card p-4 sm:p-6"
        style={{ fontFamily: fontCss, fontSize, lineHeight }}
      >
        {loading ? (
          <div className="space-y-3">
            <Skeleton className="h-5 w-2/3" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-4/5" />
          </div>
        ) : content ? (
          <article>
            <h1 className="text-xl font-bold mb-4">Chương {chapter?.orderNo}. {chapter?.title}</h1>
            {content.split(/\n+/).filter(Boolean).map((para, i) => (
              <p key={i} className="mb-3 text-justify">{para}</p>
            ))}
          </article>
        ) : (
          <div className="py-16 text-center text-muted-foreground">Chưa có nội dung chương.</div>
        )}
      </div>

      {/* Bottom nav */}
      <div className="flex items-center justify-between gap-2 mt-3">
        <Button variant="outline" size="sm" onClick={goPrev} disabled={currentIndex <= 0}>
          <ChevronLeft className="h-4 w-4 mr-1" /> Chương trước
        </Button>
        <span className="text-xs text-muted-foreground flex items-center gap-1">
          <BookOpen className="h-3.5 w-3.5" /> {currentIndex + 1}/{chapters.length}
        </span>
        <Button variant="outline" size="sm" onClick={goNext} disabled={currentIndex >= chapters.length - 1}>
          Chương sau <ChevronRight className="h-4 w-4 ml-1" />
        </Button>
      </div>
    </div>
  )
}
