'use client'

import { create } from 'zustand'
import { api } from '@/lib/api-client'

// Reader settings cho tab "Xem chữ" trong player + trang Settings
// Mirror user_settings: fontSize, fontFamily, lineHeight, theme, autoplayNext, playbackSpeed

export type FontFamily = 'system' | 'serif' | 'sans' | 'mono'
interface ReaderState {
  fontSize: number // px
  fontFamily: FontFamily
  lineHeight: number
  // hydrated từ server / localStorage
  hydrated: boolean

  hydrate: () => Promise<void>
  setFontSize: (n: number) => void
  setFontFamily: (f: FontFamily) => void
  setLineHeight: (n: number) => void
}

const LS_KEY = 'sonovel-reader-settings'

function loadLocal(): Partial<ReaderState> {
  if (typeof window === 'undefined') return {}
  try {
    const v = JSON.parse(localStorage.getItem(LS_KEY) || '{}')
    return v
  } catch { return {} }
}

function saveLocal(s: { fontSize: number; fontFamily: FontFamily; lineHeight: number }) {
  if (typeof window === 'undefined') return
  try { localStorage.setItem(LS_KEY, JSON.stringify(s)) } catch {}
}

// Persist store qua HMR (giống pattern Prisma client)
const globalForReader = globalThis as unknown as { __readerSettings?: typeof useReaderSettings }

// Debounce save server — tránh gọi API mỗi nấc kéo slider (fontSize/lineHeight).
let serverSaveTimer: ReturnType<typeof setTimeout> | null = null

export const useReaderSettings = globalForReader.__readerSettings ?? create<ReaderState>((set, get) => ({
  fontSize: 18,
  fontFamily: 'system',
  lineHeight: 1.8,
  hydrated: false,

  hydrate: async () => {
    if (get().hydrated) return
    const local = loadLocal()
    let server: any = null
    try {
      const r = await api.getSettings()
      server = r.settings
    } catch {}
    set({
      fontSize: server?.fontSize ?? local.fontSize ?? 18,
      fontFamily: (server?.fontFamily ?? local.fontFamily ?? 'system') as FontFamily,
      lineHeight: server?.lineHeight ?? local.lineHeight ?? 1.8,
      hydrated: true,
    })
  },

  setFontSize: (n) => {
    const clamped = Math.min(32, Math.max(14, n))
    set({ fontSize: clamped })
    const s = get()
    saveLocal({ fontSize: s.fontSize, fontFamily: s.fontFamily, lineHeight: s.lineHeight })
    if (serverSaveTimer) clearTimeout(serverSaveTimer)
    serverSaveTimer = setTimeout(() => {
      const cur = get()
      api.saveSettings({ fontSize: cur.fontSize, fontFamily: cur.fontFamily, lineHeight: cur.lineHeight }).catch(() => {})
    }, 600)
  },

  setFontFamily: (f) => {
    set({ fontFamily: f })
    const s = get()
    saveLocal({ fontSize: s.fontSize, fontFamily: s.fontFamily, lineHeight: s.lineHeight })
    if (serverSaveTimer) clearTimeout(serverSaveTimer)
    serverSaveTimer = setTimeout(() => {
      const cur = get()
      api.saveSettings({ fontSize: cur.fontSize, fontFamily: cur.fontFamily, lineHeight: cur.lineHeight }).catch(() => {})
    }, 600)
  },

  setLineHeight: (n) => {
    const clamped = Math.min(2.4, Math.max(1.3, n))
    set({ lineHeight: clamped })
    const s = get()
    saveLocal({ fontSize: s.fontSize, fontFamily: s.fontFamily, lineHeight: s.lineHeight })
    if (serverSaveTimer) clearTimeout(serverSaveTimer)
    serverSaveTimer = setTimeout(() => {
      const cur = get()
      api.saveSettings({ fontSize: cur.fontSize, fontFamily: cur.fontFamily, lineHeight: cur.lineHeight }).catch(() => {})
    }, 600)
  },
}))

if (process.env.NODE_ENV !== 'production' && !globalForReader.__readerSettings) {
  globalForReader.__readerSettings = useReaderSettings
}

export const FONT_FAMILY_LABELS: Record<FontFamily, string> = {
  system: 'Mặc định',
  serif: 'Serif (có chân)',
  sans: 'Sans (không chân)',
  mono: 'Mono (cách đều)',
}

export const FONT_FAMILY_CSS: Record<FontFamily, string> = {
  system: 'var(--font-vietnamese), ui-sans-serif, system-ui, sans-serif',
  serif: 'Georgia, "Times New Roman", serif',
  sans: 'system-ui, -apple-system, "Segoe UI", sans-serif',
  mono: 'ui-monospace, "Cascadia Code", "Source Code Pro", monospace',
}
