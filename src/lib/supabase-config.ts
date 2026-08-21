// SoNovel — Supabase env config (no framework imports, safe for seed scripts).

export const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || ''
export const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || ''
export const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

if (typeof window !== 'undefined' && (!SUPABASE_URL || !SUPABASE_ANON_KEY)) {
  console.error('[supabase-config] Missing NEXT_PUBLIC_SUPABASE_URL/ANON_KEY — check Vercel Env (Production+Preview). URL:', SUPABASE_URL ? 'set' : 'empty', 'anon:', SUPABASE_ANON_KEY ? 'set' : 'empty')
}

export function isConfigured() {
  return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY)
}
