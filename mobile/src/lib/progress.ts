import { supabase } from './supabase';
import { getUserId } from './session';
import { getLocalProgress } from './tts';

// ---------- Types ----------
export type SeriesRow = {
  id: string;
  title: string;
  author: string;
  description: string;
  cover_url: string;
  status: string;
  genres: string[];
  tags: string[];
  word_count: number;
  updated_at: string;
  created_at: string;
};

export type ChapterRow = {
  id: string;
  series_id: string;
  order_no: number;
  title: string;
  content: string;
  status: string;
  word_count: number;
  published_at: string | null;
};

export type ProgressRow = {
  id?: string;
  user_id: string;
  series_id: string;
  listen_chapter_id: string | null;
  listen_char_index: number;
  audio_sec: number;
  playback_speed: number;
  last_listened_at: string | null;
  read_chapter_id: string | null;
  read_char_index: number;
  read_percent: number;
  last_read_at: string | null;
};

export type FavoriteRow = {
  user_id: string;
  series_id: string;
  created_at: string;
};

export type HistoryRow = {
  user_id: string;
  series_id: string;
  opened_count: number;
  last_opened_at: string;
};

// ---------- Series ----------
export async function listSeries(opts?: {
  limit?: number;
  offset?: number;
  status?: string[];
  orderBy?: 'updated_at' | 'title' | 'word_count';
  ascending?: boolean;
  search?: string;
  genre?: string;
  tag?: string;
}): Promise<SeriesRow[]> {
  const {
    limit = 24,
    offset = 0,
    status = ['published', 'completed'],
    orderBy = 'updated_at',
    ascending = false,
    search,
    genre,
    tag,
  } = opts ?? {};
  let q = supabase
    .from('series')
    .select('*')
    .in('status', status)
    .range(offset, offset + limit - 1);
  if (orderBy === 'title') q = q.order('title', { ascending });
  else if (orderBy === 'word_count') q = q.order('word_count', { ascending });
  else q = q.order('updated_at', { ascending });
  if (search) {
    q = q.or(`title.ilike.%${search}%,author.ilike.%${search}%`);
  }
  if (genre) q = q.contains('genres', [genre]);
  if (tag) q = q.contains('tags', [tag]);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as SeriesRow[];
}

export async function getSeries(id: string): Promise<SeriesRow | null> {
  const { data, error } = await supabase.from('series').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data as SeriesRow | null;
}

export async function listChapters(seriesId: string): Promise<ChapterRow[]> {
  const { data, error } = await supabase
    .from('chapters')
    .select('*')
    .eq('series_id', seriesId)
    .eq('status', 'published')
    .order('order_no', { ascending: true });
  if (error) throw error;
  return (data ?? []) as ChapterRow[];
}

// ---------- Progress ----------
export async function getProgress(seriesId: string): Promise<ProgressRow | null> {
  const userId = getUserId();
  if (!userId) {
    // Chưa đăng nhập → fallback progress local (AsyncStorage)
    const local = await getLocalProgress(seriesId);
    if (!local) return null;
    return {
      user_id: 'local',
      series_id: seriesId,
      listen_chapter_id: local.chapterId,
      listen_char_index: local.charIndex,
      audio_sec: 0,
      playback_speed: 1.0,
      last_listened_at: local.lastListenedAt,
      read_chapter_id: null,
      read_char_index: 0,
      read_percent: 0,
      last_read_at: null,
    } as ProgressRow;
  }
  const { data, error } = await supabase
    .from('progress')
    .select('*')
    .eq('user_id', userId)
    .eq('series_id', seriesId)
    .maybeSingle();
  if (error) throw error;
  return data as ProgressRow | null;
}

export async function listAllProgress(): Promise<(ProgressRow & { series?: SeriesRow })[]> {
  const userId = getUserId();
  if (!userId) {
    // Chưa đăng nhập → chỉ có progress local; gọi qua tts.ts expose riêng
    return [];
  }
  const { data, error } = await supabase
    .from('progress')
    .select('*, series:series(*)')
    .eq('user_id', userId)
    .not('listen_chapter_id', 'is', null)
    .order('last_listened_at', { ascending: false })
    .limit(20);
  if (error) throw error;
  return (data ?? []) as any;
}

export async function saveListenProgress(opts: {
  seriesId: string;
  chapterId: string;
  charIndex: number;
  rate: number;
}): Promise<void> {
  const userId = getUserId();
  if (!userId) return;
  const { error } = await supabase.from('progress').upsert({
    user_id: userId,
    series_id: opts.seriesId,
    listen_chapter_id: opts.chapterId,
    listen_char_index: opts.charIndex,
    audio_sec: 0,
    playback_speed: opts.rate,
    last_listened_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id,series_id' });
  if (error) throw error;
}

// ---------- Favorites ----------
export async function listFavorites(): Promise<(FavoriteRow & { series?: SeriesRow })[]> {
  const userId = getUserId();
  if (!userId) return [];
  const { data, error } = await supabase
    .from('favorites')
    .select('*, series:series(*)')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as any;
}

export async function isFavorite(seriesId: string): Promise<boolean> {
  const userId = getUserId();
  if (!userId) return false;
  const { data, error } = await supabase
    .from('favorites')
    .select('series_id')
    .eq('user_id', userId)
    .eq('series_id', seriesId)
    .maybeSingle();
  if (error) return false;
  return !!data;
}

export async function toggleFavorite(seriesId: string, favorite: boolean): Promise<void> {
  const userId = getUserId();
  if (!userId) throw new Error('Cần đăng nhập để lưu yêu thích');
  if (favorite) {
    const { error } = await supabase
      .from('favorites')
      .upsert({ user_id: userId, series_id: seriesId, created_at: new Date().toISOString() },
        { onConflict: 'user_id,series_id' });
    if (error) throw error;
  } else {
    const { error } = await supabase
      .from('favorites')
      .delete()
      .eq('user_id', userId)
      .eq('series_id', seriesId);
    if (error) throw error;
  }
}

// ---------- History ----------
export async function recordHistory(seriesId: string): Promise<void> {
  const userId = getUserId();
  if (!userId) return;
  const now = new Date().toISOString();
  // Upsert và tăng opened_count thủ công (Supabase REST không có atomic increment dễ dàng)
  const { data: existing } = await supabase
    .from('history')
    .select('*')
    .eq('user_id', userId)
    .eq('series_id', seriesId)
    .maybeSingle();
  if (existing) {
    await supabase
      .from('history')
      .update({
        opened_count: (existing.opened_count ?? 1) + 1,
        last_opened_at: now,
      })
      .eq('user_id', userId)
      .eq('series_id', seriesId);
  } else {
    await supabase
      .from('history')
      .insert({ user_id: userId, series_id: seriesId, opened_count: 1, last_opened_at: now });
  }
}

export async function listHistory(): Promise<(HistoryRow & { series?: SeriesRow })[]> {
  const userId = getUserId();
  if (!userId) return [];
  const { data, error } = await supabase
    .from('history')
    .select('*, series:series(*)')
    .eq('user_id', userId)
    .order('last_opened_at', { ascending: false })
    .limit(20);
  if (error) throw error;
  return (data ?? []) as any;
}
