'use client'

import { Headphones, Search, Shield } from 'lucide-react'
import { useAppStore } from '@/store/use-app-store'
import { ThemeMenu } from './theme-menu'
import { UserMenu } from './user-menu'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

export function TopBar() {
  const { navigate, user, view } = useAppStore()

  const submitSearch = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const q = String(fd.get('q') || '').trim()
    navigate({ view: 'search', q })
  }

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-3 sm:px-4">
        <button
          onClick={() => navigate({ view: 'home' })}
          className="flex items-center gap-2 shrink-0"
          aria-label="SoNovel — Trang chủ"
        >
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary text-primary-foreground">
            <Headphones className="h-5 w-5" />
          </span>
          <span className="hidden sm:block font-bold text-lg tracking-tight">SoNovel</span>
        </button>

        <nav className="hidden md:flex items-center gap-1 text-sm">
          <Button variant={view.view === 'home' ? 'secondary' : 'ghost'} size="sm" onClick={() => navigate({ view: 'home' })}>
            Trang chủ
          </Button>
          <Button variant={view.view === 'search' ? 'secondary' : 'ghost'} size="sm" onClick={() => navigate({ view: 'search' })}>
            Tìm kiếm
          </Button>
          {user && (
            <>
              <Button variant={view.view === 'favorites' ? 'secondary' : 'ghost'} size="sm" onClick={() => navigate({ view: 'favorites' })}>
                Yêu thích
              </Button>
              <Button variant={view.view === 'history' ? 'secondary' : 'ghost'} size="sm" onClick={() => navigate({ view: 'history' })}>
                Lịch sử
              </Button>
              <Button variant={view.view === 'bookmarks' ? 'secondary' : 'ghost'} size="sm" onClick={() => navigate({ view: 'bookmarks' })}>
                Đánh dấu
              </Button>
              <Button variant={view.view === 'profile' ? 'secondary' : 'ghost'} size="sm" onClick={() => navigate({ view: 'profile' })}>
                Tài khoản
              </Button>
            </>
          )}
          {user?.role === 'admin' && (
            <Button variant={view.view === 'admin' ? 'secondary' : 'ghost'} size="sm" onClick={() => navigate({ view: 'admin', tab: 'dashboard' })}>
              <Shield className="h-4 w-4 mr-1" /> Quản trị
            </Button>
          )}
        </nav>

        <form onSubmit={submitSearch} className="ml-auto hidden md:flex items-center max-w-xs flex-1">
          <div className="relative w-full">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              name="q"
              placeholder="Tìm truyện, tác giả…"
              className="pl-9 h-9"
              defaultValue={view.view === 'search' ? view.q || '' : ''}
            />
          </div>
        </form>

        <div className="ml-auto md:ml-2 flex items-center gap-1">
          <ThemeMenu />
          <UserMenu />
        </div>
      </div>
    </header>
  )
}
