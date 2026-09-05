import { NextRequest, NextResponse } from 'next/server'
import { proxyToWorker } from '@/lib/worker'

// GET /api/site-settings/:key — đọc cài đặt chung (public)
export async function GET(_req: NextRequest, { params }: { params: Promise<{ key: string }> }) {
  const { key } = await params
  try {
    const { res, json } = await proxyToWorker(`/api/site-settings/${encodeURIComponent(key)}`, { method: 'GET' })
    return NextResponse.json(json, { status: res.status })
  } catch (e) {
    return NextResponse.json({ error: 'Tải cài đặt thất bại: ' + (e as Error).message }, { status: 500 })
  }
}

// PUT /api/site-settings/:key — lưu cài đặt chung (admin)
export async function PUT(req: NextRequest, { params }: { params: Promise<{ key: string }> }) {
  try {
    const { key } = await params
    const body = await req.text()
    const { res, json } = await proxyToWorker(`/api/site-settings/${encodeURIComponent(key)}`, { method: 'PUT', body, admin: true })
    return NextResponse.json(json, { status: res.status })
  } catch (e) {
    return NextResponse.json({ error: 'Lưu cài đặt thất bại: ' + (e as Error).message }, { status: 500 })
  }
}
