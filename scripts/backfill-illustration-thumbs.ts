// Backfill 1 lần: sinh thumb preview cho ảnh minh họa cũ chưa có thumb_url.
// Đọc .env (IMGBB_API_KEY), gọi Worker D1 trực tiếp qua wrangler? Không —
// script này chạy độc lập: fetch danh sách từ Worker public API + PUT qua Next API
// với cookie admin? Đơn giản nhất: dùng SERVICE_TOKEN gọi thẳng Worker.
//
//   bun run scripts/backfill-illustration-thumbs.ts
//
// Env cần: WORKER_URL, SERVICE_TOKEN, IMGBB_API_KEY (đọc từ E:\SoNovel\.env)
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
const IMGBB_KEY = process.env.IMGBB_API_KEY || '';
if (!WORKER_URL || !SERVICE_TOKEN || !IMGBB_KEY) {
  console.error('Thiếu WORKER_URL / SERVICE_TOKEN / IMGBB_API_KEY trong .env');
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

async function uploadPreview(fullUrl: string): Promise<string> {
  const r = await fetch(fullUrl);
  if (!r.ok) throw new Error(`tải gốc HTTP ${r.status}`);
  const buf = Buffer.from(await r.arrayBuffer());
  const preview = await sharp(buf).rotate().resize({ width: 800, withoutEnlargement: true }).jpeg({ quality: 70 }).toBuffer();
  const fd = new FormData();
  fd.append('image', preview.toString('base64'));
  const up = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_KEY}`, { method: 'POST', body: fd as any });
  const j: any = await up.json().catch(() => null);
  if (!up.ok || !j?.success) throw new Error(j?.error?.message || `imgBB ${up.status}`);
  const url = j.data?.url || j.data?.display_url || j.data?.image?.url;
  if (!url) throw new Error('imgBB không trả URL');
  return url;
}

async function main() {
  const series = await wjson('/api/series?limit=100');
  let fixed = 0, skipped = 0, failed = 0;
  for (const s of series.items ?? []) {
    const ill = await wjson(`/api/series/${s.id}/illustrations`);
    const items: any[] = ill.items ?? [];
    if (!items.length) continue;
    const missing = items.filter((it) => !it.thumbUrl || it.thumbUrl === it.imageUrl);
    if (!missing.length) { skipped++; continue; }
    console.log(`→ ${s.title}: ${missing.length}/${items.length} thiếu thumb`);
    const next = [];
    for (const it of items) {
      if (it.thumbUrl && it.thumbUrl !== it.imageUrl) {
        next.push({ imageUrl: it.imageUrl, thumbUrl: it.thumbUrl, caption: it.caption || '' });
        continue;
      }
      try {
        const thumb = await uploadPreview(it.imageUrl);
        next.push({ imageUrl: it.imageUrl, thumbUrl: thumb, caption: it.caption || '' });
        fixed++;
        console.log(`  ✓ ${it.caption || it.id}`);
      } catch (e) {
        failed++;
        console.log(`  ✗ ${it.caption || it.id}: ${(e as Error).message}`);
        next.push({ imageUrl: it.imageUrl, thumbUrl: '', caption: it.caption || '' });
      }
    }
    await wjson(`/api/series/${s.id}/illustrations`, {
      method: 'PUT',
      body: JSON.stringify({ items: next }),
    });
    console.log(`  đã lưu ${next.length} ảnh`);
  }
  console.log(`Xong: ${fixed} thumb mới, ${skipped} truyện đã đủ, ${failed} lỗi`);
}

main().catch((e) => { console.error(e); process.exit(1); });
