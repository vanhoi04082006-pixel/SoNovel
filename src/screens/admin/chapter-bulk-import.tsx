'use client'

import { useRef, useState } from 'react'
import { Upload, FileText, X, AlertTriangle, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { toast } from 'sonner'
import { api } from '@/lib/api-client'
import { formatCharCount, estMinutes } from '@/lib/format'
import { parseChapterFilename, naturalCompare } from '@/lib/chapter-filename'

type ImportRow = {
  fileId: string
  fileName: string
  orderNo: number
  title: string
  content: string
  charCount: number
  autoRenumbered: boolean
}

export function ChapterBulkImport({ seriesId, existingOrders, onDone }: {
  seriesId: string
  existingOrders: number[]
  onDone: () => void
}) {
  const [open, setOpen] = useState(false)
  const [rows, setRows] = useState<ImportRow[]>([])
  const [status, setStatus] = useState<'draft' | 'published'>('published')
  const [submitting, setSubmitting] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  function assignOrderNos(parsed: { fileName: string; orderNo: number | null; title: string; content: string; charCount: number }[]): ImportRow[] {
    const used = new Set<number>(existingOrders)
    let nextFree = Math.max(0, ...existingOrders) + 1

    const sorted = [...parsed].sort((a, b) => {
      const ao = a.orderNo ?? Number.MAX_SAFE_INTEGER
      const bo = b.orderNo ?? Number.MAX_SAFE_INTEGER
      if (ao !== bo) return ao - bo
      return naturalCompare(a.fileName, b.fileName)
    })

    return sorted.map((p) => {
      let no = p.orderNo
      let autoRenumbered = false
      if (no == null || no < 1 || used.has(no)) {
        while (used.has(nextFree)) nextFree++
        no = nextFree
        nextFree++
        autoRenumbered = true
      } else {
        used.add(no)
      }
      return {
        fileId: crypto.randomUUID(),
        fileName: p.fileName,
        orderNo: no,
        title: p.title,
        content: p.content,
        charCount: p.charCount,
        autoRenumbered,
      }
    })
  }

  async function handleFiles(files: FileList | File[]) {
    const arr = Array.from(files).filter((f) => /\.txt$/i.test(f.name))
    if (arr.length === 0) {
      toast.error('Chỉ hỗ trợ file .txt.')
      return
    }
    const parsed = await Promise.all(arr.map(async (f) => {
      const content = await f.text()
      const { orderNo, title } = parseChapterFilename(f.name)
      return { fileName: f.name, orderNo, title, content, charCount: content.length }
    }))
    setRows(assignOrderNos(parsed))
  }

  function updateRow(fileId: string, patch: Partial<ImportRow>) {
    setRows((prev) => prev.map((r) => (r.fileId === fileId ? { ...r, ...patch } : r)))
  }

  function removeRow(fileId: string) {
    setRows((prev) => prev.filter((r) => r.fileId !== fileId))
  }

  const orderDuplicates = (() => {
    const seen = new Map<number, number>()
    for (const r of rows) seen.set(r.orderNo, (seen.get(r.orderNo) ?? 0) + 1)
    return new Set([...seen.entries()].filter(([, c]) => c > 1).map(([n]) => n))
  })()

  const hasConflict = rows.some((r) => orderDuplicates.has(r.orderNo) || existingOrders.includes(r.orderNo))

  async function submit() {
    if (rows.length === 0) return
    if (hasConflict) {
      toast.error('Có chương trùng số thứ tự. Vui lòng sửa trước khi nhập.')
      return
    }
    setSubmitting(true)
    try {
      const res = await api.bulkCreateChapters(seriesId, rows.map((r) => ({ orderNo: r.orderNo, title: r.title, content: r.content, status })))
      toast.success(`Đã nhập ${res.count} chương` + (res.skipped ? ` (bỏ qua ${res.skipped} trùng)` : ''))
      setRows([])
      setOpen(false)
      onDone()
    } catch (e) {
      toast.error('Nhập thất bại: ' + (e as Error).message)
    } finally {
      setSubmitting(false)
    }
  }

  function reset() {
    setRows([])
    setStatus('published')
  }

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Upload className="h-4 w-4 mr-1" /> Nhập hàng loạt
      </Button>

      <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset() }}>
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Nhập chương hàng loạt từ file .txt</DialogTitle>
            <DialogDescription>
              Chọn nhiều file <code className="text-xs">.txt</code>. Tên file dạng
              <span className="font-medium"> Chương N_ Tiêu đề.txt</span> → số thứ tự từ
              <span className="font-medium"> N</span>, tiêu đề từ phần sau (thay <code>_</code> bằng <code>:</code>).
            </DialogDescription>
          </DialogHeader>

          {rows.length === 0 ? (
            <div
              className={`flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed py-12 px-4 text-center transition-colors ${dragOver ? 'border-primary bg-primary/5' : 'border-border'}`}
              onClick={() => inputRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files) }}
              role="button"
            >
              <Upload className="h-8 w-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Kéo thả file .txt vào đây hoặc <span className="text-primary font-medium">bấm để chọn</span></p>
              <p className="text-xs text-muted-foreground">Ví dụ: Chương 1_ Notice_ Biểu tượng cảm xúc đã ra mắt rồi!.txt</p>
              <input
                ref={inputRef}
                type="file"
                multiple
                accept=".txt,text/plain"
                className="hidden"
                onChange={(e) => { if (e.target.files) handleFiles(e.target.files); e.target.value = '' }}
              />
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">{rows.length} chương</Badge>
                  {hasConflict && (
                    <span className="flex items-center gap-1 text-xs text-destructive"><AlertTriangle className="h-3.5 w-3.5" /> Trùng số thứ tự</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="sm" onClick={() => inputRef.current?.click()} disabled={submitting}>
                    <FileText className="h-4 w-4 mr-1" /> Thêm file
                  </Button>
                  <input ref={inputRef} type="file" multiple accept=".txt,text/plain" className="hidden"
                    onChange={(e) => { if (e.target.files) handleFiles(e.target.files); e.target.value = '' }} />
                  <div className="flex items-center gap-2">
                    <Label className="text-xs">Trạng thái</Label>
                    <Select value={status} onValueChange={(v) => setStatus(v as any)}>
                      <SelectTrigger className="w-28 h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="published">Đã đăng</SelectItem>
                        <SelectItem value="draft">Nháp</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto rounded-lg border border-border divide-y divide-border">
                {rows.map((r) => {
                  const dup = orderDuplicates.has(r.orderNo) || existingOrders.includes(r.orderNo)
                  return (
                    <div key={r.fileId} className="flex items-center gap-2 px-3 py-2">
                      <Input
                        type="number"
                        value={r.orderNo}
                        min={1}
                        onChange={(e) => updateRow(r.fileId, { orderNo: Number(e.target.value) })}
                        className={`w-16 h-8 text-xs ${dup ? 'border-destructive' : ''}`}
                      />
                      <div className="flex-1 min-w-0">
                        <Input
                          value={r.title}
                          onChange={(e) => updateRow(r.fileId, { title: e.target.value })}
                          className="h-8 text-sm"
                        />
                        <p className="text-xs text-muted-foreground truncate">
                          {r.fileName} · {formatCharCount(r.charCount)} · ~{estMinutes(r.charCount)} phút
                          {r.autoRenumbered && <span className="text-amber-600"> · tự đánh số lại</span>}
                          {dup && <span className="text-destructive"> · trùng!</span>}
                        </p>
                      </div>
                      <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0 text-destructive hover:text-destructive" onClick={() => removeRow(r.fileId)} disabled={submitting}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  )
                })}
              </div>
            </>
          )}

          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => { setOpen(false); reset() }} disabled={submitting}>Hủy</Button>
            <Button onClick={submit} disabled={rows.length === 0 || submitting || hasConflict}>
              {submitting ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Upload className="h-4 w-4 mr-1" />}
              Nhập {rows.length > 0 ? `${rows.length} chương` : ''}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
