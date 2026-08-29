import { NextRequest, NextResponse } from 'next/server'
import { proxyToWorker } from '@/lib/worker'

// GET /api/series/:id/illustrations — danh sách ảnh minh họa (public)
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
    const { res, json } = await proxyToWorker(`/api/series/${id}/illustrations`, { method: 'GET' })
    return NextResponse.json(json, { status: res.status })
  } catch (e) {
    return NextResponse.json({ error: 'Tải ảnh minh họa thất bại: ' + (e as Error).message }, { status: 500 })
  }
}

// PUT /api/series/:id/illustrations — lưu toàn bộ danh sách (admin)
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await req.text()
    const { res, json } = await proxyToWorker(`/api/series/${id}/illustrations`, { method: 'PUT', body, admin: true })
    return NextResponse.json(json, { status: res.status })
  } catch (e) {
    const msg = (e as Error).message
    if (msg === 'Missing WORKER_URL') return NextResponse.json({ error: 'Cấu hình Worker thiếu.' }, { status: 500 })
    return NextResponse.json({ error: 'Lưu ảnh minh họa thất bại: ' + msg }, { status: 500 })
  }
}
