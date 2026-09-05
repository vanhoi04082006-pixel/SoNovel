import { workerJson } from './worker';
import { withCache, DEFAULT_TTL_MS } from './dataCache';

export type IllustrationRow = {
  id: string;
  imageUrl: string;
  caption: string;
  orderNo: number;
};

type IllustrationsResponse = {
  items: Array<{ id: string; imageUrl: string; caption: string; orderNo: number }>;
};

/** Danh sách ảnh minh họa của 1 bộ truyện (public, sắp theo order_no). */
export async function getIllustrations(seriesId: string): Promise<IllustrationRow[]> {
  return withCache(`illust:${seriesId}`, DEFAULT_TTL_MS, async () => {
    const j = await workerJson<IllustrationsResponse>(
      `/api/series/${encodeURIComponent(seriesId)}/illustrations`,
      { method: 'GET' }
    );
    return (j.items ?? []).map((it) => ({
      id: it.id,
      imageUrl: it.imageUrl,
      caption: it.caption || '',
      orderNo: it.orderNo ?? 0,
    }));
  });
}
