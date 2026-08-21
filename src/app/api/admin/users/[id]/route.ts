import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/session'
import { createAdminSupabase } from '@/lib/supabase-admin'
import { proxyToWorker } from '@/lib/worker'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin()
    const { id } = await params
    const body = await req.json()

    if (body.role !== undefined) {
      if (body.role !== 'user' && body.role !== 'admin') {
        return NextResponse.json({ error: 'Role không hợp lệ.' }, { status: 400 })
      }
      const { res, json } = await proxyToWorker(`/api/admin/users/${id}`, { method: 'PATCH', body: JSON.stringify({ role: body.role }), admin: true })
      if (!res.ok) return NextResponse.json(json, { status: res.status })
      return NextResponse.json({ ok: true })
    }

    const admin = createAdminSupabase()
    if (body.action === 'ban') {
      const { error } = await admin.auth.admin.updateUserById(id, { ban_duration: '876000h' })
      if (error) return NextResponse.json({ error: 'Không khóa được tài khoản: ' + error.message }, { status: 500 })
      return NextResponse.json({ ok: true })
    }

    if (body.action === 'unban') {
      const { error } = await admin.auth.admin.updateUserById(id, { ban_duration: 'none' })
      if (error) return NextResponse.json({ error: 'Không mở khóa được tài khoản: ' + error.message }, { status: 500 })
      return NextResponse.json({ ok: true })
    }

    return NextResponse.json({ error: 'Thiếu hành động (role/ban/unban).' }, { status: 400 })
  } catch (e) {
    const msg = (e as Error).message
    if (msg === 'UNAUTHORIZED' || msg === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Bạn không có quyền quản trị.' }, { status: 403 })
    }
    return NextResponse.json({ error: 'Lỗi: ' + msg }, { status: 500 })
  }
}
