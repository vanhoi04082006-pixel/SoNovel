import { NextRequest, NextResponse } from 'next/server'
import { proxyToWorker } from '@/lib/worker'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await req.text()
    const { res, json } = await proxyToWorker(`/api/tags/${id}`, { method: 'PATCH', body, admin: true })
    return NextResponse.json(json, { status: res.status })
  } catch (e) {
    return NextResponse.json({ error: 'Cập nhật tag thất bại: ' + (e as Error).message }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const { res, json } = await proxyToWorker(`/api/tags/${id}`, { method: 'DELETE', admin: true })
    return NextResponse.json(json, { status: res.status })
  } catch (e) {
    return NextResponse.json({ error: 'Xóa tag thất bại: ' + (e as Error).message }, { status: 500 })
  }
}
