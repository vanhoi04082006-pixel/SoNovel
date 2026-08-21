import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/session'
import { createAdminSupabase } from '@/lib/supabase-admin'
import { proxyToWorker } from '@/lib/worker'

export async function GET(req: NextRequest) {
  try {
    await requireAdmin()
    const admin = createAdminSupabase()
    const { searchParams } = new URL(req.url)
    const q = (searchParams.get('q') || '').trim().toLowerCase()

    const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
    if (error) {
      return NextResponse.json({ error: 'Không tải được danh sách người dùng: ' + error.message }, { status: 500 })
    }

    const all = data.users
    const ids = all.map((u) => u.id)
    let roleMap = new Map<string, string>()
    if (ids.length) {
      try {
        const { res, json } = await proxyToWorker(`/api/profiles/roles?ids=${ids.join(',')}`, { method: 'GET', admin: true })
        if (res.ok && json?.roles) roleMap = new Map(Object.entries(json.roles as Record<string, string>))
      } catch {}
      if (roleMap.size === 0) {
        const { data: profiles } = await admin.from('profiles').select('id, role').in('id', ids)
        if (profiles) roleMap = new Map(profiles.map((p) => [p.id, p.role as string]))
      }
    }

    let users = all.map((u) => ({
      id: u.id,
      email: u.email ?? '',
      role: roleMap.get(u.id) ?? 'user',
      createdAt: u.created_at,
      lastSignInAt: u.last_sign_in_at ?? null,
      banned: !!u.banned_until,
      emailConfirmed: !!(u.email_confirmed_at || u.confirmed_at),
    }))

    if (q) users = users.filter((u) => u.email.includes(q))

    return NextResponse.json({ items: users })
  } catch (e) {
    const msg = (e as Error).message
    if (msg === 'UNAUTHORIZED' || msg === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Bạn không có quyền quản trị.' }, { status: 403 })
    }
    return NextResponse.json({ error: 'Lỗi: ' + msg }, { status: 500 })
  }
}
