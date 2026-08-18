'use client'

import { create } from 'zustand'
import type { SessionUser } from '@/lib/api-client'
import { api } from '@/lib/api-client'

type ThemeName = 'light' | 'dark' | 'sepia' | 'amoled'

type ViewState =
  | { view: 'home' }
  | { view: 'search'; q?: string; genre?: string; tag?: string }
  | { view: 'story'; seriesId: string }
  | { view: 'favorites' }
  | { view: 'history' }
  | { view: 'login' }
  | { view: 'admin'; tab: 'dashboard' | 'seriesForm' | 'seriesDetail' | 'tags'; seriesId?: string }

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
}

export const useAppStore = create<AppState>((set, _get) => ({
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
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior })
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
}))
