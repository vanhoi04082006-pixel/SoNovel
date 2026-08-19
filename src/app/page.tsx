'use client'

import { useEffect } from 'react'
import dynamic from 'next/dynamic'
import { useAppStore } from '@/store/use-app-store'
import { useRealtimeSync } from '@/hooks/use-realtime-sync'
import { TopBar } from '@/components/sonovel/top-bar'
import { BottomNav } from '@/components/sonovel/bottom-nav'
import { PlayerBar } from '@/components/player/player-bar'
import { HomeScreen } from '@/screens/home'
import { SearchScreen } from '@/screens/search'
import { StoryDetailScreen } from '@/screens/story-detail'
import { FavoritesScreen } from '@/screens/favorites'
import { HistoryScreen } from '@/screens/history'
import { BookmarksScreen } from '@/screens/bookmarks'
import { ProfileScreen } from '@/screens/profile'
import { SettingsScreen } from '@/screens/settings'
import { AboutScreen } from '@/screens/about'
import { StatsScreen } from '@/screens/stats'
import { LoginScreen } from '@/screens/login'
import { AdminShell } from '@/screens/admin/shell'

// Lazy-load InstallPrompt + PWARegister để tránh HMR module factory error
const InstallPrompt = dynamic(() => import('@/components/sonovel/install-prompt').then(m => ({ default: m.InstallPrompt })), { ssr: false })
const PWARegister = dynamic(() => import('@/components/sonovel/pwa-register').then(m => ({ default: m.PWARegister })), { ssr: false })

export default function Home() {
  const { view, initAuth, initTheme, user, authReady } = useAppStore()
  useRealtimeSync()

  useEffect(() => {
    initTheme()
    initAuth()
  }, [initTheme, initAuth])

  // pad bottom for player bar + bottom nav
  const hasPlayer = useAppStore((s) => s.playerActive)

  if (!authReady) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <span className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">Đang tải SoNovel…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <TopBar />
      <PWARegister />
      <InstallPrompt />
      <main className="flex-1 pb-28 md:pb-8">
        {view.view === 'home' && <HomeScreen />}
        {view.view === 'search' && <SearchScreen />}
        {view.view === 'story' && <StoryDetailScreen />}
        {view.view === 'favorites' && <FavoritesScreen />}
        {view.view === 'history' && <HistoryScreen />}
        {view.view === 'bookmarks' && <BookmarksScreen />}
        {view.view === 'profile' && <ProfileScreen />}
        {view.view === 'settings' && <SettingsScreen />}
        {view.view === 'about' && <AboutScreen />}
        {view.view === 'stats' && <StatsScreen />}
        {view.view === 'login' && <LoginScreen />}
        {view.view === 'admin' && user?.role === 'admin' && <AdminShell />}
        {view.view === 'admin' && user?.role !== 'admin' && (
          <div className="py-16 text-center text-muted-foreground">
            Bạn không có quyền truy cập trang quản trị.
          </div>
        )}
      </main>
      <PlayerBar />
      <BottomNav />
      {hasPlayer && <div className="hidden md:block h-16" />}
      <footer className="hidden md:block border-t border-border bg-muted/30 mt-auto">
        <div className="mx-auto max-w-6xl px-4 py-4 text-xs text-muted-foreground flex flex-wrap items-center justify-between gap-2">
          <span>SoNovel — Ứng dụng nghe truyện chữ tiếng Việt</span>
          <div className="flex items-center gap-3">
            <button onClick={() => useAppStore.getState().navigate({ view: 'about' })} className="hover:text-primary">Giới thiệu</button>
            <button onClick={() => useAppStore.getState().navigate({ view: 'settings' })} className="hover:text-primary">Cài đặt</button>
            <span className="opacity-60">Web Speech API · v1.0</span>
          </div>
        </div>
      </footer>
    </div>
  )
}
