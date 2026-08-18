'use client'

import { Moon, Sun, Palette, BookOpen, Check } from 'lucide-react'
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

const THEMES = [
  { key: 'light', label: 'Sáng', desc: 'Trắng sạch' },
  { key: 'dark', label: 'Tối', desc: 'Xám đậm' },
  { key: 'sepia', label: 'Vàng giấy', desc: 'Giấy cổ, dịu mắt' },
  { key: 'amoled', label: 'Đen tuyền', desc: 'Tiết kiệm pin OLED' },
] as const

export function ThemeMenu() {
  const { theme, setTheme } = useAppStore()
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Đổi giao diện">
          {theme === 'light' ? <Sun className="h-5 w-5" /> : theme === 'amoled' ? <BookOpen className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="flex items-center gap-2">
          <Palette className="h-4 w-4" /> Giao diện
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {THEMES.map((t) => (
          <DropdownMenuItem
            key={t.key}
            onClick={() => setTheme(t.key)}
            className="flex items-center justify-between cursor-pointer"
          >
            <div className="flex flex-col">
              <span className="font-medium">{t.label}</span>
              <span className="text-xs text-muted-foreground">{t.desc}</span>
            </div>
            {theme === t.key && <Check className="h-4 w-4 text-primary" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
