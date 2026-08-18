import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAdmin } from '@/lib/session'

// GET /api/stats — admin dashboard stats
export async function GET() {
  try {
    await requireAdmin()
    const [seriesCount, chapterCount, userCount, progressCount] = await Promise.all([
      db.series.count(),
      db.chapter.count(),
      db.profile.count(),
      db.progress.count(),
    ])
    // status breakdown for series
    const statusBreakdown = await db.series.groupBy({ by: ['status'], _count: true })
    const byStatus: Record<string, number> = { draft: 0, published: 0, completed: 0, hidden: 0 }
    statusBreakdown.forEach((s) => (byStatus[s.status] = s._count))
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
    return NextResponse.json({ error: 'Tải thống kê thất bại.' }, { status: 500 })
  }
}
