import { NextRequest, NextResponse } from 'next/server'
import { readdir, readFile, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { requireAdmin } from '@/lib/session'
import { parseChapterFilename, naturalCompare } from '@/lib/chapter-filename'
import { proxyToWorker } from '@/lib/worker'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin()
    const { id } = await params
    const body = await req.json()
    const folderPath = String(body?.folderPath || '').trim()
    const preview = body?.preview === true

    if (!folderPath) {
      return NextResponse.json({ error: 'Thiếu đường dẫn thư mục.' }, { status: 400 })
    }

    let dirStat
    try {
      dirStat = await stat(folderPath)
    } catch {
      return NextResponse.json({ error: 'Không tìm thấy thư mục trên máy chủ.' }, { status: 400 })
    }
    if (!dirStat.isDirectory()) {
      return NextResponse.json({ error: 'Đường dẫn không phải là thư mục.' }, { status: 400 })
    }

    const entries = (await readdir(folderPath)).filter((f) => /\.txt$/i.test(f)).sort(naturalCompare)

    if (entries.length === 0) {
      return NextResponse.json({ error: 'Thư mục không có file .txt nào.' }, { status: 400 })
    }
    if (entries.length > 500) {
      return NextResponse.json({ error: 'Tối đa 500 chương mỗi lần nhập.' }, { status: 400 })
    }

    let existingOrders = new Set<number>()
    try {
      const { res, json } = await proxyToWorker(`/api/series/${id}/chapters?all=1`, { method: 'GET', admin: true })
      if (res.ok && json?.items) existingOrders = new Set((json.items as any[]).map((c: any) => c.orderNo))
    } catch {}

    if (preview) {
      const previewRows = entries
        .map((file) => {
          const { orderNo, title } = parseChapterFilename(file)
          if (orderNo == null || orderNo < 1) return null
          return { fileName: file, orderNo, title, exists: existingOrders.has(orderNo) }
        })
        .filter((r): r is NonNullable<typeof r> => r !== null)
      return NextResponse.json({ ok: true, preview: previewRows, total: previewRows.length })
    }

    const skipped: string[] = []
    const chapters: any[] = []
    for (const file of entries) {
      const { orderNo, title } = parseChapterFilename(file)
      if (orderNo == null || orderNo < 1) continue
      if (existingOrders.has(orderNo)) {
        skipped.push(file)
        continue
      }
      const content = await readFile(join(folderPath, file), 'utf8')
      chapters.push({ orderNo, title, content, status: 'published' })
    }

    if (chapters.length === 0) {
      return NextResponse.json({
        error: 'Không có chương mới hợp lệ. Tất cả số thứ tự đều đã tồn tại hoặc không có số "Chương N".',
        skipped: skipped.length,
      }, { status: 400 })
    }

    const { res, json } = await proxyToWorker(`/api/series/${id}/chapters/bulk`, {
      method: 'POST',
      body: JSON.stringify({ chapters }),
      admin: true,
    })
    if (!res.ok) return NextResponse.json(json, { status: res.status })
    return NextResponse.json({ ok: true, count: json.count, skipped: (json.skipped ?? 0) + skipped.length })
  } catch (e) {
    const msg = (e as Error).message
    if (msg === 'UNAUTHORIZED' || msg === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Bạn không có quyền quản trị.' }, { status: 403 })
    }
    return NextResponse.json({ error: 'Nhập từ thư mục thất bại: ' + msg }, { status: 500 })
  }
}
