'use client'

import { create } from 'zustand'
import type { SessionUser } from '@/lib/api-client'
import { api, clearCatalogCache } from '@/lib/api-client'
import { viewToHash } from '@/lib/view-url'

export type ThemeName = 'light' | 'dark' | 'sepia' | 'amoled'

export type ViewState =
  | { view: 'home' }
  | { view: 'search'; q?: string; genre?: string; tag?: string; sort?: string }
  | { view: 'story'; seriesId: string }
  | { view: 'reader'; seriesId: string; chapterId: string }
  | { view: 'favorites' }
  | { view: 'history' }
  | { view: 'bookmarks' }
  | { view: 'profile' }
  | { view: 'settings' }
  | { view: 'about' }
  | { view: 'stats' }
  | { view: 'login' }
  | { view: 'admin'; tab: 'dashboard' | 'seriesForm' | 'seriesDetail' | 'tags' | 'users'; seriesId?: string }

interface AppState {
  user: SessionUser | null
  authReady: boolean
  initAuth: () => Promise<void>
  refreshUser: () => Promise<void>

  view: ViewState
  navigate: (v: ViewState) => void

  theme: ThemeName
  setTheme: (t: ThemeName) => void
  initTheme: () => void

  playerActive: boolean
  setPlayerActive: (v: boolean) => void

  playerOverlayOpen: boolean
  setPlayerOverlayOpen: (v: boolean) => void

  syncVersion: number
  bumpSync: () => void
}

const globalForApp = globalThis as unknown as { __appStore?: typeof useAppStore }

export const useAppStore = globalForApp.__appStore ?? create<AppState>((set, _get) => ({
  user: null,
  authReady: false,
  initAuth: async () => {
    try {
      const { user } = await api.me()
      set({ user, authReady: true })
    } catch {
      set({ user: null, authReady: true })
    }
  },
  refreshUser: async () => {
    try {
      const { user } = await api.me()
      set({ user })
    } catch {
      set({ user: null })
    }
  },

  view: { view: 'home' },
  navigate: (v) => {
    set({ view: v })
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior })
      try {
        const hash = viewToHash(v)
        if (window.location.hash !== hash) history.pushState(null, '', hash)
      } catch {}
    }
  },

  theme: 'light',
  setTheme: (t) => {
    set({ theme: t })
    if (typeof window !== 'undefined') {
      document.documentElement.setAttribute('data-theme', t)
      localStorage.setItem('sonovel-theme', t)
      api.saveSettings({ theme: t }).catch(() => {})
    }
  },
  initTheme: () => {
    if (typeof window === 'undefined') return
    const t = (localStorage.getItem('sonovel-theme') as ThemeName) || 'light'
    set({ theme: t })
    document.documentElement.setAttribute('data-theme', t)
  },

  playerActive: false,
  setPlayerActive: (v) => set({ playerActive: v }),

  playerOverlayOpen: false,
  setPlayerOverlayOpen: (v) => set({ playerOverlayOpen: v }),

  syncVersion: 0,
  bumpSync: () => {
    clearCatalogCache()
    set((s) => ({ syncVersion: s.syncVersion + 1 }))
  },
}))

if (process.env.NODE_ENV !== 'production' && !globalForApp.__appStore) {
  globalForApp.__appStore = useAppStore
}
