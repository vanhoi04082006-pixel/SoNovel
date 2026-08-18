'use client'

import { useEffect, useState } from 'react'
import { ChevronLeft, Upload, X, Save } from 'lucide-react'
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
      }
    })()
  }, [seriesId])

  const genres = genresInput.split(',').map((x) => x.trim()).filter(Boolean)
  const tags = tagsInput.split(',').map((x) => x.trim()).filter(Boolean)
  const suggestedTags = allTags.filter((t) => !tags.includes(t.name)).slice(0, 12)

  const onUpload = async (file: File) => {
    setUploading(true)
    try {
      const r = await api.upload(file)
      if (r.url) {
        setCoverUrl(r.url)
        toast.success('Đã tải ảnh lên.')
      } else {
        toast.error(r.error || 'Tải ảnh thất bại.')
      }
    } catch (e) {
      toast.error('Tải ảnh thất bại: ' + (e as Error).message)
    } finally {
      setUploading(false)
    }
  }

  const onSave = async () => {
    if (!title.trim()) { toast.error('Tên truyện là bắt buộc.'); return }
    setSaving(true)
    try {
      const data = { title, author, description, coverUrl, status, genres, tags }
      if (isEdit && seriesId) {
        await api.updateSeries(seriesId, data)
        toast.success('Đã cập nhật truyện.')
      } else {
        const r = await api.createSeries(data)
        toast.success('Đã tạo truyện mới.')
        navigate({ view: 'admin', tab: 'seriesDetail', seriesId: r.series.id })
        return
      }
      navigate({ view: 'admin', tab: 'dashboard' })
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
