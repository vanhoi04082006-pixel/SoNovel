'use client'

import { useEffect, useState } from 'react'
import {
  User as UserIcon, LogOut, Settings, Moon, Gauge, Heart, Clock, Bookmark,
  ChevronRight, Shield, Info, BarChart3,
} from 'lucide-react'
import { useAppStore } from '@/store/use-app-store'
import { api } from '@/lib/api-client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { toast } from 'sonner'

const THEMES = [
  { key: 'light', label: 'Sáng', desc: 'Trắng sạch' },
  { key: 'dark', label: 'Tối', desc: 'Xám đậm' },
  { key: 'sepia', label: 'Vàng giấy', desc: 'Giấy cổ' },
  { key: 'amoled', label: 'Đen tuyền', desc: 'OLED' },
] as const

const RATE_PRESETS = [0.75, 1, 1.25, 1.5, 2]

export function ProfileScreen() {
  const { user, navigate, theme, setTheme, refreshUser } = useAppStore()
  const [settings, setSettings] = useState<any>(null)

  useEffect(() => {
    if (!user) return
    ;(async () => {
      try {
        const s = await api.getSettings()
        setSettings(s.settings)
      } catch {}
    })()
  }, [user])

  if (!user) {
    return (
      <div className="mx-auto max-w-md px-4 py-12 text-center">
        <div className="grid h-16 w-16 mx-auto place-items-center rounded-full bg-muted">
          <UserIcon className="h-8 w-8 text-muted-foreground" />
        </div>
        <h1 className="mt-4 text-xl font-semibold">Tài khoản của bạn</h1>
        <p className="mt-1 text-sm text-muted-foreground">Đăng nhập để đồng bộ tiến độ nghe, yêu thích và cài đặt across thiết bị.</p>
        <Button className="mt-4" onClick={() => navigate({ view: 'login' })}>Đăng nhập / Đăng ký</Button>
      </div>
    )
  }

  const initials = user.email.slice(0, 2).toUpperCase()
  const defaultRate = settings?.playbackSpeed || 1

  const setRate = async (r: number) => {
    try {
      await api.saveSettings({ playbackSpeed: r })
      setSettings({ ...settings, playbackSpeed: r })
      toast.success(`Tốc độ đọc mặc định: ${r}x`)
    } catch {
      toast.error('Không lưu được cài đặt.')
    }
  }

  const onLogout = async () => {
    await api.logout()
    await refreshUser()
    toast.success('Đã đăng xuất.')
    navigate({ view: 'home' })
  }

  return (
    <div className="mx-auto max-w-2xl px-3 sm:px-4 py-4 sm:py-6 space-y-4">
      {/* Header card */}
      <Card>
        <CardContent className="p-5 flex items-center gap-4">
          <Avatar className="h-16 w-16 border-2 border-primary/20">
            <AvatarFallback className="bg-primary/15 text-primary text-lg font-semibold">{initials}</AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-semibold truncate">{user.email}</h1>
            <div className="mt-1 flex items-center gap-2">
              <Badge variant={user.role === 'admin' ? 'default' : 'secondary'}>
                {user.role === 'admin' ? 'Quản trị viên' : 'Thành viên'}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quick links */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        <QuickLink icon={<BarChart3 className="h-5 w-5" />} label="Thống kê" onClick={() => navigate({ view: 'stats' })} />
        <QuickLink icon={<Heart className="h-5 w-5" />} label="Yêu thích" onClick={() => navigate({ view: 'favorites' })} />
        <QuickLink icon={<Clock className="h-5 w-5" />} label="Lịch sử" onClick={() => navigate({ view: 'history' })} />
        <QuickLink icon={<Bookmark className="h-5 w-5" />} label="Đánh dấu" onClick={() => navigate({ view: 'bookmarks' })} />
        <QuickLink icon={<Settings className="h-5 w-5" />} label="Cài đặt" onClick={() => navigate({ view: 'settings' })} />
        <QuickLink icon={<Info className="h-5 w-5" />} label="Giới thiệu" onClick={() => navigate({ view: 'about' })} />
      </div>

      {/* Theme settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><Moon className="h-4 w-4" /> Giao diện</CardTitle>
          <CardDescription>Chọn theme hiển thị cho ứng dụng</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {THEMES.map((t) => (
            <button
              key={t.key}
              onClick={() => setTheme(t.key)}
              className={`rounded-lg border p-3 text-left transition-all ${
                theme === t.key
                  ? 'border-primary bg-primary/5 ring-1 ring-primary'
                  : 'border-border hover:border-primary/50'
              }`}
            >
              <p className="text-sm font-medium">{t.label}</p>
              <p className="text-xs text-muted-foreground">{t.desc}</p>
            </button>
          ))}
        </CardContent>
      </Card>

      {/* Default playback speed */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><Gauge className="h-4 w-4" /> Tốc độ đọc mặc định</CardTitle>
          <CardDescription>Áp dụng cho lần nghe tiếp theo</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {RATE_PRESETS.map((r) => (
              <button
                key={r}
                onClick={() => setRate(r)}
                className={`rounded-lg border px-4 py-2 text-sm transition-colors ${
                  defaultRate === r ? 'border-primary bg-primary text-primary-foreground' : 'border-border hover:border-primary'
                }`}
              >
                {r}x
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {user.role === 'admin' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base"><Shield className="h-4 w-4" /> Quản trị</CardTitle>
            <CardDescription>Dành cho quản trị viên</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" size="sm" onClick={() => navigate({ view: 'admin', tab: 'dashboard' })}>
              Mở trang quản trị <ChevronRight className="h-4 w-4" />
            </Button>
          </CardContent>
        </Card>
      )}

      <Separator />

      {/* Logout */}
      <Button variant="outline" className="w-full text-destructive hover:text-destructive" onClick={onLogout}>
        <LogOut className="h-4 w-4 mr-2" /> Đăng xuất
      </Button>

      <p className="text-center text-xs text-muted-foreground pt-2">
        SoNovel · Phiên bản web · Web Speech API
      </p>
    </div>
  )
}

function QuickLink({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center gap-1.5 rounded-xl border border-border bg-card p-4 hover:border-primary hover:bg-accent/30 transition-colors"
    >
      <span className="grid h-10 w-10 place-items-center rounded-lg bg-primary/10 text-primary">{icon}</span>
      <span className="text-sm font-medium">{label}</span>
    </button>
  )
}
