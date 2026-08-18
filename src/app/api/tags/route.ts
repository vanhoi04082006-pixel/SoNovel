import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAdmin } from '@/lib/session'

// GET /api/tags — public list
export async function GET() {
  const tags = await db.tag.findMany({ orderBy: { name: 'asc' } })
  return NextResponse.json({ items: tags })
}

// POST /api/tags — admin create
export async function POST(req: NextRequest) {
  try {
    await requireAdmin()
    const { name } = await req.json()
    if (!name || !String(name).trim()) {
      return NextResponse.json({ error: 'Tên tag là bắt buộc.' }, { status: 400 })
    }
    const t = await db.tag.create({ data: { name: String(name).trim() } })
    return NextResponse.json({ ok: true, id: t.id })
  } catch (e) {
    const msg = (e as Error).message
    if (msg === 'UNAUTHORIZED' || msg === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Bạn không có quyền quản trị.' }, { status: 403 })
    }
    if (msg.includes('Unique constraint')) {
      return NextResponse.json({ error: 'Tag đã tồn tại.' }, { status: 400 })
    }
    return NextResponse.json({ error: 'Tạo tag thất bại.' }, { status: 500 })
  }
}
