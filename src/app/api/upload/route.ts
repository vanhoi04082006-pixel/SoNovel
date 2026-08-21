import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/session'
import { createAdminSupabase } from '@/lib/supabase-admin'

async function uploadToWorker(file: File): Promise<string | null> {
  const workerUrl = process.env.WORKER_URL
  const serviceToken = process.env.SERVICE_TOKEN
  if (!workerUrl || !serviceToken) return null
  try {
    const fd = new FormData()
    fd.append('file', file, file.name)
    const res = await fetch(`${workerUrl.replace(/\/$/, '')}/api/upload`, {
      method: 'POST',
      headers: { 'x-service-token': serviceToken },
      body: fd,
    })
    if (res.status === 503) return null
    if (!res.ok) {
      const j: any = await res.json().catch(() => null)
      throw new Error(j?.error || `Worker upload failed ${res.status}`)
    }
    const j: any = await res.json()
    const url: string = j.url || j.key
    if (!url) return null
    if (url.startsWith('http')) return url
    return `${workerUrl.replace(/\/$/, '')}${url.startsWith('/') ? url : `/${url}`}`
  } catch {
    return null
  }
}

// POST /api/upload — admin upload cover: thử Worker R2 trước, fallback Supabase Storage
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

    const workerUrl = await uploadToWorker(file)
    if (workerUrl) {
      return NextResponse.json({ ok: true, url: workerUrl })
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
