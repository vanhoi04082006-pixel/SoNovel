import { NextRequest, NextResponse } from 'next/server'
import { serverDb } from '@/lib/server-data'
import { invalidateAll } from '@/lib/server-cache'
import { requireAdmin } from '@/lib/session'

// PATCH /api/tags/[id] — admin rename
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin()
    const { id } = await params
    const { name } = await req.json()
    if (!name || !String(name).trim()) {
      return NextResponse.json({ error: 'Tên tag là bắt buộc.' }, { status: 400 })
    }
    const { error } = await serverDb().from('tags').update({ name: String(name).trim() }).eq('id', id)
    if (error) {
      if ((error as any).code === '23505') return NextResponse.json({ error: 'Tag đã tồn tại.' }, { status: 400 })
      throw error
    }
    invalidateAll()
    return NextResponse.json({ ok: true })
  } catch (e) {
    const msg = (e as Error).message
    if (msg === 'UNAUTHORIZED' || msg === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Bạn không có quyền quản trị.' }, { status: 403 })
    }
    return NextResponse.json({ error: 'Cập nhật tag thất bại: ' + msg }, { status: 500 })
  }
}

// DELETE /api/tags/[id]
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin()
    const { id } = await params
    const { error } = await serverDb().from('tags').delete().eq('id', id)
    if (error) throw error
    invalidateAll()
    return NextResponse.json({ ok: true })
  } catch (e) {
    const msg = (e as Error).message
    if (msg === 'UNAUTHORIZED' || msg === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Bạn không có quyền quản trị.' }, { status: 403 })
    }
    return NextResponse.json({ error: 'Xóa tag thất bại: ' + msg }, { status: 500 })
  }
}
