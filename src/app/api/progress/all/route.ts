import { NextRequest, NextResponse } from 'next/server'
import { proxyToWorker } from '@/lib/worker'

export async function GET() {
  try {
    const { res, json } = await proxyToWorker('/api/progress/all', { method: 'GET' })
    return NextResponse.json(json, { status: res.status })
  } catch (e) {
    return NextResponse.json({ error: 'Tải tiến độ thất bại: ' + (e as Error).message }, { status: 500 })
  }
}
