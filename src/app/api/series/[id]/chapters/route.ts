import { NextRequest, NextResponse } from 'next/server'
import { proxyToWorker } from '@/lib/worker'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
    const url = new URL(req.url)
    const { res, json } = await proxyToWorker(`/api/series/${id}/chapters${url.search}`, { method: 'GET', admin: url.searchParams.get('all') === '1' })
    return NextResponse.json(json, { status: res.status })
  } catch (e) {
    return NextResponse.json({ error: 'Tải danh sách chương thất bại: ' + (e as Error).message }, { status: 500 })
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await req.text()
    const { res, json } = await proxyToWorker(`/api/series/${id}/chapters`, { method: 'POST', body, admin: true })
    return NextResponse.json(json, { status: res.status })
  } catch (e) {
    return NextResponse.json({ error: 'Tạo chương thất bại: ' + (e as Error).message }, { status: 500 })
  }
}
