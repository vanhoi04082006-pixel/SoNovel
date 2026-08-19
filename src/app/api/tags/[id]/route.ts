import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
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
    await db.tag.update({ where: { id }, data: { name: String(name).trim() } })
    return NextResponse.json({ ok: true })
  } catch (e) {
    const msg = (e as Error).message
    if (msg === 'UNAUTHORIZED' || msg === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Bạn không có quyền quản trị.' }, { status: 403 })
    }
    if (msg.includes('Unique constraint')) {
      return NextResponse.json({ error: 'Tag đã tồn tại.' }, { status: 400 })
    }
    return NextResponse.json({ error: 'Cập nhật tag thất bại.' }, { status: 500 })
  }
}

// DELETE /api/tags/[id]
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin()
    const { id } = await params
    await db.tag.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (e) {
    const msg = (e as Error).message
    if (msg === 'UNAUTHORIZED' || msg === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Bạn không có quyền quản trị.' }, { status: 403 })
    }
    return NextResponse.json({ error: 'Xóa tag thất bại.' }, { status: 500 })
  }
}
