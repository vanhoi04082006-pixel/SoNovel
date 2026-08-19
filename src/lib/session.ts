// SoNovel — session helper for API routes (Supabase Auth).
// Reads the auth session from cookies, re-checks role from public.profiles.

import { createServerSupabase } from '@/lib/supabase'
import { serverDb } from '@/lib/server-data'

export type SessionUser = {
  id: string
  email: string
  role: 'user' | 'admin'
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const supabase = await createServerSupabase()
  const { data } = await supabase.auth.getUser()
  const user = data.user
  if (!user) return null

  let role = 'user'
  try {
    const { data: p } = await serverDb().from('profiles').select('role').eq('id', user.id).maybeSingle()
    if (p) role = p.role
  } catch {
    // profiles row may be missing — fall back to 'user'
  }

  return { id: user.id, email: user.email ?? '', role: role as 'user' | 'admin' }
}

export async function requireUser(): Promise<SessionUser> {
  const u = await getSessionUser()
  if (!u) throw new Error('UNAUTHORIZED')
  return u
}

export async function requireAdmin(): Promise<SessionUser> {
  const u = await requireUser()
  if (u.role !== 'admin') throw new Error('FORBIDDEN')
  return u
}
