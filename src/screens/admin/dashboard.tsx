'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { BookOpen, FileText, Users, Headphones, Search, Trash2, Settings2, Plus, CheckSquare, Square, X, ChevronsUpDown, Check } from 'lucide-react'
import { useAppStore } from '@/store/use-app-store'
import { api, type SeriesItem } from '@/lib/api-client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Skeleton } from '@/components/ui/skeleton'
import { CoverImage } from '@/components/sonovel/cover-image'
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { StatusChart } from './status-chart'

const STATUS_TABS = [
  { key: 'all', label: 'Tất cả' },
  { key: 'published', label: 'Đang ra' },
  { key: 'completed', label: 'Hoàn thành' },
  { key: 'draft', label: 'Nháp' },
  { key: 'hidden', label: 'Ẩn' },
] as const

export function AdminDashboard() {
  const { navigate } = useAppStore()
  const [stats, setStats] = useState<any>(null)
  const [items, setItems] = useState<SeriesItem[]>([])
  const [total, setTotal] = useState(0)
  const [offset, setOffset] = useState(0)
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [statusTab, setStatusTab] = useState<string>('all')
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [deleteTarget, setDeleteTarget] = useState<SeriesItem | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkMode, setBulkMode] = useState(false)
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false)
  const [allTags, setAllTags] = useState<{ id: string; name: string }[]>([])
  const [tagFilter, setTagFilter] = useState<string>('')
  const [tagOpen, setTagOpen] = useState(false)
  const [apkUrl, setApkUrl] = useState('')
  const [apkSaving, setApkSaving] = useState(false)
  const limit = 12
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const loadStats = useCallback(async () => {
    try {
      const s = await api.stats()
      setStats(s)
      setCounts(s.byStatus || {})
    } catch {}
  }, [])

  useEffect(() => {
    ;(async () => {
      try {
        const r = await api.listTags()
        setAllTags(r.items)
      } catch {}
      try {
        const s = await api.getSiteSetting('android_apk_url')
        setApkUrl(s.value || '')
      } catch {}
    })()
  }, [])

  const saveApkUrl = async () => {
    setApkSaving(true)
    try {
      const r = await api.saveSiteSetting('android_apk_url', apkUrl.trim())
      setApkUrl(r.value || '')
      toast.success('Đã lưu liên kết tải Android.')
    } catch (e) {
      toast.error('Lưu thất bại: ' + (e as Error).message)
    } finally {
      setApkSaving(false)
    }
  }

  const loadList = useCallback(async (resetOffset = true) => {
    setLoading(true)
    const o = resetOffset ? 0 : offset
    try {
      const statusParam = statusTab === 'all' ? 'draft,published,completed,hidden' : statusTab
      const res = await api.listSeries({ q, status: statusParam, sort: 'new', limit, offset: o })
      let filtered = res.items
      if (tagFilter) filtered = filtered.filter((s) => s.tags?.includes(tagFilter))
      // FIX: cập nhật offset sau MỖI lần tải (trước đây offset đứng 0 → "Tải thêm"
      // luôn fetch lại trang 1 rồi nối vào → danh sách bị nhân đôi).
      setItems((prev) => {
        if (resetOffset) return filtered
        const seen = new Set(prev.map((i) => i.id))
        return [...prev, ...filtered.filter((s) => !seen.has(s.id))]
      })
      setTotal(res.total)
      setOffset(o + res.items.length)
    } catch {
      toast.error('Không tải được danh sách.')
    } finally {
      setLoading(false)
    }
  }, [q, statusTab, tagFilter, offset])

  useEffect(() => { loadStats() }, [loadStats])
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => loadList(true), 300)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [q, statusTab, tagFilter])

  const confirmDelete = async () => {
    if (!deleteTarget) return
    try {
      await api.deleteSeries(deleteTarget.id)
      toast.success(`Đã xóa "${deleteTarget.title}"`)
      setDeleteTarget(null)
      loadStats()
      loadList(true)
    } catch (e) {
      toast.error('Xóa thất bại: ' + (e as Error).message)
    }
  }

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const selectAll = () => {
    if (selectedIds.size === items.length) setSelectedIds(new Set())
    else setSelectedIds(new Set(items.map((i) => i.id)))
  }

  const confirmBulkDelete = async () => {
    const ids = Array.from(selectedIds)
    if (ids.length === 0) return
    let ok = 0
    let fail = 0
    for (const id of ids) {
      try {
        await api.deleteSeries(id)
        ok++
      } catch {
        fail++
      }
    }
    toast.success(`Đã xóa ${ok} truyện${fail > 0 ? `, ${fail} thất bại` : ''}`)
    setBulkDeleteOpen(false)
    setSelectedIds(new Set())
    setBulkMode(false)
    loadStats()
    loadList(true)
  }

  const exitBulkMode = () => {
    setBulkMode(false)
    setSelectedIds(new Set())
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-2xl font-bold">Bảng điều khiển</h1>
        <div className="flex gap-1">
          {bulkMode ? (
            <>
              <span className="text-sm text-muted-foreground self-center mr-2">Đã chọn {selectedIds.size}</span>
              <Button size="sm" variant="outline" onClick={selectAll} disabled={items.length === 0}>
                {selectedIds.size === items.length && items.length > 0 ? <><X className="h-4 w-4 mr-1" /> Bỏ tất cả</> : <><CheckSquare className="h-4 w-4 mr-1" /> Chọn tất cả</>}
              </Button>
              <Button size="sm" variant="destructive" onClick={() => setBulkDeleteOpen(true)} disabled={selectedIds.size === 0}>
                <Trash2 className="h-4 w-4 mr-1" /> Xóa ({selectedIds.size})
              </Button>
              <Button size="sm" variant="ghost" onClick={exitBulkMode}>Hủy</Button>
            </>
          ) : (
            <>
              <Button size="sm" variant="outline" onClick={() => setBulkMode(true)} disabled={items.length === 0}>
                <CheckSquare className="h-4 w-4 mr-1" /> Chọn nhiều
              </Button>
              <Button size="sm" onClick={() => navigate({ view: 'admin', tab: 'seriesForm' })}>
                <Plus className="h-4 w-4 mr-1" /> Thêm truyện
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard icon={<BookOpen className="h-5 w-5" />} label="Bộ truyện" value={stats?.series ?? '—'} color="text-amber-600" />
        <StatCard icon={<FileText className="h-5 w-5" />} label="Chương" value={stats?.chapters ?? '—'} color="text-emerald-600" />
        <StatCard icon={<Users className="h-5 w-5" />} label="Người dùng" value={stats?.users ?? '—'} color="text-rose-600" />
        <StatCard icon={<Headphones className="h-5 w-5" />} label="Người nghe" value={stats?.listeners ?? '—'} color="text-violet-600" />
      </div>

      {/* Status chart */}
      <Card className="card-lift">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Phân bố trạng thái</CardTitle>
          <CardDescription>Số bộ truyện theo trạng thái</CardDescription>
        </CardHeader>
        <CardContent>
          <StatusChart data={counts} />
        </CardContent>
      </Card>

      {/* Liên kết tải app Android (hiện ở trang Tải ứng dụng) */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Liên kết tải Android</CardTitle>
          <CardDescription>Link Drive file APK — người dùng bấm nút Android ở trang Tải ứng dụng sẽ mở link này.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-2">
            <Input value={apkUrl} onChange={(e) => setApkUrl(e.target.value)} placeholder="https://drive.google.com/…" className="flex-1" />
            <Button size="sm" onClick={saveApkUrl} disabled={apkSaving} className="shrink-0">
              {apkSaving ? 'Đang lưu…' : 'Lưu link'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Search */}
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tìm theo tên truyện…" className="pl-9" />
      </div>

      {/* Status tabs */}
      <div className="flex flex-wrap gap-1.5 items-center">
        {STATUS_TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setStatusTab(t.key)}
            className={cn(
              'rounded-full border px-3 py-1 text-sm transition-colors',
              statusTab === t.key ? 'border-primary bg-primary text-primary-foreground' : 'border-border hover:border-primary'
            )}
          >
            {t.label}
            <span className="ml-1.5 text-xs opacity-70">
              {t.key === 'all' ? (stats?.series ?? 0) : (counts[t.key] ?? 0)}
            </span>
          </button>
        ))}
        {allTags.length > 0 && (
          <Popover open={tagOpen} onOpenChange={setTagOpen}>
            <PopoverTrigger asChild>
              <button
                className="ml-auto flex items-center gap-1 rounded-full border border-border bg-background px-3 py-1 text-sm hover:border-primary transition-colors"
                aria-label="Lọc theo tag"
              >
                {tagFilter ? <span className="text-primary font-medium">#{tagFilter}</span> : 'Tất cả tag'}
                <ChevronsUpDown className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-52 p-0" align="end">
              <Command>
                <CommandInput placeholder="Tìm tag…" />
                <CommandList>
                  <CommandEmpty>Không có tag.</CommandEmpty>
                  <CommandGroup>
                    <CommandItem
                      onSelect={() => { setTagFilter(''); setTagOpen(false) }}
                      className="cursor-pointer"
                    >
                      <Check className={cn('h-4 w-4', !tagFilter ? 'opacity-100' : 'opacity-0')} />
                      Tất cả tag
                    </CommandItem>
                    {allTags.map((t) => (
                      <CommandItem
                        key={t.id}
                        onSelect={() => { setTagFilter(t.name); setTagOpen(false) }}
                        className="cursor-pointer"
                      >
                        <Check className={cn('h-4 w-4', tagFilter === t.name ? 'opacity-100' : 'opacity-0')} />
                        #{t.name}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        )}
      </div>

      {/* Series grid */}
      {loading && items.length === 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-32 w-full rounded-lg" />)}
        </div>
      ) : items.length === 0 ? (
        <div className="py-12 text-center text-muted-foreground">Chưa có truyện nào.</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {items.map((s) => (
            <Card key={s.id} className={`overflow-hidden ${bulkMode && selectedIds.has(s.id) ? 'ring-2 ring-primary' : ''}`}>
              <CardContent className="p-3 flex gap-3">
                {bulkMode && (
                  <Checkbox
                    checked={selectedIds.has(s.id)}
                    onCheckedChange={() => toggleSelect(s.id)}
                    className="mt-1 shrink-0"
                    aria-label={`Chọn ${s.title}`}
                  />
                )}
                <CoverImage title={s.title} coverUrl={s.coverUrl} className="h-24 w-16 shrink-0" />
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-sm line-clamp-1">{s.title}</h3>
                  <p className="text-xs text-muted-foreground line-clamp-1">{s.author || 'Không rõ'}</p>
                  <div className="mt-1 flex items-center gap-1.5">
                    <StatusBadge status={s.status} />
                    <span className="text-xs text-muted-foreground">{s.chapterCount ?? 0} chương</span>
                  </div>
                  <div className="mt-2 flex gap-1">
                    <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => navigate({ view: 'admin', tab: 'seriesDetail', seriesId: s.id })} disabled={bulkMode}>
                      <Settings2 className="h-3 w-3 mr-1" /> Quản lý
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7 text-xs text-destructive hover:text-destructive" onClick={() => setDeleteTarget(s)} disabled={bulkMode}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {offset < total && (
        <div className="text-center pt-2">
          <Button variant="outline" onClick={() => loadList(false)} disabled={loading}>
            Tải thêm ({total - offset} còn lại)
          </Button>
        </div>
      )}

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xóa truyện?</AlertDialogTitle>
            <AlertDialogDescription>
              Hành động này sẽ xóa vĩnh viễn truyện "{deleteTarget?.title}" cùng toàn bộ chương. Không thể hoàn tác.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Hủy</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Xóa
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xóa {selectedIds.size} truyện đã chọn?</AlertDialogTitle>
            <AlertDialogDescription>
              Hành động này sẽ xóa vĩnh viễn {selectedIds.size} truyện cùng toàn bộ chương của chúng. Không thể hoàn tác.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Hủy</AlertDialogCancel>
            <AlertDialogAction onClick={confirmBulkDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Xóa {selectedIds.size} truyện
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function StatCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: number | string; color: string }) {
  return (
    <Card className="card-lift overflow-hidden">
      <CardContent className="p-4 flex items-center gap-3 relative">
        <span className={cn('grid h-10 w-10 place-items-center rounded-lg bg-muted shrink-0', color)}>{icon}</span>
        <div className="min-w-0">
          <p className="text-2xl font-bold leading-none tabular-nums">{value}</p>
          <p className="text-xs text-muted-foreground mt-1">{label}</p>
        </div>
      </CardContent>
    </Card>
  )
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; variant: any }> = {
    published: { label: 'Đang ra', variant: 'default' },
    completed: { label: 'Hoàn thành', variant: 'secondary' },
    draft: { label: 'Nháp', variant: 'outline' },
    hidden: { label: 'Ẩn', variant: 'outline' },
  }
  const m = map[status] || { label: status, variant: 'outline' }
  return <Badge variant={m.variant}>{m.label}</Badge>
}

