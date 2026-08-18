import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { recalcSeriesWordCount } from '@/lib/sonovel'
import { requireAdmin } from '@/lib/session'
import fs from 'fs'
import path from 'path'

// POST /api/upload — admin upload cover image (stores in /public/uploads)
export async function POST(req: NextRequest) {
  try {
    await requireAdmin()
    const form = await req.formData()
    const file = form.get('file')
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Không có file.' }, { status: 400 })
    }
    if (!file.type.startsWith('image/')) {
      return NextResponse.json({ error: 'Chỉ chấp nhận file ảnh.' }, { status: 400 })
    }
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: 'Ảnh quá lớn (tối đa 5MB).' }, { status: 400 })
    }
    const ext = file.name.split('.').pop() || 'jpg'
    const name = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
    const dir = path.join(process.cwd(), 'public', 'uploads')
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    const buf = Buffer.from(await file.arrayBuffer())
    fs.writeFileSync(path.join(dir, name), buf)
    return NextResponse.json({ ok: true, url: `/uploads/${name}` })
  } catch (e) {
    const msg = (e as Error).message
    if (msg === 'UNAUTHORIZED' || msg === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Bạn không có quyền quản trị.' }, { status: 403 })
    }
    return NextResponse.json({ error: 'Tải ảnh thất bại: ' + msg }, { status: 500 })
  }
}

// dummy export to satisfy recalcSeriesWordCount import linter (unused here)
export const _unused = { recalcSeriesWordCount, db }
