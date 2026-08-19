// SoNovel — server-side data access via Supabase (service role, bypasses RLS).
// Routes enforce auth via getSessionUser/requireAdmin. Maps snake_case → camelCase.

import { createAdminSupabase } from '@/lib/supabase-admin'

export function serverDb() {
  return createAdminSupabase()
}

export function mapSeries(s: any, chapterCount?: number) {
  return {
    id: s.id,
    title: s.title,
    author: s.author,
    description: s.description,
    coverUrl: s.cover_url,
    status: s.status,
    genres: s.genres ?? [],
    tags: s.tags ?? [],
    wordCount: s.word_count,
    chapterCount,
    createdAt: s.created_at,
    updatedAt: s.updated_at,
  }
}

export function mapChapter(c: any) {
  return {
    id: c.id,
    seriesId: c.series_id,
    orderNo: c.order_no,
    title: c.title,
    content: c.content,
    status: c.status,
    wordCount: c.word_count,
    publishedAt: c.published_at,
    createdAt: c.created_at,
  }
}

export function mapProgress(p: any) {
  if (!p) return null
  return {
    id: p.id,
    userId: p.user_id,
    seriesId: p.series_id,
    readChapterId: p.read_chapter_id,
    readCharIndex: p.read_char_index,
    readPercent: p.read_percent,
    lastReadAt: p.last_read_at,
    listenChapterId: p.listen_chapter_id,
    listenCharIndex: p.listen_char_index,
    audioSec: p.audio_sec,
    playbackSpeed: p.playback_speed,
    lastListenedAt: p.last_listened_at,
    updatedAt: p.updated_at,
  }
}
