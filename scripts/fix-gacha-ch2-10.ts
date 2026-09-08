// Fix 7 chương (4-10) truyện Gacha 6★ theo bảng đã duyệt:
// - Xóa dòng "Chương N" + dòng header "**Chương N: Sub**"/"Chương N: Sub" ở đầu nội dung
// - Đặt title = Sub (chỉ khi title hiện tại là "Chương N" chung chung)
// - Bỏ qua + báo riêng nếu số trong header không khớp order_no
//   bun run scripts/fix-gacha-ch2-10.ts
// Env: WORKER_URL, SERVICE_TOKEN (đọc từ E:\SoNovel\.env)
import { readFileSync } from 'fs';

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

const SERIES_ID = '8c3d0a29-b0a8-4cc0-861e-3ff0806f730a';
const ORDERS = [4, 5, 6, 7, 8, 9, 10];
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

function transform(orderNo: number, title: string, content: string): { title: string; content: string; stripped: string[] } | { skip: string } {
  const lines = content.split('\n');
  let i = 0;
  // Dòng 1 phải là "Chương N"
  if ((lines[i] || '').trim() !== `Chương ${orderNo}`) return { skip: `dòng đầu không phải "Chương ${orderNo}"` };
  const stripped: string[] = [lines[i].trim()];
  i++;
  while (i < lines.length && lines[i].trim() === '') i++; // bỏ dòng trống
  let newTitle = title;
  const m = (lines[i] || '').trim().match(/^\*{0,2}Chương\s+(\d+)\s*:\s*(.+?)\*{0,2}$/);
  if (m) {
    if (Number(m[1]) !== orderNo) return { skip: `số trong header (${m[1]}) khác order_no (${orderNo})` };
    stripped.push(lines[i].trim());
    if (title.trim() === `Chương ${orderNo}` && m[2].trim()) newTitle = m[2].trim();
    i++;
    while (i < lines.length && lines[i].trim() === '') i++;
  }
  return { title: newTitle, content: lines.slice(i).join('\n'), stripped };
}

async function main() {
  const list = await wjson(`/api/series/${SERIES_ID}/chapters?q=&fields=meta`);
  const byOrder = new Map((list.items ?? []).map((c: any) => [c.orderNo, c]));
  for (const orderNo of ORDERS) {
    const meta = byOrder.get(orderNo) as any;
    if (!meta) { console.log(`Chương ${orderNo}: KHÔNG THẤY (skip)`); continue; }
    const full = await wjson(`/api/chapters/${meta.id}`);
    const r = transform(orderNo, full.title, full.content || '');
    if ('skip' in r) { console.log(`Chương ${orderNo}: SKIP — ${r.skip}`); continue; }
    if (r.title === full.title && r.content === (full.content || '')) {
      console.log(`Chương ${orderNo}: đã sạch, bỏ qua`);
      continue;
    }
    await wjson(`/api/chapters/${meta.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ title: r.title, content: r.content }),
    });
    console.log(`Chương ${orderNo}: OK — title "${full.title}" → "${r.title}", xóa ${r.stripped.length} dòng header`);
  }
  console.log('Xong 10 chương đầu.');
}

main().catch((e) => { console.error(e); process.exit(1); });
