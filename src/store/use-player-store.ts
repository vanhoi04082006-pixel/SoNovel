'use client'

import { create } from 'zustand'
import { api } from '@/lib/api-client'

export type PlayerChapter = {
  id: string
  orderNo: number
  title: string
  content: string
  wordCount: number
}

type SleepMode = 'off' | 10 | 15 | 30 | 60 | 'end-of-chapter'

interface PlayerState {
  seriesId: string | null
  seriesTitle: string
  coverUrl: string
  chapters: PlayerChapter[]
  currentIndex: number
  currentChar: number // absolute char index within current chapter content
  rate: number
  isPlaying: boolean
  isPaused: boolean
  busy: boolean
  seriesEnded: boolean
  error: string | null
  sessionSeconds: number // live session timer (seconds played this session)

  sleepMode: SleepMode
  sleepEndTime: number | null // epoch ms
  sleepChapterEndFlag: boolean

  autoplayNext: boolean

  // local event subscribers
  _listeners: Map<string, Set<(payload?: any) => void>>

  // actions
  playChapter: (opts: { seriesId: string; seriesTitle: string; coverUrl: string; chapters: PlayerChapter[]; index: number; startChar?: number; rate?: number; autoplayNext?: boolean }) => void
  togglePlayPause: () => void
  pause: () => void
  resume: () => void
  stop: () => void
  seekTo: (frac: number) => void
  seekBy: (deltaFrac: number) => void
  next: () => void
  prev: () => void
  replay: () => void
  setRate: (r: number) => void
  setSleep: (m: SleepMode) => void
  setAutoplayNext: (v: boolean) => void
  clearError: () => void
  on: (type: string, cb: (payload?: any) => void) => () => void
  emit: (type: string, payload?: any) => void
}

const RATE_PRESETS = [0.75, 1, 1.25, 1.5, 2]
// Smaller chunks → speech starts almost instantly & avoids Chrome TTS repeat bug.
const CHUNK_SIZE = 800
const CHUNK_TRANSITION_DELAY_MS = 50
const SAVE_INTERVAL_MS = 4000

// ---- chunking: split at ~800 chars, prefer sentence boundary ----
function chunkText(text: string): { text: string; offset: number }[] {
  const chunks: { text: string; offset: number }[] = []
  if (!text) return chunks
  let i = 0
  while (i < text.length) {
    let end = Math.min(i + CHUNK_SIZE, text.length)
    if (end < text.length) {
      // find last sentence boundary within [i+200, end]
      const window = text.slice(i, end)
      const boundaryRe = /[.!?…]\s+/g
      let last = -1
      let m: RegExpExecArray | null
      while ((m = boundaryRe.exec(window)) !== null) {
        last = m.index + m[0].length
      }
      if (last > 200) end = i + last
      else {
        // fallback: break at last space
        const sp = window.lastIndexOf(' ', end - i)
        if (sp > 200) end = i + sp
      }
    }
    chunks.push({ text: text.slice(i, end), offset: i })
    i = end
  }
  return chunks
}

function findChunkIndex(chunks: { offset: number }[], charIndex: number): number {
  for (let i = chunks.length - 1; i >= 0; i--) {
    if (chunks[i].offset <= charIndex) return i
  }
  return 0
}

// singleton synth
let synth: SpeechSynthesis | null = null
let currentUtterance: SpeechSynthesisUtterance | null = null
let currentChunks: { text: string; offset: number }[] = []
let currentChunkIdx = 0
let generation = 0
let saveTimer: ReturnType<typeof setInterval> | null = null
let sleepTimer: ReturnType<typeof setInterval> | null = null
let sessionTimer: ReturnType<typeof setInterval> | null = null
let titleAnnouncedForChapter = -1

function getSynth(): SpeechSynthesis | null {
  if (typeof window === 'undefined') return null
  if (!synth) synth = window.speechSynthesis
  return synth
}

function pickVoice(): SpeechSynthesisVoice | null {
  const s = getSynth()
  if (!s) return null
  const voices = s.getVoices()
  // prefer vi-VN
  const vi = voices.find((v) => v.lang && v.lang.toLowerCase().startsWith('vi'))
  return vi || voices[0] || null
}

// kick-start voice loading (non-blocking) — playback proceeds with available voice
function ensureVoices() {
  const s = getSynth()
  if (!s) return
  if (s.getVoices().length === 0) {
    s.onvoiceschanged = () => {}
  }
}

export const usePlayerStore = create<PlayerState>((set, get) => {
  // ---- internal: speak current chunk ----
  const speakCurrentChunk = () => {
    const s = getSynth()
    if (!s) {
      set({ error: 'Trình duyệt không hỗ trợ đọc tiếng (Web Speech API).' })
      return
    }
    const gen = generation
    const state = get()
    if (currentChunkIdx >= currentChunks.length) {
      // chapter done → next
      onChapterEnd()
      return
    }
    // cancel any pending
    s.cancel()

    const chunk = currentChunks[currentChunkIdx]
    let textToSpeak = chunk.text
    // announce title at chapter start
    if (state.currentChar < chunk.offset + 5 && titleAnnouncedForChapter !== state.currentIndex) {
      const ch = state.chapters[state.currentIndex]
      if (ch) {
        textToSpeak = `Chương ${ch.orderNo}. ${ch.title}. ` + chunk.text
        titleAnnouncedForChapter = state.currentIndex
      }
    }

    const u = new SpeechSynthesisUtterance(textToSpeak)
    u.lang = 'vi-VN'
    u.rate = state.rate
    const v = pickVoice()
    if (v) u.voice = v
    u.onstart = () => {
      if (gen !== generation) return
      set({ isPlaying: true, isPaused: false, busy: false, error: null })
      get().emit('stateChange', { isPlaying: true })
      updateMediaSession()
    }
    u.onboundary = (e) => {
      if (gen !== generation) return
      if (e.name && e.name !== 'word') return
      const abs = chunk.offset + (e.charIndex || 0)
      // subtract title prefix length if title was prepended
      let real = abs
      if (textToSpeak !== chunk.text) {
        const prefixLen = textToSpeak.length - chunk.text.length
        real = abs - prefixLen
      }
      if (real < 0) real = chunk.offset
      set({ currentChar: Math.max(real, 0) })
      get().emit('progress', { charIndex: get().currentChar })
      syncMediaSessionPosition()
    }
    u.onend = () => {
      if (gen !== generation) return
      // chunk finished → next chunk (small delay avoids Chrome repeat bug)
      const st = get()
      if (!st.isPlaying && !st.isPaused) return // was stopped
      currentChunkIdx++
      if (currentChunkIdx < currentChunks.length) {
        setTimeout(() => {
          if (gen === generation) speakCurrentChunk()
        }, CHUNK_TRANSITION_DELAY_MS)
      } else {
        onChapterEnd()
      }
    }
    u.onerror = (e) => {
      // 'interrupted' / 'canceled' are normal on stop/seek — ignore
      const errType = (e as any).error
      if (errType === 'interrupted' || errType === 'canceled') return
      console.warn('TTS error', errType)
      set({ error: 'Lỗi đọc: ' + errType, busy: false })
    }
    currentUtterance = u
    s.speak(u)
  }

  const onChapterEnd = () => {
    const st = get()
    // sleep: end-of-chapter
    if (st.sleepMode === 'end-of-chapter') {
      stopInternal()
      set({ sleepMode: 'off', sleepChapterEndFlag: true, isPlaying: false, isPaused: false })
      get().emit('sleepHit', { mode: 'end-of-chapter' })
      return
    }
    if (st.currentIndex + 1 < st.chapters.length) {
      if (st.autoplayNext) {
        const nextIdx = st.currentIndex + 1
        playChapterInternal(nextIdx, 0)
      } else {
        set({ isPlaying: false, isPaused: true })
        get().emit('chapterEnd', { index: st.currentIndex })
      }
    } else {
      // series ended
      stopInternal()
      set({ seriesEnded: true, isPlaying: false, isPaused: false })
      get().emit('seriesEnd', {})
    }
  }

  // Ensure the chapter at `index` has content loaded; fetch on demand if missing.
  const ensureChapterContent = async (index: number): Promise<string> => {
    const st = get()
    const ch = st.chapters[index]
    if (!ch) return ''
    if (ch.content) return ch.content
    try {
      const full = await api.getChapter(ch.id)
      const content = full.content || ''
      set((s) => ({
        chapters: s.chapters.map((c) => (c.id === ch.id ? { ...c, content } : c)),
      }))
      return content
    } catch {
      set({ error: 'Không tải được nội dung chương.' })
      return ''
    }
  }

  // Prefetch the given chapter content in the background (fire-and-forget).
  const prefetchChapter = (index: number) => {
    const st = get()
    const ch = st.chapters[index]
    if (!ch || ch.content) return
    api.getChapter(ch.id).then((full) => {
      const content = full.content || ''
      set((s) => ({
        chapters: s.chapters.map((c) => (c.id === ch.id ? { ...c, content } : c)),
      }))
    }).catch(() => {})
  }

  const playChapterInternal = async (index: number, startChar: number) => {
    const st = get()
    if (st.busy) return
    const ch = st.chapters[index]
    if (!ch) return
    generation++
    const gen = generation
    set({ busy: true })
    const content = await ensureChapterContent(index)
    if (gen !== generation) return
    const st2 = get()
    // Reset session timer khi bắt đầu series mới (index 0 + startChar 0)
    const isNewSeries = index === 0 && startChar === 0 && st2.currentIndex !== 0
    set({
      currentIndex: index,
      currentChar: startChar,
      isPlaying: false,
      isPaused: false,
      busy: false,
      seriesEnded: false,
      error: null,
      sessionSeconds: isNewSeries ? 0 : st2.sessionSeconds,
    })
    get().emit('chapterChange', { index })
    currentChunks = chunkText(content)
    currentChunkIdx = findChunkIndex(currentChunks, startChar)
    // adjust startChar to chunk offset boundary (speak whole chunk, but we won't skip mid-chunk for simplicity)
    titleAnnouncedForChapter = startChar === 0 ? -1 : index // only announce if starting from 0
    speakCurrentChunk()
    startSaveTimer()
    startSleepTimer()
    startSessionTimer()
    flushSave()
    // Prefetch the following chapter so next is near-instant.
    prefetchChapter(index + 1)
  }

  const startSaveTimer = () => {
    stopSaveTimer()
    saveTimer = setInterval(() => {
      const st = get()
      if (st.isPlaying && st.seriesId) {
        const ch = st.chapters[st.currentIndex]
        api.saveProgress({
          seriesId: st.seriesId,
          listenChapterId: ch?.id,
          listenCharIndex: st.currentChar,
          playbackSpeed: st.rate,
        }).then(() => {
          checkAchievementUnlocks()
        }).catch(() => {})
        // Track actual listening seconds (30s per tick)
        api.saveSession({
          seriesId: st.seriesId,
          chapterId: ch?.id,
          durationSec: SAVE_INTERVAL_MS / 1000,
        }).catch(() => {})
      }
    }, SAVE_INTERVAL_MS)
  }

  const stopSaveTimer = () => {
    if (saveTimer) { clearInterval(saveTimer); saveTimer = null }
  }

  // Live session timer — increment sessionSeconds mỗi giây khi isPlaying
  const startSessionTimer = () => {
    stopSessionTimer()
    sessionTimer = setInterval(() => {
      const st = get()
      if (st.isPlaying) {
        set({ sessionSeconds: st.sessionSeconds + 1 })
      }
    }, 1000)
  }

  const stopSessionTimer = () => {
    if (sessionTimer) { clearInterval(sessionTimer); sessionTimer = null }
  }

  // Track previous unlocked achievements to detect new unlocks
  let prevUnlockedIds: Set<string> | null = null

  const checkAchievementUnlocks = async () => {
    try {
      const r = await api.achievementsStats()
      const currentUnlocked = new Set(r.achievements.filter((a: any) => a.unlocked).map((a: any) => a.id))
      if (prevUnlockedIds === null) {
        // First load — just cache, don't toast
        prevUnlockedIds = currentUnlocked
        return
      }
      // Find newly unlocked (in current but not in prev)
      const newUnlocks = r.achievements.filter((a: any) => a.unlocked && !prevUnlockedIds!.has(a.id))
      prevUnlockedIds = currentUnlocked
      // Fire toast for each new unlock
      newUnlocks.forEach((a: any) => {
        // dynamic import to avoid circular dep
        import('sonner').then(({ toast }) => {
          toast.success(`🏆 Mở khóa: ${a.title}!`, {
            description: a.desc,
            duration: 6000,
          })
        })
      })
    } catch {}
  }

  // Goal progress notification — toast khi challenge đạt 80%+
  let prevGoalNotifiedIds: Set<string> | null = null

  const checkGoalProgress = async () => {
    try {
      const r = await api.challengeStats()
      // Find challenges at 80-99% (not yet unlocked)
      const nearGoal = r.challenges.filter((c: any) => {
        const pct = (c.progress / c.goal) * 100
        return pct >= 80 && pct < 100
      })
      if (prevGoalNotifiedIds === null) {
        prevGoalNotifiedIds = new Set()
        return
      }
      nearGoal.forEach((c: any) => {
        if (!prevGoalNotifiedIds!.has(c.id)) {
          prevGoalNotifiedIds!.add(c.id)
          import('sonner').then(({ toast }) => {
            const pct = Math.round((c.progress / c.goal) * 100)
            toast.info(`🎯 Sắp đạt: ${c.title}`, {
              description: `Đã ${c.progress}/${c.goal} ${c.unit} (${pct}%) — cố lên!`,
              duration: 5000,
            })
          })
        }
      })
      // Clear notified khi đã unlock
      r.challenges.filter((c: any) => c.unlocked).forEach((c: any) => {
        prevGoalNotifiedIds!.delete(c.id)
      })
    } catch {}
  }

  const flushSave = () => {
    const st = get()
    if (!st.seriesId) return
    const ch = st.chapters[st.currentIndex]
    api.saveProgress({
      seriesId: st.seriesId,
      listenChapterId: ch?.id,
      listenCharIndex: st.currentChar,
      playbackSpeed: st.rate,
    }).then(() => {
      // Check for new achievement unlocks + goal progress after progress save
      checkAchievementUnlocks()
      checkGoalProgress()
    }).catch(() => {})
  }

  const startSleepTimer = () => {
    stopSleepTimer()
    const st = get()
    if (typeof st.sleepMode === 'number') {
      const end = Date.now() + (st.sleepMode as number) * 60 * 1000
      set({ sleepEndTime: end })
      sleepTimer = setInterval(() => {
        if (Date.now() >= end) {
          stopInternal()
          set({ sleepMode: 'off', sleepEndTime: null, isPlaying: false, isPaused: false })
          get().emit('sleepHit', { mode: 'timer' })
        }
      }, 1000)
    }
  }

  const stopSleepTimer = () => {
    if (sleepTimer) { clearInterval(sleepTimer); sleepTimer = null }
  }

  const stopInternal = () => {
    generation++ // invalidate any pending chunk-transition timers
    const s = getSynth()
    if (s) s.cancel()
    currentUtterance = null
    stopSaveTimer()
    stopSleepTimer()
    stopSessionTimer()
  }

  const updateMediaSession = () => {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return
    const st = get()
    const ch = st.chapters[st.currentIndex]
    navigator.mediaSession.metadata = new MediaMetadata({
      title: `Chương ${ch?.orderNo}. ${ch?.title || ''}`,
      artist: st.seriesTitle,
      album: 'SoNovel',
      artwork: st.coverUrl ? [{ src: st.coverUrl, sizes: '512x512', type: 'image/png' }] : [],
    })
    navigator.mediaSession.setActionHandler('play', () => get().resume())
    navigator.mediaSession.setActionHandler('pause', () => get().pause())
    navigator.mediaSession.setActionHandler('previoustrack', () => get().prev())
    navigator.mediaSession.setActionHandler('nexttrack', () => get().next())
    syncMediaSessionPosition()
  }

  // Đồng bộ vị trí lên lock-screen / media controls (Web Speech không phát audio thật,
  // ước tính ~4.5 ký tự/giây ở rate 1 cho setPositionState).
  const syncMediaSessionPosition = () => {
    try {
      if (typeof navigator === 'undefined' || !('mediaSession' in navigator) || !('setPositionState' in navigator.mediaSession)) return
      const st = get()
      const ch = st.chapters[st.currentIndex]
      if (!ch) return
      const len = Math.max(1, ch.content.length)
      const charsPerSec = Math.max(0.5, 4.5 * (st.rate || 1))
      navigator.mediaSession.setPositionState({
        duration: len / charsPerSec,
        position: Math.min(len, st.currentChar || 0) / charsPerSec,
        playbackRate: st.rate || 1,
      })
    } catch {}
  }

  return {
    seriesId: null,
    seriesTitle: '',
    coverUrl: '',
    chapters: [],
    currentIndex: 0,
    currentChar: 0,
    rate: 1,
    isPlaying: false,
    isPaused: false,
    busy: false,
    seriesEnded: false,
    error: null,
    sessionSeconds: 0,
    sleepMode: 'off',
    sleepEndTime: null,
    sleepChapterEndFlag: false,
    autoplayNext: true,
    _listeners: new Map(),

    playChapter: async (opts) => {
      ensureVoices() // non-blocking: start with available voice, better voice applies later
      stopInternal()
      set({
        seriesId: opts.seriesId,
        seriesTitle: opts.seriesTitle,
        coverUrl: opts.coverUrl,
        chapters: opts.chapters,
        autoplayNext: opts.autoplayNext ?? true,
        rate: opts.rate ?? get().rate,
        busy: false,
      })
      playChapterInternal(opts.index, opts.startChar ?? 0)
    },

    togglePlayPause: () => {
      const st = get()
      if (st.busy) return
      if (st.isPlaying) {
        get().pause()
      } else if (st.isPaused) {
        get().resume()
      } else {
        // nothing playing → resume from current
        get().resume()
      }
    },

    pause: () => {
      const s = getSynth()
      if (s) s.pause()
      set({ isPlaying: false, isPaused: true })
      get().emit('stateChange', { isPlaying: false })
      flushSave()
    },

    resume: () => {
      const s = getSynth()
      if (!s) {
        set({ error: 'Trình duyệt không hỗ trợ đọc tiếng.' })
        return
      }
      const st = get()
      if (st.seriesEnded) {
        // restart from beginning
        set({ seriesEnded: false })
        playChapterInternal(0, 0)
        return
      }
      if (st.chapters.length === 0) return
      // if was paused, just resume synth; else (stopped/cold) restart from saved position
      if (st.isPaused && currentUtterance) {
        s.resume()
        set({ isPlaying: true, isPaused: false })
        get().emit('stateChange', { isPlaying: true })
        startSaveTimer()
        startSleepTimer()
      } else {
        // cold start → restart from currentChar
        playChapterInternal(st.currentIndex, st.currentChar)
      }
    },

    stop: () => {
      stopInternal()
      set({ isPlaying: false, isPaused: false, busy: false })
      get().emit('stateChange', { isPlaying: false })
      flushSave()
    },

    seekTo: (frac) => {
      const st = get()
      const ch = st.chapters[st.currentIndex]
      if (!ch) return
      const target = Math.max(0, Math.min(ch.content.length - 1, Math.floor(frac * ch.content.length)))
      set({ currentChar: target })
      // restart from target
      if (st.isPlaying || st.isPaused) {
        generation++
        currentChunks = chunkText(ch.content)
        currentChunkIdx = findChunkIndex(currentChunks, target)
        titleAnnouncedForChapter = target === 0 ? -1 : st.currentIndex
        speakCurrentChunk()
        if (st.isPaused) {
          // keep paused
          const s = getSynth()
          if (s) s.pause()
          set({ isPlaying: false, isPaused: true })
        }
      }
      syncMediaSessionPosition()
      get().emit('progress', { charIndex: target })
      flushSave()
    },

    seekBy: (deltaFrac) => {
      const st = get()
      const ch = st.chapters[st.currentIndex]
      if (!ch) return
      const cur = st.currentChar / Math.max(1, ch.content.length)
      get().seekTo(cur + deltaFrac)
    },

    next: () => {
      const st = get()
      if (st.currentIndex + 1 < st.chapters.length) {
        playChapterInternal(st.currentIndex + 1, 0)
      } else {
        set({ seriesEnded: true, isPlaying: false, isPaused: false })
        stopInternal()
        get().emit('seriesEnd', {})
      }
    },

    prev: () => {
      const st = get()
      if (st.currentIndex > 0) {
        playChapterInternal(st.currentIndex - 1, 0)
      } else {
        // restart current chapter
        playChapterInternal(0, 0)
      }
    },

    replay: () => {
      const st = get()
      set({ seriesEnded: false })
      playChapterInternal(0, 0)
    },

    setRate: (r) => {
      set({ rate: r })
      api.saveSettings({ playbackSpeed: r }).catch(() => {})
      // restart from current position with new rate
      const st = get()
      if (st.isPlaying || st.isPaused) {
        const ch = st.chapters[st.currentIndex]
        if (ch) {
          generation++
          currentChunks = chunkText(ch.content)
          currentChunkIdx = findChunkIndex(currentChunks, st.currentChar)
          speakCurrentChunk()
          if (st.isPaused) {
            const s = getSynth()
            if (s) s.pause()
          }
        }
      }
    },

    setSleep: (m) => {
      set({ sleepMode: m, sleepEndTime: null, sleepChapterEndFlag: false })
      if (m === 'off') {
        stopSleepTimer()
      } else if (typeof m === 'number') {
        startSleepTimer()
      }
    },

    setAutoplayNext: (v) => set({ autoplayNext: v }),

    clearError: () => set({ error: null }),

    on: (type, cb) => {
      const map = get()._listeners
      if (!map.has(type)) map.set(type, new Set())
      map.get(type)!.add(cb)
      return () => { map.get(type)?.delete(cb) }
    },

    emit: (type, payload) => {
      const set1 = get()._listeners.get(type)
      if (set1) set1.forEach((cb) => cb(payload))
    },
  }
})

export { RATE_PRESETS }
export type { SleepMode }
