// SoNovel — backfill D1 profiles từ Supabase (auth.users + profiles role).
// Lý do: D1 enforce foreign key; mọi ghi user-data (favorites/bookmarks/progress/...)
// cần row profiles(id) tồn tại. Script này chép toàn bộ user hiện có vào D1.
// Chạy: bun run scripts/backfill-d1-profiles.ts
// Yêu cầu env: NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY.

import { createClient } from '@supabase/supabase-js'
import { readFileSync, writeFileSync, existsSync } from 'fs'
import { execSync } from 'child_process'
import path from 'path'

function loadEnv() {
  const envPath = path.resolve(process.cwd(), '.env')
  if (!existsSync(envPath)) return
  const content = readFileSync(envPath, 'utf-8')
  for (const line of content.split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (!m) continue
    const k = m[1]
    let v = m[2].trim()
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
    if (!process.env[k]) process.env[k] = v
  }
}
loadEnv()

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || ''
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env')
  process.exit(1)
}
const supabase = createClient(SUPABASE_URL, SERVICE_KEY)

function esc(v: unknown): string {
  if (v === null || v === undefined) return 'NULL'
  if (typeof v === 'number') return Number.isFinite(v) ? String(v) : 'NULL'
  const s = String(v).replace(/'/g, "''")
  return `'${s}'`
}

async function main() {
  console.log('→ Fetching auth.users from Supabase...')
  const users: any[] = []
  let page = 1
  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 })
    if (error) throw new Error(`listUsers page ${page}: ${error.message}`)
    if (!data.users || data.users.length === 0) break
    users.push(...data.users)
    if (data.users.length < 1000) break
    page++
  }
  console.log(`  auth.users: ${users.length}`)

  console.log('→ Fetching profiles (roles)...')
  const roleMap = new Map<string, string>()
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from('profiles').select('id, role').range(from, from + 999)
    if (error) throw new Error(`profiles ${from}: ${error.message}`)
    if (!data || data.length === 0) break
    for (const p of data) roleMap.set(p.id, p.role)
    if (data.length < 1000) break
  }
  console.log(`  profiles: ${roleMap.size}`)

  const now = new Date().toISOString()
  const lines = users.map((u) => {
    const id = esc(u.id)
    const role = roleMap.get(u.id) === 'admin' ? 'admin' : 'user'
    const created = esc(u.created_at || now)
    return `INSERT OR IGNORE INTO profiles (id, role, created_at) VALUES (${id}, '${role}', ${created});`
  })

  const outFile = path.join(path.resolve(process.cwd(), 'd1'), 'backfill-profiles.sql')
  writeFileSync(outFile, lines.join('\n'), 'utf-8')
  console.log(`  SQL → ${path.relative(process.cwd(), outFile)} (${lines.length} statements)`)

  console.log('→ Executing via wrangler d1 execute --remote ...')
  const cmd = `npx wrangler d1 execute sonovel --remote --file="${outFile.replace(/\\/g, '/')}"`
  console.log(`  $ ${cmd}`)
  try {
    execSync(cmd, { stdio: 'inherit', cwd: process.cwd() })
  } catch (e) {
    console.error('wrangler execute failed, try manual: ', cmd)
    process.exit(1)
  }

  console.log('→ Verifying D1 profiles count...')
  try {
    const verifyCmd = `npx wrangler d1 execute sonovel --remote --command="SELECT role, COUNT(*) AS c FROM profiles GROUP BY role;"`
    execSync(verifyCmd, { stdio: 'inherit', cwd: process.cwd() })
  } catch {}

  console.log('✅ Backfill done.')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
