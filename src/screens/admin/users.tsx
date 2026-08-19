'use client'

import { useEffect, useState } from 'react'
import { Users, Shield, ShieldOff, Ban, CheckCircle2, Search, RefreshCw } from 'lucide-react'
import { api } from '@/lib/api-client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { toast } from 'sonner'
import { formatTimeAgo } from '@/lib/format'

type AdminUser = {
  id: string
  email: string
  role: string
  createdAt: string
  lastSignInAt: string | null
  banned: boolean
  emailConfirmed: boolean
}

export function AdminUsers() {
  const [users, setUsers] = useState<AdminUser[]>([])
  const [q, setQ] = useState('')
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = async (query = '') => {
    setLoading(true)
    try {
      const r = await api.listUsers(query)
      setUsers(r.items)
    } catch (e) {
      toast.error((e as Error).message || 'Không tải được danh sách người dùng.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const r = await api.listUsers('')
        if (!cancelled) setUsers(r.items)
      } catch {
        if (!cancelled) toast.error('Không tải được danh sách người dùng.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [])

  async function setRole(u: AdminUser, role: 'user' | 'admin') {
    setBusyId(u.id)
    try {
      await api.updateUser(u.id, { role })
      toast.success(role === 'admin' ? `Đã cấp quyền quản trị cho ${u.email}` : `Đã hạ quyền ${u.email} về người dùng`)
      setUsers((prev) => prev.map((x) => (x.id === u.id ? { ...x, role } : x)))
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setBusyId(null)
    }
  }

  async function toggleBan(u: AdminUser) {
    setBusyId(u.id)
    try {
      await api.updateUser(u.id, { action: u.banned ? 'unban' : 'ban' })
      toast.success(u.banned ? `Đã mở khóa ${u.email}` : `Đã khóa ${u.email}`)
      setUsers((prev) => prev.map((x) => (x.id === u.id ? { ...x, banned: !u.banned } : x)))
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Quản lý người dùng</h1>
        <p className="text-sm text-muted-foreground">Đổi quyền, khóa/mở tài khoản người dùng.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Users className="h-4 w-4" /> Danh sách ({users.length})</CardTitle>
          <CardDescription>Tìm kiếm theo email.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <div className="relative flex-1 max-w-sm">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') load(q) }}
                placeholder="Tìm email…"
                className="pl-8"
              />
            </div>
            <Button variant="outline" onClick={() => { setQ(''); load('') }}><RefreshCw className="h-4 w-4 mr-1" /> Làm mới</Button>
          </div>

          {loading ? (
            <div className="py-8 text-center text-sm text-muted-foreground">Đang tải…</div>
          ) : (
            <div className="rounded-xl border border-border divide-y divide-border overflow-hidden">
              {users.map((u) => (
                <div key={u.id} className="flex items-center gap-3 px-3 py-2.5 flex-wrap">
                  <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-muted text-xs font-semibold uppercase">
                    {u.email.slice(0, 2)}
                  </div>
                  <div className="flex-1 min-w-[160px]">
                    <p className="text-sm font-medium truncate">{u.email}</p>
                    <p className="text-xs text-muted-foreground">
                      {u.lastSignInAt ? `Đăng nhập ${formatTimeAgo(u.lastSignInAt)}` : 'Chưa đăng nhập'} · tham gia {formatTimeAgo(u.createdAt)}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {u.banned && <Badge variant="destructive">Đã khóa</Badge>}
                    <Badge variant={u.role === 'admin' ? 'default' : 'outline'}>
                      {u.role === 'admin' ? <Shield className="h-3 w-3 mr-1" /> : null}
                      {u.role === 'admin' ? 'Quản trị' : 'Người dùng'}
                    </Badge>
                    {!u.emailConfirmed && <Badge variant="secondary">Chưa xác thực</Badge>}
                  </div>
                  <div className="flex items-center gap-1">
                    {u.role === 'admin' ? (
                      <Button size="sm" variant="outline" disabled={busyId === u.id} onClick={() => setRole(u, 'user')}>
                        <ShieldOff className="h-3.5 w-3.5 mr-1" /> Hạ quyền
                      </Button>
                    ) : (
                      <Button size="sm" variant="outline" disabled={busyId === u.id} onClick={() => setRole(u, 'admin')}>
                        <Shield className="h-3.5 w-3.5 mr-1" /> Cấp quyền
                      </Button>
                    )}
                    <Button size="sm" variant={u.banned ? 'outline' : 'destructive'} disabled={busyId === u.id} onClick={() => toggleBan(u)}>
                      {u.banned ? <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> : <Ban className="h-3.5 w-3.5 mr-1" />}
                      {u.banned ? 'Mở khóa' : 'Khóa'}
                    </Button>
                  </div>
                </div>
              ))}
              {users.length === 0 && <div className="py-8 text-center text-sm text-muted-foreground">Không có người dùng nào.</div>}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
