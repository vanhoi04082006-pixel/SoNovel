import { NextRequest, NextResponse } from 'next/server'
import { proxyToWorker } from '@/lib/worker'

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const { res, json } = await proxyToWorker(`/api/bookmarks/${id}`, { method: 'DELETE' })
    return NextResponse.json(json, { status: res.status })
  } catch (e) {
    return NextResponse.json({ error: 'Xóa đánh dấu thất bại: ' + (e as Error).message }, { status: 500 })
  }
}
