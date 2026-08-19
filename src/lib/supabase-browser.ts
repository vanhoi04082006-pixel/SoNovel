'use client'

import { createBrowserClient } from '@supabase/ssr'
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '@/lib/supabase-config'

let client: ReturnType<typeof createBrowserClient> | null = null

export function createBrowserSupabase() {
  if (client) return client
  client = createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  return client
}
