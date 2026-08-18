'use client'

import { BookHeadphones, Clock, Heart, Home as HomeIcon, Search, User } from 'lucide-react'
import { useAppStore } from '@/store/use-app-store'
import { cn } from '@/lib/utils'

const TABS = [
  { key: 'home', label: 'Trang chủ', icon: HomeIcon },
  { key: 'search', label: 'Tìm kiếm', icon: Search },
  { key: 'favorites', label: 'Yêu thích', icon: Heart },
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
      <div className="grid grid-cols-5">
        {TABS.map((t) => {
          const isActive = active === t.key || (t.key === 'login' && active === 'login')
          const Icon = t.icon
          const label = t.key === 'login' ? (user ? 'Tài khoản' : 'Đăng nhập') : t.label
          return (
            <button
              key={t.key}
              onClick={() => navigate({ view: t.key } as any)}
              className={cn(
                'flex flex-col items-center justify-center gap-1 py-2 text-[11px] font-medium transition-colors',
                isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
              )}
              aria-current={isActive ? 'page' : undefined}
            >
              <Icon className={cn('h-5 w-5', isActive && 'fill-primary/20')} />
              <span className="truncate max-w-[64px]">{label}</span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
