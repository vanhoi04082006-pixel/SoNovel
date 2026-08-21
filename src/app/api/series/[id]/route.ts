import { NextRequest, NextResponse } from 'next/server'
import { proxyToWorker } from '@/lib/worker'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
    const { res, json } = await proxyToWorker(`/api/series/${id}`, { method: 'GET' })
    return NextResponse.json(json, { status: res.status })
  } catch (e) {
    return NextResponse.json({ error: 'Tải truyện thất bại: ' + (e as Error).message }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await req.text()
    const { res, json } = await proxyToWorker(`/api/series/${id}`, { method: 'PATCH', body, admin: true })
    return NextResponse.json(json, { status: res.status })
  } catch (e) {
    const msg = (e as Error).message
    if (msg === 'Missing WORKER_URL') return NextResponse.json({ error: 'Cấu hình Worker thiếu.' }, { status: 500 })
    return NextResponse.json({ error: 'Cập nhật thất bại: ' + msg }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const { res, json } = await proxyToWorker(`/api/series/${id}`, { method: 'DELETE', admin: true })
    return NextResponse.json(json, { status: res.status })
  } catch (e) {
    return NextResponse.json({ error: 'Xóa thất bại: ' + (e as Error).message }, { status: 500 })
  }
}
