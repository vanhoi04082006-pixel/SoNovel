import { NextRequest, NextResponse } from 'next/server'
import { serverDb } from '@/lib/server-data'
import { cachedFetch, invalidateAll } from '@/lib/server-cache'
import { requireAdmin } from '@/lib/session'

// GET /api/tags — public list
export async function GET() {
  try {
    const result = await cachedFetch('tags', 60_000, async () => {
      const { data, error } = await serverDb().from('tags').select('id, name').order('name', { ascending: true })
      if (error) throw error
      return { items: data ?? [] }
    })
    return NextResponse.json(result)
  } catch (e) {
    return NextResponse.json({ error: 'Tải tag thất bại: ' + (e as Error).message }, { status: 500 })
  }
}

// POST /api/tags — admin create
export async function POST(req: NextRequest) {
  try {
    await requireAdmin()
    const { name } = await req.json()
    if (!name || !String(name).trim()) {
      return NextResponse.json({ error: 'Tên tag là bắt buộc.' }, { status: 400 })
    }
    const { data, error } = await serverDb().from('tags').insert({ name: String(name).trim() }).select('id').single()
    if (error) {
      if ((error as any).code === '23505') return NextResponse.json({ error: 'Tag đã tồn tại.' }, { status: 400 })
      throw error
    }
    invalidateAll()
    return NextResponse.json({ ok: true, id: data.id })
  } catch (e) {
    const msg = (e as Error).message
    if (msg === 'UNAUTHORIZED' || msg === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Bạn không có quyền quản trị.' }, { status: 403 })
    }
    return NextResponse.json({ error: 'Tạo tag thất bại: ' + msg }, { status: 500 })
  }
}
