import { NextResponse } from 'next/server'
import { proxyToWorker } from '@/lib/worker'

export async function GET() {
  try {
    const { res, json } = await proxyToWorker('/api/stats/streak', { method: 'GET' })
    return NextResponse.json(json, { status: res.status })
  } catch (e) {
    return NextResponse.json({ error: 'Tải streak thất bại: ' + (e as Error).message }, { status: 500 })
  }
}
