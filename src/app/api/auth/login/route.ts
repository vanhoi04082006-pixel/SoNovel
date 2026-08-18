import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { hashPassword, signSession, SESSION_COOKIE_NAME, SESSION_COOKIE_MAX_AGE } from '@/lib/auth'

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json()
    if (!email || !password) {
      return NextResponse.json({ error: 'Vui lòng nhập đủ email và mật khẩu.' }, { status: 400 })
    }
    const profile = await db.profile.findUnique({ where: { email: String(email).toLowerCase() } })
    if (!profile) {
      return NextResponse.json({ error: 'Email hoặc mật khẩu không đúng.' }, { status: 400 })
    }
    const { verifyPassword } = await import('@/lib/auth')
    if (!verifyPassword(String(password), profile.passwordHash)) {
      return NextResponse.json({ error: 'Email hoặc mật khẩu không đúng.' }, { status: 400 })
    }
    const token = signSession(profile.id, profile.email, profile.role)
    const res = NextResponse.json({ ok: true, user: { id: profile.id, email: profile.email, role: profile.role } })
    res.cookies.set(SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: 'lax',
      maxAge: SESSION_COOKIE_MAX_AGE,
      path: '/',
    })
    return res
  } catch (e) {
    return NextResponse.json({ error: 'Đăng nhập thất bại: ' + (e as Error).message }, { status: 500 })
  }
}
