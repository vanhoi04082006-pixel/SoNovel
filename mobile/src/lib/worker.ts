import { supabase } from './supabase'

export const WORKER_URL = 'https://sonovel-api.vanhoi04082006.workers.dev'

async function getAuthHeaders(): Promise<Record<string, string>> {
  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (session?.access_token) return { Authorization: `Bearer ${session.access_token}` }
  } catch {}
  return {}
}

export async function workerFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const headers: Record<string, string> = { ...(init.headers as Record<string, string> || {}) }
  const auth = await getAuthHeaders()
  Object.assign(headers, auth)
  const hasBody = init.body !== undefined && init.body !== null
  const isFormData = typeof FormData !== 'undefined' && hasBody && init.body instanceof FormData
  if (hasBody && !isFormData && !headers['Content-Type']) headers['Content-Type'] = 'application/json'
  if (isFormData) delete headers['Content-Type']
  return fetch(`${WORKER_URL}${path}`, { ...init, headers })
}

export async function workerJson<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await workerFetch(path, init)
  const text = await res.text()
  let json: any = null
  try { json = text ? JSON.parse(text) : null } catch { json = { raw: text } }
  if (!res.ok) {
    const msg = json?.error || `Worker ${res.status}`
    throw new Error(msg)
  }
  return json as T
}
