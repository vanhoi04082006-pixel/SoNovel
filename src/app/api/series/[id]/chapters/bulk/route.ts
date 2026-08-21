import { NextRequest, NextResponse } from 'next/server'
import { proxyToWorker } from '@/lib/worker'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await req.text()
    const { res, json } = await proxyToWorker(`/api/series/${id}/chapters/bulk`, { method: 'POST', body, admin: true })
    return NextResponse.json(json, { status: res.status })
  } catch (e) {
    return NextResponse.json({ error: 'Nhập hàng loạt thất bại: ' + (e as Error).message }, { status: 500 })
  }
}
