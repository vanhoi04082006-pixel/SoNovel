import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSessionUser } from '@/lib/session'

// DELETE /api/bookmarks/[id]
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Vui lòng đăng nhập.' }, { status: 401 })
  const { id } = await params
  try {
    const bm = await db.bookmark.findUnique({ where: { id }, select: { userId: true } })
    if (!bm || bm.userId !== user.id) {
      return NextResponse.json({ error: 'Không tìm thấy đánh dấu.' }, { status: 404 })
    }
    await db.bookmark.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: 'Xóa đánh dấu thất bại.' }, { status: 500 })
  }
}
