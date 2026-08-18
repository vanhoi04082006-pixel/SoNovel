'use client'

import { useEffect } from 'react'
import { useAppStore } from '@/store/use-app-store'
import { TopBar } from '@/components/sonovel/top-bar'
import { BottomNav } from '@/components/sonovel/bottom-nav'
import { PlayerBar } from '@/components/player/player-bar'
import { HomeScreen } from '@/screens/home'
import { SearchScreen } from '@/screens/search'
import { StoryDetailScreen } from '@/screens/story-detail'
import { FavoritesScreen } from '@/screens/favorites'
import { HistoryScreen } from '@/screens/history'
import { LoginScreen } from '@/screens/login'
import { AdminShell } from '@/screens/admin/shell'

export default function Home() {
  const { view, initAuth, initTheme, user, authReady } = useAppStore()

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
      <main className="flex-1 pb-28 md:pb-8">
        {view.view === 'home' && <HomeScreen />}
        {view.view === 'search' && <SearchScreen />}
        {view.view === 'story' && <StoryDetailScreen />}
        {view.view === 'favorites' && <FavoritesScreen />}
        {view.view === 'history' && <HistoryScreen />}
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
        <div className="mx-auto max-w-6xl px-4 py-4 text-xs text-muted-foreground flex items-center justify-between">
          <span>SoNovel — Ứng dụng nghe truyện chữ tiếng Việt</span>
          <span>Web Speech API · Tự dựng theo SPEC §7</span>
        </div>
      </footer>
    </div>
  )
}
