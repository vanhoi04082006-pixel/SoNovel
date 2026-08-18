'use client'

import { LogOut, Shield, User as UserIcon } from 'lucide-react'
import { useAppStore } from '@/store/use-app-store'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { api } from '@/lib/api-client'
import { toast } from 'sonner'

export function UserMenu() {
  const { user, navigate, refreshUser } = useAppStore()

  if (!user) {
    return (
      <Button variant="outline" size="sm" onClick={() => navigate({ view: 'login' })}>
        Đăng nhập
      </Button>
    )
  }

  const initials = user.email.slice(0, 2).toUpperCase()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="rounded-full" aria-label="Tài khoản">
          <Avatar className="h-9 w-9 border border-border">
            <AvatarFallback className="bg-primary/15 text-primary text-xs font-semibold">{initials}</AvatarFallback>
          </Avatar>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel>
          <div className="flex flex-col">
            <span className="text-sm font-medium">{user.email}</span>
            <span className="text-xs text-muted-foreground">
              {user.role === 'admin' ? 'Quản trị viên' : 'Thành viên'}
            </span>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {user.role === 'admin' && (
          <DropdownMenuItem onClick={() => navigate({ view: 'admin', tab: 'dashboard' })} className="cursor-pointer">
            <Shield className="h-4 w-4 mr-2" /> Trang quản trị
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onClick={() => navigate({ view: 'history' })} className="cursor-pointer">
          <UserIcon className="h-4 w-4 mr-2" /> Lịch sử nghe
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={async () => {
            await api.logout()
            await refreshUser()
            toast.success('Đã đăng xuất')
            navigate({ view: 'home' })
          }}
          className="cursor-pointer text-destructive focus:text-destructive"
        >
          <LogOut className="h-4 w-4 mr-2" /> Đăng xuất
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
