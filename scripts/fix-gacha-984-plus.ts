// Fix 177 chương cuối (984-1160) truyện Gacha 6★: title rút từ header trong nội dung.
//   - "Chương N: Sub" / "**Chương N: Sub**"      -> title=Sub, xóa 2 dòng
//   - "N: Sub" (thiếu chữ Chương, vd 993)        -> title=Sub, xóa 2 dòng
//   - "N화: Sub" kiểu Hàn (1041-1044,1086-1088)  -> title=Sub (1086-1088 chỉ lấy phần Việt trong ngoặc), xóa 2 dòng
//   - "(Ngoại truyện) ..." (1117-1120)           -> title="Ngoại truyện - ...", xóa 2 dòng
//   - Không header (28 chương)                    -> chỉ xóa dòng "Chương N", giữ title cũ
//   - Header lệch số (1097 ghi 1098)             -> vẫn làm + log MISMATCH (dùng --skip=1097 để bỏ qua)
//
//   bun run scripts/fix-gacha-984-plus.ts --dry-run
//   bun run scripts/fix-gacha-984-plus.ts --dry-run --orders=1097,1117
//   bun run scripts/fix-gacha-984-plus.ts --skip=1097
//   bun run scripts/fix-gacha-984-plus.ts
//
// Env: WORKER_URL, SERVICE_TOKEN (đọc từ .env ở root)
import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
function loadLocalEnv() {
  try {
    const raw = readFileSync(join(ROOT, '.env'), 'utf8');
    for (const line of raw.split('\n')) {
      const m = line.match(/^([A-Z_]+)=(.*)$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
    }
  } catch {}
}
loadLocalEnv();

const SERIES_ID = '8c3d0a29-b0a8-4cc0-861e-3ff0806f730a';
const MIN_ORDER = 984;
const WORKER_URL = (process.env.WORKER_URL || '').replace(/\/$/, '');
const SERVICE_TOKEN = process.env.SERVICE_TOKEN || '';
if (!WORKER_URL || !SERVICE_TOKEN) {
  console.error('Thiếu WORKER_URL / SERVICE_TOKEN trong .env');
  process.exit(1);
}

const args = process.argv.slice(2);
const DRY = args.includes('--dry-run');
const ORDERS_ARG = (args.find((a) => a.startsWith('--orders=')) || '').split('=')[1] || '';
const SKIP_ARG = (args.find((a) => a.startsWith('--skip=')) || '').split('=')[1] || '';
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function wjson(path: string, init: RequestInit = {}, retries = 3): Promise<any> {
  let last: any = null;
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(`${WORKER_URL}${path}`, {
        ...init,
        headers: { 'Content-Type': 'application/json', 'x-service-token': SERVICE_TOKEN, ...(init.headers || {}) },
      });
      const j: any = await res.json().catch(() => null);
      if (!res.ok) throw new Error(j?.error || `Worker ${res.status} ${path}`);
      return j;
    } catch (e) {
      last = e;
      await sleep(500 * (i + 1));
    }
  }
  throw last;
}

const STD_RE = /^\*{0,2}\s*Chương\s+(\d+)\s*[:\-–—]?\s*(.*?)\s*\*{0,2}$/;
const BARE_RE = /^\*{0,2}\s*(\d+)\s*:\s*(.+?)\s*\*{0,2}$/;
const HWA_RE = /^\*{0,2}\s*(\d+)\s*화\s*:\s*(.+?)\s*\*{0,2}$/;

type Kind = 'std' | 'bare' | 'hwa' | 'paren' | 'story' | 'other';

function transform(
  orderNo: number,
  oldTitle: string,
  content: string,
): { title: string; content: string; kind: Kind; sub: string; headerNum: number | null; stripped: string[] } {
  const lines = content.split('\n');
  const stripped: string[] = [];
  if ((lines[0] || '').trim() !== `Chương ${orderNo}`) {
    return { title: oldTitle, content, kind: 'other', sub: '', headerNum: null, stripped };
  }
  stripped.push(lines[0].trim());
  let i = 1;
  while (i < lines.length && lines[i].trim() === '') i++;
  const t = (lines[i] || '').trim();
  let m: RegExpMatchArray | null;
  // 1) Chuẩn "Chương N: Sub"
  if ((m = t.match(STD_RE)) && (m[1] || m[2])) {
    const headerNum = Number(m[1]);
    const rawSub = (m[2] || '').trim();
    stripped.push(t);
    i++;
    while (i < lines.length && lines[i].trim() === '') i++;
    if (!rawSub) {
      // Dòng lặp lại "Chương N" (không Sub) -> không có title để rút
      return { title: oldTitle, content: lines.slice(i).join('\n'), kind: 'story', sub: '', headerNum, stripped };
    }
    return { title: rawSub, content: lines.slice(i).join('\n'), kind: 'std', sub: rawSub, headerNum, stripped };
  }
  // 2) "N: Sub" (thiếu chữ Chương)
  if ((m = t.match(BARE_RE)) && Number(m[1]) === orderNo) {
    const sub = m[2].trim();
    stripped.push(t);
    i++;
    while (i < lines.length && lines[i].trim() === '') i++;
    return { title: sub, content: lines.slice(i).join('\n'), kind: 'bare', sub, headerNum: orderNo, stripped };
  }
  // 3) "N화: Sub" kiểu Hàn
  if ((m = t.match(HWA_RE)) && Number(m[1]) === orderNo) {
    const rawSub = m[2].trim();
    const pm = rawSub.match(/\(([^()]+)\)\s*$/);
    const sub = pm ? pm[1].trim() : rawSub;
    stripped.push(t);
    i++;
    while (i < lines.length && lines[i].trim() === '') i++;
    return { title: sub, content: lines.slice(i).join('\n'), kind: 'hwa', sub, headerNum: orderNo, stripped };
  }
  // 4) "(Ngoại truyện) ..." đặc biệt
  const cleaned = t.replace(/^\*{1,2}\s*/, '').replace(/\s*\*{1,2}$/, '');
  if (cleaned.startsWith('(') && cleaned.length < 150) {
    const sub = cleaned.replace(/^\((.+?)\)\s*/, '$1 - ');
    stripped.push(t);
    i++;
    while (i < lines.length && lines[i].trim() === '') i++;
    return { title: sub, content: lines.slice(i).join('\n'), kind: 'paren', sub, headerNum: null, stripped };
  }
  // 5) Không header -> chỉ xóa dòng "Chương N"
  return { title: oldTitle, content: lines.slice(i).join('\n'), kind: 'story', sub: '', headerNum: null, stripped };
}

async function main() {
  const list = await wjson(`/api/series/${SERIES_ID}/chapters?fields=meta&all=1`);
  const byOrder = new Map((list.items ?? []).map((c: any) => [c.orderNo, c]));
  let orders = [...byOrder.keys()].filter((n) => n >= MIN_ORDER).sort((a, b) => a - b);
  if (ORDERS_ARG) {
    const want = new Set(ORDERS_ARG.split(',').map(Number));
    orders = orders.filter((n) => want.has(n));
  }
  const skip = new Set(SKIP_ARG ? SKIP_ARG.split(',').map(Number) : []);
  orders = orders.filter((n) => !skip.has(n));
  console.log(`Sẽ xử lý ${orders.length} chương (984+) ${DRY ? '(DRY-RUN)' : '(CHẠY THẬT)'}`);

  let ok = 0, clean = 0, fail = 0, mismatch = 0;
  const kinds: Record<string, number> = {};
  const storyKept: number[] = [];
  const backup: Array<{ id: string; orderNo: number; title: string; content: string }> = [];
  for (const orderNo of orders) {
    const meta = byOrder.get(orderNo) as any;
    let full: any;
    try {
      full = await wjson(`/api/chapters/${meta.id}`);
    } catch (e: any) {
      console.log(`Chương ${orderNo}: FETCH FAIL — ${e?.message || e}`);
      fail++;
      continue;
    }
    const r = transform(orderNo, full.title || '', full.content || '');
    kinds[r.kind] = (kinds[r.kind] || 0) + 1;
    if (r.headerNum !== null && r.headerNum !== orderNo) {
      mismatch++;
      console.log(`Chương ${orderNo}: MISMATCH header ghi số ${r.headerNum} (vẫn strip + lấy title)`);
    }
    if (r.kind === 'story') storyKept.push(orderNo);
    const titleSame = (full.title || '').trim() === r.title.trim();
    const contentSame = (full.content || '') === r.content;
    if (titleSame && contentSame) {
      clean++;
      continue;
    }
    if (DRY) {
      ok++;
      console.log(
        `Chương ${orderNo} [${r.kind}]: WOULD — title "${(full.title || '').slice(0, 40)}" → "${r.title.slice(0, 60)}" (strip ${r.stripped.length} dòng)`,
      );
      continue;
    }
    backup.push({ id: meta.id, orderNo, title: full.title, content: full.content || '' });
    try {
      await wjson(`/api/chapters/${meta.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ title: r.title, content: r.content }),
      });
      ok++;
      if (ok % 25 === 0) console.log(`... đã update ${ok} chương (tới chương ${orderNo})`);
    } catch (e: any) {
      console.log(`Chương ${orderNo}: PATCH FAIL — ${e?.message || e}`);
      fail++;
    }
    await sleep(150);
  }

  console.log(`\nXONG ${DRY ? '(dry-run)' : ''}: update=${ok}, đã-đúng=${clean}, fail=${fail}, mismatch=${mismatch}`);
  console.log('Theo loại:', JSON.stringify(kinds));
  if (storyKept.length) console.log(`Giữ title cũ, chỉ xóa dòng Chương N (${storyKept.length}): ${storyKept.join(',')}`);
  if (!DRY && backup.length) {
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    const p = `C:\\Users\\buiva\\AppData\\Local\\Temp\\opencode\\gacha984-backup-${ts}.json`;
    try {
      writeFileSync(p, JSON.stringify(backup));
      console.log(`Backup ${backup.length} chương: ${p}`);
    } catch (e: any) {
      console.log(`Không ghi được backup: ${e?.message || e}`);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
