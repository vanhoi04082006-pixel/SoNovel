// Đặt title cho 27 chương generic còn lại + chuẩn hóa 1090 (chỉ PATCH title, KHÔNG đụng content).
// Titles do agent đọc nội dung và đề xuất, user đã duyệt.
//
//   bun run scripts/fix-gacha-final-titles.ts --dry-run
//   bun run scripts/fix-gacha-final-titles.ts
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
const WORKER_URL = (process.env.WORKER_URL || '').replace(/\/$/, '');
const SERVICE_TOKEN = process.env.SERVICE_TOKEN || '';
if (!WORKER_URL || !SERVICE_TOKEN) {
  console.error('Thiếu WORKER_URL / SERVICE_TOKEN trong .env');
  process.exit(1);
}

const TITLE_MAP: Record<number, string> = {
  1013: 'Càn Quét Tầng 96 (1)',
  1014: 'Càn Quét Tầng 96 (2)',
  1015: 'Càn Quét Tầng 96 (3)',
  1016: 'Càn Quét Tầng 96 (4)',
  1017: 'Càn Quét Tầng 96 (5)',
  1018: 'Càn Quét Tầng 96 (6)',
  1019: 'Càn Quét Tầng 96 (7)',
  1020: 'Càn Quét Tầng 96 (8)',
  1021: 'Dũng Giả Xài Bom (1)',
  1022: 'Dũng Giả Xài Bom (2)',
  1023: 'Dũng Giả Xài Bom (3)',
  1024: 'Dũng Giả Xài Bom (4)',
  1085: 'Ma Vương Chuyển Giai Đoạn',
  1089: 'Ma Pháp Hạt Nhân 4',
  1090: 'Ma Pháp Hạt Nhân 5',
  1093: 'Bí Mật Của Nữ Thần (1)',
  1094: 'Bí Mật Của Nữ Thần (2)',
  1095: 'Bí Mật Của Nữ Thần (3)',
  1096: 'Bí Mật Của Nữ Thần (4)',
  1109: 'Đêm Của Grace',
  1110: 'Kế Hoạch Của Grace Và Katie',
  1111: 'Bỏ Nhà Đi Bụi',
  1112: 'Người Thừa Kế Phương Bắc',
  1133: 'Hậu Trường Trái Đất (1)',
  1134: 'Hậu Trường Trái Đất (2)',
  1135: 'Hậu Trường Trái Đất (3)',
  1136: 'Hậu Trường Trái Đất (4)',
  1160: 'Lời Bạt Hoàn Thành',
};

const DRY = process.argv.includes('--dry-run');
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

async function main() {
  const orders = Object.keys(TITLE_MAP).map(Number).sort((a, b) => a - b);
  console.log(`Sẽ đặt title ${orders.length} chương ${DRY ? '(DRY-RUN)' : '(CHẠY THẬT, chỉ title)'}`);
  const list = await wjson(`/api/series/${SERIES_ID}/chapters?fields=meta&all=1`);
  const byOrder = new Map((list.items ?? []).map((c: any) => [c.orderNo, c]));
  let ok = 0, clean = 0, fail = 0, skipped = 0;
  const backup: Array<{ id: string; orderNo: number; title: string }> = [];
  for (const orderNo of orders) {
    const meta = byOrder.get(orderNo) as any;
    if (!meta) {
      console.log(`Chương ${orderNo}: KHÔNG THẤY trong DB (skip)`);
      skipped++;
      continue;
    }
    const want = TITLE_MAP[orderNo];
    let full: any;
    try {
      full = await wjson(`/api/chapters/${meta.id}`);
    } catch (e: any) {
      console.log(`Chương ${orderNo}: FETCH FAIL — ${e?.message || e}`);
      fail++;
      continue;
    }
    // An toàn: nội dung phải sạch header rồi (đợt trước đã xóa); nếu còn thì bỏ qua để xử lý tay
    const firstLine = String(full.content || '').split('\n')[0].trim();
    if (firstLine === `Chương ${orderNo}`) {
      console.log(`Chương ${orderNo}: nội dung còn header — SKIP để xử lý tay`);
      skipped++;
      continue;
    }
    if ((full.title || '').trim() === want) {
      clean++;
      continue;
    }
    if (DRY) {
      ok++;
      console.log(`Chương ${orderNo}: WOULD — "${(full.title || '').slice(0, 40)}" → "${want}"`);
      continue;
    }
    backup.push({ id: meta.id, orderNo, title: full.title });
    try {
      await wjson(`/api/chapters/${meta.id}`, { method: 'PATCH', body: JSON.stringify({ title: want }) });
      const check = await wjson(`/api/chapters/${meta.id}`);
      if ((check.title || '').trim() === want) {
        ok++;
        console.log(`Chương ${orderNo}: OK → "${want}"`);
      } else {
        console.log(`Chương ${orderNo}: VERIFY FAIL — DB vẫn "${check.title}"`);
        fail++;
      }
    } catch (e: any) {
      console.log(`Chương ${orderNo}: PATCH FAIL — ${e?.message || e}`);
      fail++;
    }
    await sleep(150);
  }
  console.log(`\nXONG ${DRY ? '(dry-run)' : ''}: ok=${ok}, đã-đúng=${clean}, skip=${skipped}, fail=${fail}`);
  if (!DRY && backup.length) {
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    const p = `C:\\Users\\buiva\\AppData\\Local\\Temp\\opencode\\gacha-titles-backup-${ts}.json`;
    try {
      writeFileSync(p, JSON.stringify(backup));
      console.log(`Backup title cũ (${backup.length}): ${p}`);
    } catch (e: any) {
      console.log(`Không ghi được backup: ${e?.message || e}`);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
