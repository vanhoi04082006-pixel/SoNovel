import { NextRequest, NextResponse } from 'next/server'
import { proxyToWorker } from '@/lib/worker'

export async function GET() {
  try {
    const { res, json } = await proxyToWorker('/api/history', { method: 'GET' })
    return NextResponse.json(json, { status: res.status })
  } catch (e) {
    return NextResponse.json({ error: 'Tải lịch sử thất bại: ' + (e as Error).message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.text()
    const { res, json } = await proxyToWorker('/api/history', { method: 'POST', body })
    return NextResponse.json(json, { status: res.status })
  } catch (e) {
    return NextResponse.json({ error: 'Ghi lịch sử thất bại: ' + (e as Error).message }, { status: 500 })
  }
}
