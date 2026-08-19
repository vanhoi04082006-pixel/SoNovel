// SoNovel — client-safe formatting helpers (no db import)

export function estMinutes(contentLength: number): number {
  return Math.max(1, Math.round(contentLength / 270))
}

export function formatTimeAgo(date: Date | string | null | undefined): string {
  if (!date) return ''
  const d = typeof date === 'string' ? new Date(date) : date
  const now = Date.now()
  const diff = Math.floor((now - d.getTime()) / 1000)
  if (diff < 60) return 'vừa xong'
  if (diff < 3600) return `${Math.floor(diff / 60)} phút trước`
  if (diff < 86400) return `${Math.floor(diff / 3600)} giờ trước`
  if (diff < 604800) return `${Math.floor(diff / 86400)} ngày trước`
  if (diff < 2592000) return `${Math.floor(diff / 604800)} tuần trước`
  return `${Math.floor(diff / 2592000)} tháng trước`
}

export function formatRemainingMs(ms: number): string {
  if (ms <= 0) return '00:00'
  const total = Math.ceil(ms / 1000)
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export function formatCharCount(n: number): string {
  if (n < 1000) return `${n} ký tự`
  return `${(n / 1000).toFixed(1)}k ký tự`
}
