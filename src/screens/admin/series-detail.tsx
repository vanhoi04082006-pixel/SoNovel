'use client'

import { useEffect, useState, useCallback } from 'react'
import { ChevronLeft, Plus, Trash2, Edit3, Save, X, Search } from 'lucide-react'
import { useAppStore } from '@/store/use-app-store'
import { api, type SeriesDetail, type ChapterItem } from '@/lib/api-client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { toast } from 'sonner'
import { formatCharCount, estMinutes } from '@/lib/format'
import { ChapterBulkImport } from '@/screens/admin/chapter-bulk-import'

export function AdminSeriesDetail({ seriesId }: { seriesId: string }) {
  const { navigate } = useAppStore()
  const [detail, setDetail] = useState<SeriesDetail | null>(null)
  const [chapters, setChapters] = useState<ChapterItem[]>([])
  const [filter, setFilter] = useState('')
  const [filterTab, setFilterTab] = useState<'all' | 'draft' | 'published'>('all')
  const [editing, setEditing] = useState<ChapterItem | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<ChapterItem | null>(null)

  // form
  const [orderNo, setOrderNo] = useState('1')
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [status, setStatus] = useState<'draft' | 'published'>('published')

  const load = useCallback(async () => {
    try {
      const [d, c] = await Promise.all([
        api.getSeries(seriesId),
        api.listChapters(seriesId, true, ''),
      ])
      setDetail(d)
      setChapters(c.items)
      // default next orderNo
      const maxOrder = c.items.reduce((m, x) => Math.max(m, x.orderNo), 0)
      setOrderNo(String(maxOrder + 1))
    } catch {
      toast.error('Không tải được truyện.')
    }
  }, [seriesId])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const [d, c] = await Promise.all([
          api.getSeries(seriesId),
          api.listChapters(seriesId, true, ''),
        ])
        if (cancelled) return
        setDetail(d)
        setChapters(c.items)
        const maxOrder = c.items.reduce((m, x) => Math.max(m, x.orderNo), 0)
        setOrderNo(String(maxOrder + 1))
      } catch {
        if (!cancelled) toast.error('Không tải được truyện.')
      }
    })()
    return () => { cancelled = true }
  }, [seriesId])

  const startEdit = (c: ChapterItem) => {
    setEditing(c)
    setOrderNo(String(c.orderNo))
    setTitle(c.title)
    setContent(c.content || '')
    setStatus(c.status === 'draft' ? 'draft' : 'published')
  }

  const resetForm = () => {
    setEditing(null)
    setTitle('')
    setContent('')
    setStatus('published')
    const maxOrder = chapters.reduce((m, x) => Math.max(m, x.orderNo), 0)
    setOrderNo(String(maxOrder + 1))
  }

  const saveChapter = async () => {
    if (!title.trim()) { toast.error('Tiêu đề chương là bắt buộc.'); return }
    try {
      if (editing) {
        await api.updateChapter(editing.id, { title, content, status, orderNo: Number(orderNo) })
        toast.success('Đã cập nhật chương.')
      } else {
        await api.createChapter(seriesId, { title, content, status, orderNo: Number(orderNo) })
        toast.success('Đã thêm chương.')
      }
      resetForm()
      load()
    } catch (e) {
      toast.error('Lưu chương thất bại: ' + (e as Error).message)
    }
  }

  const confirmDelete = async () => {
    if (!deleteTarget) return
    try {
      await api.deleteChapter(deleteTarget.id)
      toast.success('Đã xóa chương.')
      setDeleteTarget(null)
      load()
    } catch (e) {
      toast.error('Xóa thất bại: ' + (e as Error).message)
    }
  }

  const filteredChapters = chapters
    .filter((c) => filterTab === 'all' || c.status === filterTab)
    .filter((c) => !filter || c.title.toLowerCase().includes(filter.toLowerCase()) || String(c.orderNo) === filter)

  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" onClick={() => navigate({ view: 'admin', tab: 'dashboard' })}>
        <ChevronLeft className="h-4 w-4" /> Quay lại
      </Button>

      {detail && (
        <Card>
          <CardHeader><CardTitle>{detail.title}</CardTitle></CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">{detail.author} · {chapters.length} chương · {formatCharCount(detail.wordCount)}</p>
            <div className="mt-2 flex gap-2">
              <Button size="sm" variant="outline" onClick={() => navigate({ view: 'admin', tab: 'seriesForm', seriesId })}>Sửa thông tin</Button>
              <ChapterBulkImport seriesId={seriesId} existingOrders={chapters.map((c) => c.orderNo)} onDone={load} />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Chapter form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {editing ? <><Edit3 className="h-4 w-4" /> Sửa chương</> : <><Plus className="h-4 w-4" /> Thêm chương</>}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid sm:grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label>Số thứ tự</Label>
              <Input type="number" value={orderNo} onChange={(e) => setOrderNo(e.target.value)} min={1} />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label>Tiêu đề chương <span className="text-destructive">*</span></Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="VD: Chương 1: Khởi đầu" />
            </div>
          </div>
          <div className="space-y-1">
            <Label>Trạng thái</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as any)}>
              <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="published">Đã đăng</SelectItem>
                <SelectItem value="draft">Nháp</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">Chỉ có 2 trạng thái: Đã đăng hoặc Nháp.</p>
          </div>
          <div className="space-y-1">
            <Label>Nội dung</Label>
            <Textarea value={content} onChange={(e) => setContent(e.target.value)} rows={8} placeholder="Dán nội dung chương vào đây…" />
            <p className="text-xs text-muted-foreground">{formatCharCount(content.length)} · ~{estMinutes(content.length)} phút nghe</p>
          </div>
          <div className="flex justify-end gap-2">
            {editing && <Button variant="ghost" onClick={resetForm}><X className="h-4 w-4 mr-1" /> Hủy sửa</Button>}
            <Button onClick={saveChapter}><Save className="h-4 w-4 mr-1" /> {editing ? 'Cập nhật' : 'Thêm chương'}</Button>
          </div>
        </CardContent>
      </Card>

      {/* Chapter list */}
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex gap-1.5">
            {(['all', 'published', 'draft'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setFilterTab(t)}
                className={`rounded-full border px-3 py-1 text-xs ${filterTab === t ? 'border-primary bg-primary text-primary-foreground' : 'border-border'}`}
              >
                {t === 'all' ? 'Tất cả' : t === 'published' ? 'Đã đăng' : 'Nháp'}
              </button>
            ))}
          </div>
          <div className="relative w-48">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Tìm chương…" className="pl-8 h-8 text-sm" />
          </div>
        </div>
        <div className="rounded-xl border border-border divide-y divide-border overflow-hidden">
          {filteredChapters.map((c) => (
            <div key={c.id} className="flex items-center gap-3 px-3 py-2.5">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-muted text-xs font-semibold">{c.orderNo}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium line-clamp-1">{c.title}</p>
                <p className="text-xs text-muted-foreground">{formatCharCount(c.wordCount * 5)} · ~{estMinutes(c.wordCount * 5)} phút</p>
              </div>
              <Badge variant={c.status === 'published' ? 'default' : 'outline'}>
                {c.status === 'published' ? 'Đã đăng' : 'Nháp'}
              </Badge>
              <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => startEdit(c)}><Edit3 className="h-4 w-4" /></Button>
              <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setDeleteTarget(c)}><Trash2 className="h-4 w-4" /></Button>
            </div>
          ))}
          {filteredChapters.length === 0 && <div className="py-8 text-center text-sm text-muted-foreground">Chưa có chương nào.</div>}
        </div>
      </div>

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xóa chương?</AlertDialogTitle>
            <AlertDialogDescription>
              Xóa vĩnh viễn "{deleteTarget?.title}"? Không thể hoàn tác.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Hủy</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Xóa</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
