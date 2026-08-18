import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { parseArray, stringifyArray } from '@/lib/sonovel'
import { requireAdmin } from '@/lib/session'

// GET /api/series/[id] — public detail with published chapters
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const s = await db.series.findUnique({
    where: { id },
    include: {
      chapters: {
        where: { status: 'published' },
        orderBy: { orderNo: 'asc' },
        select: { id: true, orderNo: true, title: true, wordCount: true, status: true, publishedAt: true },
      },
    },
  })
  if (!s) return NextResponse.json({ error: 'Không tìm thấy truyện.' }, { status: 404 })
  return NextResponse.json({
    id: s.id,
    title: s.title,
    author: s.author,
    description: s.description,
    coverUrl: s.coverUrl,
    status: s.status,
    genres: parseArray(s.genres),
    tags: parseArray(s.tags),
    wordCount: s.wordCount,
    createdAt: s.createdAt,
    updatedAt: s.updatedAt,
    chapters: s.chapters.map((c) => ({
      id: c.id,
      orderNo: c.orderNo,
      title: c.title,
      wordCount: c.wordCount,
      status: c.status,
      publishedAt: c.publishedAt,
    })),
  })
}

// PATCH /api/series/[id] — admin update
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin()
    const { id } = await params
    const body = await req.json()
    const data: any = {}
    if (body.title !== undefined) data.title = String(body.title).trim()
    if (body.author !== undefined) data.author = String(body.author).trim()
    if (body.description !== undefined) data.description = String(body.description).trim()
    if (body.coverUrl !== undefined) data.coverUrl = String(body.coverUrl).trim()
    if (body.status !== undefined) {
      const valid = ['draft', 'published', 'completed', 'hidden']
      if (valid.includes(body.status)) data.status = body.status
    }
    if (body.genres !== undefined) {
      data.genres = stringifyArray(Array.isArray(body.genres) ? body.genres : String(body.genres || '').split(',').map((x: string) => x.trim()).filter(Boolean))
    }
    if (body.tags !== undefined) {
      data.tags = stringifyArray(Array.isArray(body.tags) ? body.tags : String(body.tags || '').split(',').map((x: string) => x.trim()).filter(Boolean))
    }
    const s = await db.series.update({ where: { id }, data })
    return NextResponse.json({ ok: true, id: s.id })
  } catch (e) {
    const msg = (e as Error).message
    if (msg === 'UNAUTHORIZED' || msg === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Bạn không có quyền quản trị.' }, { status: 403 })
    }
    return NextResponse.json({ error: 'Cập nhật thất bại: ' + msg }, { status: 500 })
  }
}

// DELETE /api/series/[id] — admin delete (cascade)
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin()
    const { id } = await params
    await db.series.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (e) {
    const msg = (e as Error).message
    if (msg === 'UNAUTHORIZED' || msg === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Bạn không có quyền quản trị.' }, { status: 403 })
    }
    return NextResponse.json({ error: 'Xóa thất bại: ' + msg }, { status: 500 })
  }
}
