import { supabase } from './supabase';
import { getUserId } from './session';
import { getLocalProgress } from './tts';
import { workerJson } from './worker';

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
  content?: string;
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

function mapSeries(w: any): SeriesRow {
  return {
    id: w.id,
    title: w.title,
    author: w.author,
    description: w.description,
    cover_url: w.coverUrl ?? w.cover_url ?? '',
    status: w.status,
    genres: w.genres ?? [],
    tags: w.tags ?? [],
    word_count: w.wordCount ?? w.word_count ?? 0,
    updated_at: w.updatedAt ?? w.updated_at ?? '',
    created_at: w.createdAt ?? w.created_at ?? '',
  };
}
function mapChapter(w: any): ChapterRow {
  return {
    id: w.id,
    series_id: w.seriesId ?? w.series_id ?? '',
    order_no: w.orderNo ?? w.order_no ?? 0,
    title: w.title,
    content: w.content,
    status: w.status,
    word_count: w.wordCount ?? w.word_count ?? 0,
    published_at: w.publishedAt ?? w.published_at ?? null,
  };
}
function mapProgress(w: any): ProgressRow | null {
  if (!w) return null
  return {
    id: w.id,
    user_id: w.userId ?? w.user_id ?? '',
    series_id: w.seriesId ?? w.series_id ?? '',
    listen_chapter_id: w.listenChapterId ?? w.listen_chapter_id ?? null,
    listen_char_index: w.listenCharIndex ?? w.listen_char_index ?? 0,
    audio_sec: w.audioSec ?? w.audio_sec ?? 0,
    playback_speed: w.playbackSpeed ?? w.playback_speed ?? 1.0,
    last_listened_at: w.lastListenedAt ?? w.last_listened_at ?? null,
    read_chapter_id: w.readChapterId ?? w.read_chapter_id ?? null,
    read_char_index: w.readCharIndex ?? w.read_char_index ?? 0,
    read_percent: w.readPercent ?? w.read_percent ?? 0,
    last_read_at: w.lastReadAt ?? w.last_read_at ?? null,
  };
}

// ---------- Series (Worker primary, Supabase fallback) ----------
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
    search,
    genre,
    tag,
  } = opts ?? {};
  const sort = orderBy === 'title' ? 'title' : orderBy === 'word_count' ? 'chapters' : 'new';
  const sp = new URLSearchParams({
    limit: String(limit),
    offset: String(offset),
    status: status.join(','),
    sort,
  });
  if (search) sp.set('q', search);
  if (genre) sp.set('genre', genre);
  if (tag) sp.set('tag', tag);
  try {
    const j: any = await workerJson(`/api/series?${sp.toString()}`, { method: 'GET' });
    return (j.items ?? []).map(mapSeries);
  } catch {
    let q = supabase.from('series').select('*').in('status', status).range(offset, offset + limit - 1);
    if (orderBy === 'title') q = q.order('title', { ascending: false });
    else if (orderBy === 'word_count') q = q.order('word_count', { ascending: false });
    else q = q.order('updated_at', { ascending: false });
    if (search) q = q.or(`title.ilike.%${search}%,author.ilike.%${search}%`);
    if (genre) q = q.contains('genres', [genre]);
    if (tag) q = q.contains('tags', [tag]);
    const { data, error } = await q;
    if (error) throw error;
    return (data ?? []) as SeriesRow[];
  }
}

export async function getSeries(id: string): Promise<SeriesRow | null> {
  try {
    const j: any = await workerJson(`/api/series/${id}`, { method: 'GET' });
    if (!j?.id) return null;
    return mapSeries(j);
  } catch {
    const { data, error } = await supabase.from('series').select('*').eq('id', id).maybeSingle();
    if (error) throw error;
    return data as SeriesRow | null;
  }
}

export async function listChapters(seriesId: string): Promise<ChapterRow[]> {
  try {
    const j: any = await workerJson(`/api/series/${seriesId}/chapters`, { method: 'GET' });
    return (j.items ?? []).map(mapChapter);
  } catch {
    const { data, error } = await supabase
      .from('chapters')
      .select('id, series_id, order_no, title, status, word_count, published_at')
      .eq('series_id', seriesId)
      .eq('status', 'published')
      .order('order_no', { ascending: true });
    if (error) throw error;
    return (data ?? []) as ChapterRow[];
  }
}

// ---------- Progress (Worker primary, fallback local/supabase) ----------
export async function getProgress(seriesId: string): Promise<ProgressRow | null> {
  const userId = getUserId();
  if (!userId) {
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
  try {
    const j: any = await workerJson(`/api/progress?series_id=${seriesId}`, { method: 'GET' });
    if (j.progress) return mapProgress(j.progress);
  } catch {}
  try {
    const { data, error } = await supabase.from('progress').select('*').eq('user_id', userId).eq('series_id', seriesId).maybeSingle();
    if (error) throw error;
    return data as ProgressRow | null;
  } catch {
    return null;
  }
}

export async function listAllProgress(): Promise<(ProgressRow & { series?: SeriesRow })[]> {
  const userId = getUserId();
  if (!userId) return [];
  // Worker /api/continue-listening trả đủ series title/cover + chapter word_count
  // → "Tiếp tục nghe" hiển thị đúng (trước đây /api/progress/all không có series → rỗng).
  try {
    const j: any = await workerJson('/api/continue-listening', { method: 'GET' });
    const items = j.items ?? [];
    if (items.length > 0) {
      return items.map((it: any) => ({
        user_id: userId,
        series_id: it.seriesId,
        listen_chapter_id: it.chapterId ?? null,
        listen_char_index: it.listenCharIndex ?? 0,
        audio_sec: 0,
        playback_speed: it.playbackSpeed ?? 1.0,
        last_listened_at: it.lastListenedAt,
        read_chapter_id: null,
        read_char_index: 0,
        read_percent: it.percent ?? 0,
        last_read_at: null,
        series: {
          id: it.seriesId,
          title: it.title ?? '',
          author: '',
          description: '',
          cover_url: it.coverUrl ?? '',
          status: 'published',
          genres: [],
          tags: [],
          word_count: it.chapterWordCount ?? 0,
          updated_at: it.lastListenedAt ?? '',
          created_at: it.lastListenedAt ?? '',
        } as SeriesRow,
      }));
    }
  } catch {}
  try {
    const j: any = await workerJson('/api/progress/all', { method: 'GET' });
    const items = j.items ?? [];
    if (items.length > 0) {
      return items.map((it: any) => ({
        user_id: userId,
        series_id: it.seriesId,
        listen_chapter_id: it.listenChapterId,
        listen_char_index: it.listenCharIndex,
        audio_sec: 0,
        playback_speed: 1.0,
        last_listened_at: it.lastListenedAt,
        read_chapter_id: null,
        read_char_index: 0,
        read_percent: it.percent ?? 0,
        last_read_at: null,
        series: undefined,
      }));
    }
  } catch {}
  try {
    const { data, error } = await supabase
      .from('progress')
      .select('*, series:series(*)')
      .eq('user_id', userId)
      .not('listen_chapter_id', 'is', null)
      .order('last_listened_at', { ascending: false })
      .limit(20);
    if (error) throw error;
    return (data ?? []) as any;
  } catch {
    return [];
  }
}

// Ghi giờ nghe thực tế lên Worker (nuôi stats/streak/achievements cho mobile).
// Endpoint có sẵn: POST /api/stats/session (worker cap 600s/lần).
export async function saveSession(opts: { seriesId: string; chapterId?: string | null; durationSec: number }): Promise<void> {
  const userId = getUserId();
  if (!userId || !opts.seriesId || opts.durationSec <= 0) return;
  try {
    await workerJson('/api/stats/session', {
      method: 'POST',
      body: JSON.stringify({
        seriesId: opts.seriesId,
        chapterId: opts.chapterId ?? null,
        durationSec: Math.min(600, Math.max(1, Math.round(opts.durationSec))),
      }),
    });
  } catch {}
}

// Đồng bộ user_settings (theme, rate, font...) lên Worker.
export async function saveSettings(data: Record<string, unknown>): Promise<void> {
  try {
    await workerJson('/api/settings', { method: 'PUT', body: JSON.stringify(data) });
  } catch {}
}

// ---------- Bookmarks ----------
export type BookmarkRow = {
  id: string;
  seriesId: string;
  chapterId: string;
  charIndex: number;
  note: string;
  createdAt: string;
  series?: { id: string; title: string; coverUrl: string } | null;
};

export async function listBookmarks(): Promise<BookmarkRow[]> {
  const userId = getUserId();
  if (!userId) return [];
  try {
    const j: any = await workerJson('/api/bookmarks', { method: 'GET' });
    return (j.items ?? []).map((b: any) => ({
      id: b.id,
      seriesId: b.seriesId,
      chapterId: b.chapterId,
      charIndex: b.charIndex ?? 0,
      note: b.note ?? '',
      createdAt: b.createdAt ?? '',
      series: b.series ?? null,
    }));
  } catch {
    try {
      const { data, error } = await supabase.from('bookmarks').select('*').eq('user_id', userId).order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []).map((b: any) => ({
        id: b.id,
        seriesId: b.series_id,
        chapterId: b.chapter_id,
        charIndex: b.char_index ?? 0,
        note: b.note ?? '',
        createdAt: b.created_at ?? '',
        series: null,
      }));
    } catch {
      return [];
    }
  }
}

export async function createBookmark(opts: { seriesId: string; chapterId: string; charIndex: number; note?: string }): Promise<string | null> {
  const userId = getUserId();
  if (!userId) return null;
  try {
    const j: any = await workerJson('/api/bookmarks', {
      method: 'POST',
      body: JSON.stringify({
        seriesId: opts.seriesId,
        chapterId: opts.chapterId,
        charIndex: opts.charIndex,
        note: opts.note ?? '',
      }),
    });
    if (j?.id) return j.id as string;
  } catch {}
  try {
    const { data, error } = await supabase.from('bookmarks').insert({
      user_id: userId,
      series_id: opts.seriesId,
      chapter_id: opts.chapterId,
      char_index: opts.charIndex,
      note: opts.note ?? '',
    }).select('id').single();
    if (error) throw error;
    return data?.id ?? null;
  } catch {
    return null;
  }
}

export async function deleteBookmark(id: string): Promise<void> {
  const userId = getUserId();
  if (!userId) return;
  try {
    await workerJson(`/api/bookmarks/${id}`, { method: 'DELETE' });
  } catch {}
  try {
    await supabase.from('bookmarks').delete().eq('id', id).eq('user_id', userId);
  } catch {}
}

// ---------- Stats (Worker primary, fallback rỗng) ----------
export async function statsReading(): Promise<any> {
  try { return await workerJson('/api/stats/reading', { method: 'GET' }); } catch { return { stats: null }; }
}
export async function statsStreak(): Promise<any> {
  try { return await workerJson('/api/stats/streak', { method: 'GET' }); } catch { return { stats: null }; }
}
export async function statsAchievements(): Promise<any> {
  try { return await workerJson('/api/stats/achievements', { method: 'GET' }); } catch { return { achievements: [], summary: { unlocked: 0, total: 0, progress: 0 } }; }
}
export async function statsChallenge(): Promise<any> {
  try { return await workerJson('/api/stats/challenge', { method: 'GET' }); } catch { return { challenges: [], summary: { unlocked: 0, total: 0 } }; }
}
export async function statsHistory(): Promise<any> {
  try { return await workerJson('/api/stats/history', { method: 'GET' }); } catch { return { items: [] }; }
}

export async function saveListenProgress(opts: {
  seriesId: string;
  chapterId: string;
  charIndex: number;
  rate: number;
}): Promise<void> {
  const userId = getUserId();
  if (!userId) return;
  try {
    await workerJson('/api/progress', {
      method: 'PUT',
      body: JSON.stringify({
        seriesId: opts.seriesId,
        listenChapterId: opts.chapterId,
        listenCharIndex: opts.charIndex,
        playbackSpeed: opts.rate,
      }),
    });
  } catch {}
  try {
    await supabase.from('progress').upsert({
      user_id: userId,
      series_id: opts.seriesId,
      listen_chapter_id: opts.chapterId,
      listen_char_index: opts.charIndex,
      audio_sec: 0,
      playback_speed: opts.rate,
      last_listened_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,series_id' });
  } catch {}
}

// ---------- Favorites (Worker primary, Supabase fallback) ----------
export async function listFavorites(): Promise<(FavoriteRow & { series?: SeriesRow })[]> {
  const userId = getUserId();
  if (!userId) return [];
  try {
    const j: any = await workerJson('/api/favorites', { method: 'GET' });
    const items = j.items ?? [];
    if (items.length > 0) {
      return items.map((s: any) => ({
        user_id: userId,
        series_id: s.id,
        created_at: s.favoritedAt ?? s.updatedAt ?? '',
        series: mapSeries(s),
      }));
    }
  } catch {}
  try {
    const { data, error } = await supabase.from('favorites').select('*, series:series(*)').eq('user_id', userId).order('created_at', { ascending: false });
    if (error) throw error;
    return (data ?? []) as any;
  } catch {
    return [];
  }
}

export async function isFavorite(seriesId: string): Promise<boolean> {
  const userId = getUserId();
  if (!userId) return false;
  try {
    const j: any = await workerJson('/api/favorites', { method: 'GET' });
    const items = j.items ?? [];
    if (items.some((s: any) => s.id === seriesId)) return true;
    if (items.length > 0) return false;
  } catch {}
  try {
    const { data, error } = await supabase.from('favorites').select('series_id').eq('user_id', userId).eq('series_id', seriesId).maybeSingle();
    if (error) return false;
    return !!data;
  } catch {
    return false;
  }
}

export async function toggleFavorite(seriesId: string, favorite: boolean): Promise<void> {
  const userId = getUserId();
  if (!userId) throw new Error('Cần đăng nhập để lưu yêu thích');
  try {
    await workerJson('/api/favorites', { method: 'POST', body: JSON.stringify({ seriesId }) });
    return;
  } catch {}
  if (favorite) {
    const { error } = await supabase.from('favorites').upsert({ user_id: userId, series_id: seriesId, created_at: new Date().toISOString() }, { onConflict: 'user_id,series_id' });
    if (error) throw error;
  } else {
    const { error } = await supabase.from('favorites').delete().eq('user_id', userId).eq('series_id', seriesId);
    if (error) throw error;
  }
}

// ---------- History (Worker primary, Supabase fallback) ----------
export async function recordHistory(seriesId: string): Promise<void> {
  const userId = getUserId();
  if (!userId) return;
  try {
    await workerJson('/api/history', { method: 'POST', body: JSON.stringify({ seriesId }) });
  } catch {}
  try {
    const now = new Date().toISOString();
    const { data: existing } = await supabase.from('history').select('*').eq('user_id', userId).eq('series_id', seriesId).maybeSingle();
    if (existing) {
      await supabase.from('history').update({ opened_count: (existing.opened_count ?? 1) + 1, last_opened_at: now }).eq('user_id', userId).eq('series_id', seriesId);
    } else {
      await supabase.from('history').insert({ user_id: userId, series_id: seriesId, opened_count: 1, last_opened_at: now });
    }
  } catch {}
}

export async function listHistory(): Promise<(HistoryRow & { series?: SeriesRow })[]> {
  const userId = getUserId();
  if (!userId) return [];
  try {
    const j: any = await workerJson('/api/history', { method: 'GET' });
    const items = j.items ?? [];
    if (items.length > 0) {
      return items.map((s: any) => ({
        user_id: userId,
        series_id: s.id,
        opened_count: s.openedCount ?? 1,
        last_opened_at: s.lastOpenedAt ?? s.updatedAt ?? '',
        series: mapSeries(s),
      }));
    }
  } catch {}
  try {
    const { data, error } = await supabase.from('history').select('*, series:series(*)').eq('user_id', userId).order('last_opened_at', { ascending: false }).limit(20);
    if (error) throw error;
    return (data ?? []) as any;
  } catch {
    return [];
  }
}
