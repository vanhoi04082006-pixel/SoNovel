// SoNovel — shared lib helpers

import { db } from '@/lib/db'

// ---- JSON array helpers (SQLite không có text[]) ----
export function parseArray(s: string | null | undefined): string[] {
  if (!s) return []
  try {
    const v = JSON.parse(s)
    return Array.isArray(v) ? v.map(String) : []
  } catch {
    return []
  }
}

export function stringifyArray(arr: string[] | null | undefined): string {
  return JSON.stringify(arr ?? [])
}

// ---- is_admin equivalent ----
export async function isAdmin(userId: string | null | undefined): Promise<boolean> {
  if (!userId) return false
  const p = await db.profile.findUnique({ where: { id: userId }, select: { role: true } })
  return p?.role === 'admin'
}

// ---- word_count recalc (mirror §5.5 trigger recalc_series_word_count) ----
// series.word_count = sum(length(content)/5) for published chapters
export async function recalcSeriesWordCount(seriesId: string): Promise<void> {
  const chapters = await db.chapter.findMany({
    where: { seriesId, status: 'published' },
    select: { content: true },
  })
  const wc = chapters.reduce((sum, c) => sum + Math.floor((c.content?.length ?? 0) / 5), 0)
  await db.series.update({ where: { id: seriesId }, data: { wordCount: wc } })
}

// ---- chapter word_count (length/5) ----
export function chapterWordCount(content: string): number {
  return Math.floor((content?.length ?? 0) / 5)
}

// ---- estimated listening minutes (content.length/270 per §6) ----
export function estMinutes(content: string): number {
  return Math.max(1, Math.round((content?.length ?? 0) / 270))
}
