import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  try {
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
    await supabase.auth.signOut()

    const response = NextResponse.json({ ok: true })
    // Supabase clears the session cookies with maxAge 0; also hard-clear defensively.
    cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
    response.cookies.set('sb-access-token', '', { maxAge: 0, path: '/' })
    response.cookies.set('sb-refresh-token', '', { maxAge: 0, path: '/' })
    return response
  } catch {
    const response = NextResponse.json({ ok: true })
    response.cookies.set('sb-access-token', '', { maxAge: 0, path: '/' })
    response.cookies.set('sb-refresh-token', '', { maxAge: 0, path: '/' })
    return response
  }
}
