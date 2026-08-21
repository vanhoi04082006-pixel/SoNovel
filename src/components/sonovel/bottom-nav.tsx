'use client'

import { Bookmark, Clock, Heart, Home as HomeIcon, Search, User } from 'lucide-react'
import { useAppStore } from '@/store/use-app-store'
import { cn } from '@/lib/utils'

const TABS = [
  { key: 'home', label: 'Trang chủ', icon: HomeIcon },
  { key: 'search', label: 'Tìm kiếm', icon: Search },
  { key: 'favorites', label: 'Yêu thích', icon: Heart },
  { key: 'bookmarks', label: 'Đánh dấu', icon: Bookmark },
  { key: 'history', label: 'Lịch sử', icon: Clock },
  { key: 'login', label: 'Tài khoản', icon: User },
] as const

export function BottomNav() {
  const { view, navigate, user } = useAppStore()
  const active = view.view

  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80"
      aria-label="Điều hướng chính"
    >
      <div className="grid grid-cols-6">
        {TABS.map((t) => {
          const isActive = active === t.key
          const Icon = t.icon
          const label = t.key === 'login' ? (user ? 'Tài khoản' : 'Đăng nhập') : t.label
          const target = t.key === 'login' ? (user ? { view: 'profile' as const } : { view: 'login' as const }) : { view: t.key as any }
          return (
            <button
              key={t.key}
              onClick={() => navigate(target as any)}
              className={cn(
                'relative flex flex-col items-center justify-center gap-1 py-2 text-[11px] font-medium transition-colors',
                isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
              )}
              aria-current={isActive ? 'page' : undefined}
            >
              <div className="relative grid h-8 w-12 place-items-center">
                {isActive && <div className="absolute inset-0 mx-auto h-8 w-10 rounded-full bg-primary/10 shadow-soft" />}
                <Icon className={cn('relative h-5 w-5 z-10', isActive && 'fill-primary/30')} />
              </div>
              <span className="truncate max-w-[64px]">{label}</span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
