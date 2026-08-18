'use client'

import { useEffect, useState, useRef } from 'react'
import { Plus, Trash2, Check, X, Tag as TagIcon } from 'lucide-react'
import { useAppStore } from '@/store/use-app-store'
import { api } from '@/lib/api-client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { toast } from 'sonner'

export function AdminTags() {
  const { user } = useAppStore()
  const [tags, setTags] = useState<{ id: string; name: string }[]>([])
  const [newName, setNewName] = useState('')
  const [error, setError] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null)
  const editInputRef = useRef<HTMLInputElement>(null)

  const load = async () => {
    try {
      const r = await api.listTags()
      setTags(r.items)
    } catch {
      toast.error('Không tải được tag.')
    }
  }

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const r = await api.listTags()
        if (!cancelled) setTags(r.items)
      } catch {
        if (!cancelled) toast.error('Không tải được tag.')
      }
    })()
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    if (editingId && editInputRef.current) editInputRef.current.focus()
  }, [editingId])

  const addTag = async () => {
    const name = newName.trim()
    if (!name) { setError('Tên tag là bắt buộc.'); return }
    if (tags.some((t) => t.name.toLowerCase() === name.toLowerCase())) {
      setError('Tag đã tồn tại.')
      return
    }
    try {
      await api.createTag(name)
      setNewName('')
      setError('')
      toast.success(`Đã thêm tag "${name}".`)
      load()
    } catch (e) {
      setError((e as Error).message)
    }
  }

  const saveEdit = async (id: string) => {
    const name = editName.trim()
    if (!name) { setEditingId(null); return }
    try {
      await api.updateTag(id, name)
      toast.success('Đã cập nhật tag.')
      setEditingId(null)
      load()
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  const cancelEdit = () => { setEditingId(null); setEditName('') }

  const confirmDelete = async () => {
    if (!deleteTarget) return
    try {
      await api.deleteTag(deleteTarget.id)
      toast.success(`Đã xóa tag "${deleteTarget.name}".`)
      setDeleteTarget(null)
      load()
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  if (user?.role !== 'admin') {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          Trang quản lý tag chỉ dành cho quản trị viên.
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Quản lý tag</h1>
        <p className="text-sm text-muted-foreground">Tạo và quản lý các tag dùng để phân loại truyện.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Plus className="h-4 w-4" /> Thêm tag mới</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input
              value={newName}
              onChange={(e) => { setNewName(e.target.value); setError('') }}
              onKeyDown={(e) => { if (e.key === 'Enter') addTag() }}
              placeholder="VD: tiên hiệp, ngôn tình…"
            />
            <Button onClick={addTag}>Thêm</Button>
          </div>
          {error && <p className="text-sm text-destructive mt-2">{error}</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><TagIcon className="h-4 w-4" /> Danh sách tag ({tags.length})</CardTitle>
          <CardDescription>Bấm vào tên tag để sửa. Enter để lưu, Escape để hủy.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {tags.map((t) => (
              <div key={t.id} className="group flex items-center gap-1 rounded-full border border-border bg-card pl-3 pr-1 py-1 text-sm">
                {editingId === t.id ? (
                  <>
                    <input
                      ref={editInputRef}
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') saveEdit(t.id)
                        if (e.key === 'Escape') cancelEdit()
                      }}
                      className="bg-transparent outline-none text-sm min-w-0 w-24"
                    />
                    <button onClick={() => saveEdit(t.id)} className="p-0.5 text-primary hover:bg-primary/10 rounded" aria-label="Lưu">
                      <Check className="h-3.5 w-3.5" />
                    </button>
                    <button onClick={cancelEdit} className="p-0.5 text-muted-foreground hover:bg-muted rounded" aria-label="Hủy">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => { setEditingId(t.id); setEditName(t.name) }}
                      className="hover:text-primary"
                    >
                      {t.name}
                    </button>
                    <button
                      onClick={() => setDeleteTarget(t)}
                      className="p-0.5 text-muted-foreground hover:text-destructive rounded"
                      aria-label={`Xóa ${t.name}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </>
                )}
              </div>
            ))}
            {tags.length === 0 && <p className="text-sm text-muted-foreground">Chưa có tag nào.</p>}
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xóa tag "{deleteTarget?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              Tag sẽ bị xóa khỏi danh sách. Các truyện đã dùng tag này không bị ảnh hưởng nội dung.
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
