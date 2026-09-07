// Backfill 1 lần: đo width/height ảnh minh họa cũ (chỉ đọc metadata, không resize).
//   bun run scripts/backfill-illustration-dims.ts
// Env: WORKER_URL, SERVICE_TOKEN (đọc từ E:\SoNovel\.env)
import { readFileSync } from 'fs';
import sharp from 'sharp';

const ROOT = new URL('..', import.meta.url).pathname;
function loadLocalEnv() {
  try {
    const raw = readFileSync(`${ROOT}/.env`, 'utf8');
    for (const line of raw.split('\n')) {
      const m = line.match(/^([A-Z_]+)=(.*)$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
    }
  } catch {}
}
loadLocalEnv();

const WORKER_URL = (process.env.WORKER_URL || '').replace(/\/$/, '');
const SERVICE_TOKEN = process.env.SERVICE_TOKEN || '';
if (!WORKER_URL || !SERVICE_TOKEN) {
  console.error('Thiếu WORKER_URL / SERVICE_TOKEN trong .env');
  process.exit(1);
}

async function wjson(path: string, init: RequestInit = {}): Promise<any> {
  const res = await fetch(`${WORKER_URL}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', 'x-service-token': SERVICE_TOKEN, ...(init.headers || {}) },
  });
  const j: any = await res.json().catch(() => null);
  if (!res.ok) throw new Error(j?.error || `Worker ${res.status} ${path}`);
  return j;
}

async function probe(url: string): Promise<{ width: number; height: number }> {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`tải HTTP ${r.status}`);
  const buf = Buffer.from(await r.arrayBuffer());
  const meta = await sharp(buf).metadata();
  return { width: meta.width || 0, height: meta.height || 0 };
}

async function main() {
  const series = await wjson('/api/series?limit=100');
  let fixed = 0, skipped = 0, failed = 0;
  for (const s of series.items ?? []) {
    const ill = await wjson(`/api/series/${s.id}/illustrations`);
    const items: any[] = ill.items ?? [];
    if (!items.length) continue;
    const need = items.filter((it) => !(it.width > 0 && it.height > 0));
    if (!need.length) { skipped++; continue; }
    console.log(`→ ${s.title}: ${need.length}/${items.length} thiếu dims`);
    const next = [];
    for (const it of items) {
      if (it.width > 0 && it.height > 0) {
        next.push({ imageUrl: it.imageUrl, thumbUrl: it.thumbUrl || '', groupName: it.groupName || '', width: it.width, height: it.height, caption: it.caption || '' });
        continue;
      }
      try {
        const d = await probe(it.imageUrl);
        next.push({ imageUrl: it.imageUrl, thumbUrl: it.thumbUrl || '', groupName: it.groupName || '', width: d.width, height: d.height, caption: it.caption || '' });
        fixed++;
        console.log(`  ✓ ${it.caption || it.id} ${d.width}x${d.height}`);
      } catch (e) {
        failed++;
        console.log(`  ✗ ${it.caption || it.id}: ${(e as Error).message}`);
        next.push({ imageUrl: it.imageUrl, thumbUrl: it.thumbUrl || '', groupName: it.groupName || '', width: 0, height: 0, caption: it.caption || '' });
      }
    }
    await wjson(`/api/series/${s.id}/illustrations`, {
      method: 'PUT',
      body: JSON.stringify({ items: next }),
    });
    console.log(`  đã lưu ${next.length} ảnh`);
  }
  console.log(`Xong: ${fixed} dims mới, ${skipped} truyện đã đủ, ${failed} lỗi`);
}

main().catch((e) => { console.error(e); process.exit(1); });
