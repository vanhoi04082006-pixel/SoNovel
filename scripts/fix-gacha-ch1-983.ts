// Đổi title + xóa header trùng cho truyện Gacha 6★ (chương 1-983).
// Mapping: scripts/gacha-titles-1-983.txt (dòng "Chương N - SubTitle").
// Title DB = phần SubTitle (không prefix "Chương N -").
// Content: xóa dòng "Chương N" + 1 dòng header "Chương N: ..." (chịu cả **, :/-) ở đầu.
//
//   bun run scripts/fix-gacha-ch1-983.ts --dry-run
//   bun run scripts/fix-gacha-ch1-983.ts --dry-run --limit=100
//   bun run scripts/fix-gacha-ch1-983.ts            (chạy thật)
//   bun run scripts/fix-gacha-ch1-983.ts --orders=11,12,114
//
// Env: WORKER_URL, SERVICE_TOKEN (đọc từ E:\SoNovel\.env)
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
const MAP_FILE = join(ROOT, 'scripts', 'gacha-titles-1-983.txt');
const WORKER_URL = (process.env.WORKER_URL || '').replace(/\/$/, '');
const SERVICE_TOKEN = process.env.SERVICE_TOKEN || '';
if (!WORKER_URL || !SERVICE_TOKEN) {
  console.error('Thiếu WORKER_URL / SERVICE_TOKEN trong .env');
  process.exit(1);
}

const args = process.argv.slice(2);
const DRY = args.includes('--dry-run');
const LIMIT = Number((args.find((a) => a.startsWith('--limit=')) || '').split('=')[1] || 0);
const ORDERS_ARG = (args.find((a) => a.startsWith('--orders=')) || '').split('=')[1] || '';
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

// Parse "Chương N - Sub" -> Map<orderNo, sub>. Báo trùng số.
function loadMapping(): { map: Map<number, string>; dups: string[]; lines: number } {
  const raw = readFileSync(MAP_FILE, 'utf8');
  const map = new Map<number, string>();
  const dups: string[] = [];
  let lines = 0;
  for (const ln of raw.split('\n')) {
    const t = ln.trim();
    if (!t) continue;
    const m = t.match(/^Chương\s+(\d+)\s*-\s*(.+)$/);
    if (!m) {
      dups.push(`dòng không parse được: ${t.slice(0, 60)}`);
      continue;
    }
    lines++;
    const n = Number(m[1]);
    const sub = m[2].trim();
    if (map.has(n) && map.get(n) !== sub) dups.push(`trùng số ${n}: "${map.get(n)}" vs "${sub}" (lấy sau)`);
    map.set(n, sub);
  }
  return { map, dups, lines };
}

const HEADER_RE = /^\*{0,2}\s*Chương\s+(\d+)\s*[:\-–—]?\s*(.*?)\s*\*{0,2}$/;

function transform(
  orderNo: number,
  newTitle: string,
  content: string,
): { title: string; content: string; stripped: string[]; headerNum: number | null; alreadyClean: boolean } {
  const lines = content.split('\n');
  const stripped: string[] = [];
  let i = 0;
  // Dòng đầu phải là "Chương N" thì mới coi là chưa strip
  if ((lines[i] || '').trim() !== `Chương ${orderNo}`) {
    return { title: newTitle, content, stripped, headerNum: null, alreadyClean: true };
  }
  stripped.push(lines[i].trim());
  i++;
  while (i < lines.length && lines[i].trim() === '') i++;
  let headerNum: number | null = null;
  const m = (lines[i] || '').trim().match(HEADER_RE);
  if (m && (m[1] || m[2])) {
    // Chỉ strip khi dòng này thực sự là header (có số chương ở đầu)
    headerNum = Number(m[1]);
    stripped.push(lines[i].trim());
    i++;
    while (i < lines.length && lines[i].trim() === '') i++;
  }
  return { title: newTitle, content: lines.slice(i).join('\n'), stripped, headerNum, alreadyClean: false };
}

async function main() {
  const { map, dups, lines } = loadMapping();
  console.log(`Mapping: ${lines} dòng -> ${map.size} order_no distinct`);
  for (const d of dups) console.log('  DUP/WARN:', d);

  let orders = [...map.keys()].sort((a, b) => a - b);
  if (ORDERS_ARG) {
    const want = new Set(ORDERS_ARG.split(',').map(Number));
    orders = orders.filter((n) => want.has(n));
  }
  if (LIMIT > 0) orders = orders.slice(0, LIMIT);
  console.log(`Sẽ xử lý ${orders.length} chương ${DRY ? '(DRY-RUN, không ghi)' : '(CHẠY THẬT)'}`);

  const list = await wjson(`/api/series/${SERIES_ID}/chapters?fields=meta&all=1`);
  const byOrder = new Map((list.items ?? []).map((c: any) => [c.orderNo, c]));
  console.log(`DB: ${(list.items ?? []).length} chương`);

  // Báo cáo số trong mapping mà DB không có + số 1..983 DB có mà mapping thiếu
  const notInDb = orders.filter((n) => !byOrder.has(n));
  const inDbNoMap: number[] = [];
  for (let n = 1; n <= 983; n++) if (!map.has(n) && byOrder.has(n)) inDbNoMap.push(n);
  if (notInDb.length) console.log(`Trong list nhưng DB KHÔNG có (${notInDb.length}): ${notInDb.join(',')}`);
  else console.log('Mọi số trong list đều có trong DB.');
  if (inDbNoMap.length) console.log(`DB có nhưng LIST THIẾU (${inDbNoMap.length}, sẽ giữ nguyên): ${inDbNoMap.join(',')}`);

  let ok = 0, clean = 0, skip = 0, mismatch = 0, fail = 0;
  const backup: Array<{ id: string; orderNo: number; title: string; content: string }> = [];
  for (const orderNo of orders) {
    const meta = byOrder.get(orderNo) as any;
    if (!meta) {
      console.log(`Chương ${orderNo}: KHÔNG THẤY trong DB (skip)`);
      skip++;
      continue;
    }
    const newTitle = map.get(orderNo)!;
    let full: any;
    try {
      full = await wjson(`/api/chapters/${meta.id}`);
    } catch (e: any) {
      console.log(`Chương ${orderNo}: FETCH FAIL — ${e?.message || e}`);
      fail++;
      continue;
    }
    const r = transform(orderNo, newTitle, full.content || '');
    if (r.headerNum !== null && r.headerNum !== orderNo) {
      mismatch++;
      console.log(`Chương ${orderNo}: header trong nội dung ghi số ${r.headerNum} (lệch) — vẫn strip + đổi title`);
    }
    const titleSame = (full.title || '').trim() === r.title;
    const contentSame = (full.content || '') === r.content;
    if (titleSame && contentSame) {
      clean++;
      if (orders.length <= 120) console.log(`Chương ${orderNo}: đã đúng, bỏ qua`);
      continue;
    }
    if (DRY) {
      ok++;
      if (orders.length <= 200 || !titleSame) {
        console.log(
          `Chương ${orderNo}: WOULD UPDATE — title "${(full.title || '').slice(0, 40)}" → "${r.title.slice(0, 60)}"` +
            (contentSame ? ' (content giữ nguyên)' : ` (strip ${r.stripped.length} dòng${r.alreadyClean ? ', nội dung đã sạch header' : ''})`),
        );
      }
      continue;
    }
    backup.push({ id: meta.id, orderNo, title: full.title, content: full.content || '' });
    try {
      await wjson(`/api/chapters/${meta.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ title: r.title, content: r.content }),
      });
      ok++;
      if (ok % 50 === 0) console.log(`... đã update ${ok} chương (tới chương ${orderNo})`);
      else if (orders.length <= 120)
        console.log(`Chương ${orderNo}: OK — title → "${r.title.slice(0, 60)}", strip ${r.stripped.length} dòng`);
    } catch (e: any) {
      console.log(`Chương ${orderNo}: PATCH FAIL — ${e?.message || e}`);
      fail++;
    }
    await sleep(150); // nhẹ tay: mỗi PATCH đều recalc word_count + invalidate cache
  }

  console.log(`\nXONG ${DRY ? '(dry-run)' : ''}: update/would-update=${ok}, đã-đúng=${clean}, skip=${skip}, header-lệch-số=${mismatch}, fail=${fail}`);
  if (!DRY && backup.length) {
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    const p = `C:\\Users\\buiva\\AppData\\Local\\Temp\\opencode\\gacha-backup-${ts}.json`;
    try {
      writeFileSync(p, JSON.stringify(backup));
      console.log(`Đã lưu backup ${backup.length} chương vào ${p} (rollback tay nếu cần)`);
    } catch (e: any) {
      console.log(`Không ghi được backup: ${e?.message || e}`);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
