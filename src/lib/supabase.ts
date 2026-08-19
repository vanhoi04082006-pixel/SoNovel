// SoNovel — Supabase server client (reads/writes auth session via cookies).

import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { ReadonlyRequestCookies } from 'next/dist/server/web/spec-extension/adapters/request-cookies'
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '@/lib/supabase-config'

export { SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY } from '@/lib/supabase-config'

// Used by route handlers & server components (reads current request cookies).
export async function createServerSupabase() {
  const cookieStore = await cookies()
  return buildServerClient(cookieStore)
}

// Used by auth route handlers (login/signup/logout) so cookies can be set on the response.
export function buildServerClient(cookieStore: ReadonlyRequestCookies) {
  return createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
        } catch {
          // Called from a Server Component — safe to ignore.
        }
      },
    },
  })
}
