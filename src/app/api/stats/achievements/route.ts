import { NextResponse } from 'next/server'
import { proxyToWorker } from '@/lib/worker'

export async function GET() {
  try {
    const { res, json } = await proxyToWorker('/api/stats/achievements', { method: 'GET' })
    return NextResponse.json(json, { status: res.status })
  } catch (e) {
    return NextResponse.json({ error: 'Tải thành tích thất bại: ' + (e as Error).message }, { status: 500 })
  }
}
