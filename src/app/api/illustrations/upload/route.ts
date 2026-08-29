import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/session'

const IMGBB_API_KEY = process.env.IMGBB_API_KEY || '778ccfcea4d829817b3350a9e484083a'

// POST /api/illustrations/upload — admin upload ảnh minh họa qua imgBB
// nhận multipart file, forward sang https://api.imgbb.com/1/upload
export async function POST(req: NextRequest) {
  try {
    await requireAdmin()
    const formData = await req.formData()
    const file = (formData as any).get('file') as File | null
    if (!file) return NextResponse.json({ error: 'Không tìm thấy file.' }, { status: 400 })
    if (!file.type.startsWith('image/')) return NextResponse.json({ error: 'Chỉ chấp nhận file ảnh.' }, { status: 400 })
    if (file.size > 5 * 1024 * 1024) return NextResponse.json({ error: 'Ảnh vượt quá 5MB.' }, { status: 400 })

    const buf = Buffer.from(await file.arrayBuffer())
    const b64 = buf.toString('base64')

    const fd = new FormData()
    fd.append('image', b64)

    const res = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, {
      method: 'POST',
      body: fd,
    })
    const j: any = await res.json().catch(() => null)
    if (!res.ok || !j?.success) {
      const msg = j?.error?.message || `imgBB upload failed ${res.status}`
      return NextResponse.json({ error: msg }, { status: 500 })
    }
    const url = j.data?.url || j.data?.display_url || j.data?.image?.url
    if (!url) return NextResponse.json({ error: 'imgBB không trả về URL.' }, { status: 500 })
    return NextResponse.json({ ok: true, url, thumb: j.data?.thumb?.url || j.data?.display_url, data: j.data })
  } catch (e) {
    const msg = (e as Error).message
    if (msg === 'UNAUTHORIZED' || msg === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Bạn không có quyền quản trị.' }, { status: 403 })
    }
    return NextResponse.json({ error: 'Tải ảnh minh họa thất bại: ' + msg }, { status: 500 })
  }
}
