import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/session'
import { createAdminSupabase } from '@/lib/supabase-admin'

// POST /api/upload — admin upload cover image to Supabase Storage
export async function POST(req: NextRequest) {
  try {
    await requireAdmin()
    const formData = await req.formData()
    const file = (formData as any).get('file') as File | null
    if (!file) {
      return NextResponse.json({ error: 'Không tìm thấy file.' }, { status: 400 })
    }

    if (!file.type.startsWith('image/')) {
      return NextResponse.json({ error: 'Chỉ chấp nhận file ảnh.' }, { status: 400 })
    }

    const ext = file.name.split('.').pop() || 'jpg'
    const path = `covers/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`

    const supabase = createAdminSupabase()
    const buffer = Buffer.from(await file.arrayBuffer())
    const { error } = await supabase.storage
      .from('covers')
      .upload(path, buffer, { contentType: file.type, upsert: false })

    if (error) throw error

    const { data: urlData } = supabase.storage.from('covers').getPublicUrl(path)

    return NextResponse.json({ ok: true, url: urlData.publicUrl })
  } catch (e) {
    const msg = (e as Error).message
    if (msg === 'UNAUTHORIZED' || msg === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Bạn không có quyền quản trị.' }, { status: 403 })
    }
    return NextResponse.json({ error: 'Tải ảnh thất bại: ' + msg }, { status: 500 })
  }
}
