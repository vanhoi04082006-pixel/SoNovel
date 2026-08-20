import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { readdir, readFile, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { serverDb } from '@/lib/server-data'
import { chapterWordCount, recalcSeriesWordCount } from '@/lib/sonovel'
import { invalidateAll } from '@/lib/server-cache'
import { requireAdmin } from '@/lib/session'
import { parseChapterFilename, naturalCompare } from '@/lib/chapter-filename'

// POST /api/series/[id]/chapters/import-folder — nhập chương hàng loạt từ thư mục (admin)
// Chỉ chạy được khi server có quyền đọc thư mục trên máy (local/dev). Không hoạt động trên serverless.
// Body: { folderPath: string, preview?: boolean }
//   preview=true → chỉ quét và trả danh sách {orderNo,title,fileName,charCount,exists}, không ghi DB.
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

    const supabase = serverDb()

    const { data: existing } = await supabase.from('chapters').select('order_no').eq('series_id', id)
    const existingOrders = new Set((existing ?? []).map((c: any) => c.order_no))

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

    const rows: any[] = []
    const skipped: string[] = []
    for (const file of entries) {
      const { orderNo, title } = parseChapterFilename(file)
      if (orderNo == null || orderNo < 1) continue
      if (existingOrders.has(orderNo)) {
        skipped.push(file)
        continue
      }
      const content = await readFile(join(folderPath, file), 'utf8')
      rows.push({
        id: randomUUID(),
        series_id: id,
        order_no: orderNo,
        title,
        content,
        status: 'published',
        word_count: chapterWordCount(content),
        published_at: new Date().toISOString(),
      })
    }

    if (rows.length === 0) {
      return NextResponse.json({
        error: 'Không có chương mới hợp lệ. Tất cả số thứ tự đều đã tồn tại hoặc không có số "Chương N".',
        skipped: skipped.length,
      }, { status: 400 })
    }

    const { error } = await supabase.from('chapters').upsert(rows, { onConflict: 'series_id,order_no', ignoreDuplicates: true })
    if (error) throw error

    await recalcSeriesWordCount(id)
    invalidateAll()

    return NextResponse.json({ ok: true, count: rows.length, skipped: skipped.length })
  } catch (e) {
    const msg = (e as Error).message
    if (msg === 'UNAUTHORIZED' || msg === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Bạn không có quyền quản trị.' }, { status: 403 })
    }
    return NextResponse.json({ error: 'Nhập từ thư mục thất bại: ' + msg }, { status: 500 })
  }
}