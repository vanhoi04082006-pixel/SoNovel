import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  try {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      return NextResponse.json({ error: 'Supabase chưa được cấu hình.' }, { status: 500 })
    }
    const { email, password } = await req.json()
    if (!email || !password) {
      return NextResponse.json({ error: 'Vui lòng nhập đủ email và mật khẩu.' }, { status: 400 })
    }
    if (String(password).length < 6) {
      return NextResponse.json({ error: 'Mật khẩu phải có ít nhất 6 ký tự.' }, { status: 400 })
    }

    let cookiesToSet: { name: string; value: string; options: any }[] = []
    const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      cookies: {
        getAll() {
          return req.cookies.getAll()
        },
        setAll(toSet) {
          cookiesToSet = toSet
        },
      },
    })

    const { data, error } = await supabase.auth.signUp({
      email: String(email).trim().toLowerCase(),
      password: String(password),
    })
    if (error) {
      const msg = error.message.toLowerCase()
      if (msg.includes('already registered') || msg.includes('đã được')) {
        return NextResponse.json({ error: 'Email này đã được đăng ký.' }, { status: 400 })
      }
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    const response = NextResponse.json({
      ok: true,
      user: data.user ? { id: data.user.id, email: data.user.email, role: 'user' } : null,
      needsConfirm: !data.session,
    })
    cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
    return response
  } catch (e) {
    return NextResponse.json({ error: 'Đăng ký thất bại: ' + (e as Error).message }, { status: 500 })
  }
}
