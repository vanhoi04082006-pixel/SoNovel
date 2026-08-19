// SoNovel — shared lib helpers

import { serverDb } from '@/lib/server-data'

// ---- array helpers ----
// Genres/tags là text[] thật trên Postgres; các helper giờ là pass-through
// (giữ tên hàm cũ để các route không phải đổi). Vẫn chấp nhận chuỗi JSON cho
// tương thích ngược nếu có dữ liệu cũ.
export function parseArray(s: string | string[] | null | undefined): string[] {
  if (Array.isArray(s)) return s
  if (!s) return []
  try {
    const v = JSON.parse(s)
    return Array.isArray(v) ? v.map(String) : []
  } catch {
    return []
  }
}

export function stringifyArray(arr: string[] | string | null | undefined): string[] {
  if (Array.isArray(arr)) return arr
  if (typeof arr === 'string') {
    const trimmed = arr.trim()
    if (!trimmed) return []
    if (trimmed.startsWith('[')) {
      try {
        const v = JSON.parse(trimmed)
        return Array.isArray(v) ? v.map(String) : []
      } catch {
        /* fall through */
      }
    }
    return trimmed.split(',').map((x) => x.trim()).filter(Boolean)
  }
  return []
}

// ---- word_count recalc (mirror §5.5 trigger recalc_series_word_count) ----
// Trigger chapters_sync_word_count đã tự cập nhật; gọi lại qua RPC khi cần chắc chắn.
export async function recalcSeriesWordCount(seriesId: string): Promise<void> {
  try {
    await serverDb().rpc('recalc_series_word_count', { p_series: seriesId })
  } catch {
    // trigger DB đã lo — bỏ qua lỗi RPC
  }
}

// ---- chapter word_count (length/5) ----
export function chapterWordCount(content: string): number {
  return Math.floor((content?.length ?? 0) / 5)
}

// ---- estimated listening minutes (content.length/270 per §6) ----
export function estMinutes(content: string): number {
  return Math.max(1, Math.round((content?.length ?? 0) / 270))
}
