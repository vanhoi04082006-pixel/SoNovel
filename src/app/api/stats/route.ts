import { NextResponse } from 'next/server'
import { serverDb } from '@/lib/server-data'
import { requireAdmin } from '@/lib/session'

// GET /api/stats — admin dashboard stats
export async function GET() {
  try {
    await requireAdmin()
    const supabase = serverDb()

    const countOf = async (table: string) => {
      const { count, error } = await supabase.from(table).select('*', { count: 'exact', head: true })
      if (error) throw error
      return count ?? 0
    }

    const [seriesCount, chapterCount, userCount, progressCount] = await Promise.all([
      countOf('series'),
      countOf('chapters'),
      countOf('profiles'),
      countOf('progress'),
    ])

    const { data: statuses, error: sErr } = await supabase.from('series').select('status')
    if (sErr) throw sErr
    const byStatus: Record<string, number> = { draft: 0, published: 0, completed: 0, hidden: 0 }
    ;(statuses ?? []).forEach((s: any) => { if (s.status in byStatus) byStatus[s.status]++ })

    return NextResponse.json({
      series: seriesCount,
      chapters: chapterCount,
      users: userCount,
      listeners: progressCount,
      byStatus,
    })
  } catch (e) {
    const msg = (e as Error).message
    if (msg === 'UNAUTHORIZED' || msg === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Bạn không có quyền quản trị.' }, { status: 403 })
    }
    return NextResponse.json({ error: 'Tải thống kê thất bại: ' + msg }, { status: 500 })
  }
}
