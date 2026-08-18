'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  Home, Search, Heart, Clock, Bookmark, User, Settings, Info,
  Shield, Headphones, CornerDownLeft, ArrowUp, ArrowDown, BarChart3,
} from 'lucide-react'
import { useAppStore } from '@/store/use-app-store'
import { api, type SeriesItem } from '@/lib/api-client'
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandSeparator,
  CommandShortcut,
} from '@/components/ui/command'
import { Dialog, DialogContent } from '@/components/ui/dialog'

export function CommandPalette() {
  const { navigate, user } = useAppStore()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [searchItems, setSearchItems] = useState<SeriesItem[]>([])

  // Cmd/Ctrl+K to toggle
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setOpen((v) => !v)
      } else if (e.key === 'Escape') {
        setOpen(false)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  // Debounced search when query length >= 2
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!open) { setQuery(''); return }
    if (query.trim().length < 2) { return }
    let cancelled = false
    const t = setTimeout(() => {
      ;(async () => {
        try {
          const r = await api.listSeries({ q: query.trim(), status: 'published,completed', limit: 8 })
          if (!cancelled) setSearchItems(r.items)
        } catch {}
      })()
    }, 300)
    return () => { cancelled = true; clearTimeout(t) }
  }, [query, open])

  const go = useCallback((view: any) => {
    navigate(view)
    setOpen(false)
  }, [navigate])

  const openStory = useCallback((id: string) => {
    navigate({ view: 'story', seriesId: id })
    setOpen(false)
  }, [navigate])

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="overflow-hidden p-0 shadow-lg max-w-xl" style={{ top: '15%' }}>
        <Command shouldFilter={false} className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground [&_[cmdk-group-heading]]:text-xs [&_[cmdk-input-wrapper]_svg]:h-5 [&_[cmdk-input-wrapper]_svg]:w-5 [&_[cmdk-input]]:h-12 [&_[cmdk-item]]:px-2 [&_[cmdk-item]]:py-2.5 [&_[cmdk-item]_svg]:h-4 [&_[cmdk-item]_svg]:w-4">
          <CommandInput placeholder="Tìm truyện hoặc nhảy đến trang…" value={query} onValueChange={setQuery} />
          <CommandList className="max-h-[400px]">
            <CommandEmpty>Không tìm thấy kết quả.</CommandEmpty>

            {/* Quick navigation — hide when searching */}
            {query.trim().length < 2 && (
            <CommandGroup heading="Điều hướng">
              <CommandItem onSelect={() => go({ view: 'home' })}>
                <Home /><span>Trang chủ</span>
                <CommandShortcut>⌘K</CommandShortcut>
              </CommandItem>
              <CommandItem onSelect={() => go({ view: 'search' })}>
                <Search /><span>Tìm kiếm truyện</span>
              </CommandItem>
              <CommandItem onSelect={() => go({ view: 'about' })}>
                <Info /><span>Giới thiệu</span>
              </CommandItem>
              <CommandItem onSelect={() => go({ view: 'settings' })}>
                <Settings /><span>Cài đặt</span>
              </CommandItem>
            </CommandGroup>
            )}

            {user && query.trim().length < 2 && (
              <>
                <CommandSeparator />
                <CommandGroup heading="Tài khoản">
                  <CommandItem onSelect={() => go({ view: 'profile' })}>
                    <User /><span>Tài khoản</span>
                  </CommandItem>
                  <CommandItem onSelect={() => go({ view: 'stats' })}>
                    <BarChart3 /><span>Thống kê nghe</span>
                  </CommandItem>
                  <CommandItem onSelect={() => go({ view: 'favorites' })}>
                    <Heart /><span>Yêu thích</span>
                  </CommandItem>
                  <CommandItem onSelect={() => go({ view: 'history' })}>
                    <Clock /><span>Lịch sử nghe</span>
                  </CommandItem>
                  <CommandItem onSelect={() => go({ view: 'bookmarks' })}>
                    <Bookmark /><span>Đánh dấu</span>
                  </CommandItem>
                </CommandGroup>
              </>
            )}

            {user?.role === 'admin' && query.trim().length < 2 && (
              <>
                <CommandSeparator />
                <CommandGroup heading="Quản trị">
                  <CommandItem onSelect={() => go({ view: 'admin', tab: 'dashboard' })}>
                    <Shield /><span>Bảng điều khiển admin</span>
                  </CommandItem>
                  <CommandItem onSelect={() => go({ view: 'admin', tab: 'seriesForm' })}>
                    <Headphones /><span>Thêm truyện mới</span>
                  </CommandItem>
                  <CommandItem onSelect={() => go({ view: 'admin', tab: 'tags' })}>
                    <Settings /><span>Quản lý tag</span>
                  </CommandItem>
                </CommandGroup>
              </>
            )}

            {/* Story search results */}
            {searchItems.length > 0 && (
              <>
                <CommandSeparator />
                <CommandGroup heading={`Truyện (${searchItems.length})`}>
                  {searchItems.map((s) => (
                    <CommandItem key={s.id} onSelect={() => openStory(s.id)}>
                      <Headphones />
                      <div className="flex flex-col min-w-0">
                        <span className="truncate font-medium">{s.title}</span>
                        {s.author && <span className="text-xs text-muted-foreground truncate">{s.author}</span>}
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </>
            )}

            {query.trim().length < 2 && (
            <>
            <CommandSeparator />
            <CommandGroup heading="Phím tắt">
              <CommandItem disabled>
                <CornerDownLeft /><span>Mở mục chọn</span>
              </CommandItem>
              <CommandItem disabled>
                <ArrowUp /><ArrowDown className="-ml-3" /><span>Di chuyển lên/xuống</span>
              </CommandItem>
            </CommandGroup>
            </>
            )}
          </CommandList>
        </Command>
      </DialogContent>
    </Dialog>
  )
}
