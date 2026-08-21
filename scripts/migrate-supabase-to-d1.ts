import { createClient } from '@supabase/supabase-js'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
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
  console.error('Missing SUPABASE_URL or SERVICE_ROLE_KEY in .env')
  process.exit(1)
}
const supabase = createClient(SUPABASE_URL, SERVICE_KEY)

function esc(v: unknown): string {
  if (v === null || v === undefined) return 'NULL'
  if (typeof v === 'number') return Number.isFinite(v) ? String(v) : 'NULL'
  if (typeof v === 'boolean') return v ? '1' : '0'
  const s = String(v).replace(/'/g, "''")
  return `'${s}'`
}
function escJson(arr: unknown): string {
  if (!arr) return esc('[]')
  if (Array.isArray(arr)) return esc(JSON.stringify(arr))
  if (typeof arr === 'string') {
    try { const p = JSON.parse(arr); if (Array.isArray(p)) return esc(JSON.stringify(p)) } catch {}
    return esc(arr)
  }
  return esc(JSON.stringify(arr))
}

async function fetchAll(table: string, orderBy = 'id') {
  const rows: any[] = []
  const pageSize = 1000
  let from = 0
  while (true) {
    const { data, error } = await supabase.from(table).select('*').order(orderBy, { ascending: true }).range(from, from + pageSize - 1)
    if (error) throw new Error(`fetch ${table} ${from}-${from + pageSize}: ${error.message}`)
    if (!data || data.length === 0) break
    rows.push(...data)
    if (data.length < pageSize) break
    from += pageSize
  }
  return rows
}

async function main() {
  console.log('→ Fetching Supabase catalogue...')
  const [tags, series, chapters] = await Promise.all([
    fetchAll('tags', 'name'),
    fetchAll('series', 'created_at'),
    fetchAll('chapters', 'order_no'),
  ])
  console.log(`  tags: ${tags.length}, series: ${series.length}, chapters: ${chapters.length}`)

  const snapshotDir = path.resolve(process.cwd(), 'd1')
  if (!existsSync(snapshotDir)) mkdirSync(snapshotDir, { recursive: true })
  const snapFile = path.join(snapshotDir, `snapshot-${new Date().toISOString().slice(0,10)}.json`)
  const snapshot = { tags, series, chapters, exportedAt: new Date().toISOString() }
  writeFileSync(snapFile, JSON.stringify(snapshot, null, 2), 'utf-8')
  console.log(`  snapshot → ${path.relative(process.cwd(), snapFile)} (${(JSON.stringify(snapshot).length/1024/1024).toFixed(2)} MB)`)

  const sqlParts: string[] = []
  sqlParts.push('PRAGMA foreign_keys=OFF;')
  sqlParts.push('DELETE FROM chapters;')
  sqlParts.push('DELETE FROM series;')
  sqlParts.push('DELETE FROM tags;')

  for (const t of tags) {
    const id = esc(t.id)
    const name = esc(t.name)
    const created = esc(t.created_at || new Date().toISOString())
    sqlParts.push(`INSERT OR REPLACE INTO tags (id, name, created_at) VALUES (${id}, ${name}, ${created});`)
  }
  for (const s of series) {
    const vals = [
      esc(s.id),
      esc(s.title),
      esc(s.author ?? ''),
      esc(s.description ?? ''),
      esc(s.cover_url ?? ''),
      esc(s.status ?? 'published'),
      escJson(s.genres),
      escJson(s.tags),
      String(s.word_count ?? 0),
      esc(s.created_at || new Date().toISOString()),
      esc(s.updated_at || new Date().toISOString()),
    ]
    sqlParts.push(`INSERT OR REPLACE INTO series (id, title, author, description, cover_url, status, genres, tags, word_count, created_at, updated_at) VALUES (${vals.join(', ')});`)
  }
  const CHUNK = 200
  for (let i = 0; i < chapters.length; i += CHUNK) {
    const chunk = chapters.slice(i, i + CHUNK)
    for (const ch of chunk) {
      const vals = [
        esc(ch.id),
        esc(ch.series_id),
        String(Number(ch.order_no ?? 0)),
        esc(ch.title ?? ''),
        esc(ch.content ?? ''),
        esc(ch.status ?? 'published'),
        esc(ch.published_at ?? null),
        String(ch.word_count ?? Math.floor((ch.content?.length ?? 0)/5)),
        esc(ch.created_at || new Date().toISOString()),
      ]
      sqlParts.push(`INSERT OR REPLACE INTO chapters (id, series_id, order_no, title, content, status, published_at, word_count, created_at) VALUES (${vals.join(', ')});`)
    }
    if ((i/CHUNK) % 5 === 0) console.log(`  prepared ${Math.min(i+CHUNK, chapters.length)}/${chapters.length} chapters`)
  }
  sqlParts.push('PRAGMA foreign_keys=ON;')

  const outFile = path.join(snapshotDir, 'migrate-remote.sql')
  writeFileSync(outFile, sqlParts.join('\n'), 'utf-8')
  console.log(`  SQL → ${path.relative(process.cwd(), outFile)} (${(sqlParts.join('\n').length/1024/1024).toFixed(2)} MB, ${sqlParts.length} statements)`)

  console.log('→ Executing via wrangler d1 execute --remote ...')
  const cmd = `npx wrangler d1 execute sonovel --remote --file="${outFile.replace(/\\/g,'/')}"`
  console.log(`  $ ${cmd}`)
  try {
    execSync(cmd, { stdio: 'inherit', cwd: process.cwd() })
  } catch (e) {
    console.error('wrangler execute failed, try manual: ', cmd)
    process.exit(1)
  }

  console.log('→ Verifying D1 counts...')
  try {
    const verifyCmd = `npx wrangler d1 execute sonovel --remote --command="SELECT 'series' as tbl, COUNT(*) as c FROM series UNION ALL SELECT 'chapters', COUNT(*) FROM chapters UNION ALL SELECT 'tags', COUNT(*) FROM tags;"`
    execSync(verifyCmd, { stdio: 'inherit', cwd: process.cwd() })
  } catch {}

  console.log('✅ Migration done. Verify Worker: GET /api/series?limit=2 via WORKER_URL')
}

main().catch(e => { console.error(e); process.exit(1) })
