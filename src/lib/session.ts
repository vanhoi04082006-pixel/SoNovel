// SoNovel — session helper for API routes (reads cookie, returns user payload)

import { cookies } from 'next/headers'
import { verifySession, SESSION_COOKIE_NAME } from '@/lib/auth'
import { db } from '@/lib/db'

export type SessionUser = {
  id: string
  email: string
  role: 'user' | 'admin'
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const store = await cookies()
  const token = store.get(SESSION_COOKIE_NAME)?.value
  const payload = verifySession(token)
  if (!payload) return null
  // re-check role from DB (in case changed)
  const p = await db.profile.findUnique({ where: { id: payload.uid }, select: { id: true, email: true, role: true } })
  if (!p) return null
  return { id: p.id, email: p.email, role: p.role as 'user' | 'admin' }
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
