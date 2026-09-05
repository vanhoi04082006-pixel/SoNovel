import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/session'
import sharp from 'sharp'

async function uploadToImgBB(key: string, b64: string): Promise<any> {
  const fd = new FormData()
  fd.append('image', b64)
  const res = await fetch(`https://api.imgbb.com/1/upload?key=${key}`, { method: 'POST', body: fd })
  const j: any = await res.json().catch(() => null)
  if (!res.ok || !j?.success) throw new Error(j?.error?.message || `imgBB upload failed ${res.status}`)
  return j.data
}

function sniffImage(buf: Uint8Array): boolean {
  if (buf.length < 12) return false
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return true
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return true
  if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x38) return true
  if (buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 && buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50) return true
  if (buf[0] === 0x42 && buf[1] === 0x4d) return true
  return false
}

const rateMap = new Map<string, { c: number; reset: number }>()
const RATE_CLEANUP_MS = 5 * 60 * 1000
let lastRateCleanup = 0
function checkRate(ip: string): boolean {
  const now = Date.now()
  if (now - lastRateCleanup > RATE_CLEANUP_MS) {
    lastRateCleanup = now
    for (const [k, v] of rateMap) if (v.reset <= now) rateMap.delete(k)
    if (rateMap.size > 2000) {
      const keys = Array.from(rateMap.keys()).slice(0, rateMap.size - 2000)
      for (const k of keys) rateMap.delete(k)
    }
  }
  const e = rateMap.get(ip)
  if (!e || e.reset <= now) { rateMap.set(ip, { c: 1, reset: now + 60_000 }); return true }
  if (e.c >= 20) return false
  e.c++; return true
}
function clientIp(req: NextRequest): string {
  return req.headers.get('x-real-ip')?.split(',')[0]?.trim()
    || req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || 'anon'
}

// POST /api/illustrations/upload — admin upload ảnh minh họa qua imgBB
// nhận multipart file, forward sang https://api.imgbb.com/1/upload
export async function POST(req: NextRequest) {
  try {
    await requireAdmin()
    const ip = clientIp(req)
    if (!checkRate(ip)) return NextResponse.json({ error: 'Quá nhiều yêu cầu, thử lại sau 1 phút.' }, { status: 429 })
    const key = process.env.IMGBB_API_KEY
    if (!key) return NextResponse.json({ error: 'IMGBB_API_KEY chưa cấu hình (Vercel env).' }, { status: 500 })
    const formData = await req.formData()
    const file = (formData as any).get('file') as File | null
    if (!file) return NextResponse.json({ error: 'Không tìm thấy file.' }, { status: 400 })
    if (!file.type.startsWith('image/')) return NextResponse.json({ error: 'Chỉ chấp nhận file ảnh.' }, { status: 400 })
    if (file.size > 5 * 1024 * 1024) return NextResponse.json({ error: 'Ảnh vượt quá 5MB.' }, { status: 400 })

    const buf = Buffer.from(await file.arrayBuffer())
    if (!sniffImage(new Uint8Array(buf))) return NextResponse.json({ error: 'File không phải ảnh hợp lệ (PNG/JPEG/GIF/WEBP/BMP).' }, { status: 400 })

    // Bản gốc up nguyên vẹn; đồng thời sinh bản preview ~800px (vài chục KB)
    // để app hiện ngay khi mạng yếu, bấm vào mới tải full.
    let previewBuf: Buffer
    try {
      previewBuf = await sharp(buf).rotate().resize({ width: 800, withoutEnlargement: true }).jpeg({ quality: 70 }).toBuffer()
    } catch {
      return NextResponse.json({ error: 'Không đọc được file ảnh.' }, { status: 400 })
    }

    const [full, preview] = await Promise.all([
      uploadToImgBB(key, buf.toString('base64')),
      uploadToImgBB(key, previewBuf.toString('base64')),
    ])
    const url = full?.url || full?.display_url || full?.image?.url
    const thumbUrl = preview?.url || preview?.display_url || preview?.image?.url
    if (!url || !thumbUrl) return NextResponse.json({ error: 'imgBB không trả về URL.' }, { status: 500 })
    return NextResponse.json({ ok: true, url, thumbUrl, thumb: preview?.thumb?.url || thumbUrl })
  } catch (e) {
    const msg = (e as Error).message
    if (msg === 'UNAUTHORIZED' || msg === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Bạn không có quyền quản trị.' }, { status: 403 })
    }
    return NextResponse.json({ error: 'Tải ảnh minh họa thất bại: ' + msg }, { status: 500 })
  }
}
