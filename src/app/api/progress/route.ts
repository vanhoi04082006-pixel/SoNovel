import { NextRequest, NextResponse } from 'next/server'
import { proxyToWorker } from '@/lib/worker'

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url)
    const { res, json } = await proxyToWorker(`/api/progress${url.search}`, { method: 'GET' })
    return NextResponse.json(json, { status: res.status })
  } catch (e) {
    return NextResponse.json({ error: 'Tải tiến độ thất bại: ' + (e as Error).message }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.text()
    const { res, json } = await proxyToWorker('/api/progress', { method: 'PUT', body })
    return NextResponse.json(json, { status: res.status })
  } catch (e) {
    return NextResponse.json({ error: 'Lưu tiến độ thất bại: ' + (e as Error).message }, { status: 500 })
  }
}
