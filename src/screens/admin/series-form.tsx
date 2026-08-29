'use client'

import { useEffect, useState } from 'react'
import { ChevronLeft, Upload, X, Save, Plus, Trash2 } from 'lucide-react'
import { useAppStore } from '@/store/use-app-store'
import { api } from '@/lib/api-client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'

const STATUSES = [
  { key: 'draft', label: 'Nháp' },
  { key: 'published', label: 'Đang ra' },
  { key: 'completed', label: 'Hoàn thành' },
  { key: 'hidden', label: 'Ẩn' },
]

type IllustrationRow = { imageUrl: string; caption: string }

export function AdminSeriesForm({ seriesId }: { seriesId?: string }) {
  const { navigate } = useAppStore()
  const isEdit = !!seriesId

  const [title, setTitle] = useState('')
  const [author, setAuthor] = useState('')
  const [description, setDescription] = useState('')
  const [coverUrl, setCoverUrl] = useState('')
  const [status, setStatus] = useState('published')
  const [genresInput, setGenresInput] = useState('')
  const [tagsInput, setTagsInput] = useState('')
  const [allTags, setAllTags] = useState<{ id: string; name: string }[]>([])
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [illustrations, setIllustrations] = useState<IllustrationRow[]>([])
  const [illustUploadingIdx, setIllustUploadingIdx] = useState<number | null>(null)

  useEffect(() => {
    ;(async () => {
      try {
        const t = await api.listTags()
        setAllTags(t.items)
      } catch {}
      if (seriesId) {
        try {
          const s = await api.getSeries(seriesId)
          setTitle(s.title)
          setAuthor(s.author)
          setDescription(s.description)
          setCoverUrl(s.coverUrl)
          setStatus(s.status)
          setGenresInput((s.genres || []).join(', '))
          setTagsInput((s.tags || []).join(', '))
        } catch {
          toast.error('Không tải được truyện.')
        }
        try {
          const ill = await api.getIllustrations(seriesId)
          setIllustrations(ill.items.map((it) => ({ imageUrl: it.imageUrl, caption: it.caption || '' })))
        } catch {}
      }
    })()
  }, [seriesId])

  const genres = genresInput.split(',').map((x) => x.trim()).filter(Boolean)
  const tags = tagsInput.split(',').map((x) => x.trim()).filter(Boolean)
  const suggestedTags = allTags.filter((t) => !tags.includes(t.name)).slice(0, 12)

  const onUpload = async (file: File) => {
    setUploading(true)
    try {
      // Toàn bộ up ảnh qua imgBB (theo yêu cầu)
      const r = await api.uploadIllustration(file)
      if (r.url) {
        setCoverUrl(r.url)
        toast.success('Đã tải ảnh lên imgBB.')
      } else {
        toast.error(r.error || 'Tải ảnh thất bại.')
      }
    } catch (e) {
      toast.error('Tải ảnh thất bại: ' + (e as Error).message)
    } finally {
      setUploading(false)
    }
  }

  // ---- Ảnh minh họa ----
  const updateIllust = (idx: number, patch: Partial<IllustrationRow>) => {
    setIllustrations((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)))
  }
  const moveIllust = (idx: number, dir: -1 | 1) => {
    setIllustrations((prev) => {
      const next = [...prev]
      const j = idx + dir
      if (j < 0 || j >= next.length) return prev
      ;[next[idx], next[j]] = [next[j], next[idx]]
      return next
    })
  }
  const uploadIllust = async (file: File, idx: number) => {
    setIllustUploadingIdx(idx)
    try {
      const r = await api.uploadIllustration(file)
      if (r.url) {
        updateIllust(idx, { imageUrl: r.url })
        toast.success('Đã tải ảnh minh họa lên imgBB.')
      } else toast.error(r.error || 'Tải ảnh thất bại.')
    } catch (e) {
      toast.error('Tải ảnh thất bại: ' + (e as Error).message)
    } finally {
      setIllustUploadingIdx(null)
    }
  }

  const onSave = async () => {
    if (!title.trim()) { toast.error('Tên truyện là bắt buộc.'); return }
    setSaving(true)
    try {
      const data = { title, author, description, coverUrl, status, genres, tags }
      let savedId = seriesId
      if (isEdit && seriesId) {
        await api.updateSeries(seriesId, data)
        toast.success('Đã cập nhật truyện.')
      } else {
        const r = await api.createSeries(data)
        savedId = r.series.id
        toast.success('Đã tạo truyện mới.')
      }
      // Lưu ảnh minh họa (bulk replace). Lỗi minh họa không chặn việc lưu truyện.
      const cleanItems = illustrations.filter((it) => it.imageUrl.trim())
      if (savedId && (cleanItems.length > 0 || isEdit)) {
        try {
          await api.saveIllustrations(savedId, cleanItems)
        } catch (e) {
          toast.warning('Đã lưu truyện nhưng lưu ảnh minh họa thất bại: ' + (e as Error).message)
        }
      }
      navigate({ view: 'admin', tab: 'seriesDetail', seriesId: savedId || undefined })
    } catch (e) {
      toast.error('Lưu thất bại: ' + (e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" onClick={() => navigate({ view: 'admin', tab: 'dashboard' })}>
        <ChevronLeft className="h-4 w-4" /> Quay lại
      </Button>
      <h1 className="text-2xl font-bold">{isEdit ? 'Sửa truyện' : 'Thêm truyện mới'}</h1>

      <Card>
        <CardHeader><CardTitle>Thông tin truyện</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label>Tên truyện <span className="text-destructive">*</span></Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Nhập tên truyện…" />
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Tác giả</Label>
              <Input value={author} onChange={(e) => setAuthor(e.target.value)} placeholder="Tên tác giả" />
            </div>
            <div className="space-y-1.5">
              <Label>Trạng thái</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUSES.map((s) => <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Thể loại (phân tách bởi dấu phẩy)</Label>
            <Input value={genresInput} onChange={(e) => setGenresInput(e.target.value)} placeholder="Tiên Hiệp, Kiếm Hiệp…" />
            {genres.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1">
                {genres.map((g) => <Badge key={g} variant="secondary">{g}</Badge>)}
              </div>
            )}
          </div>
          <div className="space-y-1.5">
            <Label>Tag (phân tách bởi dấu phẩy)</Label>
            <Input value={tagsInput} onChange={(e) => setTagsInput(e.target.value)} placeholder="tu tiên, trọng sinh…" />
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1">
                {tags.map((t) => <Badge key={t} variant="outline">#{t}</Badge>)}
              </div>
            )}
            {suggestedTags.length > 0 && (
              <div className="mt-2">
                <p className="text-xs text-muted-foreground mb-1">Gợi ý tag:</p>
                <div className="flex flex-wrap gap-1">
                  {suggestedTags.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => setTagsInput(tagsInput ? `${tagsInput}, ${t.name}` : t.name)}
                      className="rounded-full border border-dashed border-border px-2 py-0.5 text-xs hover:border-primary hover:text-primary"
                    >
                      + {t.name}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
          <div className="space-y-1.5">
            <Label>Mô tả</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} placeholder="Giới thiệu nội dung truyện…" />
          </div>
          <div className="space-y-1.5">
            <Label>Ảnh bìa</Label>
            <div className="flex items-start gap-3">
              <div className="w-24 h-32 rounded-lg overflow-hidden border border-border bg-muted shrink-0">
                {coverUrl ? (
                  <img src={coverUrl} alt="Bìa" className="h-full w-full object-cover" />
                ) : (
                  <div className="h-full w-full grid place-items-center text-xs text-muted-foreground">Chưa có</div>
                )}
              </div>
              <div className="flex-1 space-y-2">
                <Input value={coverUrl} onChange={(e) => setCoverUrl(e.target.value)} placeholder="Dán link ảnh…" />
                <div className="flex gap-2">
                  <label className="cursor-pointer">
                    <Button variant="outline" size="sm" disabled={uploading} asChild>
                      <span><Upload className="h-4 w-4 mr-1" /> {uploading ? 'Đang tải…' : 'Tải ảnh lên'}</span>
                    </Button>
                    <input type="file" accept="image/*" className="hidden" onChange={(e) => {
                      const f = e.target.files?.[0]
                      if (f) onUpload(f)
                    }} />
                  </label>
                  {coverUrl && (
                    <Button variant="ghost" size="sm" onClick={() => setCoverUrl('')}>
                      <X className="h-4 w-4 mr-1" /> Bỏ ảnh
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>
          {/* Ảnh minh họa */}
          <Card className="border-dashed">
            <CardHeader className="pb-2"><CardTitle className="text-base">Ảnh minh họa</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <p className="text-xs text-muted-foreground">
                Tab «Minh họa» hiển thị: thông tin ảnh (chữ) phía trên, ảnh phía dưới. Mục lục được tạo tự động từ thông tin các ảnh.
              </p>
              {illustrations.map((it, idx) => (
                <div key={idx} className="rounded-lg border border-border p-3 space-y-2 bg-muted/20">
                  <div className="flex items-start gap-3">
                    <div className="w-24 h-16 rounded-md overflow-hidden border border-border bg-muted shrink-0">
                      {it.imageUrl ? (
                        <img src={it.imageUrl} alt={it.caption || `Ảnh ${idx + 1}`} className="h-full w-full object-cover" />
                      ) : (
                        <div className="h-full w-full grid place-items-center text-[10px] text-muted-foreground">Trống</div>
                      )}
                    </div>
                    <div className="flex-1 space-y-2 min-w-0">
                      <Input value={it.imageUrl} onChange={(e) => updateIllust(idx, { imageUrl: e.target.value })} placeholder="Link ảnh (https://…)" />
                      <div className="flex flex-wrap gap-1.5">
                        <label className="cursor-pointer">
                          <Button variant="outline" size="sm" disabled={illustUploadingIdx === idx} asChild>
                            <span><Upload className="h-3.5 w-3.5 mr-1" /> {illustUploadingIdx === idx ? 'Đang tải…' : 'Tải ảnh lên'}</span>
                          </Button>
                          <input type="file" accept="image/*" className="hidden" onChange={(e) => {
                            const f = e.target.files?.[0]
                            if (f) uploadIllust(f, idx)
                            e.currentTarget.value = ''
                          }} />
                        </label>
                        <Button variant="outline" size="sm" onClick={() => moveIllust(idx, -1)} disabled={idx === 0}>↑</Button>
                        <Button variant="outline" size="sm" onClick={() => moveIllust(idx, 1)} disabled={idx === illustrations.length - 1}>↓</Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          onClick={() => setIllustrations((prev) => prev.filter((_, i) => i !== idx))}
                        >
                          <Trash2 className="h-3.5 w-3.5 mr-1" /> Xóa
                        </Button>
                      </div>
                    </div>
                  </div>
                  <Input value={it.caption} onChange={(e) => updateIllust(idx, { caption: e.target.value })} placeholder={`Thông tin ảnh ${idx + 1} — hiện phía trên ảnh, làm mục lục…`} />
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={() => setIllustrations((prev) => [...prev, { imageUrl: '', caption: '' }])}>
                <Plus className="h-4 w-4 mr-1" /> Thêm ảnh minh họa
              </Button>
            </CardContent>
          </Card>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => navigate({ view: 'admin', tab: 'dashboard' })}>Hủy</Button>
            <Button onClick={onSave} disabled={saving || uploading}>
              <Save className="h-4 w-4 mr-1" /> {saving ? 'Đang lưu…' : 'Lưu'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
