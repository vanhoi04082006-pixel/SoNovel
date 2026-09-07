import AsyncStorage from '@react-native-async-storage/async-storage';
import { workerJson } from './worker';
import { withCache, DEFAULT_TTL_MS } from './dataCache';

const META_PREFIX = 'sonovel.illustMeta.';
const META_TTL_MS = 24 * 60 * 60 * 1000; // 1 ngày — list hiện ngay cả khi offline

export type IllustrationRow = {
  id: string;
  imageUrl: string;
  thumbUrl: string;
  groupName: string;
  width: number;
  height: number;
  caption: string;
  orderNo: number;
};

type IllustrationsResponse = {
  items: Array<{ id: string; imageUrl: string; thumbUrl?: string; groupName?: string; width?: number; height?: number; caption: string; orderNo: number }>;
};

function mapRows(items: IllustrationsResponse['items']): IllustrationRow[] {
  return (items ?? []).map((it) => ({
    id: it.id,
    imageUrl: it.imageUrl,
    thumbUrl: it.thumbUrl || it.imageUrl,
    groupName: (it.groupName || '').trim(),
    width: it.width || 0,
    height: it.height || 0,
    caption: it.caption || '',
    orderNo: it.orderNo ?? 0,
  }));
}

export type IllustSection = { title: string | null; rows: { it: IllustrationRow; idx: number }[] };

/** Gom ảnh theo mục (giữ thứ tự): mục xếp theo ảnh đầu tiên của nó. */
export function groupIllustrations(items: IllustrationRow[]): IllustSection[] {
  const order: string[] = [];
  const map = new Map<string, { it: IllustrationRow; idx: number }[]>();
  items.forEach((it, idx) => {
    const g = it.groupName;
    if (!map.has(g)) { map.set(g, []); order.push(g); }
    map.get(g)!.push({ it, idx });
  });
  order.sort((a, b) => (a === '' ? -1 : b === '' ? 1 : 0));
  return order.map((g) => ({
    title: g === '' ? (order.length > 1 ? 'Ảnh chung' : null) : g,
    rows: map.get(g)!,
  }));
}

async function readMetaCache(seriesId: string): Promise<IllustrationRow[] | null> {
  try {
    const raw = await AsyncStorage.getItem(META_PREFIX + seriesId);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { at: number; items: IllustrationRow[] };
    if (!parsed || Date.now() - parsed.at > META_TTL_MS) return null;
    return parsed.items;
  } catch {
    return null;
  }
}

/** Danh sách ảnh minh họa của 1 bộ truyện (public, sắp theo order_no). */
export async function getIllustrations(seriesId: string): Promise<IllustrationRow[]> {
  return withCache(`illust:${seriesId}`, DEFAULT_TTL_MS, async () => {
    try {
      const j = await workerJson<IllustrationsResponse>(
        `/api/series/${encodeURIComponent(seriesId)}/illustrations`,
        { method: 'GET' }
      );
      const rows = mapRows(j.items);
      try {
        await AsyncStorage.setItem(META_PREFIX + seriesId, JSON.stringify({ at: Date.now(), items: rows }));
      } catch {}
      return rows;
    } catch (e) {
      // Mất mạng → trả metadata đã lưu để tab vẫn hiện list + ảnh từ disk cache
      const cached = await readMetaCache(seriesId);
      if (cached) return cached;
      throw e;
    }
  });
}
