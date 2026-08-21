import { NextRequest, NextResponse } from 'next/server'
import { proxyToWorker } from '@/lib/worker'

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url)
    const { res, json } = await proxyToWorker(`/api/series${url.search}`, { method: 'GET' })
    return NextResponse.json(json, { status: res.status })
  } catch (e) {
    return NextResponse.json({ error: 'Tải danh sách truyện thất bại: ' + (e as Error).message }, { status: 500 })
  }
}
