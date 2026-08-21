import { NextRequest } from 'next/server'
import { createServerSupabase } from '@/lib/supabase'
import { getSessionUser } from '@/lib/session'

function mustWorkerUrl(): string {
  const url = process.env.WORKER_URL
  if (!url) throw new Error('Missing WORKER_URL')
  return url.replace(/\/$/, '')
}

export async function getWorkerHeaders(opts?: { admin?: boolean }): Promise<Record<string, string>> {
  const headers: Record<string, string> = {}
  if (opts?.admin) {
    const user = await getSessionUser()
    if (user?.role === 'admin') {
      const token = process.env.SERVICE_TOKEN
      if (token) headers['x-service-token'] = token
      return headers
    }
  }
  try {
    const supabase = await createServerSupabase()
    const { data: { session } } = await supabase.auth.getSession()
    if (session?.access_token) headers['Authorization'] = `Bearer ${session.access_token}`
  } catch {}
  if (opts?.admin && !headers['x-service-token']) {
    const token = process.env.SERVICE_TOKEN
    if (token) {
      const user = await getSessionUser()
      if (user?.role === 'admin') headers['x-service-token'] = token
    }
  }
  return headers
}

export async function proxyToWorker(
  path: string,
  init: RequestInit & { admin?: boolean; headers?: Record<string, string> } = {}
): Promise<{ res: Response; json: any }> {
  const url = mustWorkerUrl() + path
  const workerHeaders = await getWorkerHeaders({ admin: init.admin })
  const headers: Record<string, string> = { ...workerHeaders, ...(init.headers || {}) }
  const hasBody = init.body !== undefined && init.body !== null
  const isFormData = typeof FormData !== 'undefined' && hasBody && init.body instanceof FormData
  if (hasBody && !isFormData && !headers['Content-Type']) headers['Content-Type'] = 'application/json'
  if (isFormData) delete headers['Content-Type']
  let res: Response
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 25_000)
    res = await fetch(url, {
      method: init.method || 'GET',
      headers,
      body: init.body as any,
      signal: controller.signal,
    }).finally(() => clearTimeout(timer))
  } catch (e) {
    const msg = (e as Error).message || String(e)
    throw new Error(`Worker fetch failed: ${msg} (url=${url})`)
  }
  let json: any = null
  const text = await res.text()
  try { json = text ? JSON.parse(text) : null } catch { json = { raw: text } }
  return { res, json }
}


