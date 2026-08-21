import { supabase } from './supabase';
import type { ChapterRow } from './progress';
import { workerJson } from './worker';

export async function getChapterContent(
  seriesId: string,
  chapterId: string
): Promise<ChapterRow | null> {
  try {
    const j: any = await workerJson(`/api/chapters/${chapterId}`, { method: 'GET' });
    if (!j?.id) return null;
    return {
      id: j.id,
      series_id: j.seriesId ?? j.series_id ?? seriesId,
      order_no: j.orderNo ?? j.order_no ?? 0,
      title: j.title,
      content: j.content,
      status: j.status,
      word_count: j.wordCount ?? j.word_count ?? 0,
      published_at: j.publishedAt ?? j.published_at ?? null,
    } as ChapterRow;
  } catch {
    const { data, error } = await supabase
      .from('chapters')
      .select('id, series_id, order_no, title, content, status, word_count, published_at')
      .eq('series_id', seriesId)
      .eq('id', chapterId)
      .maybeSingle();
    if (error) throw error;
    return data as ChapterRow | null;
  }
}
